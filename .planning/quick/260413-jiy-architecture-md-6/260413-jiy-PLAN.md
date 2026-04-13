---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/ARCHITECTURE.md
autonomous: true
must_haves:
  truths:
    - "ARCHITECTURE.md 完整记录 WF 系统经过 6 个阶段实际构建的架构"
    - "文档涵盖所有层次：CLI、状态管理、Agent、会话、工作流、质量工具"
    - "模块依赖关系图准确反映代码中的 require() 关系"
    - "入口点清单与实际文件一一对应（16 commands、15 workflows、6 agents、4 hooks）"
  artifacts:
    - path: ".planning/ARCHITECTURE.md"
      provides: "WF 系统完整架构文档"
      min_lines: 300
---

<objective>
创建 `.planning/ARCHITECTURE.md`，全面记录 WF 工作流系统经过 6 个阶段开发后的实际架构。

Purpose: 当前 CLAUDE.md 中的 Architecture 部分是项目初期编写的，不反映 6 个阶段实际构建的系统。需要一份准确的架构文档供未来维护和扩展参考。
Output: `.planning/ARCHITECTURE.md` — 中文编写，替代/补充 CLAUDE.md 中的 Architecture 部分。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

关键事实（从代码中提取，执行器无需重新探索）：

## CLI 模块清单（wf/bin/lib/）

| 模块 | 行数 | 依赖 | 导出 |
|------|------|------|------|
| utils.cjs | 121 | fs, path, os | readFile, readJson, writeFile, ensurePlanningDir, findProjectRoot, output, error |
| config.cjs | 257 | utils | loadConfig, CONFIG_DEFAULTS, deepMerge, run, saveConfig, getConfigSchema, getConfigValue |
| state.cjs | 507 | utils | parseFrontmatter, serializeFrontmatter, parseYamlValue, parseStateMd, stateGet/Set/Json/Patch/Merge/Validate/BeginPhase/AdvancePlan, run |
| roadmap.cjs | 354 | utils, fs | roadmapAnalyze, addPhase, insertPhase, removePhase, run |
| phase.cjs | 176 | utils, fs | findPhaseDir, phaseInfo, run |
| progress.cjs | 76 | utils, phase | calculateProgress, run |
| git.cjs | 87 | utils, execFileSync | gitCommitPlanning, run |
| init.cjs | 177 | utils, config, phase | run, initPhaseOp, initNewProject, initQuick |
| validate.cjs | 169 | utils | validateHealth, validateFormat, run |
| session.cjs | 223 | utils, fs | createHandoff, readHandoff, deleteHandoff, generateContinueHere, run |
| review.cjs | 316 | utils, phase, execFileSync | computeFileScope, extractKeyFilesFromSummaries, getGitDiffFiles, filterReviewFiles, parseReviewFrontmatter, run |
| milestone.cjs | 187 | utils, fs | archiveMilestone, resetForNewMilestone, run |

## 模块依赖图（仅 lib 内部依赖）

```
utils.cjs (基础层 — 无内部依赖)
  ├── config.cjs
  ├── state.cjs
  ├── roadmap.cjs
  ├── phase.cjs
  │     ├── progress.cjs (+ phase)
  │     ├── review.cjs (+ phase + execFileSync)
  │     └── init.cjs (+ config + phase)
  ├── git.cjs (+ execFileSync)
  ├── validate.cjs
  ├── session.cjs
  └── milestone.cjs
```

## Router（wf-tools.cjs, 77 行）

命令路由：init | state | roadmap | phase | phase-ops | progress | commit | config/settings | validate | session | review | milestone

## Hooks（hooks/）

| 文件 | 行数 | 触发时机 | 功能 |
|------|------|----------|------|
| wf-session-state.js | 227 | SessionStart | Node.js 会话初始化，写 bridge file |
| wf-session-state.sh | 22 | (遗留) | 原 bash 版本（已被 .js 替代） |
| wf-context-monitor.js | 117 | PostToolUse (Bash/Edit/Write/MultiEdit/Agent/Task) | Context 预算监控和警告 |
| wf-prompt-guard.js | 92 | PreToolUse (Write/Edit) | 输入安全过滤 |
| wf-statusline.js | 91 | StatusLine | 状态栏显示（进度/context） |

## Agents（agents/）

6 个：wf-executor, wf-planner, wf-verifier, wf-researcher, wf-roadmapper, wf-reviewer

## Commands（commands/wf/）

16 个：do, new-project, discuss-phase, plan-phase, execute-phase, verify-work, autonomous, quick, progress, pause, resume, next, settings, code-review, complete-milestone, new-milestone

## Workflows（wf/workflows/）

15 个：do, new-project, discuss-phase, plan-phase, execute-phase, verify-work, autonomous, quick, progress, next, session, settings, code-review, complete-milestone, new-milestone

## References（wf/references/）

7 个：agent-contracts, anti-patterns, context-budget, continuation-format, gates, ui-brand, verification-patterns

## Templates（wf/templates/）

5 个：config.json, project.md, requirements.md, roadmap.md, state.md

## Hook 配置（settings.json）

SessionStart → wf-session-state.js
PostToolUse (Bash|Edit|Write|MultiEdit|Agent|Task) → wf-context-monitor.js (10s timeout)
PreToolUse (Write|Edit) → wf-prompt-guard.js (5s timeout)
StatusLine → wf-statusline.js

## 测试

11 个 test 文件（lib/ 内 10 个 *.test.cjs + hooks/ 内 1 个 wf-prompt-guard.test.cjs），使用 node:test + node:assert
</context>

<tasks>

<task type="auto">
  <name>Task 1: 创建 ARCHITECTURE.md 完整架构文档</name>
  <files>.planning/ARCHITECTURE.md</files>
  <action>
创建 `.planning/ARCHITECTURE.md`，中文编写，结构如下：

# WF 工作流系统架构

## 概述
- 系统定位：Claude Code 个人配置/插件系统，提供结构化项目管理能力
- 核心模式：自然语言路由 → Markdown 工作流引擎 → Agent 并行执行 → 状态追踪 → 质量验证
- 技术栈：Node.js (CommonJS) + Markdown + Claude Code Hooks

## 系统分层

用表格+描述，6 层架构：

### 1. 命令入口层（Command Layer）
- 位置：`commands/wf/`（16 个命令定义文件）
- 功能：用户通过 `/wf-*` slash 命令交互，`do.md` 提供自然语言路由
- 命令清单（全部 16 个）分类列出：
  - 核心生命周期：new-project, discuss-phase, plan-phase, execute-phase, verify-work
  - 自动化：autonomous, quick
  - 会话管理：pause, resume, next
  - 配置与状态：settings, progress
  - 质量工具：code-review, complete-milestone, new-milestone
  - 路由：do

### 2. 工作流编排层（Workflow Layer）
- 位置：`wf/workflows/`（15 个工作流定义）
- 功能：Markdown 定义的执行逻辑，通过 Skill() 调用链编排多步操作
- 与命令层的映射关系（大部分 1:1，session.md 无对应命令入口）
- Skill() 链式调用模式说明（以 autonomous.md 为例：discuss→plan→execute→verify）

### 3. Agent 执行层（Agent Layer）
- 位置：`agents/`（6 个 agent）
- 6 个 agent 职责和触发场景的表格
- 合同机制：JSON 完成标记 { status, artifacts, summary }
- 模型配置：config.json agents.models 节（executor/planner/verifier=sonnet, researcher/roadmapper=haiku, reviewer=sonnet）
- 重试规则：最多 1 次，第二次失败停止

### 4. CLI 工具层（CLI Tool Layer）
- 位置：`wf/bin/wf-tools.cjs`（路由器）+ `wf/bin/lib/`（12 个模块）
- 路由器模式说明（56 行 switch-case 分发）
- **模块依赖图**（用 ASCII 树形图展示实际 require 关系）：
  ```
  utils.cjs ← 基础层（所有模块依赖）
    ├── state.cjs (507 行, YAML frontmatter CRUD)
    ├── roadmap.cjs (354 行, 阶段管理)
    ├── config.cjs (257 行, 配置读写)
    ├── session.cjs (223 行, HANDOFF 持久化)
    ├── review.cjs (316 行, 代码审查) → phase.cjs
    ├── milestone.cjs (187 行, 里程碑生命周期)
    ├── phase.cjs (176 行, 阶段目录) → utils
    │     ├── progress.cjs (76 行, 进度计算) → phase
    │     └── init.cjs (177 行, 初始化) → config, phase
    ├── validate.cjs (169 行, 健康检查)
    └── git.cjs (87 行, Git 操作)
  ```
- 12 个模块的导出函数清单表格
- CLI 命令格式：`wf-tools [--cwd <path>] <command> [subcommand] [args...]`

### 5. 运行时监控层（Runtime Layer）
- 位置：`hooks/`（4 个 hook 脚本）+ `settings.json`（hook 绑定配置）
- 4 个 hook 的触发时机、功能、超时设置表格
- Hook 数据流：settings.json 定义绑定 → Claude Code 在对应事件触发 → hook 读取 stdin JSON → 返回 stdout JSON
- Context 预算监控机制（WARNING 35%/CRITICAL 25% + debounce）
- Prompt Guard 机制（负向前瞻 + 注入模式检测）
- SessionStart 会话初始化流程（bridge file + HANDOFF.json）
- StatusLine 状态栏（进度条 + context 使用率）

### 6. 状态与配置层（State & Config Layer）
- 位置：`.planning/` 目录结构
- STATE.md 结构（YAML frontmatter + Markdown body），嵌套 dotted-key CRUD
- config.json 配置项分类（mode, workflow, planning, parallelization, gates, safety, hooks, agents）
- 目录结构：
  ```
  .planning/
  ├── PROJECT.md
  ├── REQUIREMENTS.md
  ├── ROADMAP.md
  ├── STATE.md
  ├── config.json
  └── phases/
      └── {NN}-{slug}/
          ├── {NN}-CONTEXT.md
          ├── {NN}-RESEARCH.md
          ├── {NN}-{NN}-PLAN.md
          ├── {NN}-{NN}-SUMMARY.md
          └── {NN}-VERIFICATION.md
  ```

## 数据流

### 项目生命周期数据流
new-project → (PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json)
discuss-phase → CONTEXT.md
plan-phase → PLAN.md（可选 RESEARCH.md）
execute-phase → SUMMARY.md（per plan）
verify-work → VERIFICATION.md

### 会话数据流
SessionStart hook → bridge file（/tmp） → context-monitor 读取
pause → HANDOFF.json 写入
resume → HANDOFF.json 读取 + 删除
next → STATE.md 读取 → Skill() 路由

### 质量工具数据流
code-review → REVIEW.md（3 层文件范围：phase/milestone/full）
complete-milestone → 归档 phases/ + 重置 STATE.md
new-milestone → 创建新 milestone 目录结构

## 关键设计模式

### Markdown-as-Code
- 工作流和 agent 指令以 Markdown 定义，不是代码
- YAML frontmatter 作为结构化元数据
- 工作流通过 Skill() 引用其他工作流实现组合

### 合同驱动的 Agent 交互
- JSON 完成标记统一所有 agent 输出格式
- 工作流 orchestrator 解析 status 字段决定路由
- 失败重试最多 1 次，防止无限循环

### 质量门控（Gates）
- 硬门控：必须通过（最多 3 次重试）
- 软门控：仅警告
- 可配置：config.json gates 节

### Wave 并行化
- Wave 内任务无依赖，可并行
- Wave 间按依赖顺序
- 并行度配置：max_concurrent_agents, min_plans_for_parallel

### 渐进式验证
- EXISTS → SUBSTANTIVE → WIRED → DATA-FLOWING
- 各级别失败触发 gap closure

## 安装结构
- 源码仓库结构 → 安装到项目 `.claude/` 目录
- `{{WF_ROOT}}` 占位符在安装时替换为 `$HOME/.claude`
- settings.json 复制到 `.claude/settings.json` 激活 hooks

## 参考文档索引

| 文件 | 用途 |
|------|------|
| wf/references/agent-contracts.md | Agent 输入/输出合同定义 |
| wf/references/gates.md | 质量门控规则 |
| wf/references/verification-patterns.md | 验证模式（4 级） |
| wf/references/ui-brand.md | UI 输出规范 |
| wf/references/anti-patterns.md | Prompt 注入防护模式 |
| wf/references/context-budget.md | Context 预算策略 |
| wf/references/continuation-format.md | 会话延续格式 |

## 测试

- 框架：node:test + node:assert（零外部依赖）
- 11 个测试文件，与模块同目录（`*.test.cjs`）
- 运行：`node --test wf/bin/lib/*.test.cjs hooks/*.test.cjs`

**重要提示：**
- 所有数据必须基于上方 context 中提供的实际数据，不要凭记忆编造
- 确保所有数字（16 commands, 15 workflows, 6 agents, 12 modules, 4 hooks, 7 references, 5 templates）与实际一致
- 模块依赖关系必须准确反映上方列出的 require() 关系
  </action>
  <verify>
    <automated>test -f .planning/ARCHITECTURE.md && wc -l .planning/ARCHITECTURE.md | awk '{if ($1 >= 300) print "PASS: " $1 " lines"; else print "FAIL: only " $1 " lines"}'</automated>
  </verify>
  <done>
- `.planning/ARCHITECTURE.md` 存在且超过 300 行
- 文档用中文编写
- 涵盖全部 6 层架构
- 模块依赖图准确（12 个 lib 模块 + 实际 require 关系）
- 入口点清单完整（16 commands, 15 workflows, 6 agents, 4 hooks）
- 数据流覆盖项目生命周期、会话管理、质量工具 3 条主线
  </done>
</task>

</tasks>

<verification>
- `.planning/ARCHITECTURE.md` 存在且内容充实（300+ 行）
- 文档结构清晰，可作为系统架构参考
- 所有数字与实际文件清单一致
</verification>

<success_criteria>
- 一份准确、全面的中文架构文档，替代 CLAUDE.md 中过时的 Architecture 部分
- 新开发者（或未来的 Claude 会话）可以通过此文档快速理解 WF 系统的完整架构
</success_criteria>

<output>
完成后无需创建 SUMMARY — quick task 模式
</output>
