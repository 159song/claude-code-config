# WF 工作流系统优化

## What This Is

WF 是一套 Claude Code 个人配置/插件系统，提供结构化项目管理能力：从项目初始化、需求定义、阶段规划到并行执行和验证。参考了 GSD 的设计理念但独立运作，目标是在功能、质量、体验上全面超越 GSD。

## Core Value

让 Claude Code 在任何项目中都能按照结构化工作流高效推进，同时保持低 context 消耗和高可靠性。

## Requirements

### Validated

- ✓ 9 个核心命令（do, new-project, discuss-phase, plan-phase, execute-phase, verify-work, autonomous, quick, progress） — existing
- ✓ 5 个 sub-agent（planner, executor, verifier, researcher, roadmapper） — existing
- ✓ 4 个 hook（session-state, context-monitor, prompt-guard, statusline） — existing
- ✓ CLI 工具 wf-tools.cjs（状态管理、路线图分析、进度计算） — existing
- ✓ 模板系统（project, requirements, roadmap, state, config） — existing
- ✓ 参考文档（gates, verification-patterns, ui-brand） — existing

### Active

- [ ] 全面代码审查：识别 bug、冗余代码、错误处理缺陷
- [ ] 功能增强：补齐 GSD 有而 WF 缺少的能力
- [ ] Context 优化：减少工作流对 context window 的消耗
- [ ] 用户体验改进：命令交互、输出格式、错误提示优化
- [ ] 工作流卡顿修复：识别并修复容易卡住的环节
- [ ] wf-tools.cjs 健壮性：CLI 工具的错误处理和功能完善
- [ ] Hook 优化：减少不必要的 hook 触发，提高效率
- [ ] Agent 指令优化：让 sub-agent 产出更准确、更少幻觉

### Out of Scope

- 重写为全新系统 — 在现有架构上优化，不是推翻重来
- GUI/Web 界面 — 保持 CLI 形态
- 多语言支持 — 保持中文为主

## Context

- 当前版本: 1.0.0
- 架构: 6 层分层（Routing → Workflow → Agent → State → Runtime → Reference）
- 已有 codebase map: `.planning/codebase/`
- 参考系统: GSD（已安装在 `~/.claude/get-shit-done/`）
- 用于个人和工作项目

### 已知问题（待分析确认）

- 工作流执行中偶尔卡顿
- 某些功能 GSD 有而 WF 缺少
- Context 消耗可能有优化空间
- wf-tools.cjs 错误处理待加强

## Constraints

- **兼容性**: 必须保持与 Claude Code hook/command/agent 规范的兼容
- **架构**: 保持现有分层架构，不引入破坏性重构
- **命名**: 保持 `wf-` 前缀命名约定
- **语言**: hooks/CLI 保持 JavaScript/Node.js，文档保持中文

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 参考 GSD 但不照搬 | WF 要有自己的特色和超越点 | — Pending |
| 在现有架构上优化 | 避免推翻重来的成本，渐进改进 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/wf-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/wf-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-10 after initialization*
