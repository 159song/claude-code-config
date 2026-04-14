# WF 工作流系统 — 架构文档

## 概述

WF 是一套 Claude Code 结构化项目管理系统，采用**事件驱动 + 状态机 + 多智能体**架构。核心设计理念：用 Markdown 文件作为状态存储，用 CLI 工具作为状态变更的唯一入口，用 Hooks 实现运行时监控，用 Agents 实现并行任务执行。

**核心价值：** 让 Claude Code 在任何项目中都能按照结构化工作流高效推进，同时保持低 context 消耗和高可靠性。

---

## 1. 分层架构

```
┌─────────────────────────────────────────────────────────┐
│                   入口路由层 (16个命令)                    │
│        commands/wf/ — 解析用户意图，分发到工作流            │
├─────────────────────────────────────────────────────────┤
│                 工作流编排层 (15个工作流)                   │
│     wf/workflows/ — discuss→plan→execute→verify 流程     │
├─────────────────────────────────────────────────────────┤
│                 智能体执行层 (6个 Agent)                   │
│  agents/wf-*.md — planner/executor/verifier/researcher   │
│                   /roadmapper/reviewer                   │
├─────────────────────────────────────────────────────────┤
│                   状态管理层                               │
│  .planning/ — PROJECT/REQUIREMENTS/ROADMAP/STATE + 产物   │
├─────────────────────────────────────────────────────────┤
│                 运行时监控层 (4个 Hook)                    │
│  hooks/wf-*.js — session/guard/monitor/statusline        │
├─────────────────────────────────────────────────────────┤
│                   参考配置层                               │
│  wf/references/ + wf/templates/ — 门/验证模型/UI/配置      │
└─────────────────────────────────────────────────────────┘
```

| 层级 | 位置 | 职责 |
|------|------|------|
| 入口路由层 | `commands/wf/` | 解析用户意图，分发到对应工作流 |
| 工作流编排层 | `wf/workflows/` | 定义 discuss→plan→execute→verify 流程逻辑 |
| 智能体执行层 | `agents/wf-*.md` | 6个专业 agent 的任务执行 |
| 状态管理层 | `.planning/` | 项目状态、需求、路线图、阶段产物 |
| 运行时监控层 | `hooks/wf-*.js` | session状态/注入防护/context预算/状态栏 |
| 参考配置层 | `wf/references/` + `wf/templates/` | 质量门/验证模型/UI规范/默认配置 |

---

## 2. 命令体系

### 2.1 核心阶段管道

```
/wf-discuss-phase N  →  /wf-plan-phase N  →  /wf-execute-phase N  →  /wf-verify-work
     (--chain)              (--chain)              (--chain)
```

### 2.2 完整命令清单 (16个)

#### 核心阶段命令

| 命令 | 用途 | 参数 |
|------|------|------|
| `wf-discuss-phase` | 阶段讨论（灰色地带决策） | `N --auto --chain --batch` |
| `wf-plan-phase` | 生成执行计划（带质量门） | `N --chain --skip-research` |
| `wf-execute-phase` | 波次并行执行 | `N --wave N --interactive --chain` |
| `wf-verify-work` | 用户验收测试 (UAT) | `--smoke` |

#### 项目与里程碑命令

| 命令 | 用途 | 参数 |
|------|------|------|
| `wf-new-project` | 项目初始化 (5问题→研究→需求→路线图) | `--auto` |
| `wf-new-milestone` | 新里程碑初始化 | `[version]` |
| `wf-complete-milestone` | 里程碑归档 + git tag | `[version]` |

#### 自动化与便捷命令

| 命令 | 用途 | 参数 |
|------|------|------|
| `wf-do` | 自然语言意图路由 | `<描述>` |
| `wf-autonomous` | 全自动模式（遍历所有阶段） | `--from N --to N --only N --interactive` |
| `wf-next` | 自动检测并路由到下一步 | 无参数 |
| `wf-quick` | 快速任务（阶段外） | `<任务> --full --validate --discuss --research` |

#### 会话与工具命令

| 命令 | 用途 | 参数 |
|------|------|------|
| `wf-pause` | 保存断点检查点 | 无参数 |
| `wf-resume` | 从检查点恢复 | 无参数 |
| `wf-progress` | 进度仪表板 + 智能路由 | 无参数 |
| `wf-code-review` | 代码质量审查（自动修复） | `<phase> --depth --files` |
| `wf-settings` | 查看/修改工作流配置 | `[set key value]` |

### 2.3 命令链与交互

```
线性管道:
  discuss → plan → execute → verify (每步可 --chain 自动链接)

自动多阶段:
  autonomous --from N --to M
    └─ 对每个阶段循环: discuss → plan → execute → verify

项目生命周期:
  new-project → discuss 1 → [...执行阶段...] → complete-milestone → new-milestone

会话管理:
  任意状态 → pause → [会话中断] → resume → 自动路由到下一步

快速任务:
  quick "描述" [flags] → 规划并执行 (在阶段系统之外)

智能路由:
  progress → 显示状态 → next → 路由到 discuss/plan/execute/verify
```

---

## 3. 智能体协作模型

### 3.1 六个 Agent 及职责

| Agent | 文件 | 职责 | 模型默认 |
|-------|------|------|----------|
| **wf-researcher** | `agents/wf-researcher.md` | 技术调研（tech stack/功能/架构/风险） | haiku |
| **wf-roadmapper** | `agents/wf-roadmapper.md` | 路线图设计（阶段划分 + 需求映射） | haiku |
| **wf-planner** | `agents/wf-planner.md` | 计划生成（任务分解 + 波次分组） | sonnet |
| **wf-executor** | `agents/wf-executor.md` | 任务执行（逐任务执行 + git commit） | sonnet |
| **wf-verifier** | `agents/wf-verifier.md` | 目标验证（4级渐进验证模型） | sonnet |
| **wf-reviewer** | `agents/wf-reviewer.md` | 代码审查（4维度 + 持久化 issue 跟踪） | sonnet |

### 3.2 调用层次

```
主编排器 (Main Session)
  │
  ├─ wf-researcher ×4      (并行, 仅 /wf-new-project)
  │
  ├─ wf-roadmapper ×1      (顺序, 在 researcher 之后)
  │
  ├─ wf-researcher ×1      (可选, /wf-discuss-phase 或 /wf-plan-phase)
  │
  ├─ wf-planner ×1         (顺序, /wf-plan-phase)
  │
  ├─ wf-executor ×N        (按波次并行, 每 executor 使用独立 git worktree)
  │
  ├─ wf-verifier ×1        (顺序, 执行后验证)
  │
  ├─ wf-reviewer ×1        (顺序, /wf-code-review)
  │
  └─ wf-executor ×1        (顺序, code-review 自动修复)
```

### 3.3 协作机制

Agent 之间**不直接调用**，通过 `.planning/` 下的**不可变产物文件**进行协调：

```
wf-researcher  写入 → RESEARCH.md
wf-roadmapper  读取 ← researcher 输出, 写入 → ROADMAP.md
wf-planner     读取 ← CONTEXT.md + REQUIREMENTS.md, 写入 → PLAN.md
wf-executor    读取 ← PLAN.md, 写入 → SUMMARY.md + git commits
wf-verifier    读取 ← SUMMARY.md + PLAN.md, 写入 → VERIFICATION.md
wf-reviewer    读取 ← source files, 写入 → REVIEW.md
```

### 3.4 统一输出契约

所有 Agent 必须返回 JSON 完成标记：

```json
{
  "status": "complete|partial|failed",
  "artifacts": [".planning/phase-N/SUMMARY.md"],
  "summary": "简要描述"
}
```

- `complete` → 继续下一步
- `partial` → 记录断点，通知用户可恢复
- `failed` → 重试一次（附失败摘要），第二次失败则停止

---

## 4. 状态机与阶段生命周期

### 4.1 阶段状态流转

```
┌────────────────────────────────────────────────────┐
│                  NOT STARTED                        │
│  (无 CONTEXT.md / PLAN.md / SUMMARY.md)            │
└──────────┬─────────────────────────────────────────┘
           │ /wf-discuss-phase N
           ↓
┌────────────────────────────────────────────────────┐
│                    DISCUSS                          │
│  产出: CONTEXT.md (决策锁定), DISCUSSION-LOG.md     │
└──────────┬─────────────────────────────────────────┘
           │ /wf-plan-phase N
           ↓
┌────────────────────────────────────────────────────┐
│                     PLAN                            │
│  产出: PLAN.md (或 PLAN-A/B.md)                     │
│  质量门: 覆盖率>=90%, 无循环依赖, 任务完整           │
│  安全门: OWASP Top 10 威胁建模 (可选)               │
└──────────┬─────────────────────────────────────────┘
           │ /wf-execute-phase N
           ↓
┌────────────────────────────────────────────────────┐
│                   EXECUTE                           │
│  按波次并行: Wave 1 → Wave 2 → Wave 3              │
│  每波内: executor ×N (git worktree 隔离)            │
│  产出: SUMMARY.md + 每任务 git commit               │
└──────────┬─────────────────────────────────────────┘
           │ /wf-verify-work
           ↓
┌────────────────────────────────────────────────────┐
│                   VERIFY                            │
│  Smoke Test → Code Review → UAT 对话 → Gap Closure  │
│  产出: VERIFICATION.md, UAT.md                      │
├──────────┬──────────────┬──────────────────────────┘
│          │              │
│  PASS ✅ │  WARN ⚠️     │  FAIL ❌
│  进入下阶段│  Gap Closure │  暂停 (不跳过)
│          │  重试1次      │
```

### 4.2 四级渐进验证模型

| 级别 | 名称 | 检查内容 |
|------|------|----------|
| L1 | **EXISTS** | 文件存在于文件系统 |
| L2 | **SUBSTANTIVE** | 有实质实现（非 TODO/占位符，>阈值行数） |
| L3 | **WIRED** | 模块正确集成（import/export 连通，路由注册） |
| L4 | **DATA-FLOWING** | 端到端数据流通（测试通过，用户输入→处理→存储→响应） |

**Key Link 示例：**
```
Key Link: 用户注册流程
  Entry:      src/pages/register.tsx
  Validation: src/lib/validators.ts
  Storage:    src/lib/db/users.ts
  Exit:       src/api/auth/register.ts

  EXISTS:       ✅ 4个文件全部存在
  SUBSTANTIVE:  ✅ 均 >5 行实现代码
  WIRED:        ⚠️ register 页面尚未被路由引用
  DATA-FLOWING: ❌ validators.ts 有 TODO 待完成
```

### 4.3 里程碑生命周期

```
/wf-new-project
  └─ PROJECT.md + REQUIREMENTS.md + ROADMAP.md + STATE.md
      │
      ↓ 执行所有阶段 (discuss→plan→execute→verify × N)
      │
/wf-complete-milestone v1.0
  ├─ 归档到 .planning/milestones/v1.0/
  ├─ 创建 git tag v1.0
  └─ 重置 STATE.md
      │
      ↓ (可选自动链接)
      │
/wf-new-milestone v1.1
  └─ 阶段编号从 1 重新开始 (D-08 规则)
```

### 4.4 会话检查点

```json
// HANDOFF.json (恰好7个字段)
{
  "phase": 3,
  "plan": 1,
  "step": "execute",
  "stopped_at": "Context budget 78%, Task 2.1 pending",
  "resume_command": "/wf-resume",
  "git_branch": "main",
  "timestamp": "2026-04-14T10:00:00Z"
}
```

`/wf-pause` 保存 → 新会话 → `/wf-resume` 读取并自动路由 → 成功后清理 HANDOFF.json。

---

## 5. 运行时基础设施

### 5.1 Hooks 系统

| Hook | 事件 | 文件 | 职责 | 超时 |
|------|------|------|------|------|
| SessionStart | 会话启动 | `wf-session-state.js` | 注入项目状态摘要 + 断点恢复提示 | 10s |
| PreToolUse | Write/Edit 前 | `wf-prompt-guard.js` | 检测29种注入模式（仅告警不阻断） | 5s |
| PostToolUse | Bash/Edit/Write/Agent/Task 后 | `wf-context-monitor.js` | context预算监控 + 去抖 | 10s |
| StatusLine | 持续 | `wf-statusline.js` | `WF │ Model │ Task │ ██░░ 47%` | N/A |

#### Context 预算监控链

```
wf-statusline.js (持续)
  ├─ 读取 Claude Code context window 数据
  ├─ 计算 used_pct (扣除16.5%自动压缩缓冲)
  ├─ 写入 /tmp/claude-ctx-{session_id}.json (桥接文件)
  └─ 显示彩色进度条 (绿<50% / 黄50-65% / 橙65-80% / 红>80%)

wf-context-monitor.js (PostToolUse)
  ├─ 读取桥接文件 (60秒过期保护)
  ├─ WARNING: 剩余 ≤35% → 建议收尾当前任务
  ├─ CRITICAL: 剩余 ≤25% → 建议立即保存状态
  └─ 去抖机制: 同级别告警间隔5次工具调用

wf-executor (Agent 内部)
  ├─ 任务间检查桥接文件
  ├─ 使用率 ≥70% → 生成 partial SUMMARY.md
  └─ 返回 "partial" 状态支持恢复
```

### 5.2 CLI 工具 (`wf/bin/wf-tools.cjs`)

命令路由器，分发到 `lib/` 下各模块：

| 子命令 | 职责 |
|--------|------|
| `init` | 初始化项目 |
| `state` | 查询/修改 STATE.md（**唯一写入入口**） |
| `roadmap` | 分析路线图结构 |
| `phase` | 获取阶段信息 |
| `progress` | 计算进度指标 |
| `commit` | Git 操作封装 |
| `config` | 读写 config.json |
| `validate` | 验证产物完整性 |
| `session` | 暂停/恢复检查点 |
| `review` | 代码审查文件范围计算 |
| `milestone` | 里程碑归档/重置 |

---

## 6. 状态管理 — 产物文件结构

### 6.1 目录布局

```
.planning/
├── PROJECT.md                  # 项目元数据 (跨里程碑持久)
├── REQUIREMENTS.md             # 需求追溯 (FR-N / NFR-N)
├── ROADMAP.md                  # 阶段定义 + 依赖关系
├── STATE.md                    # 执行状态 (仅 CLI 可写)
├── config.json                 # 工作流配置
├── UAT.md                      # 累积验收状态
├── HANDOFF.json                # 暂停检查点 (临时)
│
├── phase-{N}/                  # 每阶段产物
│   ├── CONTEXT.md              # 决策记录 (discuss 产出, 锁定)
│   ├── DISCUSSION-LOG.md       # 讨论过程记录
│   ├── RESEARCH.md             # 实现调研 (plan 输入)
│   ├── PLAN.md                 # 任务分解 (plan 产出, 锁定)
│   ├── PLAN-B.md               # (大项目多文件)
│   ├── THREAT-MODEL.md         # 安全威胁模型 (可选)
│   ├── SUMMARY.md              # 执行日志 (execute 产出)
│   ├── VERIFICATION.md         # 4级验证结果 (verify 产出)
│   ├── REVIEW.md               # 代码审查发现
│   └── gap-closure-PLAN.md     # 验证失败时自动生成
│
├── quick/                      # 快速任务产物 (阶段外)
│
└── milestones/                 # 里程碑归档
    └── v1.0/
        ├── v1.0-ROADMAP.md
        ├── v1.0-REQUIREMENTS.md
        ├── v1.0-STATE.md
        └── phase-{N}/
```

### 6.2 产物所有权与不可变性

| 产物 | 创建者 | 不可变? | 备注 |
|------|--------|---------|------|
| PROJECT.md | new-project | 初始化后锁定 | complete-milestone 可追加记录 |
| REQUIREMENTS.md | new-project / new-milestone | discuss 后锁定 | — |
| ROADMAP.md | wf-roadmapper | plan-phase 1 后锁定 | 阶段顺序不可变 |
| STATE.md | 编排器 | **持续更新** | 仅通过 wf-tools CLI |
| CONTEXT.md | discuss-phase | **discuss 后锁定** | planner 不可修改用户决策 |
| PLAN.md | wf-planner | **plan 后锁定** | executor 不可修改任务结构 |
| SUMMARY.md | wf-executor | 可追加 | 支持 partial → complete 恢复 |
| VERIFICATION.md | wf-verifier | 每次验证覆盖 | — |
| REVIEW.md | wf-reviewer | 每轮迭代覆盖 | CR-XX ID 跨迭代持久 |

---

## 7. 质量门与安全约束

### 7.1 硬门 (必须通过才能继续)

| 门 | 检查内容 | 重试限制 |
|----|----------|----------|
| 需求覆盖门 | PLAN.md 覆盖 ≥90% 阶段需求 | 3次修订 |
| 计划质量门 | 任务结构完整、无循环、波次合理 | 3次修订 |
| 验证门 | 4级验证模型 (EXISTS→SUBSTANTIVE→WIRED→DATA-FLOWING) | 1次 gap closure |
| 安全门 | OWASP Top 10 覆盖 (当 `security_enforcement: true`) | 随计划门 |

### 7.2 软门 (告警建议)

| 门 | 阈值 | 行为 |
|----|------|------|
| Context 预算门 | ≤35% WARNING / ≤25% CRITICAL | 注入告警消息 |
| 工作流追踪门 | 非计划编辑检测 | 建议使用 WF 工具 |
| Schema 漂移门 | 执行后 DB/API 变更 | 告警偏差 |

### 7.3 安全约束矩阵

| 约束 | 规则 ID | 说明 |
|------|---------|------|
| STATE.md 只读 | Phase 2 | 所有变更必须通过 `wf-tools state` CLI |
| CONTEXT.md 锁定 | — | discuss 后 planner 不可覆盖决策 |
| 不跳过失败阶段 | D-02 | 验证失败后最多1次 gap closure，不跳过 |
| Skill() 白名单 | T-05-02 | autonomous 仅可调用4个已知命令 |
| 输入验证 | T-05-01 | phase 必须正整数，step 必须在白名单 |
| 路径防护 | T-04-02 | session_id 防路径穿越攻击 |
| 注入检测 | — | 29种模式检测（仅告警不阻断） |
| Git 不可变 | T-06-14 | tag 仅创建不删除，commit 仅新建不 amend |

---

## 8. 配置系统

### 8.1 config.json 完整结构

```json
{
  "mode": "auto",
  "granularity": "standard",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": true,
    "security_enforcement": true,
    "discuss_mode": "auto",
    "code_review": true,
    "code_review_depth": "standard",
    "code_review_auto_fix": true,
    "code_review_max_iterations": 3
  },
  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_plan": false,
    "confirm_transition": false
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  },
  "agents": {
    "models": {
      "executor": "sonnet",
      "planner": "sonnet",
      "verifier": "sonnet",
      "researcher": "haiku",
      "roadmapper": "haiku"
    }
  }
}
```

### 8.2 settings.json Hook 绑定

```json
{
  "hooks": {
    "SessionStart": [{ "command": "node wf-session-state.js", "timeout": 10 }],
    "PreToolUse":   [{ "matcher": "Write|Edit", "command": "node wf-prompt-guard.js", "timeout": 5 }],
    "PostToolUse":  [{ "matcher": "Bash|Edit|Write|MultiEdit|Agent|Task", "command": "node wf-context-monitor.js", "timeout": 10 }]
  },
  "statusLine": { "command": "node wf-statusline.js" }
}
```

---

## 9. 典型使用路径

| 场景 | 命令序列 |
|------|----------|
| **全自动开发** | `/wf-new-project` → `/wf-autonomous` |
| **交互式逐阶段** | `discuss 1` → `plan 1` → `execute 1` → `verify` → 循环 |
| **快速修复** | `/wf-quick "修复登录Bug" --validate` |
| **中途暂停/恢复** | `/wf-pause` → 新会话 → `/wf-resume` |
| **里程碑切换** | `/wf-complete-milestone v1.0` → `/wf-new-milestone v1.1` |
| **状态检查** | `/wf-progress` → `/wf-next` (自动路由) |
| **仅执行某个阶段** | `/wf-autonomous --only 3` |
| **从指定阶段开始** | `/wf-autonomous --from 2 --to 4` |

---

## 10. 数据流全景

```
用户输入
  │
  ├─ /wf-new-project
  │   ├─ 5个问题 → PROJECT.md
  │   ├─ wf-researcher ×4 (并行) → research/SUMMARY.md
  │   ├─ 需求提取 → REQUIREMENTS.md
  │   ├─ wf-roadmapper → ROADMAP.md
  │   └─ 初始化 → STATE.md + config.json
  │
  ├─ /wf-discuss-phase N
  │   ├─ 读取 ROADMAP + REQUIREMENTS
  │   ├─ 识别灰色地带 → 决策讨论
  │   ├─ (可选) wf-researcher → 深度对比
  │   └─ 写入 → CONTEXT.md + DISCUSSION-LOG.md
  │
  ├─ /wf-plan-phase N
  │   ├─ 读取 CONTEXT + REQUIREMENTS + ROADMAP
  │   ├─ (可选) wf-researcher → RESEARCH.md
  │   ├─ wf-planner → PLAN.md (任务 + 波次)
  │   ├─ 质量门检查 (最多3次修订)
  │   └─ (可选) 安全门 → THREAT-MODEL.md
  │
  ├─ /wf-execute-phase N
  │   ├─ 解析 PLAN.md → 按波次分组
  │   ├─ 每波: wf-executor ×N (worktree 隔离)
  │   │   ├─ 逐任务: action → verify → git commit
  │   │   ├─ context 检查 (≥70% → partial SUMMARY)
  │   │   └─ 写入 → SUMMARY.md
  │   ├─ 波间: merge + 回归测试
  │   ├─ wf-verifier → VERIFICATION.md
  │   └─ 失败 → gap closure (1次重试)
  │
  └─ /wf-verify-work
      ├─ Smoke Test (自动)
      ├─ Code Review (可选, wf-reviewer)
      ├─ UAT 对话 (用户确认行为)
      ├─ 问题自动修复 (wf-executor)
      └─ 写入 → UAT.md + 更新 STATE.md
```

---

## 11. 设计原则

1. **Discuss→Plan→Execute→Verify 循环：** 每个阶段必须按序通过全部4步，不可跳过。

2. **自治与护栏并存：** autonomous 模式可全自动运行，但在 context 耗尽或验证失败时自动暂停（从不跳过）。

3. **CLI 是状态的唯一写入口：** STATE.md 从不被工作流或 Agent 直接写入，全部通过 `wf-tools state` 命令。

4. **计划质量门：** 最多3次修订循环，确保计划质量后再投入执行资源。

5. **Gap Closure：** 验证失败后自动尝试1次修复（生成新任务 + 重新验证），仍失败则暂停。

6. **跨会话检查点：** HANDOFF.json 记录 phase/step/plan，新会话可无缝恢复。

7. **里程碑内阶段编号独立：** 每个里程碑阶段编号从1开始（D-08 规则）。

8. **薄路由层：** `/wf-next` 和 `/wf-do` 是纯路由器，调用已有 Skill 不重复实现逻辑。

9. **Worktree 隔离：** 波次内并行执行使用独立 git worktree，合并前互不干扰。

10. **决策锁定：** `discuss-phase` 捕获的决策写入 CONTEXT.md 后锁定，下游 Agent 不可推翻。

---

## 12. 实现完成度

| 模块 | 文件数 | 状态 |
|------|--------|------|
| 命令层 | 16 | 完整 |
| 工作流层 | 15 | 完整 |
| Agent 层 | 6 | 完整 |
| Hooks 层 | 4 | 完整 |
| CLI 工具 | 12+ 模块 | 完整 |
| 参考文档 | 7 | 完整 |
| 模板 | 5 | 完整 |
| 配置集成 | 1 | 完整 |

WF 系统已是一套功能完备的结构化工作流引擎，覆盖从项目初始化到里程碑归档的完整生命周期。
