# External Integrations

**Analysis Date:** 2026-04-13

## APIs & External Services

**Claude Code IDE:**
- Claude Code Hooks system - Native IDE integration
  - Hook types: SessionStart, PreToolUse, PostToolUse, StatusLine
  - Hook protocol: JSON stdin/stdout communication
  - Implementation: `hooks/wf-*.js` (Node.js executable scripts)

**Claude AI Models:**
- Agent orchestration via Claude models
  - Planner agent (`agents/wf-planner.md`) - Model: Sonnet 4.6
  - Executor agent (`agents/wf-executor.md`) - Model: Sonnet 4.6
  - Verifier agent (`agents/wf-verifier.md`) - Model: Sonnet 4.6
  - Researcher agent (`agents/wf-researcher.md`) - Model: Haiku 4.5
  - Roadmapper agent (`agents/wf-roadmapper.md`) - Model: Haiku 4.5
  - Reviewer agent (`agents/wf-reviewer.md`) - Model: Sonnet 4.6
  - Auth: Via Claude Code IDE session (implicit, no explicit API keys in config)
  - Config: `wf/templates/config.json` under `agents.models`

## Data Storage

**Databases:**
- Not applicable - No database backend used

**File Storage:**
- Local filesystem only
  - Project state: `.planning/` directory structure
  - Phase artifacts: `.planning/phases/NN-*/` subdirectories
  - Session state: `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`
  - Configuration: `.planning/config.json`
  - Temporary metrics: `/tmp/claude-ctx-{session_id}.json` (session context tracking)
  - Session bridge: `/tmp/wf-session-{session_id}.json` (inter-hook communication)
  - Todo tracking: `$HOME/.claude/todos/` (from Claude Code todo system)

**Caching:**
- Session metrics cache in `/tmp/` for inter-hook communication
  - Context metrics: `/tmp/claude-ctx-{session_id}.json`
  - Session state bridge: `/tmp/wf-session-{session_id}.json`
  - Warning state: `/tmp/claude-ctx-{session_id}-warned.json` (debounce tracking)
  - Auto-cleanup: Handled by OS tmpdir rotation (no explicit cleanup in code)

## Authentication & Identity

**Auth Provider:**
- Claude Code IDE session context (implicit)
  - Session ID passed via hook stdin: `data.session_id`
  - Workspace context passed via hook stdin: `data.workspace.current_dir`
  - Model selection passed via hook stdin: `data.model.display_name`
  - Context window metrics passed via hook stdin: `data.context_window.remaining_percentage`
  - No explicit credentials required in configuration files

**Security Checks:**
- Session ID validation: Regex check `/[/\\]|\.\./` to prevent path traversal (all hooks: `wf-context-monitor.js`, `wf-statusline.js`, `wf-session-state.js`)
- Path traversal prevention: `sessionId` validated before file operations
- Prompt injection detection: `wf-prompt-guard.js` scans `.planning/` writes for 15+ injection patterns

## Monitoring & Observability

**Error Tracking:**
- Not applicable - No error tracking service integrated

**Logs:**
- Hook output via stdout/stderr to Claude Code IDE
  - JSON-structured output for hook communication
  - Human-readable Chinese text for user-facing messages
  - Context warnings injected via `PostToolUse` hook when context < 35% remaining
  - Prompt injection warnings injected via `PreToolUse` hook
- Debug capability: Session state logs available in `.planning/STATE.md` and phase subdirectories

**Status Monitoring:**
- Real-time context usage via `wf-statusline.js`
  - Displays: Model name | Current task | Directory | Context usage %
  - Progress bar: 10-segment filled/empty bar with color coding (green <50%, yellow <65%, orange <80%, red ≥80%)
  - Status update: Every statusline refresh (native Claude Code integration)

**Metrics Collected:**
- Context window usage: `remaining_percentage`, `used_pct`
- Session state: Current phase, workflow step (discuss/plan/execute/verify/done)
- Progress tracking: Phase completion %, milestone status

## CI/CD & Deployment

**Hosting:**
- Local IDE extension (no cloud deployment)
- Installation target: `$HOME/.claude/` directory in any project

**CI Pipeline:**
- Not applicable - No CI/CD pipeline (local-only execution)

**Version Control Integration:**
- Git integration via `wf/bin/lib/git.cjs`
  - Commit generation at task completion
  - Conventional Commits format: `<type>(<scope>): <description>`
  - Semantic versioning tracked in `VERSION` file

## Environment Configuration

**Required env vars:**
- `HOME` - Used to locate `.claude/` configuration directory
- `CLAUDE_CONFIG_DIR` - Optional override for `.claude/` location (defaults to `$HOME/.claude`)
- `PATH` - Standard system path (for Node.js discovery)

**Optional env vars:**
- None documented in codebase

**Secrets location:**
- Not applicable - No API keys or secrets stored in this project
- Projects using WF workflow may store secrets in `.env` (not committed)
- Validation at startup: `wf/bin/lib/validate.cjs` (no current secret validation implemented)

## Webhooks & Callbacks

**Incoming:**
- Not applicable - No webhook endpoints

**Outgoing:**
- Not applicable - No webhook callbacks

## Hook Communication Protocol

**Stdin/Stdout JSON Protocol:**
- All hooks receive JSON on stdin containing:
  - `session_id` - Unique session identifier
  - `cwd` - Current working directory
  - `model` - Model information (for statusline)
  - `workspace` - Workspace context
  - `context_window` - Remaining context percentage
  - `tool_name` - Tool being used (PreToolUse only)
  - `tool_input` - Tool parameters (PreToolUse only)

- All hooks return JSON on stdout with structure:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse|PostToolUse|StatusLine",
    "additionalContext": "user-facing message"
  }
}
```

## Cross-Hook Communication

**Bridge Files in /tmp/:**
- `claude-ctx-{session_id}.json` - Context metrics written by statusline, read by context-monitor
  - Contains: `remaining_percentage`, `used_pct`, `session_id`, `timestamp`
  - Used for context warning triggering (35% threshold WARNING, 25% CRITICAL)
- `wf-session-{session_id}.json` - Session state written by session-state hook, available for all hooks
  - Contains: `phase`, `step`, `status`, `progress_pct`, `milestone`, `has_handoff`, `resume_hint`

## Configuration Integration

**Workflow Behavior:**
- `wf/templates/config.json` loaded from `.planning/config.json` in projects
  - `mode`: "auto" | "manual" (workflow execution mode)
  - `workflow.research`: Enable/disable researcher agent
  - `workflow.plan_check`: Enable/disable plan quality gates
  - `workflow.verifier`: Enable/disable verification phase
  - `workflow.security_enforcement`: Enable/disable security checks
  - `workflow.code_review`: Enable/disable code review
  - `workflow.code_review_auto_fix`: Auto-fix code review findings
  - `workflow.code_review_max_iterations`: Max retries for code review (default: 3)
  - `agents.models`: Per-agent model selection (planner, executor, verifier, researcher, roadmapper, reviewer)
  - `parallelization.enabled`: Enable parallel agent execution
  - `parallelization.max_concurrent_agents`: Max concurrent agents (default: 3)
  - `gates.confirm_*`: Quality gates requiring user confirmation
  - `safety.always_confirm_external_services`: Confirm before external integrations
  - `hooks.context_warnings`: Enable/disable context warning injection

---

*Integration audit: 2026-04-13*
