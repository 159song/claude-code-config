---
phase: 02-state-safety
plan: "02"
subsystem: cli
tags: [validation, health-check, auto-repair, frontmatter, state-safety]

# Dependency graph
requires:
  - phase: 01-cli-foundation
    provides: "Router + lib/ module pattern, utils.cjs (readFile, writeFile, output, error)"
provides:
  - "validate.cjs module with health check, format validation, and --repair"
  - "'wf-tools validate health [--repair]' CLI command"
  - "'wf-tools validate format' CLI command"
affects: [02-state-safety, workflow-migration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["TDD RED-GREEN for new modules", "Regex-based frontmatter validation without external YAML parser"]

key-files:
  created:
    - wf/bin/lib/validate.cjs
    - wf/bin/lib/validate.test.cjs
  modified:
    - wf/bin/wf-tools.cjs

key-decisions:
  - "Validate module is standalone -- no dependency on state.cjs (lightweight regex checks)"
  - "Repair only modifies STATE.md frontmatter, never body content"
  - "Required keys checked: status, last_updated, last_activity (minimal set for health)"

patterns-established:
  - "TDD for new modules: write tests first, then implement, commit separately"
  - "Validation module pattern: detect issues as string array, repair flag triggers write-back"

requirements-completed: [STATE-03]

# Metrics
duration: 3min
completed: 2026-04-10
---

# Phase 02 Plan 02: STATE.md Validate Command Summary

**validate.cjs module with health check (5 rules), format validation (duplicate key detection), and --repair auto-fix for STATE.md frontmatter**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-10T06:49:05Z
- **Completed:** 2026-04-10T06:51:58Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created validate.cjs with validateHealth (detects missing opener, closer, required keys) and validateFormat (detects duplicate keys)
- Implemented --repair flag that auto-fixes frontmatter structure: adds missing opener/closer, inserts missing required keys with defaults
- Wired validate command into wf-tools.cjs router for CLI access
- 15 new test cases all passing, 53 total tests with zero regression

## Task Commits

Each task was committed atomically:

1. **Task 1: Create validate.cjs module with health check and repair (TDD RED)** - `155811c` (test)
2. **Task 1: Create validate.cjs module with health check and repair (TDD GREEN)** - `07fb32d` (feat)
3. **Task 2: Wire validate.cjs into wf-tools.cjs router** - `827fd87` (feat)

_TDD task had RED (failing tests) and GREEN (implementation) commits._

## Files Created/Modified
- `wf/bin/lib/validate.cjs` - Health check, format validation, and auto-repair module (169 lines)
- `wf/bin/lib/validate.test.cjs` - 15 test cases covering all validation rules and repair strategies (254 lines)
- `wf/bin/wf-tools.cjs` - Added validate require and case to router (+5 lines)

## Decisions Made
- validate.cjs is fully independent from state.cjs -- uses its own lightweight regex checks rather than importing parseFrontmatter, keeping the module focused and avoiding coupling
- Repair writes defaults: status=unknown, last_updated=ISO timestamp, last_activity=ISO date
- Frontmatter closer repair finds the last YAML-like line (key: value pattern) and inserts --- after it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Threat Surface Scan

No new threat surfaces beyond those documented in the plan's threat model. validate.cjs only reads/writes `.planning/STATE.md` via hardcoded path.join(cwd, '.planning', 'STATE.md'). The --repair flag is the only write path, consistent with T-02-05 mitigation.

## Next Phase Readiness
- validate module ready for use by workflows and other plans
- Plan 01 (state.cjs enhancements) and Plan 03 (workflow migration) can reference `wf-tools validate health --repair` for STATE.md health verification

## Self-Check: PASSED

- All 3 created/modified files exist on disk
- All 3 commit hashes verified in git log
- Line counts match SUMMARY claims (validate.cjs: 169, validate.test.cjs: 254)

---
*Phase: 02-state-safety*
*Completed: 2026-04-10*
