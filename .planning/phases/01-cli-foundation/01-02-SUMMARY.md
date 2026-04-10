---
phase: 01-cli-foundation
plan: "02"
subsystem: cli
tags: [init, compound-context, workflow-bootstrap, infra]
dependency_graph:
  requires: ["01-01"]
  provides: ["init-compound-context", "INFRA-05"]
  affects: ["wf-tools-router", "all-workflows-using-init"]
tech_stack:
  added: []
  patterns:
    - "Compound init pattern: single CLI call returns all workflow context"
    - "Sub-mode dispatch with whitelist validation (T-02-03)"
    - "Numeric phase input validation before directory traversal (T-02-01)"
key_files:
  created:
    - wf/bin/lib/init.cjs
    - wf/bin/lib/init.test.cjs
  modified:
    - wf/bin/wf-tools.cjs
decisions:
  - "initPhaseOp returns relative phase_dir (not absolute) to match D-08 spec"
  - "padded_phase and phase_number are both set to the zero-padded string for consistency"
  - "run() uses whitelist (VALID_MODES array) rather than switch default to reject unknown sub-modes"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-10"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 01 Plan 02: Compound Init Command Summary

Single CLI call `wf-tools init <sub-mode>` returns complete workflow context JSON, eliminating multi-file reads from workflow agents.

## What Was Built

`wf/bin/lib/init.cjs` implements a compound init module with sub-mode dispatch:

- **initPhaseOp(cwd, phaseNumStr)** - Returns all D-08 fields for plan-phase/execute-phase/discuss-phase workflows: phase existence, directory, slug, file flags, roadmap/planning existence, config fields (commit_docs, response_language)
- **initNewProject(cwd)** - Returns project file existence flags for the new-project workflow
- **initQuick(cwd)** - Returns minimal config + existence context for the quick workflow
- **run(cwd, args)** - Sub-mode dispatcher routing phase-op/execute-phase/plan-phase/discuss-phase/new-project/quick

`wf/bin/wf-tools.cjs` router updated to dispatch `init` command to `init.run()` (2-line change, router stays at 56 lines).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | TDD failing tests for init.cjs | c8dcea8 | wf/bin/lib/init.test.cjs |
| 1 (GREEN) | Create init.cjs with compound sub-mode dispatch | c4144b2 | wf/bin/lib/init.cjs |
| 2 | Wire init.cjs into router + integration test | 2c24443 | wf/bin/wf-tools.cjs |

## Verification Results

| Check | Result |
|-------|--------|
| `node --test wf/bin/lib/init.test.cjs` | 15/15 PASS |
| `wf-tools init phase-op 1` returns all D-08 fields | PASS |
| `wf-tools init new-project` returns project flags | PASS |
| `wf-tools init quick` returns config + project_root | PASS |
| response_language in all sub-mode outputs (D-09) | PASS |
| Router <= 60 lines (actual: 56) | PASS |
| T-02-01: non-numeric phase rejected | PASS |
| T-02-03: unknown sub-mode exits non-zero | PASS |

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface

No new network endpoints or auth paths introduced. CLI runs locally as user — threat model T-02-01 and T-02-03 mitigations applied as planned (numeric validation, whitelist dispatch).

## Self-Check: PASSED

All files present, all commits verified:
- FOUND: wf/bin/lib/init.cjs
- FOUND: wf/bin/lib/init.test.cjs
- FOUND: .planning/phases/01-cli-foundation/01-02-SUMMARY.md
- FOUND commits: c8dcea8, c4144b2, 2c24443
