<!-- GSD:project-start source:PROJECT.md -->
## Project

**WF 工作流系统优化**

WF 是一套 Claude Code 个人配置/插件系统，提供结构化项目管理能力：从项目初始化、需求定义、阶段规划到并行执行和验证。参考了 GSD 的设计理念但独立运作，目标是在功能、质量、体验上全面超越 GSD。

**Core Value:** 让 Claude Code 在任何项目中都能按照结构化工作流高效推进，同时保持低 context 消耗和高可靠性。

### Constraints

- **兼容性**: 必须保持与 Claude Code hook/command/agent 规范的兼容
- **架构**: 保持现有分层架构，不引入破坏性重构
- **命名**: 保持 `wf-` 前缀命名约定
- **语言**: hooks/CLI 保持 JavaScript/Node.js，文档保持中文
- **文档同步**: 当 WF 工作流、命令、Agent、Hook 或配置发生变更时，同步更新 `ARCHITECTURE.md`、`README.md`，并检查并更新 `docs/` 目录下**所有**相关文档（当前包括 `docs/workflow-diagram.md`、`docs/wf-architecture.md`，后续新增文档自动纳入此规则）。检查范围：
  - 新增/删除/重命名 workflow (`wf/workflows/*.md`) → 更新流程图、workflow 列表
  - 新增/删除/重命名 agent (`agents/wf-*.md`) → 更新 agent 表、数量统计
  - 新增/删除/修改 hook (`hooks/wf-*.js`) → 更新 Hook 章节、事件绑定表
  - 新增/删除 CLI 子命令 (`wf/bin/lib/*.cjs`) → 更新 CLI 命令矩阵
  - 新增/删除模板 (`wf/templates/*`) → 更新模板列表
  - 修改 `settings.json` / `config.json` 模板字段 → 更新配置章节
  修改完成后在 commit message 中明确提及"docs: 同步 X/Y/Z"，避免文档漂移。
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript - Runtime for hooks and CLI tools
- Markdown - Workflow definitions, documentation, and state management
- Bash - Session initialization hook (`wf-session-state.sh`)
- JSON - Configuration files (`settings.json`, `config.json`)
## Runtime
- Node.js (CommonJS) - Declared in `package.json` as `{"type":"commonjs"}`
- npm (implicit from `package.json`)
- Lockfile: Not present (minimal dependencies)
## Frameworks
- Claude Code Hooks system - Event-driven architecture integrated with Claude Code IDE
- Custom workflow engine - Markdown-based workflow definitions executed by Claude agent orchestrator
## Key Dependencies
- Node.js standard library modules only:
## Configuration
- No `.env` files used
- Configuration via `settings.json` → copied to `.claude/settings.json` at installation time
- Workflow config template at `wf/templates/config.json`
- No build step required
- Pure Node.js CommonJS scripts
- Markdown files are source documents, not compiled
- `package.json` - CommonJS declaration only
- `settings.json` - Claude Code hook bindings (SessionStart, PreToolUse, PostToolUse, StatusLine)
- `.planning/config.json` - Workflow behavior configuration (mode, gates, safety rules)
## Platform Requirements
- Node.js v14+ (CommonJS support)
- Bash shell for `wf-session-state.sh`
- Claude Code IDE with hooks support
- Git (implied by workflow system)
- Claude Code IDE (primary platform)
- Installation target: `.claude/` directory in any project
- No server/cloud deployment; runs as local IDE extension
- macOS (tested, primary development)
- Linux (Bash compatible)
- Windows (WSL/Git Bash for shell hooks)
## Installation
- Install target: `$HOME/.claude/` (global, not per-project)
- Install command: `./wf/bin/install.sh` (supports `--dry-run`, `--force`, `--uninstall`)
- `settings.json` is intelligently merged via `merge-settings.cjs` (preserves user config)
- Test files (`*.test.cjs`) are excluded from installation
## Version Management
- `VERSION` file: `1.0.0`
- Semantic versioning with upgrade/downgrade detection
- Version available at `$HOME/.claude/wf/VERSION` after installation
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Kebab-case with functional prefix: `wf-prompt-guard.js`, `wf-statusline.js`, `wf-context-monitor.js`
- Markdown documents use kebab-case: `verification-patterns.md`, `plan-phase.md`, `execute-phase.md`
- Configuration files: `config.json`, `settings.json`
- camelCase for function and variable names: `createSession()`, `validateCredentials()`, `processToolInput()`, `initializeMetrics()`
- Constants use UPPER_SNAKE_CASE: `WARNING_THRESHOLD`, `CRITICAL_THRESHOLD`, `STALE_SECONDS`, `DEBOUNCE_CALLS`
- Private/internal functions may use prefix underscore if needed, but not strictly enforced
- Descriptive camelCase: `filePath`, `stdinTimeout`, `sessionId`, `bridgeData`, `usableRemaining`
- Configuration properties: camelCase in nested objects: `config.workflow.research`, `config.parallelization.enabled`
- DOM/UI utilities: CSSVariable-like: `AUTO_COMPACT_BUFFER_PCT`, `INJECTION_PATTERNS`
- PascalCase for error/special objects when used: `Error`, `Date`, `JSON`, `RegExp`
- Regular expression literals: Use `const PATTERN_NAME = /pattern/flags;` format
- No explicit TypeScript interfaces in this codebase (JavaScript-based)
## Code Style
- No explicit ESLint/Prettier configuration detected; follows Node.js standard conventions
- 2-space indentation (observed in all `.js` files)
- Standard Node.js formatting with semicolons
- Comments use `//` for inline and `/* */` for block comments
- All code files are executable scripts (`#!/usr/bin/env node` shebang)
- No linting configuration found (`.eslintrc*`, `eslint.config.*` absent)
- Code assumes compatibility with Node.js runtime (no transpilation needed)
- Strict mode not explicitly declared but assumed by `process` global availability
## Import Organization
- No path aliases detected (simple relative/absolute fs paths used)
- Prefer direct requires: `const fs = require('fs');`
## Error Handling
- Defensive try/catch for I/O operations that may fail silently: `try { ... } catch (e) {}`
- Silent failures preferred for monitoring/hook scripts to prevent deadlock
- No error propagation in hook contexts; fail safely and exit gracefully
- Exit code 0 on any error to prevent system interruption
- Wrap risky operations (file I/O, JSON parsing, path validation) in try/catch
- Use empty catch blocks for non-critical operations
- For critical operations, validate inputs before use: `if (!sessionId) process.exit(0);`
## Logging
- Process stdout redirection for structured output: `process.stdout.write(JSON.stringify(output));`
- Structured JSON output for hook communication
- ANSI color codes for terminal output: `\x1b[32m`, `\x1b[33m`, `\x1b[0m` (reset)
- Progress indicators using Unicode block characters: `█` (filled), `░` (empty)
- When to log:
## Comments
- Explain non-obvious logic or thresholds: "// Context 使用率显示"
- Document magic numbers or constants: `// 16.5% buffer for auto-compaction`
- Clarify regex patterns or complex conditionals
- Avoid over-commenting obvious code
- Not used in this codebase (no TypeScript, minimal JSDoc)
- Frontmatter metadata used in Markdown files for structured data:
## Function Design
- Limit to 3-5 parameters maximum
- Use object destructuring for configuration: `const { session_id, remaining_percentage } = data;`
- Validate parameters early in function with guard clauses: `if (!sessionId) process.exit(0);`
- Functions processing JSON return structured objects: `{ hookSpecificOutput: { ... } }`
- Utility functions return primitives or exit process
- Hook scripts primarily cause side effects (file writes) rather than returning values
## Module Design
- CommonJS modules: `module.exports = ...` (not used; scripts are standalone)
- Executable scripts: Top-level code with event listeners
- Each hook file is self-contained with no exports (runs as standalone CLI)
- No barrel files (index.js) detected in this configuration repo
- Markdown documents serve as documentation "modules" with frontmatter
- `hooks/wf-*.js` — Standalone executable hook scripts
- `agents/wf-*.md` — Agent behavior specifications with frontmatter
- `commands/wf/` → symlinked/copied during installation
- `wf/templates/` → Template files for projects using this config
## Markdown Conventions
- YAML frontmatter for metadata (name, description, tools/references)
- H1 for title, H2 for major sections, H3 for subsections
- Tables for structured data (verification results, task tracking)
- Code blocks for examples, commands, and pseudocode
- Inline backticks for file paths, variable names, and code references
## Git Conventions
- **权威来源**: [`wf/references/git-conventions.md`](wf/references/git-conventions.md)
  —— 集成用户全局 `~/.claude/CLAUDE.md` 的分支/环境/commit 规范 + WF 特定扩展
- Use Conventional Commits format in planned phases
- Scope 约定：`feat(phase-<N>): ...`（阶段执行） / `feat(change-<id>): ...`（变更应用）
- One task = one atomic commit
- Commits created immediately after task verification passes
- No squashing or amending (create new commit instead if corrections needed)
- No `--no-verify` to bypass hooks — fix the root cause instead
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Natural language intent routing to specialized commands
- Multi-phase project execution (discuss → plan → execute → verify)
- Agent-based parallelization with state management
- Quality gates and verification checkpoints
- Hook-based runtime introspection and monitoring
## Layers
- Purpose: Parse natural language input and dispatch to appropriate command
- Location: `commands/wf/` (user-facing command definitions), `wf/workflows/do.md` (routing logic)
- Contains: 9 command entry points and routing logic
- Depends on: UI brand guidelines, command registry
- Used by: End users via `/wf-*` slash commands
- Purpose: Orchestrate the 9 core workflows and agent invocations
- Location: `wf/workflows/` (9 workflow definitions: do.md, new-project.md, discuss-phase.md, plan-phase.md, execute-phase.md, verify-work.md, autonomous.md, quick.md, progress.md)
- Contains: Workflow logic, decision trees, phase progression
- Depends on: State management, reference docs (gates.md, verification-patterns.md)
- Used by: Orchestrator session to invoke agents and control flow
- Purpose: Execute specialized domain tasks in parallel or sequence
- Location: `agents/` (5 sub-agents: wf-planner.md, wf-executor.md, wf-verifier.md, wf-researcher.md, wf-roadmapper.md)
- Contains: Specialized agent instructions and capabilities
- Depends on: State files (.planning/), project context, reference patterns
- Used by: Workflow layer to spawn sub-agents for parallel execution
- Purpose: Maintain project state, requirements, plans, and execution artifacts
- Location: `.planning/` directory structure
- Contains: Project metadata (PROJECT.md), requirements (REQUIREMENTS.md), roadmap (ROADMAP.md), phase-specific artifacts (phase-N/), execution state (STATE.md)
- Depends on: Filesystem, markdown format
- Used by: All layers for context reconstruction and progress tracking
- Purpose: Monitor execution, guard safety, track context budget, display status
- Location: `hooks/` (4 hooks: wf-context-monitor.js, wf-prompt-guard.js, wf-statusline.js), `wf/bin/wf-tools.cjs` (CLI utilities)
- Contains: Hook implementations, state query tools, progress calculation
- Depends on: Session metrics, filesystem state, JSON config
- Used by: Claude Code session lifecycle to inject warnings and context
- Purpose: Define quality gates, verification models, UI conventions, default configurations
- Location: `wf/references/` (gates.md, verification-patterns.md, ui-brand.md), `wf/templates/` (config.json, project.md, requirements.md, roadmap.md, state.md)
- Contains: Policy definitions, template schemas, UI specifications
- Depends on: None (stable reference data)
- Used by: All layers for policy compliance and template rendering
## Data Flow
- Centralized `.planning/` directory: immutable source of truth for each phase
- Per-phase subdirectory (`phase-N/`): CONTEXT.md, DISCUSSION-LOG.md, RESEARCH.md, PLAN*.md, SUMMARY*.md, VERIFICATION.md
- STATE.md: tracks progress, current phase, completion markers
- Config.json: workflow behavior toggles (auto vs. manual gates, parallelization settings)
- Hook runs PostToolUse on Bash|Edit|Write|Agent|Task
- Reads metrics from session statusline: used_pct, remaining_percentage
- Warns at 35% remaining (WARNING), 25% remaining (CRITICAL)
- Debounces warnings (5 calls between repeats) to avoid spam
## Key Abstractions
- Purpose: Represent parallelizable task sets that can run concurrently
- Examples: Task 1.1, 1.2, 1.3 in Wave 1 (no interdependencies)
- Pattern: Within wave = parallelizable; across waves = sequential dependency
- Purpose: Progressively validate that phase goals are achieved, not just tasks completed
- Examples: Verify EXISTS (file present), SUBSTANTIVE (has real implementation), WIRED (integrated into system), DATA-FLOWING (end-to-end functional)
- Pattern: Failures at any level trigger gap closure plan generation
- Purpose: Enforce correctness checkpoints without blocking automated mode
- Examples: Requirements coverage gate (≥90% in PLAN), security gate (threat model vs OWASP Top 10), verification gate (no FAIL results)
- Pattern: Hard gates (must pass, up to 3 retries); soft gates (warning only); gates configurable via config.json
- Purpose: Ensure each task completion is tracked in git with semantic meaning
- Examples: `feat(phase-1): create user model`, `fix(phase-2): resolve auth endpoint validation`
- Pattern: Task → verification → git add → git commit (Conventional Commits format)
## Entry Points
- Location: `commands/wf/do.md`
- Triggers: User natural language via `/wf-do "<description>"`
- Responsibilities: Parse intent → route to best-match command → invoke via Skill()
- `/wf-new-project [--auto]` → `commands/wf/new-project.md`
- `/wf-discuss-phase N [--auto|--chain|--batch]` → `commands/wf/discuss-phase.md`
- `/wf-plan-phase N [--chain|--skip-research]` → `commands/wf/plan-phase.md`
- `/wf-execute-phase N [--wave N|--interactive|--chain]` → `commands/wf/execute-phase.md`
- `/wf-verify-work [--smoke]` → `commands/wf/verify-work.md`
- `/wf-autonomous [--from N|--to N|--only N|--interactive]` → `commands/wf/autonomous.md`
- `/wf-quick <description> [--full|--validate|--discuss|--research]` → `commands/wf/quick.md`
- `/wf-progress` → `commands/wf/progress.md`
- `wf-planner` → `agents/wf-planner.md` — invoked by plan-phase workflow
- `wf-executor` → `agents/wf-executor.md` — invoked by execute-phase workflow (parallel per PLAN file)
- `wf-verifier` → `agents/wf-verifier.md` — invoked by execute-phase/verify-work workflows
- `wf-researcher` → `agents/wf-researcher.md` — invoked by new-project (4 parallel), discuss-phase (optional), plan-phase (optional)
- `wf-roadmapper` → `agents/wf-roadmapper.md` — invoked by new-project workflow
## Error Handling
- Executor discovers bug during task → fix immediately, record in commit message and SUMMARY.md
- Plan quality gate fails → max 3 revision cycles, re-generate PLAN.md
- Verification fails at any level → generate gap-closure plan, execute fixes, re-verify once
- External dependency blocks task → pause with explicit reason, require manual intervention
- Architectural changes discovered → pause immediately (executor must not self-decide)
- Context budget critical → inject warning, suggest saving state, offer session checkpoint
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

## Compact instructions

When compacting this conversation, preserve the following WF workflow state:

1. **Current execution position**: Which phase number, which step (discuss/plan/execute/verify), which wave/task
2. **CONTINUATION checkpoint**: If `.planning/CONTINUATION.md` exists, read it and include its full content in the summary
3. **Pending work**: List of remaining phases/steps that still need execution
4. **Active autonomous mode**: Whether `/wf-autonomous` was running and its flags (--from/--to/--only)
5. **Key decisions**: Any user decisions or confirmations made during this session
6. **Last verification status**: PASS/WARN/FAIL results from the most recent phase

After compaction, immediately check for `.planning/CONTINUATION.md` and resume the workflow from the recorded position. Do NOT ask the user what to do — read the checkpoint and continue automatically.
