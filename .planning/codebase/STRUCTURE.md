# Codebase Structure

**Analysis Date:** 2026-04-13

## Directory Layout

```
/Users/zxs/Desktop/claude-code-config/
├── VERSION                                  # Semantic version: "1.0.0"
├── package.json                             # CommonJS declaration
├── settings.json                            # Hook configuration (installed to .claude/settings.json)
├── CLAUDE.md                                # Project documentation (includes ARCHITECTURE, CONVENTIONS)
├── README.md                                # Installation and usage guide
├── ARCHITECTURE.md                          # Architecture diagram and workflow
│
├── wf/                                      # Core workflow system
│   ├── bin/
│   │   ├── wf-tools.cjs                     # CLI utilities: state query, roadmap analysis, progress calculation
│   │   └── lib/                             # Utilities library for bin/
│   │
│   ├── workflows/                           # 9 orchestration workflow definitions
│   │   ├── do.md                            # Natural language intent routing (dispatcher)
│   │   ├── new-project.md                   # Project initialization orchestration
│   │   ├── discuss-phase.md                 # Phase discussion orchestration
│   │   ├── plan-phase.md                    # Phase planning orchestration
│   │   ├── execute-phase.md                 # Phase execution orchestration
│   │   ├── verify-work.md                   # Final verification orchestration
│   │   ├── autonomous.md                    # Full-automation mode (loops all phases)
│   │   ├── quick.md                         # Quick task execution (off-roadmap)
│   │   ├── progress.md                      # Progress tracking and intelligent routing
│   │   ├── code-review.md                   # Code review coordination
│   │   ├── pause.md                         # Pause/checkpoint workflow
│   │   ├── resume.md                        # Resume from checkpoint
│   │   ├── new-milestone.md                 # Milestone creation
│   │   ├── complete-milestone.md            # Milestone completion
│   │   ├── next.md                          # Smart next-step routing
│   │   └── settings.md                      # Configuration management
│   │
│   ├── references/                          # Stable reference documentation
│   │   ├── gates.md                         # Quality gate definitions (hard/soft gates)
│   │   ├── verification-patterns.md         # 4-level verification model (EXISTS→SUBSTANTIVE→WIRED→DATA-FLOWING)
│   │   ├── ui-brand.md                      # UI/output conventions (banners, checkmarks, symbols)
│   │   ├── anti-patterns.md                 # Common pitfalls to avoid
│   │   ├── agent-contracts.md               # Agent input/output contract specifications
│   │   └── continuation-format.md           # State continuation and resumption format
│   │
│   └── templates/                           # Project template files
│       ├── config.json                      # Workflow configuration template (auto mode defaults)
│       ├── project.md                       # Project documentation template
│       ├── state.md                         # State file template
│       ├── roadmap.md                       # Roadmap template
│       └── requirements.md                  # Requirements template
│
├── commands/wf/                             # 9 user-facing command definitions (installed to .claude/commands/wf/)
│   ├── do.md                                # /wf-do <description> — dispatcher
│   ├── new-project.md                       # /wf-new-project [--auto]
│   ├── discuss-phase.md                     # /wf-discuss-phase <N> [--auto|--chain|--batch]
│   ├── plan-phase.md                        # /wf-plan-phase <N> [--chain|--skip-research]
│   ├── execute-phase.md                     # /wf-execute-phase <N> [--wave N|--interactive|--chain]
│   ├── verify-work.md                       # /wf-verify-work [--smoke]
│   ├── autonomous.md                        # /wf-autonomous [--from N|--to N|--only N|--interactive]
│   ├── quick.md                             # /wf-quick <description> [--full|--validate|--discuss|--research]
│   ├── progress.md                          # /wf-progress
│   ├── code-review.md                       # /wf-code-review
│   ├── pause.md                             # /wf-pause
│   ├── resume.md                            # /wf-resume
│   ├── new-milestone.md                     # /wf-new-milestone <name>
│   ├── complete-milestone.md                # /wf-complete-milestone <N>
│   ├── next.md                              # /wf-next
│   └── settings.md                          # /wf-settings
│
├── agents/                                  # 5 core sub-agents (installed to .claude/agents/)
│   ├── wf-planner.md                        # Plan generation: task decomposition, wave grouping, dependency analysis
│   ├── wf-executor.md                       # Task execution: per-task implementation, atomic commits, deviation handling
│   ├── wf-verifier.md                       # Verification: 4-level validation, requirement coverage, anti-pattern scanning
│   ├── wf-researcher.md                     # Technical research: architecture, patterns, risk analysis
│   ├── wf-roadmapper.md                     # Roadmap design: phase decomposition, requirement mapping
│   └── wf-reviewer.md                       # Code review coordination and feedback
│
├── hooks/                                   # 4 Claude Code hooks (installed to .claude/hooks/)
│   ├── wf-session-state.js                  # SessionStart: inject .planning/STATE.md summary to session context
│   ├── wf-context-monitor.js                # PostToolUse: monitor context budget, inject warnings (WARNING ≤35%, CRITICAL ≤25%)
│   ├── wf-prompt-guard.js                   # PreToolUse: detect prompt injection patterns in .planning/ writes
│   └── wf-statusline.js                     # StatusLine: display real-time status (WF │ Model │ Task │ Dir │ ██░░ 47%)
│
├── .claude/                                 # Claude Code runtime configuration (populated at install time)
│   ├── package.json                         # CommonJS declaration
│   ├── settings.json                        # Hook binding configuration
│   ├── commands/wf/                         # Symlink or copy of commands/wf/
│   ├── agents/                              # Symlink or copy of agents/
│   ├── hooks/                               # Symlink or copy of hooks/
│   └── wf/                                  # Copy of wf/ directory
│
├── .planning/                               # Project state directory (created at /wf-new-project)
│   ├── codebase/                            # Codebase analysis documents (GSD integration)
│   │   ├── ARCHITECTURE.md                  # This file
│   │   ├── STRUCTURE.md                     # Directory and file organization
│   │   ├── STACK.md                         # Technology stack
│   │   ├── INTEGRATIONS.md                  # External service integrations
│   │   ├── CONVENTIONS.md                   # Code style and naming conventions
│   │   ├── TESTING.md                       # Testing patterns and frameworks
│   │   └── CONCERNS.md                      # Technical debt and issues
│   │
│   ├── PROJECT.md                           # Project overview and metadata
│   ├── config.json                          # Workflow behavior configuration (auto/manual gates, parallelization)
│   ├── REQUIREMENTS.md                      # Functional and non-functional requirements
│   ├── ROADMAP.md                           # Phase breakdown and milestone mapping
│   ├── STATE.md                             # Current execution state (phase, progress, blockers, timestamps)
│   │
│   ├── phase-1/
│   │   ├── CONTEXT.md                       # Phase context and assumptions
│   │   ├── DISCUSSION-LOG.md                # Design decision log
│   │   ├── RESEARCH.md                      # Technical research findings
│   │   ├── PLAN.md                          # Task breakdown (or PLAN-A.md, PLAN-B.md for parallel plans)
│   │   ├── THREAT-MODEL.md                  # Security threat analysis (if security_enforcement enabled)
│   │   ├── SUMMARY.md                       # Execution summary (or SUMMARY-A.md, SUMMARY-B.md)
│   │   └── VERIFICATION.md                  # 4-level verification results
│   │
│   ├── phase-2/ ... phase-N/                # Repeated structure for each phase
│   │
│   ├── research/                            # New-project research artifacts
│   │   └── SUMMARY.md                       # Research findings from 4 parallel researchers
│   │
│   └── UAT.md                               # User acceptance test results (from /wf-verify-work)
│
└── .git/                                    # Git repository metadata
```

## Directory Purposes

**`wf/workflows/`:**
- Purpose: Orchestration logic for each major workflow step
- Contains: 15 markdown files, each with frontmatter (name, description, tools/references) and process steps
- Usage: Invoked by user commands; routes to agents; manages gate checks and state transitions
- Key files: `do.md` (dispatcher), `autonomous.md` (full automation), `execute-phase.md` (wave-based execution)

**`wf/references/`:**
- Purpose: Stable policy and pattern documentation
- Contains: Gate definitions, verification models, UI branding, anti-patterns, agent contracts
- Usage: Referenced by workflows and agents; not modified during execution
- Immutable: These are never rewritten; only referenced

**`wf/templates/`:**
- Purpose: Template files for new projects
- Contains: JSON schema (config) and markdown templates (project, state, roadmap, requirements)
- Usage: Copied into `.planning/` at project creation; used as base for state files
- Customization: Templates can be modified to change defaults for new projects

**`commands/wf/`:**
- Purpose: User-facing command definitions
- Contains: 16 markdown files; each defines a command entry point
- Usage: Symlinked or copied to `~/.claude/commands/wf/` at install time
- Pattern: Each command references its corresponding workflow in `wf/workflows/`

**`agents/`:**
- Purpose: Specialized agent behavior specifications
- Contains: 6 markdown files with input contracts, role definition, process steps
- Usage: Invoked by workflows via agent orchestrator
- Contract-based: Input and output contracts define agent responsibilities

**`hooks/`:**
- Purpose: Claude Code IDE integration points
- Contains: 4 Node.js scripts (CommonJS, standalone)
- Usage: Installed to `~/.claude/hooks/` and triggered by IDE events
- Event triggers: SessionStart, PreToolUse, PostToolUse, StatusLine

**`.planning/` (in target project):**
- Purpose: Central immutable source of truth for project execution state
- Created by: `/wf-new-project` command
- Structure: Hierarchical; top-level for project, per-phase subdirectories for artifacts
- Immutability: Append-only logs (SUMMARY.md); overwrite only at explicit transition points (PLAN.md, STATE.md)

## Key File Locations

**Entry Points:**
- `commands/wf/do.md`: Primary user dispatcher; analyzes natural language, routes to best command
- `wf/workflows/do.md`: Dispatcher implementation; matches intent patterns
- `wf/workflows/autonomous.md`: Recommended entry point for full project automation

**Configuration:**
- `wf/templates/config.json`: Default workflow config template (auto mode, gates, parallelization, model assignments)
- `.planning/config.json` (in target project): Active configuration for project execution
- `settings.json`: Hook configuration; copied to `.claude/settings.json` at install

**Core Logic:**
- `agents/wf-executor.md`: Task execution logic; handles verification, commits, error recovery
- `agents/wf-planner.md`: Plan generation; task decomposition, wave grouping, quality gates
- `agents/wf-verifier.md`: Verification logic; 4-level validation, gap analysis

**Testing & Verification:**
- `wf/references/verification-patterns.md`: Defines 4-level verification model; used by verifier agent
- `wf/references/gates.md`: Gate definitions; checked by workflow layer

**State & Progress:**
- `.planning/STATE.md`: Current execution state; read by `wf-progress`, `wf-session-state.js`
- `wf/bin/wf-tools.cjs`: CLI utilities to query and update state files

## Naming Conventions

**Files:**
- Kebab-case with prefix: `wf-*.md` (agent/command/workflow/hook files), `*.md` (documentation)
- Example: `wf-executor.md`, `discuss-phase.md`, `wf-context-monitor.js`

**Directories:**
- Kebab-case: `wf/`, `workflows/`, `references/`, `templates/`, `commands/`, `agents/`, `hooks/`
- Phase directories: `phase-N/` (numeric phase number)

**Functions & Variables (JavaScript):**
- camelCase: `createSession()`, `validateCredentials()`, `processToolInput()`
- Constants: `UPPER_SNAKE_CASE`: `WARNING_THRESHOLD`, `CRITICAL_THRESHOLD`
- Descriptive names: `sessionId`, `filePath`, `usableRemaining`, `stdinTimeout`

**Configuration Properties (JSON):**
- camelCase: `config.workflow.research`, `config.parallelization.enabled`, `config.agents.models.executor`

**Markdown Frontmatter (YAML):**
- Use for metadata in agent/command/workflow files: `name`, `description`, `tools`, `model`
- Example: `model: inherit` (use parent session model), `model: sonnet` (explicit model assignment)

**Git Commits (Conventional Commits):**
- Format: `type(phase-N): description`
- Types: `feat` (new feature), `fix` (bug fix), `refactor` (refactoring), `test` (test addition), `docs` (documentation), `chore` (maintenance)
- Example: `feat(phase-1): create user authentication model`

## Where to Add New Code

**New Workflow Command:**
1. Create `commands/wf/{command-name}.md` with command entry point
2. Create `wf/workflows/{command-name}.md` with orchestration logic
3. Reference in `wf/workflows/do.md` dispatcher routing table
4. Update `commands/wf/do.md` if adding new intent pattern

**New Agent (specialized task):**
1. Create `agents/wf-{agent-name}.md` with input/output contracts
2. Define role, process steps, and error handling
3. Reference in relevant workflow file (e.g., `execute-phase.md`)
4. Assign model via `config.json`: `agents.models.{agent-name}`

**New Hook (IDE integration):**
1. Create `hooks/wf-{hook-name}.js` (Node.js CommonJS)
2. Add to `settings.json` under `hooks.{hook-type}` (SessionStart, PreToolUse, PostToolUse, StatusLine)
3. Read from stdin (JSON input), write to stdout (JSON output), exit code 0
4. Follow error handling pattern: try/catch with silent failure on non-critical errors

**New Reference Document:**
1. Create `wf/references/{document-name}.md` (e.g., `performance-patterns.md`)
2. Document stable patterns, policies, or verification models
3. Reference from workflows and agents where relevant
4. Keep immutable; only append new content or versioned sections

**New Workflow State File (in `.planning/`):**
- Templates exist in `wf/templates/`; copy and customize
- Use YAML frontmatter for metadata: `phase`, `status`, `updated`, `author`
- Use markdown tables for structured data (requirements, phases, verification results)
- Append-only within phase; overwrite at explicit transition points

## Special Directories

**`wf/bin/`:**
- Purpose: CLI utilities for state queries and calculations
- Generated: No (hand-written utilities)
- Committed: Yes (part of configuration repo)
- Usage: Called by hooks and workflows to read/update state
- Main tool: `wf-tools.cjs` — state query, roadmap analysis, progress calculation

**`.planning/` (in target project):**
- Purpose: Project state and execution artifacts
- Generated: Yes (created by `/wf-new-project`)
- Committed: Yes (critical project history)
- Lifecycle: Created → appended to during execution → never deleted
- Resumability: All phase artifacts support continuation via explicit `resume_from` parameter

**`.claude/` (in target project):**
- Purpose: Installation target for WF configuration
- Generated: Yes (at install time via copy/symlink)
- Committed: No (generated, not part of source repo)
- Contents: Copies/symlinks of `wf/`, `commands/`, `agents/`, `hooks/`, `settings.json`
- Placeholder replacement: `{{WF_ROOT}}` in command files replaced with actual installation path

**`phase-N/` subdirectories:**
- Purpose: Per-phase immutable artifact containers
- Lifecycle: Created at `/wf-discuss-phase`, appended during planning/execution, locked after verification
- Structure: Immutable reads; append-only logs (SUMMARY.md); overwrite at transition (PLAN.md)
- Isolation: Each phase independent; enables resumption and analysis per phase

---

*Structure analysis: 2026-04-13*
