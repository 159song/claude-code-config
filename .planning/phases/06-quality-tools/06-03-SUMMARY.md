---
phase: 06-quality-tools
plan: 03
subsystem: workflow
tags: [milestone, lifecycle, archive, roadmapper, researcher, agent-reuse]

# Dependency graph
requires:
  - phase: 06-01
    provides: milestone.cjs CLI module (archiveMilestone, resetForNewMilestone)
provides:
  - complete-milestone workflow and command (verify -> archive -> reset -> auto-chain)
  - new-milestone workflow and command (goals -> research -> requirements -> roadmap)
affects: [settings, do-routing, wf-tools]

# Tech tracking
tech-stack:
  added: []
  patterns: [Skill() auto-chain between workflows (D-09), agent reuse across workflow boundaries (D-10)]

key-files:
  created:
    - wf/workflows/complete-milestone.md
    - wf/workflows/new-milestone.md
    - commands/wf/complete-milestone.md
    - commands/wf/new-milestone.md
  modified: []

key-decisions:
  - "complete-milestone uses 5-step flow: verify readiness -> archive -> update PROJECT.md -> reset state -> auto-chain to new-milestone"
  - "new-milestone uses 8-step flow matching new-project.md pattern but with milestone-specific context loading"
  - "Phase numbering resets to 1 for each new milestone (D-08) via explicit instruction in roadmapper prompt"
  - "Auto-chain from complete to new-milestone via Skill() with user gate (D-09)"

patterns-established:
  - "Skill() cross-workflow chaining: complete-milestone auto-invokes new-milestone workflow"
  - "Agent reuse pattern: new-milestone reuses wf-researcher and wf-roadmapper with milestone-specific context"

requirements-completed: [QUAL-02]

# Metrics
duration: 4min
completed: 2026-04-13
---

# Phase 6 Plan 3: Milestone Lifecycle Summary

**Milestone lifecycle subsystem with complete-milestone (archive + reset + auto-chain) and new-milestone (goals + research + requirements + roadmap via agent reuse)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-13T05:49:06Z
- **Completed:** 2026-04-13T05:53:30Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments
- Created complete-milestone workflow with 5-step orchestration: verify readiness via roadmap analyze, archive via wf-tools milestone CLI, update PROJECT.md, reset state, and auto-chain to new-milestone via Skill()
- Created new-milestone workflow with 8-step orchestration reusing wf-researcher and wf-roadmapper agents following the same pattern as new-project.md
- Both command files route to their workflows with correct frontmatter and execution_context references

## Task Commits

Each task was committed atomically:

1. **Task 1: Create complete-milestone workflow and command** - `cff4840` (feat)
2. **Task 2: Create new-milestone workflow and command** - `5bb8277` (feat)

## Files Created/Modified
- `wf/workflows/complete-milestone.md` - 5-step milestone completion workflow (verify readiness, archive, update PROJECT.md, reset state, auto-chain)
- `wf/workflows/new-milestone.md` - 8-step new milestone initialization workflow (load context, gather goals, research, requirements, roadmap, update state, present, commit)
- `commands/wf/complete-milestone.md` - User-facing /wf-complete-milestone command with correct frontmatter
- `commands/wf/new-milestone.md` - User-facing /wf-new-milestone command with agent-contracts.md in execution_context

## Decisions Made
- complete-milestone archives via wf-tools milestone CLI (not raw fs operations) per Phase 1 CLI-first constraint
- Version format validated with `/^v\d+\.\d+$/` regex per T-06-11 threat mitigation
- Archive step must complete before reset step to prevent data loss per T-06-13
- Git tag created during archive step for immutable history marker per T-06-14
- new-milestone research focuses only on new areas not covered by previous milestone for efficiency
- User gate on auto-chain allows declining new-milestone flow per D-09

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Milestone lifecycle commands are ready for use
- Both commands need to be registered in settings.json hook bindings and do.md routing (deferred to integration)
- The wf-tools milestone CLI module from Plan 01 provides the underlying archive/reset operations

## Self-Check: PASSED

- [x] wf/workflows/complete-milestone.md: FOUND
- [x] wf/workflows/new-milestone.md: FOUND
- [x] commands/wf/complete-milestone.md: FOUND
- [x] commands/wf/new-milestone.md: FOUND
- [x] Commit cff4840: FOUND
- [x] Commit 5bb8277: FOUND

---
*Phase: 06-quality-tools*
*Completed: 2026-04-13*
