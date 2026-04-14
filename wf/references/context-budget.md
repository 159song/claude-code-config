# 上下文预算管理

## 概述

Context window 是有限资源。每次读取文件、执行命令、调用 agent 都消耗 context。预算管理的目标是在 context 耗尽之前完成有意义的工作单元。

**核心策略:** 依赖 CONTINUATION.md 检查点 + Claude Code auto-compact 实现跨 context 无缝恢复，而非硬停暂停。

## 预算阈值

`wf-context-monitor` hook 在每次工具调用后检查 context 使用率，按以下阈值触发响应：

| 使用率 | 剩余比例 | 级别 | 行为 |
|--------|----------|------|------|
| < 70% | > 30% | 正常 | 无限制，自由执行 |
| 70% | 30% | WARNING | Hook 注入警告，建议确保 CONTINUATION.md 检查点已写入 |
| 70-85% | 15-30% | WARNING | 继续执行，auto-compact 会在需要时自动压缩 |
| 85% | 15% | CRITICAL | Hook 注入严重警告，确认检查点已就绪 |
| > 85% | < 15% | CRITICAL | auto-compact 即将触发，检查点确保恢复 |

**防抖机制:** 同级别警告至少间隔 60 秒触发一次，避免高频工具调用时警告刷屏。级别升级（WARNING -> CRITICAL）立即触发，不受防抖限制。

**与 auto-compact 的协作:**
- CLAUDE.md 中的 compact instructions 指示 auto-compact 保留 CONTINUATION.md 内容
- auto-compact 后，Claude 自动读取 CONTINUATION.md 并从记录位置恢复
- 不再需要手动启动新会话

## 自治模式预算

自治模式（`/wf-autonomous`）连续执行多个阶段，context 消耗更快。预算规则：

- **每阶段周期** 大约消耗 30-50% context（含规划 + 执行 + 验证）
- **每个步骤前** 写入 CONTINUATION.md 检查点，确保 auto-compact 后能恢复
- **多 wave 执行** 每个 wave 的 executor agent 独立消耗 context（worktree 隔离），但 orchestrator 的 context 持续累积
- **Smoke-only 验证** 自主模式默认使用 `--smoke` 跳过对话式 UAT，节省 context

### 自治模式决策树

```
used < 70%   -> 正常继续，写入检查点
used 70-85%  -> 继续执行 + 检查点已就绪，trust auto-compact
used > 85%   -> 继续执行，auto-compact 即将触发，检查点确保无缝恢复
验证二次失败  -> 唯一硬停条件，暂停等待用户
阻塞问题      -> 暂停等待用户
```

> **不再有硬停阈值。** 唯一停止执行的条件是验证二次失败或阻塞问题，不是 context 使用率。

## 每任务预算参考

不同类型的任务消耗 context 差异显著：

| 任务类型 | 文件数 | 预估 context 消耗 |
|----------|--------|-------------------|
| 单文件修改 | 1-2 | 3-5% |
| 多文件功能实现 | 3-5 | 8-15% |
| 跨模块重构 | 5-10 | 15-25% |
| 带研究的新功能 | 3-5 + 调研 | 20-30% |

**影响因素:**
- 文件行数：大文件读取消耗更多 context
- 调试循环：每次失败重试约消耗 3-5% 额外 context
- Agent 调用：每次 Task() 调用约消耗 10-20% context（独立 context）

## 节省技巧

### 会话间优化

- **auto-compact:** 依赖 CONTINUATION.md + compact instructions 自动恢复，无需手动 `/clear`
- **小计划优先:** 每个 PLAN.md 限制 2-3 个任务，确保单次 context 窗口能完成
- **CLI 查询替代读取:** 用 `wf-tools state` 和 `wf-tools roadmap` 获取状态，避免读取大文件

### 执行中优化

- **精确读取:** 只读取任务 `read_first` 指定的文件，不要探索性读取
- **避免重复读取:** 已读取的文件内容在 context 中，不需要再次读取
- **批量操作:** 多个独立的小修改合并到一次 Edit 调用中
- **及时 commit:** 完成任务立即 commit，减少需要跟踪的变更状态

### 规划阶段优化

- **CONTEXT.md 压缩:** 讨论阶段的产出压缩到 CONTEXT.md，后续阶段只需读取这一个文件
- **研究报告精简:** RESEARCH.md 控制在 300 行以内，提取关键发现而非原始数据
- **引用而非内联:** 计划中引用文件路径，而非将文件内容内联到计划中

## CONTINUATION.md 检查点

### 格式

```markdown
---
phase: {N}
step: begin|discuss|plan|execute|verify
flags: "{原始 flags}"
remaining_phases: [{N}, {N+1}, ...]
last_result: null|PASS|FAIL
timestamp: {ISO 8601}
---

# WF Autonomous Continuation

恢复指令：读取此文件，跳转到 Phase {N} 的 {step} 步骤继续执行。
```

### 生命周期

1. **创建:** 自主模式每个步骤开始前写入/更新
2. **读取:** 新会话启动时由 wf-session-state hook 检测，或 auto-compact 恢复后读取
3. **删除:** 所有阶段执行完成后自动删除

## 监控机制

### wf-context-monitor hook

- **触发时机:** PostToolUse（Bash|Edit|Write|MultiEdit|Agent|Task）
- **数据来源:** `/tmp/claude-ctx-{session_id}.json`（由 statusline hook 写入）
- **刷新频率:** 每次工具调用后读取最新指标
- **过期阈值:** 指标超过 60 秒未更新时忽略（避免使用过期数据）
- **CONTINUATION 感知:** 检测 CONTINUATION.md 存在，调整警告措辞

### 手动检查

状态栏（statusline）持续显示 context 使用率。如果需要精确数值：

```bash
cat /tmp/claude-ctx-*.json | node -e "
  let d='';process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    const m=JSON.parse(d);
    console.log('Used:', m.used_pct+'%', 'Remaining:', m.remaining_percentage+'%');
  })
"
```

## 配置

在 `.planning/config.json` 中可以禁用 context 警告（不推荐）：

```json
{
  "hooks": {
    "context_warnings": false
  }
}
```
