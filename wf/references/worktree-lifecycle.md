# Sub-Agent Worktree 生命周期

## 概述

WF 使用 Git worktree 隔离并行执行的 sub-agent，确保同一 wave 内的 executor agent 不会产生文件冲突。本文档描述 worktree 的完整生命周期。

## 生命周期阶段

```
创建 → Agent 执行 → 结果收集 → 合并 → 清理
```

### 1. 创建

由 Claude Code 的 `Agent({ isolation: "worktree" })` 自动创建。

- 时机：execute-phase workflow 派发 executor agent 时
- 位置：系统临时目录下的独立 checkout
- 分支：基于当前 HEAD 创建临时分支
- 内容：完整的 working copy，包含 `.planning/` 目录

```javascript
Agent({
  subagent_type: "wf-executor",
  isolation: "worktree",  // 触发 worktree 创建
  prompt: "..."
})
```

### 2. Agent 执行

Executor agent 在 worktree 中独立工作：

- 拥有独立的 context window（不消耗主 session context）
- 直接在 worktree 目录中读写文件
- 每个任务完成后在 worktree 中执行 `git commit`
- 可访问 `.planning/` 下的所有状态文件

**隔离保证：**
- 文件系统级隔离：worktree 是独立的目录
- Git 分支隔离：每个 worktree 在独立分支上 commit
- Context 隔离：sub-agent 不消耗主 session 的 context 预算

### 3. 结果收集

Agent 完成后（返回完成标记），orchestrator 在合并前收集：

- 完成标记 JSON（status/artifacts/summary）
- SUMMARY.md 内容
- 变更文件列表（`git diff --stat`）

渐进式收集：每个 agent 返回后立即处理，不等待同 wave 全部完成。

### 4. 合并

Worktree 中的 commits 合并回主分支：

| 情况 | 处理 |
|------|------|
| 无冲突 | 自动合并（fast-forward 或 merge commit） |
| 有冲突 | 展示冲突文件，请求用户决策 |
| Agent 失败 | 不合并，保留 worktree 供诊断 |

合并后执行回归检查：
- 构建是否通过
- 现有测试是否通过

### 5. 清理

Claude Code 自动管理 worktree 清理：

- **Agent 无变更时：** worktree 自动删除
- **Agent 有变更并成功合并：** 合并后自动清理
- **Agent 失败：** worktree 保留，路径和分支信息在结果中返回

手动清理（仅在自动清理失败时）：
```bash
git worktree list        # 查看所有 worktree
git worktree remove <path>  # 删除指定 worktree
git worktree prune       # 清理无效记录
```

## 并行约束

### 文件冲突预防

同一 wave 内的 plans 必须满足文件不冲突条件：

```
Plan A 修改: src/auth.ts, src/middleware.ts
Plan B 修改: src/models.ts, src/db.ts
→ 无重叠 → 可并行
```

如果检测到文件重叠，execute-phase 会回退到串行执行。

### 最大并发

受 `config.parallelization.max_concurrent_agents` 控制（默认 3）。超过上限时排队等待。

## 故障模式

| 故障 | 影响 | 恢复 |
|------|------|------|
| Agent context 耗尽 | 返回 partial SUMMARY.md | 下次执行时通过 `resume_from` 继续 |
| Worktree 创建失败 | Agent 无法启动 | 回退为串行执行（无 worktree） |
| 合并冲突 | 变更无法自动合并 | 手动解决冲突后重新合并 |
| Git 锁冲突 | 并行 worktree 操作失败 | 重试或减少 `max_concurrent_agents` |

## 与主 Session 的关系

```
主 Session (orchestrator)
├── 低 context 消耗：只派发和收集结果
├── 不加载实际代码文件
└── 管理 wave 进度和状态更新

Worktree Agent (executor)
├── 独立 context window
├── 加载代码文件并执行任务
├── 在自己的分支上 commit
└── 返回 JSON 完成标记
```

这种设计使得自主模式能跨多阶段运行：主 session 的 context 只用于编排，不被代码文件占据。
