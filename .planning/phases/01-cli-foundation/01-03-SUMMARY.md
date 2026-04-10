---
phase: 01-cli-foundation
plan: 03
subsystem: cli-infrastructure
tags: [path-fix, settings, commands, hooks, wf-root]
dependency_graph:
  requires: []
  provides: [INFRA-01, INFRA-02]
  affects: [settings.json, commands/wf/]
tech_stack:
  added: []
  patterns: [$HOME-based absolute paths in JSON hook commands, $HOME expansion in @-references]
key_files:
  created: []
  modified:
    - settings.json
    - commands/wf/do.md
    - commands/wf/new-project.md
    - commands/wf/discuss-phase.md
    - commands/wf/plan-phase.md
    - commands/wf/execute-phase.md
    - commands/wf/verify-work.md
    - commands/wf/autonomous.md
    - commands/wf/quick.md
    - commands/wf/progress.md
decisions:
  - "Use $HOME/.claude paths with double-quote escaping in JSON hook commands"
  - "Replace {{WF_ROOT}} with $HOME/.claude (not hardcoded /Users/zxs/.claude) to stay portable"
metrics:
  duration: ~10 minutes
  completed: 2026-04-10
  tasks_completed: 2
  files_modified: 10
---

# Phase 1 Plan 3: Fix Hook Paths and WF_ROOT Placeholders Summary

Fix all 4 broken hook paths in settings.json using $HOME-based absolute paths, and replace all 31 {{WF_ROOT}} placeholder occurrences across 9 command files with $HOME/.claude to make the WF system functional after installation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix hook paths in settings.json | 66799d3 | settings.json |
| 2 | Replace all {{WF_ROOT}} in 9 command files | 09b7912 | commands/wf/*.md (9 files) |

## What Was Built

**Task 1 - settings.json hook path fix:**
All 4 hook command strings updated from relative `.claude/hooks/` paths to absolute `$HOME/.claude/hooks/` paths with proper shell quoting:
- `bash "$HOME/.claude/hooks/wf-session-state.sh"` (SessionStart)
- `node "$HOME/.claude/hooks/wf-context-monitor.js"` (PostToolUse, timeout:10)
- `node "$HOME/.claude/hooks/wf-prompt-guard.js"` (PreToolUse, timeout:5)
- `node "$HOME/.claude/hooks/wf-statusline.js"` (StatusLine)

**Task 2 - Command file WF_ROOT replacement:**
All 31 occurrences of `{{WF_ROOT}}` across 9 command files replaced with `$HOME/.claude`. Per-file counts:
- do.md: 3, new-project.md: 5, discuss-phase.md: 3, plan-phase.md: 4
- execute-phase.md: 4, verify-work.md: 3, autonomous.md: 3, quick.md: 3, progress.md: 3

## Verification Results

- `grep -r '{{WF_ROOT}}' commands/wf/ settings.json | wc -l` = 0 (zero placeholders)
- `grep -c '$HOME/.claude/hooks/' settings.json` = 4 (all hooks fixed)
- Total $HOME paths in command files = 31 (all replacements done)
- `node -e "JSON.parse(...)"` = valid JSON (settings.json structure preserved)
- All 9 command file YAML frontmatter intact (name, description fields unchanged)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree base reset accidentally deleted planning files**
- **Found during:** Task 1 commit
- **Issue:** The worktree was at commit `91158d5` (before planning files existed). `git reset --soft 4a9e70c` moved HEAD to the target base, but when `git add settings.json && git commit` ran, git detected the planning files in the index (from 4a9e70c) were absent from the working tree and deleted them in the commit.
- **Fix:** Ran `git checkout 4a9e70c -- .planning/ .gitignore CLAUDE.md` to restore the deleted files, then committed the restoration in a separate chore commit (91c0009).
- **Files modified:** .planning/ (all files), .gitignore, CLAUDE.md
- **Commit:** 91c0009

## Known Stubs

None. Both tasks are pure path/placeholder fixes with no data stubs.

## Threat Flags

None. Changes only modify path strings in configuration and command files. No new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- settings.json exists and is valid JSON: FOUND
- commands/wf/do.md contains $HOME/.claude: FOUND
- commands/wf/new-project.md contains $HOME/.claude: FOUND
- Zero {{WF_ROOT}} placeholders remain: CONFIRMED
- Commit 66799d3 exists: FOUND
- Commit 09b7912 exists: FOUND
