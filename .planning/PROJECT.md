# WF Workflow System

## What This Is

WF 是一套 Claude Code 个人配置/插件系统，提供结构化项目管理能力：从项目初始化、需求定义、阶段规划到并行执行和验证。参考了 GSD 的设计理念但独立运作，目标是在功能、质量、体验上全面超越 GSD。

## Core Value

让 Claude Code 在任何项目中都能按照结构化工作流高效推进，同时保持低 context 消耗和高可靠性。

## Requirements

### Validated

- ✓ CLI 模块化架构（router + lib/ 模块）— v1.0
- ✓ 复合 init 命令（单次调用获取完整上下文）— v1.0
- ✓ Hook 路径一致性和占位符替换 — v1.0
- ✓ 状态变更通过 CLI 命令（frontmatter CRUD）— v1.0
- ✓ 健康检查和自动修复（validate --repair）— v1.0
- ✓ 阶段转换命令（begin-phase, advance-plan）— v1.0
- ✓ Agent 完成标记和交接合同 — v1.0
- ✓ Context 预算管理 — v1.0
- ✓ 会话暂停/恢复（pause/resume）— v1.0
- ✓ 自动推进（/wf-next）— v1.0
- ✓ 自治执行模式 — v1.0
- ✓ 阶段动态调整（add/insert/remove）— v1.0
- ✓ 交互式配置管理（/wf-settings）— v1.0
- ✓ 代码审查工作流 — v1.0
- ✓ 里程碑生命周期管理 — v1.0

### Active

(None yet — defining next milestone)

### Out of Scope

- GSD 完全复刻 — WF 独立运作，选择性借鉴而非照搬
- 多人协作 — 当前为个人工作流
- 云端同步 — 本地文件系统即真相源

## Context

v1.0 已交付完整的工作流系统，覆盖 CLI 基础、状态安全、Agent 合同、会话管理、工作流增强、质量工具六大领域。代码量约 9,644 行 JS/CJS，配合大量 Markdown 工作流定义和参考文档。

## Constraints

- **兼容性**: 必须保持与 Claude Code hook/command/agent 规范的兼容
- **架构**: 保持现有分层架构，不引入破坏性重构
- **命名**: 保持 `wf-` 前缀命名约定
- **语言**: hooks/CLI 保持 JavaScript/Node.js，文档保持中文

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 6 阶段依赖排序 CLI→State→Agent→Session→Workflow→Quality | 每层依赖前一层，降低返工风险 | ✓ Good |
| CLI foundation 优先 | compound init 消除 60-70% 不必要 context 消耗 | ✓ Good |
| 独立于 GSD 运作 | 避免上游依赖，可自由演进 | ✓ Good |
| CommonJS + 纯 Node.js | 零依赖，任何环境直接运行 | ✓ Good |

## Current Milestone: (Defining next)

**Goal:** TBD

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/wf-verify-work`):
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
*Last updated: 2026-04-13 after v1.0 milestone*
