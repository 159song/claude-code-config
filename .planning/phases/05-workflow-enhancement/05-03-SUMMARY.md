---
phase: 05-workflow-enhancement
plan: 03
subsystem: settings-command
tags: [config, cli, interactive, settings]
dependency_graph:
  requires: [05-02]
  provides: [/wf-settings command, config save/get/schema API]
  affects: [wf-tools.cjs, config.cjs]
tech_stack:
  added: []
  patterns: [TDD, dotted-key-navigation, type-coercion, schema-validation]
key_files:
  created:
    - commands/wf/settings.md
    - wf/workflows/settings.md
  modified:
    - wf/bin/lib/config.cjs
    - wf/bin/lib/config.test.cjs
    - wf/bin/wf-tools.cjs
decisions:
  - Key validation against CONFIG_DEFAULTS schema prevents arbitrary key injection (T-05-08)
  - parseConfigValue coerces strings to bool/int/float for type safety (T-05-09)
  - getConfigSchema filters underscore-prefixed keys to hide internal state (T-05-10)
  - settings route added as alias to config in wf-tools.cjs for user-friendly naming
metrics:
  duration: 4m
  completed: 2026-04-13
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 3
  tests_added: 16
  tests_total: 19
---

# Phase 05 Plan 03: Settings Command Summary

Interactive /wf-settings command with saveConfig/getConfigSchema/getConfigValue API, supporting both AskUserQuestion menu mode and direct CLI set/get/schema operations.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add saveConfig and getConfigSchema to config.cjs with tests | fc7782a | config.cjs, config.test.cjs, wf-tools.cjs |
| 2 | Create settings command and workflow files | d6dfcfa | commands/wf/settings.md, wf/workflows/settings.md |

## Implementation Details

### Task 1: Config module extensions (TDD)

Added four new exported functions to `config.cjs`:

- **saveConfig(cwd, key, value)**: Writes a single dotted-key config value to `.planning/config.json`. Validates key against CONFIG_DEFAULTS schema before writing. Uses parseConfigValue for type coercion (string "true"/"false" to boolean, numeric strings to int/float).
- **getConfigSchema()**: Returns a flat array of `{key, type, default}` for all CONFIG_DEFAULTS keys. Recursively flattens nested objects with dot notation. Excludes keys starting with `_`.
- **getConfigValue(cwd, key)**: Returns `{key, value, is_default}` for a single config key from the merged config. Detects whether the value comes from project config or defaults.
- **deepMerge**: Now exported for external use.

Updated `run(cwd, args)` to handle sub-commands: `set`, `get`, `schema`, and default (full config dump).

Updated `wf-tools.cjs`: both `config` and `settings` routes now pass `subArgs` to `config.run()`.

19 tests total (16 new), all passing.

### Task 2: Command and workflow files

Created `commands/wf/settings.md` following the existing command pattern (pause.md, next.md). Frontmatter includes `AskUserQuestion` in allowed-tools for interactive mode.

Created `wf/workflows/settings.md` with two modes:
- **Interactive menu**: Fetches schema and current config, displays grouped by category (8 groups), uses AskUserQuestion loop for key selection and value input.
- **Direct CLI**: Parses `set key value` from arguments, executes via wf-tools CLI.

Config categories: basic settings, workflow behavior, parallelization, gates, safety, hooks, agent models, planning.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-05-08 | Key validation via isValidSchemaKey() rejects unknown keys before writing |
| T-05-09 | parseConfigValue coerces to expected types; schema provides type info |
| T-05-10 | getConfigSchema filters underscore-prefixed keys; workflow only shows schema-derived keys |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

All 6 files verified present. Both commit hashes (fc7782a, d6dfcfa) confirmed in git log.
