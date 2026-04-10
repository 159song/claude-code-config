---
phase: 03-agent-contracts
plan: 01
subsystem: agent-definitions
tags: [contracts, completion-markers, context-budget, native-api]
dependency_graph:
  requires: []
  provides: [agent-input-contracts, agent-output-contracts, completion-markers, context-budget-awareness, agent-contracts-reference]
  affects: [wf/workflows/execute-phase.md, wf/workflows/plan-phase.md, wf/workflows/new-project.md]
tech_stack:
  added: []
  patterns: [structured-html-blocks-in-markdown, json-completion-markers, bridge-file-context-monitoring]
key_files:
  created:
    - wf/references/agent-contracts.md
  modified:
    - agents/wf-executor.md
    - agents/wf-planner.md
    - agents/wf-verifier.md
    - agents/wf-researcher.md
    - agents/wf-roadmapper.md
decisions:
  - "Completion marker uses minimal 3-field JSON: status, artifacts, summary"
  - "Context budget threshold at 70% used_pct with fail-open on stale/missing bridge file"
  - "Model field uses inherit in frontmatter, resolved from config.json agents.models at runtime"
  - "Model validation against allowlist [sonnet, opus, haiku, inherit] before Agent() invocation"
metrics:
  duration: 303s
  completed: "2026-04-10T08:22:47Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 6
---

# Phase 03 Plan 01: Agent Contracts and Definitions Summary

Structured input/output contracts, JSON completion markers, context budget awareness, and native API fields added to all 5 WF agent definitions, with unified reference document.

## Task Results

| Task | Name | Status | Commit | Key Changes |
|------|------|--------|--------|-------------|
| 1 | Add contracts, completion markers, and native API fields to all 5 agent .md files | done | 8a762e6 | 5 agent files updated with frontmatter, contracts, completion markers |
| 2 | Create agent-contracts.md unified reference document | done | a6c9b95 | New reference doc with universal rules and per-agent contracts |

## Changes Made

### agents/wf-executor.md
- Added `model: inherit` to frontmatter
- Added `<input_contract>` with 4 required fields (phase, plan_path, context_md, session_id) and 2 optional (resume_from, config)
- Added `<output_contract>` with SUMMARY.md and git commits as artifacts
- Added "Context 预算感知" section with 70% threshold, partial SUMMARY format, and resume mechanism
- Added "完成标记" section with 3-field JSON format
- Preserved all existing content (角色, 核心原则, 执行流程, 偏差处理, 自我验证)

### agents/wf-planner.md
- Added `model: inherit` and `effort: high` to frontmatter
- Added `<input_contract>` with 4 required fields (phase, goal, context_md, requirements_md)
- Added `<output_contract>` with PLAN.md as artifact
- Added "完成标记" section
- Preserved all existing content (上下文保真, 禁止范围缩减, 任务分解规则)

### agents/wf-verifier.md
- Added `model: inherit` and `effort: high` to frontmatter
- Added `<input_contract>` with 5 required fields (phase, goal, requirements, plan_paths, summary_paths)
- Added `<output_contract>` with VERIFICATION.md as artifact
- Added "完成标记" section
- Preserved all existing content (4 级验证模型, 目标反推验证, 覆盖机制)

### agents/wf-researcher.md
- Added `model: inherit` to frontmatter (no effort field per plan)
- Added `<input_contract>` with 2 required fields (topic, tech_stack)
- Added `<output_contract>` with research report as artifact
- Added "完成标记" section
- Preserved all existing content (研究类型, 输出格式, 研究规则)

### agents/wf-roadmapper.md
- Added `model: inherit` to frontmatter (no effort field per plan)
- Added `<input_contract>` with 2 required fields (project_md, requirements_md)
- Added `<output_contract>` with ROADMAP.md as artifact
- Added "完成标记" section
- Preserved all existing content (需求映射, 阶段划分原则, 验证)

### wf/references/agent-contracts.md (NEW)
- Universal rules: completion marker format, workflow routing, retry rules (max 1), model configuration
- Per-agent sections for all 5 agents with input/output contract tables
- Executor special notes: isolation worktree, context budget awareness at 70%
- Workflow invocation examples: standard and retry patterns
- Model validation against allowlist before Agent() call
- Defensive JSON parsing guidance for completion markers

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

- `8a762e6` feat(03-01): add contracts, completion markers, and native API fields to all 5 agent files
- `a6c9b95` feat(03-01): create agent-contracts.md unified reference document

## Self-Check: PASSED

All 7 files verified present. Both commits (8a762e6, a6c9b95) verified in git log.
