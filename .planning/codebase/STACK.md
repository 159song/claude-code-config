# Technology Stack

**Analysis Date:** 2026-04-13

## Languages

**Primary:**
- JavaScript - Runtime for hook scripts and CLI tools, executed via Node.js CommonJS
- Markdown - Workflow definitions, documentation, state management, and agent instructions

**Secondary:**
- Bash - Session initialization and shell integration (deprecated in favor of Node.js hooks as of D-14)
- JSON - Configuration files and state serialization

## Runtime

**Environment:**
- Node.js v14+ (CommonJS) - Declared in `package.json` as `{"type":"commonjs"}`
- macOS, Linux, Windows (WSL/Git Bash) supported

**Package Manager:**
- npm - Implicit from `package.json`
- Lockfile: Not present (zero external dependencies, minimal footprint)

## Frameworks

**Core:**
- Claude Code Hooks system - Event-driven architecture integrated with Claude Code IDE
  - SessionStart hook: `hooks/wf-session-state.js`
  - PreToolUse hook: `hooks/wf-prompt-guard.js`
  - PostToolUse hook: `hooks/wf-context-monitor.js`
  - StatusLine hook: `hooks/wf-statusline.js`
- Custom workflow engine - Markdown-based workflow definitions executed by Claude agent orchestrator
  - Workflow layer: `wf/workflows/` (9 workflow definitions)
  - Agent layer: `agents/` (5 sub-agents for specialized tasks)

**Build/Dev:**
- No build step required - pure Node.js CommonJS scripts with no transpilation
- No external build tools (webpack, esbuild, Vite, etc.)

## Key Dependencies

**Critical:**
- Node.js standard library modules only:
  - `fs` - File I/O and state management
  - `path` - Cross-platform path handling
  - `os` - Temporary directory and home directory detection
  - No npm packages (zero external dependencies to minimize bloat and security surface)

## Configuration

**Environment:**
- No `.env` files used in production
- No secrets or API keys in source code
- Configuration via `settings.json` → copied to `.claude/settings.json` at installation time

**Build:**
- `package.json` - CommonJS declaration only (`{"type":"commonjs"}`)
- `settings.json` - Claude Code hook bindings (SessionStart, PreToolUse, PostToolUse, StatusLine)
- `.planning/config.json` - Workflow behavior configuration (mode, gates, safety rules, agent models)
- `wf/templates/config.json` - Template for new projects

**Hook Configuration:**
- SessionStart: Runs `wf-session-state.js` to detect workflow state and emit context
- PostToolUse: Runs `wf-context-monitor.js` on Bash|Edit|Write|MultiEdit|Agent|Task events (timeout: 10s)
- PreToolUse: Runs `wf-prompt-guard.js` on Write|Edit events to detect prompt injection (timeout: 5s)
- StatusLine: Runs `wf-statusline.js` to display model, task, context usage, and progress

## Platform Requirements

**Development:**
- Node.js v14+
- Bash shell (for wf-session-state.sh, now being replaced by wf-session-state.js per D-14)
- Claude Code IDE with hooks support
- Git (implied by workflow system for commit operations)

**Production:**
- Claude Code IDE (primary platform)
- Installation target: `.claude/` directory in any project root
- No server/cloud deployment; runs as local IDE extension
- Cross-platform: macOS (primary development), Linux (Bash compatible), Windows (WSL/Git Bash)

## Installation Structure

- Files from repository root are copied to project's `.claude/` directory during installation
- Command files contain `{{WF_ROOT}}` placeholder replaced with actual installation path at install time
- Version declared in `VERSION` file at root: `1.0.0`

## Version Management

- `VERSION` file: `1.0.0` (semantic versioning)
- Version available at `wf/VERSION` after installation
- Backward compatibility maintained with Claude Code hook/command/agent specifications

---

*Stack analysis: 2026-04-13*
