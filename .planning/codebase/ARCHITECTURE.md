# Architecture

**Analysis Date:** 2026-04-13

## Pattern Overview

**Overall:** Multi-layer orchestrated workflow system with natural language intent routing, agent-based task execution, and state-driven progression.

**Key Characteristics:**
- Event-driven architecture integrated with Claude Code IDE hooks
- Markdown-based workflow definitions executed through agent coordination
- Centralized `.planning/` directory as immutable source of truth
- Progressive validation model (exists → substantive → wired → data-flowing)
- Quality gates at every phase transition

## Layers

**Command Routing Layer:**
- Purpose: Parse natural language input and dispatch to appropriate commands
- Location: `commands/wf/` (user-facing command definitions), `wf/workflows/do.md` (intent routing logic)
- Contains: 9 command entry points (`do.md`, `new-project.md`, `discuss-phase.md`, `plan-phase.md`, `execute-phase.md`, `verify-work.md`, `autonomous.md`, `quick.md`, `progress.md`)
- Depends on: Command registry, routing patterns, UI brand guidelines
- Used by: End users via `/wf-*` slash commands in Claude Code

**Workflow Orchestration Layer:**
- Purpose: Orchestrate the 9 core workflows and coordinate agent invocations
- Location: `wf/workflows/` (9 workflow definitions corresponding to commands)
- Contains: Workflow logic, decision trees, phase progression logic, gate checks
- Depends on: State management (`.planning/`), reference docs (`gates.md`, `verification-patterns.md`), configuration
- Used by: Orchestrator session to invoke sub-agents and control execution flow

**Agent Execution Layer:**
- Purpose: Execute specialized domain tasks in parallel or sequence
- Location: `agents/` (5 core agents: `wf-planner.md`, `wf-executor.md`, `wf-verifier.md`, `wf-researcher.md`, `wf-roadmapper.md`)
- Contains: Specialized agent instructions, input/output contracts, domain logic
- Depends on: State files (`.planning/`), project context, codebase inspection patterns
- Used by: Workflow layer to spawn sub-agents for parallel or sequential execution

**State Management Layer:**
- Purpose: Maintain project state, requirements, plans, and execution artifacts
- Location: `.planning/` directory structure (immutable, central source of truth)
- Contains: Project metadata (`PROJECT.md`), requirements (`REQUIREMENTS.md`), roadmap (`ROADMAP.md`), phase-specific artifacts (`phase-N/`), execution state (`STATE.md`)
- Depends on: Filesystem, markdown format, YAML frontmatter
- Used by: All layers for context reconstruction and progress tracking; serialized to JSON for state queries

**Runtime Monitoring & Safety Layer:**
- Purpose: Monitor execution, guard safety boundaries, track context budget, display status
- Location: `hooks/` (4 hooks), `wf/bin/wf-tools.cjs` (CLI utilities)
- Contains: Hook implementations (`wf-context-monitor.js`, `wf-prompt-guard.js`, `wf-statusline.js`, `wf-session-state.js`), state query tools, progress calculation utilities
- Depends on: Session metrics (written by statusline hook to `/tmp/claude-ctx-{session_id}.json`), filesystem state, JSON configuration
- Used by: Claude Code session lifecycle to inject context, warnings, and real-time status

**References & Templates Layer:**
- Purpose: Define quality gates, verification models, UI conventions, default configurations
- Location: `wf/references/` (policy docs), `wf/templates/` (template schemas)
- Contains: Gate definitions (`gates.md`), verification patterns (`verification-patterns.md`), UI branding (`ui-brand.md`), JSON config template, markdown templates
- Depends on: None (stable reference data)
- Used by: All layers for policy compliance, template rendering, and standard patterns

## Data Flow

**State Progression:**

1. **Project initialization:** User → `/wf-new-project` → 4 parallel researchers → roadmapper → `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`

2. **Phase discussion:** `/wf-discuss-phase N` → loads `ROADMAP.md` + `REQUIREMENTS.md` → optional researcher → saves to `.planning/phase-N/CONTEXT.md` + `.planning/phase-N/DISCUSSION-LOG.md`

3. **Phase planning:** `/wf-plan-phase N` → loads `CONTEXT.md` → optional researcher → planner agent → generates `.planning/phase-N/PLAN.md` (or PLAN-A/B/C for parallel plans) → quality gates check → `PLAN.md` locked

4. **Phase execution:** `/wf-execute-phase N` → loads `PLAN.md` → splits by wave → N executors (one per worktree per PLAN variant) → each executor: task → verify → git commit → repeat → verifier validates → generates `.planning/phase-N/SUMMARY.md` + `.planning/phase-N/VERIFICATION.md`

5. **Final verification:** `/wf-verify-work` → reads all `SUMMARY.md` → UAT loop → saves `.planning/UAT.md`

**Central State Flows:**

- `STATE.md`: Tracks current phase, completion status, blockers, timestamps
- `config.json`: Workflow behavior toggles (auto vs. manual gates, parallelization settings, model assignments)
- Hook metrics: Context monitor writes to `/tmp/claude-ctx-{session_id}.json` (updated by statusline hook, read by context-monitor hook for warnings)
- Phase-N directory: Per-phase immutable artifact container; enables resumability via `resume_from` parameter

## Key Abstractions

**Wave:**
- Purpose: Represent parallelizable task sets that can run concurrently within a phase
- Examples: Task 1.1, 1.2, 1.3 in Wave 1 have no interdependencies; Task 2.1 depends on Wave 1 completion
- Pattern: Within wave = parallelizable (N executors); across waves = sequential dependency; enforced in planner

**Verification Level:**
- Purpose: Progressively validate that phase goals are achieved, not just tasks completed
- Examples: 
  - EXISTS: File created (`git ls-files` check)
  - SUBSTANTIVE: Has real implementation (>5 lines of meaningful code)
  - WIRED: Integrated into system (imports used, no unused exports)
  - DATA-FLOWING: End-to-end functional (tests pass, integration points work)
- Pattern: Failures at any level trigger gap closure plan generation; verifier generates remedial tasks

**Quality Gate:**
- Purpose: Enforce correctness checkpoints without blocking automated mode
- Examples: 
  - Requirements coverage gate: ≥90% of `REQUIREMENTS.md` items mapped to `PLAN.md` tasks
  - Security gate: Threat model vs. OWASP Top 10 checklist
  - Verification gate: No FAIL results in `VERIFICATION.md`
- Pattern: Hard gates (must pass, max 3 retries); soft gates (warning only); gates configurable via `config.json`

**Atomic Commit:**
- Purpose: Ensure each task completion is tracked in git with semantic meaning
- Examples: `feat(phase-1): create user model`, `fix(phase-2): resolve auth endpoint validation`, `test(phase-3): add integration tests`
- Pattern: Task → verification → `git add {files}` → `git commit -m "type(phase-N): description"` (Conventional Commits format)

## Entry Points

**User-Facing Commands:**
- `/wf-do "<description>"` → `commands/wf/do.md` → routes to best-match command via intent parsing
- `/wf-new-project [--auto]` → `commands/wf/new-project.md` → `wf/workflows/new-project.md`
- `/wf-discuss-phase N [--auto|--chain|--batch]` → `commands/wf/discuss-phase.md` → `wf/workflows/discuss-phase.md`
- `/wf-plan-phase N [--chain|--skip-research]` → `commands/wf/plan-phase.md` → `wf/workflows/plan-phase.md`
- `/wf-execute-phase N [--wave N|--interactive|--chain]` → `commands/wf/execute-phase.md` → `wf/workflows/execute-phase.md`
- `/wf-verify-work [--smoke]` → `commands/wf/verify-work.md` → `wf/workflows/verify-work.md`
- `/wf-autonomous [--from N|--to N|--only N|--interactive]` → `commands/wf/autonomous.md` → `wf/workflows/autonomous.md` (loops through phases B1→B2→B3)
- `/wf-quick <description> [--full|--validate|--discuss|--research]` → `commands/wf/quick.md` → `wf/workflows/quick.md`
- `/wf-progress` → `commands/wf/progress.md` → `wf/workflows/progress.md`

**Agent Entry Points:**
- `wf-planner` (agent) → invoked by `wf/workflows/plan-phase.md` → input contract: phase, context_md, requirements_md, config → output: `.planning/phase-N/PLAN.md`
- `wf-executor` (agent) → invoked by `wf/workflows/execute-phase.md` (parallel, N agents) → input contract: phase, plan_path, context_md, session_id, resume_from → output: `.planning/phase-N/SUMMARY.md` + git commits
- `wf-verifier` (agent) → invoked by `wf/workflows/execute-phase.md` post-execution → input contract: phase, summary_md → output: `.planning/phase-N/VERIFICATION.md`
- `wf-researcher` (agent) → invoked by `/wf-new-project` (×4 parallel), `/wf-discuss-phase` (optional), `/wf-plan-phase` (optional) → input contract: topic, scope, depth
- `wf-roadmapper` (agent) → invoked by `/wf-new-project` → input contract: project_context, requirements → output: `.planning/ROADMAP.md`, `.planning/STATE.md`

**Hook Entry Points (Session Lifecycle):**
- `SessionStart` → `hooks/wf-session-state.sh` → injects `.planning/STATE.md` summary into session context
- `PreToolUse (Write|Edit)` → `hooks/wf-prompt-guard.js` → scans `.planning/` write content for injection patterns, validates schema
- `PostToolUse (Bash|Edit|Write|Agent|Task)` → `hooks/wf-context-monitor.js` → checks context usage, injects WARNING (≤35%) or CRITICAL (≤25%) message
- `StatusLine (continuous)` → `hooks/wf-statusline.js` → displays real-time status: "WF │ Model │ Task │ Dir │ ██░░ 47%"

## Error Handling

**Executor discovers bug during task execution:**
- Fix immediately within executor agent
- Record fix details in commit message and phase `SUMMARY.md`
- Verification re-checks fixed code; if still fails, escalate to gap closure

**Plan quality gate fails:**
- Max 3 revision cycles; return to planner agent
- Planner re-generates `PLAN.md` addressing gate failures
- Retry quality checks
- If 3rd cycle fails, pause with detailed gap analysis

**Verification fails at any level:**
- Generate gap closure plan (verifier agent)
- Execute remedial tasks
- Re-verify once
- If still fails, escalate to user with explicit gap details

**External dependency blocks task:**
- Pause execution with explicit reason recorded in `SUMMARY.md`
- Require manual intervention; offer continuation via resume_from parameter
- User can retry after resolving blocker

**Architectural change discovered during execution:**
- Pause immediately (executor must not self-decide architectural changes)
- Escalate to user with context
- User decides: revise plan, abort phase, or continue with workaround

**Context budget critical:**
- Hook injects CRITICAL warning suggesting state save
- Offer session checkpoint: save `STATE.md` + git commit + pause
- User can resume in new session via `/wf-progress` + phase resume

## Cross-Cutting Concerns

**Logging:**
- Hook scripts use structured JSON output: `process.stdout.write(JSON.stringify(output))`
- Agent markdown files document decisions in frontmatter (YAML) and body sections
- Markdown state files use YAML frontmatter for metadata (phase, status, timestamps)
- CLI tool (`wf-tools.cjs`) writes debug/progress to stdout, errors to stderr

**Validation:**
- State files validated on read: schema version check, required fields check
- Phase artifacts validated before gate transition: coverage >= 90%, no broken references
- Configuration validated on load: known keys only, type checking for toggles/numbers

**Authentication:**
- Not managed by WF system; assumes Claude Code IDE session is authenticated
- `session_id` used for temporary metric files, not for secrets
- All secret management delegated to `.planning/config.json` and environment

**Parallelization:**
- Controlled via `config.json`: `parallelization.enabled`, `max_concurrent_agents`
- Within-wave parallelization: N executors (one per PLAN variant or subtask)
- Each executor runs in isolated worktree (Git worktree feature)
- Cross-wave sequential; enforced by workflow orchestrator
- Merges between waves; conflict detection via Git

---

*Architecture analysis: 2026-04-13*
