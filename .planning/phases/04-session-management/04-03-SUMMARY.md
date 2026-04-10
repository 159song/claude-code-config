---
phase: 04-session-management
plan: 03
subsystem: auto-advance
tags: [command, workflow, state-detection, routing]
dependency_graph:
  requires: [wf-tools.cjs roadmap analyze, wf-tools.cjs init phase-op]
  provides: [/wf-next command, auto-advance workflow]
  affects: [commands/wf/, wf/workflows/]
tech_stack:
  added: []
  patterns: [thin-wrapper, state-detection-routing, Skill()-delegation]
key_files:
  created:
    - commands/wf/next.md
    - wf/workflows/next.md
  modified: []
decisions:
  - id: D-next-thin-wrapper
    summary: "/wf-next is a pure routing layer that delegates all work to existing Skill() calls"
  - id: D-next-no-flags
    summary: "No flag override supported; auto-detect only per D-12 design decision"
metrics:
  duration: 88s
  completed: 2026-04-10T09:20:10Z
  tasks_completed: 1
  tasks_total: 1
  files_created: 2
  files_modified: 0
---

# Phase 04 Plan 03: Auto-Advance Command Summary

/wf-next command with full lifecycle state detection routing to existing Skill() workflows via roadmap analyze and init phase-op CLI tools.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create /wf-next command file and auto-advance workflow | 7e586f5 | commands/wf/next.md, wf/workflows/next.md |

## Implementation Details

### commands/wf/next.md
- Frontmatter with `name: wf:next`, includes Agent and Task in allowed-tools
- References `wf/workflows/next.md` via execution_context
- Thin command entry point following existing pattern (progress.md)

### wf/workflows/next.md
- 5-step detection flow: project existence -> handoff check -> roadmap analyze -> phase-op state -> Skill() routing
- Full lifecycle chain (D-09): discuss -> plan -> execute -> verify
- Lowest-numbered incomplete phase selection via `current_phase` from roadmap analyze (D-11)
- No flag override, auto-detect only (D-12)
- Edge cases handled: no project, no roadmap, empty roadmap, all phases complete, pending handoff
- Security: route targets limited to 4 known Skill() values (T-04-10 mitigation)

## Decisions Made

1. **Thin wrapper pattern**: /wf-next contains zero implementation logic; it detects state and delegates to existing discuss/plan/execute/verify workflows via Skill() calls.
2. **No flag override**: Per D-12, /wf-next always auto-detects. Users who know their target use direct commands.
3. **Handoff priority**: HANDOFF.json check runs before advance logic, ensuring interrupted work is resumed before new work starts.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] commands/wf/next.md exists
- [x] wf/workflows/next.md exists
- [x] 04-03-SUMMARY.md exists
- [x] Commit 7e586f5 exists in git log
