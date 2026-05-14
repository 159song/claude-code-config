# Changelog

All notable changes to WF workflow system are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `wf/bin/upgrade.sh` —— curl 一键升级脚本，无需 git clone；走 GitHub tarball + 临时目录，默认追加 `--force` 应对 hotfix 不 bump VERSION 的情形；支持 `--no-force`、`--dry-run`、`WF_REPO`/`WF_REF` 环境变量。
- README 新增"升级"小节（顶部"快速开始"和后部"安装"双入口）。

### Fixed
- `wf/bin/lib/roadmap.cjs` 的 `PHASE_PATTERN` 缺 `/g` flag 导致 `roadmap analyze` 在多阶段 ROADMAP 上死循环 OOM（崩 Node 4GB 堆）；同步在 `roadmap.cjs` / `progress.cjs` 加零长匹配防御。所有由 `/wf-new-project` 生成的多阶段路线图都会触发，进而让 `/wf-autonomous` Step 1 直接崩溃。240 个测试全部通过。

### Docs
- `CLAUDE.md` Compact instructions 段补一行：与 claude-mem 共存时，`.planning/CONTINUATION.md` 优先于跨项目语义记忆召回。

## [1.1.0] - 2026-04-14

### Added
- CONTINUATION.md checkpoint system for auto-compact recovery
- Compact instructions in CLAUDE.md for cross-context state preservation
- Recovery fallback degradation: CONTINUATION.md -> HANDOFF.json -> STATE.md
- Config precedence hierarchy documentation (`wf/references/config-precedence.md`)
- Troubleshooting guide with 8 common scenarios (`wf/references/troubleshooting.md`)
- Smoke-only verification standards (EXISTS/SUBSTANTIVE/WIRED levels)
- Wave progressive result collection for parallel agent execution
- Optional telemetry config for per-phase execution metrics
- Worktree lifecycle reference documentation
- Installation script (`wf/bin/install.sh`)

### Changed
- Context monitor debounce: call-count (5 calls) replaced with time-based (60s interval)
- Hook stdin timeouts unified to 15000ms across all 4 hooks
- Reviewer finding IDs namespaced per phase: `CR-{NN}` -> `CR-P{phase}-{NN}`
- Executor loads PROJECT.md and REQUIREMENTS.md once per session (saves 3-5% context/task)
- Planner validates action field quality (min 20 chars, banned placeholder words)
- Roadmapper validates phase dependencies via topological sort (cycle detection)

### Fixed
- Context warning debounce unreliable under varying tool call frequency
- Finding ID collisions across multi-phase reviews
- Autonomous mode unrecoverable after corrupted CONTINUATION.md

## [1.0.0] - 2026-04-13

### Added
- Core workflow system: 9 commands, 6 agents, 4 hooks, 15 workflows
- CLI tool (`wf-tools.cjs`) with 12 modular lib/ modules
- Wave-based parallel execution with worktree isolation
- 4-level verification model (EXISTS/SUBSTANTIVE/WIRED/DATA-FLOWING)
- Quality gates with configurable enforcement
- Autonomous mode (`/wf-autonomous`) with phase chaining
- Context budget monitoring with graduated warnings
- Prompt injection guard (PreToolUse hook)
- Status line with context usage display
- Session state injection (SessionStart hook)
- Milestone lifecycle management (archive/reset)
- Code review workflow with structured REVIEW.md output
