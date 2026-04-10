---
phase: 03-agent-contracts
plan: 02
title: "Workflow Contract Integration"
subsystem: workflow-layer
tags: [agent-contracts, workflow, config, completion-parsing, retry-logic]
dependency_graph:
  requires: [03-01]
  provides: [contract-based-invocation, completion-parsing, config-driven-models]
  affects: [execute-phase, plan-phase, new-project, discuss-phase, quick, verify-work, config]
tech_stack:
  patterns: [contract-based-agent-invocation, json-completion-markers, config-driven-model-selection, retry-once-on-failure]
key_files:
  created: []
  modified:
    - wf/templates/config.json
    - wf/bin/lib/config.cjs
    - wf/workflows/execute-phase.md
    - wf/workflows/plan-phase.md
    - wf/workflows/new-project.md
    - wf/workflows/discuss-phase.md
    - wf/workflows/quick.md
    - wf/workflows/verify-work.md
decisions:
  - "Execution-critical agents (executor, planner, verifier) default to sonnet; discovery agents (researcher, roadmapper) default to haiku"
  - "Retry-once pattern: max 1 retry on agent failure, no configurable retry count to prevent infinite loops"
  - "Completion marker parsed from last JSON code block in agent output"
metrics:
  duration_seconds: 320
  completed: "2026-04-10T08:31:53Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 8
---

# Phase 03 Plan 02: Workflow Contract Integration Summary

Config-driven agent model selection with contract-based Agent() invocations, JSON completion marker parsing, and retry-once logic across all 6 workflow files.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Add agents.models to config.json template and CONFIG_DEFAULTS | `85295a3` | Added agents.models with 5 agent types to config template and CONFIG_DEFAULTS |
| 2 | Update execute-phase.md with contract-based invocation | `bee87c4` | Contract-based executor/verifier prompts, resume detection, completion parsing, retry |
| 3 | Update remaining 5 workflow files | `3d1e644` | Contract-based invocations in plan-phase, new-project, discuss-phase, quick, verify-work |

## What Changed

### Config Layer (Task 1)
- `wf/templates/config.json` and `wf/bin/lib/config.cjs` now include `agents.models` with 5 keys: executor (sonnet), planner (sonnet), verifier (sonnet), researcher (haiku), roadmapper (haiku)
- `loadConfig()` deep-merges project overrides over these defaults automatically

### Execute-Phase Workflow (Task 2)
- Executor Agent() call uses contract fields: phase, plan_path, context_md, session_id, resume_from
- Verifier Agent() call uses contract fields: phase, goal, requirements, plan_paths, summary_paths, context_md
- Both read model from `config.agents.models.*`
- Completion marker parsing for complete/partial/failed statuses
- Resume detection scans for partial SUMMARY files
- Retry-once logic on agent failure

### Remaining Workflows (Task 3)
- **plan-phase.md**: Researcher and planner contract-based invocations with completion parsing
- **new-project.md**: 4 parallel researcher contract invocations + roadmapper contract invocation
- **discuss-phase.md**: Researcher contract invocation for advisor research
- **quick.md**: Researcher and executor contract invocations with completion parsing
- **verify-work.md**: Contract guidance note for verifier invocation in smoke test step
- All files reference `wf/references/agent-contracts.md`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| config.json has agents.models (5 keys) | PASS |
| CONFIG_DEFAULTS has agents.models (5 keys) | PASS |
| loadConfig() merges agents.models | PASS |
| 6+ workflow files reference agent-contracts.md | PASS (6 files) |
| 4+ workflow files have completion marker parsing | PASS (6 files) |
| execute-phase.md has session_id and resume_from | PASS (3 occurrences) |
| No hardcoded model names in Agent() calls | PASS (0 hardcoded) |
| All existing workflow steps preserved | PASS |
