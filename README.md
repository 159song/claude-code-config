# WF — Claude Code 结构化工作流系统

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14-brightgreen.svg)](https://nodejs.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-hooks%20%7C%20agents%20%7C%20commands-7C3AED.svg)](https://claude.ai/code)
[![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)](VERSION)

**WF** 是一套面向 [Claude Code](https://claude.ai/code) 的结构化项目管理系统。它为 Claude 提供了一条可重复的工作流——从需求到已验证的代码——通过专业化 Agent、质量门禁和基于 Wave 的并行执行实现。零外部依赖，纯 Node.js。

> 受 GSD 启发但独立设计。目标：让 Claude Code 在任何项目中都能可靠地交付真实功能，同时最小化 context 消耗。

---

## 最新动态

### v1.1.0 (2026-04-14)

- **CONTINUATION.md 检查点系统** — auto-compact 后跨 context 恢复
- **Compact 指令** — 跨 context 边界保留工作流状态
- **恢复降级链** — CONTINUATION.md -> HANDOFF.json -> STATE.md
- **故障排查指南** — 8 个常见场景及诊断方法
- **安装脚本** — 一条命令完成安装，智能合并 settings
- **烟雾验证** — EXISTS/SUBSTANTIVE/WIRED 级别检查

### v1.0.0 (2026-04-13)

- 核心工作流系统：25 个 Skill、7 个 Agent、4 个 Hook、16 个 Workflow（commands/wf/ 已全量迁至 skills/；P0 收敛：wf-next + wf-progress → wf-status）
- 基于 Wave 的并行执行 + git worktree 隔离
- 4 级验证模型（EXISTS → SUBSTANTIVE → WIRED → DATA-FLOWING）
- 自治模式，支持完整阶段链
- Context 预算监控，分级预警
- Prompt 注入防护（29 种模式）

完整历史见 [CHANGELOG.md](CHANGELOG.md)。

---

## 快速开始

### 安装

**一行远程安装**（推荐）：

```bash
# 项目级（默认）—— 装到当前项目的 .claude/
curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/install.sh | bash

# 用户级 —— 装到 $HOME/.claude/（全局可用）
curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/install.sh | bash -s -- --user

# 预览不写入
curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/install.sh | bash -s -- --dry-run
```

**本地 clone 后安装**：

```bash
git clone https://github.com/159song/claude-code-config.git
cd claude-code-config
./install.sh              # 项目级（默认）
./install.sh --user       # 用户级
./install.sh --dry-run    # 预览
./install.sh --uninstall  # 卸载
```

将命令、Agent、Hook、Workflow 和参考文档复制到目标 `.claude/` 目录，并智能合并 `settings.json`（你的现有配置会被保留）。

| Flag | 作用 |
|---|---|
| `--project` (默认) | 装到 `$(pwd)/.claude/`，作用于**当前项目** |
| `--user` | 装到 `$HOME/.claude/`，作用于**所有项目** |
| `--force` | 跳过版本检查，强制覆盖 |
| `--dry-run` | 打印计划但不写入任何文件 |
| `--uninstall` | 按当前 scope 卸载（保留用户自定义 settings 部分） |
| `--ref <branch>` | 远程安装时指定分支/tag（默认 `main`） |

> 旧入口 `./wf/bin/install.sh` 仍然可用（默认 **user**）。新入口 `./install.sh` 默认 **project**，契合"试试看"的一键场景。

### 验证

在 Claude Code 中打开任意项目，状态栏应显示：

```
WF │ opus │ idle │ ████████████████ 100%
```

### 开始一个项目

```
/wf-new-project
```

回答 5 个问题。WF 会启动 4 个并行研究 Agent，生成需求文档，并构建分阶段路线图。然后：

```
/wf-autonomous
```

WF 自动链式执行每个阶段：讨论 → 规划 → 执行 → 验证。每一步之前都会写入检查点，以便在 context 压缩后恢复。

---

## 核心概念

> 📊 完整的分层架构、双主流程（阶段驱动 / 变更驱动）、两轴交汇点以及优化清单，见 [`docs/workflow-diagram.md`](docs/workflow-diagram.md)。

### 阶段流水线

每个阶段经过 4 个步骤：

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│   讨论   │───>│   规划   │───>│   执行   │───>│   验证   │
│          │    │          │    │          │    │          │
│ 记录决策 │    │ 任务 +   │    │ 并行     │    │ 4 级     │
│          │    │ Wave 分组 │    │ Agent    │    │ 检查     │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
  CONTEXT.md      PLAN.md        SUMMARY.md    VERIFICATION.md
```

### 基于 Wave 的并行执行

计划将任务分组为 **Wave**。同一 Wave 内的任务没有相互依赖，通过子 Agent 并行执行，每个 Agent 在独立的 git worktree 中运行：

```
Wave 1: ──┬── 任务 1.1 (worktree) ──┐
          ├── 任务 1.2 (worktree) ──┤── 收集结果
          └── 任务 1.3 (worktree) ──┘
                                     ↓
Wave 2: ──┬── 任务 2.1 (worktree) ──┐
          └── 任务 2.2 (worktree) ──┤── 收集结果
                                     ↓
                                   完成
```

### 4 级验证

WF 不只是检查"任务跑了没？"——而是检查"目标达成了没？"

| 级别 | 名称 | 检查内容 |
|------|------|----------|
| 1 | **EXISTS** | 文件是否存在于磁盘 |
| 2 | **SUBSTANTIVE** | 是否有真实实现，而非占位符或 TODO |
| 3 | **WIRED** | 是否正确集成（import、路由、配置已连接） |
| 4 | **DATA-FLOWING** | 端到端数据路径是否通畅（输入 → 处理 → 存储 → 响应） |

```
验证结果 ─────────────────────────────
  EXISTS       ✅ 8/8
  SUBSTANTIVE  ✅ 7/8  ⚠️ 1
  WIRED        ✅ 6/8  ❌ 2
  DATA-FLOWING ✅ 5/8  ❌ 3
──────────────────────────────────────
```

失败会触发差距修复计划——WF 生成针对性修复并重新验证一次。

### 质量门禁

可配置的强制检查点：

| 门禁 | 类型 | 条件 |
|------|------|------|
| 需求覆盖 | 硬门禁 | PLAN 覆盖 >= 90% 的需求 |
| 计划质量 | 硬门禁 | 任务有 `files`、`action`、`verify` 字段；无循环依赖 |
| 验证 | 硬门禁 | 4 级检查中无 FAIL 结果 |
| 安全 | 硬门禁 | OWASP Top 10 威胁模型（启用时） |
| Context 预算 | 软门禁 | 剩余 30% 时 WARNING，15% 时 CRITICAL |
| 工作流追踪 | 软门禁 | 工作流外编辑时提示使用 `/wf-quick` |
| Schema 漂移 | 软门禁 | 提醒未迁移的 schema/API 变更 |

---

## 命令参考

### 阶段流水线

| 命令 | 用途 |
|------|------|
| `/wf-discuss-phase N` | 识别歧义，记录决策 → `CONTEXT.md` |
| `/wf-plan-phase N` | 生成带质量门禁的任务分解 → `PLAN.md` |
| `/wf-execute-phase N` | 基于 Wave 的并行执行 → `SUMMARY.md` |
| `/wf-verify-work` | UAT + 4 级验证 → `VERIFICATION.md` |

### 自动化

| 命令 | 用途 |
|------|------|
| `/wf-autonomous` | 端到端执行所有剩余阶段（主入口） |
| `/wf-do "<描述>"` | 自然语言意图 → 最佳匹配命令 |
| `/wf-status --auto-advance` | 智能状态检测 → 自动路由到正确步骤 |
| `/wf-quick "<描述>"` | 阶段体系外的快速任务 |

### 项目生命周期

| 命令 | 用途 |
|------|------|
| `/wf-new-project` | 初始化项目（5 个问题 → 研究 → 需求 → 路线图） |
| `/wf-new-milestone` | 开始新里程碑，重置阶段 |
| `/wf-complete-milestone` | 归档到 `milestones/`，创建 git tag，重置状态 |

### 会话管理

| 命令 | 用途 |
|------|------|
| `/wf-pause` | 保存检查点（`HANDOFF.json`） |
| `/wf-resume` | 从检查点恢复 + 自动路由 |
| `/wf-status` | 进度面板 + 智能路由建议（"下一步"触发词下自动推进） |

### 工具

| 命令 | 用途 |
|------|------|
| `/wf-code-review <phase>` | 代码质量审查，带迭代修复循环 |
| `/wf-settings` | 查看/修改工作流配置 |

### 规格空间（可选，Phase A）

WF 借鉴 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 的 Requirement/Scenario 模型，允许把需求以"按 capability 拆分的 spec"形式组织在 `.planning/specs/<capability>/spec.md`。默认关闭，通过 `config.spec.enabled = true` 启用。

```bash
wf-tools spec list                   # 列出所有 capability
wf-tools spec show <capability>      # 查看某 capability 的结构化 spec
wf-tools spec validate [--all]       # 校验 Purpose/Requirement/Scenario 结构与 WHEN/THEN 完整性
```

spec 文件格式参考 `wf/templates/spec.md`。启用后：
- `wf-roadmapper` 会在生成 ROADMAP.md 时同步生成初始 `specs/<capability>/spec.md`
- `wf-verifier` 在 `spec.verifier_use_scenarios = true` 时追加基于 scenario 的反推验证

### 变更提议（Phase B）

在规格空间之上引入 OpenSpec 风格的变更生命周期：`.planning/changes/<id>/` 承载独立的变更提议包，含 `proposal.md / tasks.md / specs/<cap>/spec.md delta`，归档时合并进主干 `specs/`。

Delta 语法（二级标题）：
- `## ADDED Requirements` — 新增 requirement（追加）
- `## MODIFIED Requirements` — 整块替换已存在的 requirement
- `## REMOVED Requirements` — 按 header 删除
- `## RENAMED Requirements` — 改名，body 可选替换

| 命令 | 用途 |
|------|------|
| `/wf-propose <idea>` | 委托 `wf-proposer` 产出完整 change 包 |
| `/wf-validate-spec <change-id\|--all>` | 校验 delta 语法 + 与主 spec 的语义一致性 |
| `/wf-apply-change <id>` | 基于 `tasks.md` 让 `wf-executor` 实现代码 |
| `/wf-archive-change <id> [--dry-run]` | delta 合并进 `specs/`，原目录移动到 `changes/archive/YYYY-MM-DD-<id>/` |

CLI 对应：`wf-tools change list/show/validate/archive`。Archive 采用 fail-fast 语义：目标不存在、ADDED 重名、RENAMED 冲突均拒绝写入主 spec，保证主干始终一致。

### 深度整合（Phase C）

- `/wf-new-project` 在 `spec.enabled = true` 时同步生成初始 `specs/<capability>/spec.md`
- `/wf-new-milestone` reset 时**保留** specs/ 和活跃 changes/（规格跨里程碑存活）
- `/wf-complete-milestone` 的归档同时捕获 `specs/`（主干快照）和 `changes/archive/`（历史变更），存在活跃 change 时以 warning 提示
- `/wf-quick --spec <任务>` 走规格级短链路：propose → validate → apply → archive，绕过 PLAN.md
- `wf-prompt-guard` 自动覆盖 `specs/` 和 `changes/`（路径前缀匹配 `.planning/`）

### 进阶能力（Phase D）

| 能力 | 命令 |
|---|---|
| 变更可视化预览 | `wf-tools change diff <id> [--json]` 展示 apply 前后主 spec 的行级 unified diff |
| 稳定 requirement ID | 在 requirement body 加 `<!-- req-id: STABLE-ID -->`；MODIFIED/REMOVED/RENAMED 按 id 优先匹配；RENAMED 支持 `- From: @id:<id>` |
| 反向追踪 | `wf-tools spec coverage <FR-N\|requirement\|capability\|id>` 扫 REQUIREMENTS/specs/phase/changes/git log，返回结构化 traces |

### Claude Code Skill 化（Phase E）

WF 全量迁移到 Claude Code 官方 Skill 机制：`.claude/skills/<name>/SKILL.md` 与 `.claude/commands/<name>.md` 等价产生 `/name`，Skill 多出 `description` 驱动的语义触发、`disable-model-invocation` / `paths` / `context: fork` 等能力。

25 个 WF Skill 按触发策略分类（P0 收敛后：26 → 25）：

| 触发策略 | skill 数量 | 代表 | 行为 |
|---|---|---|---|
| 开放自动触发 | 9 | `wf-status` / `wf-quick` / `wf-git-conventions` / `wf-code-review` / `wf-verify-work` / `wf-propose` / `wf-apply-change` / `wf-validate-spec` / `wf-troubleshooting` | Claude 读 description 语义匹配后主动调用 |
| `disable-model-invocation: true` | 12 | `wf-new-project` / `wf-discuss-phase` / `wf-plan-phase` / `wf-execute-phase` / `wf-autonomous` / `wf-complete-milestone` / `wf-archive-change` / `wf-new-milestone` / `wf-do` / `wf-pause` / `wf-resume` / `wf-settings` | 不可逆操作、阶段管道、会话生命周期、敏感配置，只能用户显式触发 |
| `user-invocable: false` | 4 | `wf-gates` / `wf-worktree-lifecycle` / `wf-4-level-verification` / `wf-anti-patterns` | 后台知识，Claude 决策时参考，不出现在 `/` 菜单 |

特殊能力：`wf-code-review` 用 `context: fork + agent: general-purpose`，在 forked subagent 中执行审查，保护主 session context。

**用户视角的变化**：
- 问"项目进度怎么样" → Claude 自动触发 `wf-status`（查询模式）
- 说"下一步做什么" → Claude 自动触发 `wf-status` 并进入推进模式
- 写 git commit（仅 WF 项目内，有 `.planning/` 目录）→ Claude 自动加载 `wf-git-conventions` 的规则
- 说"改个 bug" → Claude 自动加载 `wf-quick` 管道
- 显式 `/wf-new-project` / `/wf-autonomous` 等行为与今日完全一致（向后兼容）

---

## Agent

WF 使用 7 个专业化子 Agent，每个都有明确的契约（输入、输出、模型）：

| Agent | 模型 | 角色 |
|-------|------|------|
| **wf-researcher** | haiku | 技术调研——技术栈研究、功能对比、风险分析 |
| **wf-roadmapper** | haiku | 路线图设计——阶段划分、需求映射、依赖分析 |
| **wf-planner** | sonnet | 计划生成——任务分解、Wave 分组、门禁校验 |
| **wf-executor** | sonnet | 任务执行——原子化实现、逐任务提交、预算检查 |
| **wf-verifier** | sonnet | 目标验证——4 级检查、需求覆盖率、差距修复 |
| **wf-reviewer** | sonnet | 代码审查——逐文件分析、发现 ID 追踪、修复循环 |
| **wf-proposer** | inherit | 变更提议——把 idea 转为 proposal + delta specs + tasks（Phase B） |

Agent 协作方式：

```
/wf-new-project
  └─ wf-researcher (×4 并行, haiku)
  └─ wf-roadmapper (×1, haiku)

/wf-plan-phase N
  └─ wf-researcher (×1 可选, haiku)
  └─ wf-planner (×1, sonnet)

/wf-execute-phase N
  └─ wf-executor (×N 每 wave 并行, sonnet, 各自在 worktree 中)
  └─ wf-verifier (×1 所有 wave 完成后, sonnet)
```

---

## Hook

4 个运行时 Hook 与 Claude Code 会话生命周期集成：

| Hook | 事件 | 用途 |
|------|------|------|
| `wf-session-state.js` | SessionStart | 注入项目状态摘要 + 检查点恢复 |
| `wf-prompt-guard.js` | PreToolUse | 检测 prompt 注入（29 种模式），作用于 Write/Edit |
| `wf-context-monitor.js` | PostToolUse | 监控 context 预算；30% 警告 / 15% 严重 |
| `wf-statusline.js` | Continuous | 显示 `WF │ model │ task │ ████░░ 47%` 状态栏 |

---

## Git Conventions

WF 集成了用户全局 `~/.claude/CLAUDE.md` 的 Git 规范并做 WF 特定扩展，权威来源：[`wf/references/git-conventions.md`](wf/references/git-conventions.md)。

核心约定：

| 维度 | 约定 |
|---|---|
| **Commit 格式** | Conventional Commits：`<type>(<scope>): <subject>` |
| **Scope（WF 扩展）** | phase 执行 → `phase-<N>`；change 应用 → `change-<id>`；里程碑 → `chore(milestone)` + `git tag v1.0`；初始化 → `chore(planning)` |
| **原子性** | 一任务一 commit，禁止 `--amend` / `--no-verify` / squash |
| **分支（继承全局）** | `master`（PRO）/ `develop`（DEV）/ `feature/*`（FAT）/ `release/*`（UAT）/ `hotfix/*`（PRO） |
| **Worktree** | executor sub-agent 自动隔离到临时 worktree，完成后 fast-forward 合并回来 |
| **Push** | WF 不自动 push，所有推送需用户显式触发 |

新人推荐直接读 `wf/references/git-conventions.md` 全文（约 200 行，含完整示例与 fallback）。

---

## 项目结构

```
.
├── VERSION                          # 语义版本 (1.0.0)
├── package.json                     # CommonJS 声明（无依赖）
├── settings.json                    # Claude Code hook/权限绑定
├── CLAUDE.md                        # 项目元数据 + 约定
├── ARCHITECTURE.md                  # 系统架构文档
├── CHANGELOG.md                     # 版本历史
├── LICENSE                          # Apache 2.0
│
│                                     # commands/wf/ 已全量迁至 wf/skills/（Phase E 完成）
│   ├── autonomous.md
│   ├── do.md
│   ├── new-project.md
│   ├── discuss-phase.md
│   ├── plan-phase.md
│   ├── execute-phase.md
│   ├── verify-work.md
│   └── ...
│
├── agents/                          # 7 个专业化子 Agent
│   ├── wf-planner.md
│   ├── wf-executor.md
│   ├── wf-verifier.md
│   ├── wf-researcher.md
│   ├── wf-roadmapper.md
│   ├── wf-reviewer.md
│   └── wf-proposer.md               # 变更提议（Phase B）
│
├── hooks/                           # 4 个运行时 Hook
│   ├── wf-session-state.js
│   ├── wf-context-monitor.js
│   ├── wf-prompt-guard.js
│   ├── wf-statusline.js
│   └── *.test.cjs
│
├── wf/
│   ├── bin/
│   │   ├── install.sh               # 安装脚本
│   │   ├── wf-tools.cjs             # CLI 路由器
│   │   └── lib/                     # 15 个模块化库文件
│   │       ├── config.cjs           #   配置管理
│   │       ├── state.cjs            #   STATE.md 读写（唯一写入入口）
│   │       ├── phase.cjs            #   阶段完成检测
│   │       ├── progress.cjs         #   进度计算 + 路由
│   │       ├── roadmap.cjs          #   路线图分析
│   │       ├── milestone.cjs        #   里程碑归档/重置
│   │       ├── session.cjs          #   暂停/恢复检查点
│   │       ├── git.cjs              #   Git 操作封装
│   │       ├── validate.cjs         #   输入验证
│   │       ├── frontmatter.cjs      #   YAML frontmatter 解析
│   │       ├── review.cjs           #   代码审查文件范围
│   │       ├── merge-settings.cjs   #   智能 settings 合并
│   │       ├── init.cjs             #   项目初始化
│   │       ├── spec.cjs             #   规格解析/校验（OpenSpec-inspired）
│   │       ├── change.cjs           #   变更提议 + delta 合并（OpenSpec-inspired）
│   │       ├── utils.cjs            #   通用工具
│   │       └── *.test.cjs           #   单元测试
│   │
│   ├── workflows/                   # 15 个工作流定义
│   │   ├── autonomous.md            #   全自动循环
│   │   ├── new-project.md           #   项目初始化
│   │   ├── discuss-phase.md         #   阶段讨论
│   │   ├── plan-phase.md            #   计划生成
│   │   ├── execute-phase.md         #   Wave 执行
│   │   ├── verify-work.md           #   UAT 验证
│   │   ├── do.md                    #   意图路由
│   │   ├── quick.md                 #   快速任务
│   │   ├── progress.md              #   仪表盘
│   │   └── ...
│   │
│   ├── references/                  # 12 个参考文档
│   │   ├── gates.md                 #   质量门禁定义
│   │   ├── verification-patterns.md #   4 级验证模型
│   │   ├── agent-contracts.md       #   Agent I/O 契约
│   │   ├── anti-patterns.md         #   工作流反模式
│   │   ├── ui-brand.md              #   视觉规范
│   │   ├── context-budget.md        #   Context 管理策略
│   │   ├── continuation-format.md   #   检查点格式规范
│   │   ├── worktree-lifecycle.md    #   Git worktree 隔离
│   │   ├── shared-patterns.md       #   Wave 模型、完成标记
│   │   ├── config-precedence.md     #   配置优先级
│   │   ├── git-conventions.md       #   Git 分支/commit/worktree 规范（集成全局）
│   │   └── troubleshooting.md       #   8 个常见场景
│   │
│   ├── skills/                      # 25 个 Claude Code Skill（Phase E + P0 收敛）
│   │   ├── wf-<name>/SKILL.md       #   frontmatter + @ 引用 workflow/reference
│   │   └── ...                      #   9 开放触发 / 12 受控 / 4 后台知识
│   │
│   └── templates/                   # 9 个项目模板
│       ├── config.json
│       ├── project.md
│       ├── requirements.md
│       ├── roadmap.md
│       ├── spec.md                  #   规格模板（Purpose + Requirement + Scenario）
│       ├── change-proposal.md       #   变更提议正文模板
│       ├── change-tasks.md          #   变更任务清单模板
│       ├── change-delta.md          #   spec delta 模板（ADDED/MODIFIED/REMOVED/RENAMED）
│       └── state.md
│
└── docs/
    ├── wf-architecture.md
    └── ecc-best-practices.md
```

---

## 安装

### 前置要求

- Node.js v14+
- 支持 Hook 的 Claude Code
- Git
- macOS / Linux / Windows (WSL)

### 全局安装（用户级）

```bash
./wf/bin/install.sh
```

安装到 `~/.claude/`。该机器上所有项目都会获得 WF 能力。

### 项目级安装

```bash
./wf/bin/install.sh --project
```

安装到当前项目的 `./.claude/`。

### 选项

| 标志 | 效果 |
|------|------|
| `--dry-run` | 预览所有操作，不做任何更改 |
| `--force` | 跳过版本检查，强制覆盖 |
| `--uninstall` | 移除 WF 文件（保留你的自定义配置） |
| `--project` | 安装到 `./.claude/` 而非 `~/.claude/` |

### 安装过程

1. **检查前置条件** — Node.js v14+、源文件是否存在
2. **比较版本** — 全新安装 / 升级 / 相同 / 降级检测
3. **创建备份** — 升级/降级前创建带时间戳的备份
4. **复制文件** — 77 个文件，涵盖命令、Agent、Hook、Workflow、参考文档、模板、CLI 工具
5. **合并 settings** — `merge-settings.cjs` 保留你现有的 Hook、权限和环境变量，同时添加 WF Hook
6. **验证** — 确认关键文件存在、JSON 合法、`wf-tools.cjs` 冒烟测试通过

### Settings 合并策略

安装器绝不会覆盖你现有的 `settings.json`。它使用智能合并：

| 区域 | 策略 |
|------|------|
| `hooks` | 按 `wf-` 前缀匹配；WF Hook 更新，你的自定义 Hook 保留 |
| `statusLine` | 仅当是 WF statusLine 时才替换 |
| `permissions` | 取并集（去重） |
| `env` | 源提供默认值；你的值如已设置则优先 |
| 其他 | 你的配置保留；WF 填补空缺 |

---

## 配置

安装后，工作流行为由各项目中的 `.planning/config.json` 控制：

```json
{
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_plan": false,
    "confirm_transition": false
  },
  "milestone": {
    "auto_archive_on_complete": false,
    "auto_new_milestone": false
  },
  "parallelization": {
    "enabled": true
  },
  "security_enforcement": false
}
```

#### 里程碑自动化

| 配置项 | 默认 | 说明 |
|--------|------|------|
| `milestone.auto_archive_on_complete` | `false` | autonomous 模式完成所有阶段后，自动执行 `/wf-complete-milestone` |
| `milestone.auto_new_milestone` | `false` | 里程碑归档完成后，跳过确认直接启动 `/wf-new-milestone` |

两者均开启时，实现全自动链路：执行完所有阶段 → 归档里程碑 → 创建新里程碑。

通过命令管理：

```
/wf-settings set gates.confirm_plan true
```

或交互式操作：

```
/wf-settings
```

---

## Context 管理

WF 为低 context 消耗而设计：

### 子 Agent 隔离

执行器 Agent 在 git worktree 中运行。它们的 context 消耗不计入主会话——只有摘要会合并回来。

### 预算监控

`wf-context-monitor` Hook 追踪剩余 context 并注入警告：

- **剩余 30%** — `WARNING: Context 预算不足。建议保存状态。`
- **剩余 15%** — `CRITICAL: 立即保存状态。`

防刷新去抖机制避免警告疲劳（两次警告间隔 60 秒）。

### 跨 Context 恢复

当 context 压缩时，WF 通过降级链恢复：

```
CONTINUATION.md  →  HANDOFF.json  →  STATE.md
   （最佳）            （良好）         （基础）
```

**CONTINUATION.md** 存储精确的阶段、步骤和标志。在自治模式下每个工作流步骤前写入。如果损坏，WF 降级到 HANDOFF.json，再降级到 STATE.md。

---

## 与 GSD 的对比

WF 受 GSD 理念启发，但独立设计，做出了不同的权衡取舍：

| 维度 | GSD | WF |
|------|-----|-----|
| 架构 | 基于 prompt 的编排 | 事件驱动 Hook + 模块化 Agent + CLI 状态机 |
| 状态存储 | prompt 内 context | Markdown 文件（`.planning/`）+ CLI 唯一写入 |
| Agent 模型 | 单一多角色 Agent | 6 个专业化 Agent，各有明确契约 |
| 并行性 | 顺序阶段 | 基于 Wave 的并行执行（worktree 隔离） |
| Context 优化 | 长期运行会话 | 子 Agent 隔离 + CONTINUATION.md 检查点 |
| 质量门禁 | 隐式（Agent 判断） | 显式可配置门禁（硬 + 软），带量化指标 |
| 恢复 | 手动重新提示 | 自动降级：CONTINUATION → HANDOFF → STATE |
| 代码审查 | 执行的一部分 | 独立命令 + 迭代修复循环 |
| 里程碑 | 单项目 | 多里程碑，支持归档和 git tag |
| 配置 | 固定行为 | `config.json` schema，每个门禁可独立开关 |

---

## 架构

WF 分为 6 层：

```
┌─────────────────────────────────────────────────────────┐
│                    入口层                                │
│  commands/wf/ — 已删除；全部功能由 25 个 skill 覆盖         │
├─────────────────────────────────────────────────────────┤
│                   工作流层                               │
│  wf/workflows/ — 15 个工作流定义、阶段逻辑               │
├─────────────────────────────────────────────────────────┤
│                   Agent 层                               │
│  agents/ — 6 个专业化子 Agent（支持并行）                │
├─────────────────────────────────────────────────────────┤
│                   状态层                                 │
│  .planning/ — 项目状态、每阶段产物                       │
│  wf/bin/lib/ — CLI 状态机（唯一写入入口）                │
├─────────────────────────────────────────────────────────┤
│                   Hook 层                                │
│  hooks/ — 4 个运行时 Hook（会话、防护、监控、UI）        │
├─────────────────────────────────────────────────────────┤
│                   参考层                                 │
│  wf/references/ — 门禁、模式、契约、模板                 │
└─────────────────────────────────────────────────────────┘
```

详细系统设计见 [ARCHITECTURE.md](ARCHITECTURE.md)。

---

## 技术栈

- **运行时:** Node.js (CommonJS)，零外部依赖
- **状态:** Markdown 文件 + YAML frontmatter
- **配置:** JSON (settings.json + config.json)
- **Shell:** Bash（仅会话初始化 Hook）
- **平台:** Claude Code hooks/agents/commands 系统
- **版本控制:** Git（worktree 用于并行执行）

---

## 开发

### 测试

```bash
node --test wf/bin/lib/*.test.cjs hooks/*.test.cjs
```

17 个测试文件，覆盖 CLI 模块和 Hook 逻辑。

### 项目统计

| 组件 | 数量 |
|------|------|
| 命令 | 16 |
| Agent | 6 |
| Hook | 4 |
| Workflow | 15 |
| 参考文档 | 11 |
| 模板 | 5 |
| CLI 模块 | 14 |
| 测试文件 | 17 |
| JS 总行数 | ~6,300 |
| 总文件数 | ~100 |

### 添加新工作流

1. 创建 `wf/workflows/your-workflow.md` — 定义步骤逻辑
2. 创建 `commands/wf/your-command.md` — 用户入口
3. 更新 `wf/workflows/do.md` — 添加意图路由
4. 如需要，在 `wf/bin/lib/` 中添加 CLI 子命令

---

<details>
<summary><b>常见问题</b></summary>

### WF 可以用于任何项目吗？

可以。WF 安装到 `~/.claude/`，在你用 Claude Code 打开的任何项目中自动激活。项目特定状态存储在各项目的 `.planning/` 中。

### WF 和 GSD 可以同时使用吗？

可以共存，互不冲突。WF 所有命令、Agent 和 Hook 使用 `wf-` 前缀，GSD 使用 `gsd-`。按任务需要选择使用。

### 阶段执行中途 context 耗尽怎么办？

WF 在自治模式下每个步骤前写入 `CONTINUATION.md` 检查点。会话在压缩后恢复时，`wf-session-state` Hook 检测到检查点并建议精确的恢复命令。

### 可以禁用特定 Hook 吗？

可以。从 `~/.claude/settings.json` 中删除对应 Hook 条目，或在 settings 中设置 `"disableAllHooks": true` 关闭所有 Hook。

### 如何自定义质量门禁？

编辑项目中的 `.planning/config.json`，或使用 `/wf-settings set gates.confirm_plan true`。所有选项见[门禁参考](wf/references/gates.md)。

### 阶段验证失败怎么办？

WF 会生成仅针对失败检查项的差距修复计划，执行修复，并重新验证一次。如果仍然失败，则暂停并请求你的输入。

</details>

---

## 致谢

### GSD — 工作流骨架的起点

WF 站在 [**GSD (Get Stuff Done)**](https://github.com/aravindputrevu/gsd-claude-code) 的肩膀上，GSD 来自 [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) 社区。GSD 开创了为 Claude Code 提供结构化项目管理工作流的理念——分阶段执行、规划产物和自治循环。WF 从学习 GSD 的设计起步，逐步演变为拥有独立架构选择的系统（事件驱动 Hook、Wave 并行、专业化子 Agent、CLI 状态机）。核心洞察——Claude 在显式结构下工作效果远优于临时提示——直接来自 GSD。

感谢 GSD 的作者和 Everything Claude Code 社区验证了这个概念并开放分享。

### OpenSpec — 规格驱动层的灵感来源

WF 的 Phase A/B/C/D —— 规格空间（`specs/`）、变更提议生命周期（`changes/` + ADDED/MODIFIED/REMOVED/RENAMED delta）、`wf-tools change diff`、`spec coverage` 反向追踪、稳定 requirement ID ——整条第二轴，直接借鉴自 [**OpenSpec**](https://github.com/Fission-AI/OpenSpec)（Fission-AI）的"spec + change proposal"双子结构。

OpenSpec 的关键洞察值得被反复致敬：
- **把规格做成代码仓库里的一等公民**，而不是 Jira 里的待办
- **用 `ADDED/MODIFIED/REMOVED/RENAMED Requirements` 的机器可读 delta** 表达规格增量，让"改一条已发布的需求"和"加一条新需求"同样可 diff、可审、可归档
- **propose → validate → apply → archive** 的清晰生命周期，让人与 AI 在写代码前先对齐"要改成什么样"
- **Requirement / Scenario / WHEN-THEN** 的表达粒度，既人类可读又能驱动机器验证

WF 没有重写 OpenSpec：只是把它的设计理念重新实现在 WF 自己的 `wf-tools` CLI 和 agent 体系里，作为正交的第二轴叠加进既有的 phase-driven 架构 —— 保留 GSD 式的阶段/Wave/里程碑，同时获得 OpenSpec 式的规格/变更治理。两种世界观并存，互为补充。

感谢 OpenSpec 团队把规格驱动开发在 AI 时代重新讲清楚，并以开源形式让借鉴成为可能。

---

## 许可证

[Apache License 2.0](LICENSE)
