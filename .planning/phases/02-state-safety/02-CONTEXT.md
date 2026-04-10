# Phase 2: State Safety - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

所有对 STATE.md 和 ROADMAP.md 的变更都通过 CLI 命令完成，消除直接文件修改造成的格式腐坏和并行冲突。

Requirements: STATE-01, STATE-02, STATE-03, STATE-04, STATE-05, STATE-06

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from Phase 1:
- wf-tools.cjs is a pure router dispatching to lib/ modules (Phase 1 established this pattern)
- All new CLI commands should follow the router + lib/ module pattern
- CommonJS modules with module.exports
- Node.js standard library only (no external dependencies)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `wf/bin/lib/state.cjs` — existing state module with parseFrontmatter, parseStateMd, stateGet, stateSet, stateJson, run
- `wf/bin/lib/roadmap.cjs` — existing roadmap module with phase pattern matching
- `wf/bin/lib/utils.cjs` — readFile, readJson, writeFile, ensurePlanningDir, findProjectRoot, output
- `wf/bin/lib/config.cjs` — loadConfig with CONFIG_DEFAULTS
- `wf/bin/wf-tools.cjs` — 56-line pure router dispatching to 8 lib/ modules

### Established Patterns
- CLI subcommand routing: `wf-tools.cjs <command> <subcommand> [args]`
- JSON output via `utils.output()` for structured data
- YAML frontmatter parsing already exists in state.cjs
- findProjectRoot traversal from cwd to locate .planning/

### Integration Points
- New state mutation commands wire into wf-tools.cjs router
- Workflow files (agents, commands) currently Write/Edit STATE.md directly — must be migrated
- roadmap.cjs needs content-based completion detection (currently file-existence based)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
