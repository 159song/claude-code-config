---
phase: 06-quality-tools
plan: 01
subsystem: cli
tags: [review, milestone, config, wf-tools, code-review, archival]

# Dependency graph
requires:
  - phase: 01-cli-foundation
    provides: wf-tools.cjs router, utils.cjs, config.cjs, phase.cjs, git.cjs
provides:
  - review.cjs module with file scope computation and REVIEW.md parsing
  - milestone.cjs module with archival and reset operations
  - CONFIG_DEFAULTS extension with code_review settings and reviewer model
  - wf-tools.cjs router cases for review and milestone commands
affects: [06-02, 06-03, wf-reviewer agent, wf-verifier agent]

# Tech tracking
tech-stack:
  added: []
  patterns: [three-tier file scope fallback, YAML frontmatter manual parsing, recursive directory copy, version format validation]

key-files:
  created:
    - wf/bin/lib/review.cjs
    - wf/bin/lib/review.test.cjs
    - wf/bin/lib/milestone.cjs
    - wf/bin/lib/milestone.test.cjs
  modified:
    - wf/bin/lib/config.cjs
    - wf/bin/wf-tools.cjs
    - wf/templates/config.json

key-decisions:
  - "Used manual regex YAML parsing for REVIEW.md frontmatter to avoid external dependency"
  - "Three-tier file scope fallback: --files > SUMMARY.md key_files > git diff"
  - "Version format restricted to /^v\\d+\\.\\d+$/ for milestone archival path safety"
  - "Status value validation limited to clean/issues_found/error per threat model T-06-04"

patterns-established:
  - "Three-tier file scope: explicit files > SUMMARY extraction > git diff fallback"
  - "Version-prefixed archive naming: v1.0-ROADMAP.md, v1.0-REQUIREMENTS.md"
  - "Milestone reset preserves PROJECT.md, STATE.md, config.json, milestones/"

requirements-completed: [QUAL-01, QUAL-02]

# Metrics
duration: 5min
completed: 2026-04-13
---

# Phase 6 Plan 01: CLI Foundation Summary

**review.cjs with three-tier file scope and REVIEW.md parsing, milestone.cjs with version-validated archival and phase reset, config extension with code_review settings**

## Performance

- **Duration:** 5 min 34 sec
- **Started:** 2026-04-13T05:40:21Z
- **Completed:** 2026-04-13T05:45:55Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Created review.cjs with 6 exported functions: computeFileScope (3-tier fallback), extractKeyFilesFromSummaries, getGitDiffFiles, filterReviewFiles, parseReviewFrontmatter, run
- Created milestone.cjs with archiveMilestone (recursive copy to milestones/<version>/), resetForNewMilestone (clean slate preserving core files), run
- Extended CONFIG_DEFAULTS with code_review, code_review_depth, code_review_auto_fix, code_review_max_iterations, and agents.models.reviewer
- Wired both modules into wf-tools.cjs router with 'review' and 'milestone' cases
- 43 total tests passing (11 review + 13 milestone + 19 config)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create review.cjs module with file scope computation and REVIEW.md parsing** - `57d1dc7` (feat)
2. **Task 2: Create milestone.cjs module with archival and reset operations** - `3f51edc` (feat)
3. **Task 3: Wire review and milestone modules into wf-tools.cjs router** - `5a97eed` (feat)

_Note: TDD tasks had RED-GREEN cycle within single commits (tests + implementation)_

## Files Created/Modified
- `wf/bin/lib/review.cjs` - File scope computation (3-tier fallback) and REVIEW.md YAML frontmatter parsing
- `wf/bin/lib/review.test.cjs` - 11 unit tests covering all review functions and edge cases
- `wf/bin/lib/milestone.cjs` - Milestone archival (recursive dir copy) and phase reset operations
- `wf/bin/lib/milestone.test.cjs` - 13 unit tests covering archive, reset, validation, dispatch
- `wf/bin/lib/config.cjs` - Extended CONFIG_DEFAULTS with code_review settings and reviewer model
- `wf/bin/wf-tools.cjs` - Added require + switch cases for review and milestone, updated usage string
- `wf/templates/config.json` - Added code_review keys and reviewer model to template

## Decisions Made
- Used manual regex YAML parsing for REVIEW.md frontmatter instead of adding a YAML library dependency — keeps the zero-dependency constraint
- Implemented three-tier file scope fallback (--files > SUMMARY.md > git diff) to cover all usage scenarios from explicit to automatic
- Restricted milestone version format to `/^v\d+\.\d+$/` to prevent path injection via version strings (T-06-05)
- Validated REVIEW.md status values against an allowlist (clean/issues_found/error) per T-06-04

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- review.cjs and milestone.cjs are ready for consumption by Plan 02 (wf-reviewer agent) and Plan 03 (workflow integration)
- CONFIG_DEFAULTS code_review keys are available for agent behavior configuration
- wf-tools router dispatches review and milestone commands correctly

---
*Phase: 06-quality-tools*
*Completed: 2026-04-13*
