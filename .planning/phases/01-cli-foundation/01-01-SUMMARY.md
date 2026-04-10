---
phase: 01-cli-foundation
plan: "01"
subsystem: cli
tags: [modularization, router, lib-modules, findProjectRoot, tdd]
dependency_graph:
  requires: []
  provides: [wf/bin/lib/utils.cjs, wf/bin/lib/state.cjs, wf/bin/lib/roadmap.cjs, wf/bin/lib/phase.cjs, wf/bin/lib/progress.cjs, wf/bin/lib/git.cjs, wf/bin/lib/config.cjs, wf/bin/wf-tools.cjs]
  affects: [wf/bin/wf-tools.cjs, hooks, all workflow commands]
tech_stack:
  added: [node:test, node:assert]
  patterns: [router-dispatch, findProjectRoot-traversal, blocking-fd-write, yaml-frontmatter-parse, dual-dir-convention]
key_files:
  created:
    - wf/bin/lib/utils.cjs
    - wf/bin/lib/config.cjs
    - wf/bin/lib/state.cjs
    - wf/bin/lib/roadmap.cjs
    - wf/bin/lib/phase.cjs
    - wf/bin/lib/progress.cjs
    - wf/bin/lib/git.cjs
    - wf/bin/lib/utils.test.cjs
    - wf/bin/lib/config.test.cjs
    - wf/bin/lib/state.test.cjs
    - wf/bin/lib/roadmap.test.cjs
    - wf/bin/lib/phase.test.cjs
  modified:
    - wf/bin/wf-tools.cjs
decisions:
  - "Used node:test built-in for zero-dependency unit testing"
  - "parseFrontmatter treats YAML frontmatter as primary data source, bullet-list as fallback"
  - "findPhaseDir checks phases/NN-slug/ first (GSD-style), then phase-N/ (WF-style)"
  - "output() uses fs.writeSync for blocking fd write to prevent stdout+exit race"
  - "init placeholder returns planning_dir JSON; full init.cjs deferred to Plan 02"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-04-10"
  tasks_completed: 2
  files_created: 13
  files_modified: 1
  tests_written: 23
  tests_passing: 23
---

# Phase 1 Plan 1: Modularize wf-tools.cjs into router + lib/ architecture Summary

**One-liner:** 324-line monolithic wf-tools.cjs split into 7 CommonJS lib/ modules + 56-line pure router with findProjectRoot auto-discovery and --cwd override, fixing roadmap regex (H3), state frontmatter parsing, and phase directory dual-convention support.

## What Was Built

### Task 1: lib/ modules (TDD)

7 independently testable CommonJS modules extracted from `wf-tools.cjs`:

- **utils.cjs** — readFile, readJson, writeFile, ensurePlanningDir, findProjectRoot, output (blocking fd write), error. Leaf module with no local requires.
- **config.cjs** — CONFIG_DEFAULTS matching templates/config.json, loadConfig with deep merge, run. Requires utils only.
- **state.cjs** — parseFrontmatter (YAML primary source), parseStateMd (frontmatter + bullet-list fallback), stateGet/stateSet/stateJson, run. Fixes Pitfall 6: STATE.md YAML frontmatter now correctly read.
- **roadmap.cjs** — roadmapAnalyze with `#{2,3}` flexible regex, reads VERIFICATION.md content for actual PASS/FAIL (not just existence), run. Fixes Pitfall 2: was returning 0 phases, now returns 6.
- **phase.cjs** — findPhaseDir supporting both `phases/NN-slug/` (GSD) and `phase-N/` (WF) conventions, phaseInfo, run. Fixes Pitfall 3: was returning `exists: false`, now finds 01-cli-foundation.
- **progress.cjs** — calculateProgress using findPhaseDir for correct directory lookup, run. Benefits from Pitfall 2 and 3 fixes.
- **git.cjs** — gitCommitPlanning with optional `--files` array (selective staging vs whole .planning/), run.

23 unit tests across 5 test files, all passing.

### Task 2: Pure router wf-tools.cjs

Rewrote `wf-tools.cjs` from 324 lines to 56 lines:
- Pure dispatch with zero business logic
- `--cwd <path>` flag (D-12): parses via `indexOf`, resolves via `path.resolve()`
- `findProjectRoot(process.cwd())` auto-discovers project root from any subdirectory (D-10, D-11)
- Dispatches to all 7 lib/ modules
- `init` placeholder returns `{ planning_dir }` (init.cjs deferred to Plan 02)

## Verification Results

| Check | Result |
|-------|--------|
| 7 lib modules exist | PASS |
| Router <= 60 lines | PASS (56 lines) |
| No circular deps | PASS |
| state json → gsd_state_version key | PASS |
| roadmap analyze → total_phases: 6 | PASS |
| phase info 1 → finds 01-cli-foundation | PASS |
| progress → valid JSON with progress key | PASS |
| --cwd /tmp → no crash | PASS |
| 23 unit tests green | PASS |
| T-01-01: path.resolve() for --cwd | PASS |
| T-01-02: parseInt/isNaN for phase num | PASS |
| T-01-04: output() temp file >50KB | PASS |

## Commits

| Hash | Description |
|------|-------------|
| 9f3ba2a | test(01-01): add failing tests for lib/ modules (RED phase) |
| 35cced8 | feat(01-01): create lib/ modules by extracting from wf-tools.cjs |
| ae6ebc3 | feat(01-01): rewrite wf-tools.cjs as pure 56-line router with --cwd support |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `node:test` built-in for testing | Zero external dependencies (project constraint) |
| YAML frontmatter as primary state source | STATE.md format already uses frontmatter; bullet-list was legacy |
| `#{2,3}` regex for roadmap | ROADMAP.md uses H3 headers; H2 support retained for future compatibility |
| `phases/NN-slug/` first, `phase-N/` fallback | GSD manages this project using its own convention |
| `fs.writeSync(1, ...)` for output | Prevents stdout+process.exit race condition (verified GSD pattern) |
| `init` placeholder in router | init.cjs compound output is Plan 02 scope |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Added path.resolve() validation for --cwd flag**
- **Found during:** Task 2
- **Issue:** Threat model T-01-01 requires --cwd be validated with path.resolve()
- **Fix:** Added `cwd = path.resolve(args[cwdIdx + 1])` in router
- **Files modified:** wf/bin/wf-tools.cjs
- **Commit:** ae6ebc3

**2. [Rule 2 - Security] Added parseInt/isNaN validation for phase numbers**
- **Found during:** Task 1
- **Issue:** Threat model T-01-02 requires phaseNum validated before path.join use
- **Fix:** `const num = parseInt(phaseNum, 10); if (isNaN(num)) return null;` in findPhaseDir and phaseInfo
- **Files modified:** wf/bin/lib/phase.cjs
- **Commit:** 35cced8

No other deviations — plan executed as specified.

## Known Stubs

- `init` command in wf-tools.cjs returns minimal `{ planning_dir }` JSON. Full compound init output (phase-op, new-project, execute-phase sub-modes per D-07/D-08) is deferred to Plan 02 (01-02-PLAN.md). This stub does NOT prevent this plan's goal (modularization + routing) from being achieved.

## Threat Flags

No new security surface introduced beyond what was already in the original wf-tools.cjs. --cwd path traversal is mitigated (T-01-01). Phase number injection mitigated (T-01-02).

## Self-Check: PASSED

Files verified:
- wf/bin/lib/utils.cjs — FOUND
- wf/bin/lib/config.cjs — FOUND
- wf/bin/lib/state.cjs — FOUND
- wf/bin/lib/roadmap.cjs — FOUND
- wf/bin/lib/phase.cjs — FOUND
- wf/bin/lib/progress.cjs — FOUND
- wf/bin/lib/git.cjs — FOUND
- wf/bin/wf-tools.cjs — FOUND (56 lines)

Commits verified:
- 9f3ba2a — FOUND (test RED phase)
- 35cced8 — FOUND (feat lib/ modules)
- ae6ebc3 — FOUND (feat router)
