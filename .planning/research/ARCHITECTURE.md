# Architecture Patterns: Claude Code Workflow/Plugin Systems

**Domain:** Claude Code workflow orchestration systems
**Researched:** 2026-04-10
**Confidence:** HIGH (direct source code comparison of GSD v1.34.2 vs WF v1.0.0)

## Executive Summary

GSD (Get Shit Done) and WF share the same conceptual architecture: a layered system where a routing layer dispatches user intent to workflows, which orchestrate specialized subagents, backed by file-based state and CLI tooling. The key difference is **maturity depth** -- GSD has 14,620 lines of CLI code across 22 modular library files, while WF has 324 lines in a single monolithic file. GSD's architecture has evolved through ~134 minor versions to solve problems WF hasn't encountered yet: context budget management, agent contracts, workstream isolation, state mutation safety, and compound initialization.

The architectural gap is not in the layering (WF's 6-layer model is sound) but in the **connective tissue** between layers: how state flows, how context is conserved, how agents communicate completion, and how the CLI tool serves as a reliable intermediary between markdown-defined workflows and filesystem state.

## Recommended Architecture

### Target: Enhanced 6-Layer Architecture with GSD Patterns

WF's existing 6 layers are correct. The optimization is about making each layer more robust and context-efficient, not restructuring.

```
User Input
    |
    v
[Routing Layer]  ---- commands/wf/*.md (9 entry points)
    |                  Intent parsing + dispatch
    v
[Workflow Layer]  ---- wf/workflows/*.md (9 workflow definitions)
    |                  Orchestration logic + agent spawning
    |                  NEW: compound init commands (single CLI call per workflow)
    v
[Agent Layer]  ------- agents/wf-*.md (5 subagents)
    |                  Specialized execution
    |                  NEW: completion markers + handoff contracts
    v
[State Layer]  ------- .planning/ directory structure
    |                  All mutations via CLI tool (never direct Write/Edit)
    |                  NEW: frontmatter-based structured state
    v
[Runtime Layer]  ----- hooks/*.js + wf/bin/wf-tools.cjs
    |                  Monitoring, context budget, status display
    |                  NEW: modular CLI with lib/ directory
    v
[Reference Layer]  --- wf/references/*.md + wf/templates/*.md
                       Quality gates, verification patterns, UI brand
                       NEW: agent contracts, anti-patterns, context budget rules
```

### Component Boundaries

| Component | Responsibility | Communicates With | GSD Equivalent |
|-----------|---------------|-------------------|----------------|
| `commands/wf/*.md` | User-facing entry points, arg parsing | Workflow layer (invokes via Skill) | `commands/gsd/*.md` |
| `wf/workflows/*.md` | Orchestration: sequence agents, manage transitions | Agent layer (Task/Agent calls), State layer (via CLI) | `workflows/*.md` (68 files) |
| `agents/wf-*.md` | Execute specialized work (plan, execute, verify, research) | State layer (reads .planning/), produces artifacts | `agents/gsd-*.md` (22+ agents) |
| `wf/bin/wf-tools.cjs` | CLI utility: state CRUD, roadmap analysis, progress | All layers call this for state operations | `bin/gsd-tools.cjs` + `bin/lib/*.cjs` (22 modules) |
| `hooks/wf-*.js` | Runtime monitoring: context budget, prompt guard, statusline | Reads session metrics, injects warnings | (Not separate -- GSD uses config-driven hooks) |
| `wf/references/*.md` | Policy definitions: gates, verification, UI brand | Read by workflows and agents | `references/*.md` (35 files) |
| `wf/templates/*.md` | Document scaffolding | Used by CLI and workflows for file creation | `templates/*.md` (33 files) |
| `.planning/` | Project state persistence | Read/written by all layers via CLI | `.planning/` with workstream support |

### Data Flow

**Current WF Flow (with bottlenecks marked):**

```
User -> /wf-do -> routes to workflow
                      |
                      v
               workflow reads STATE.md, ROADMAP.md    [BOTTLENECK: full file reads]
                      |
                      v
               spawns agent with inline context        [BOTTLENECK: context bloat]
                      |
                      v
               agent reads full PLAN.md, executes
                      |
                      v
               agent writes SUMMARY.md directly        [BOTTLENECK: no structured handoff]
                      |
                      v
               workflow reads SUMMARY.md for routing   [BOTTLENECK: no completion markers]
                      |
                      v
               workflow updates STATE.md via Write      [BOTTLENECK: unsafe direct mutation]
```

**Target WF Flow (GSD pattern):**

```
User -> /wf-do -> routes to workflow
                      |
                      v
               workflow calls: node wf-tools.cjs init <workflow-type> <phase>
                      |                              [SINGLE CLI call returns all context as JSON]
                      v
               workflow parses JSON: paths, flags, models, artifact existence
                      |                              [NO file reads needed -- CLI pre-computed]
                      v
               spawns agent with: "read files at {paths}" 
                      |                              [Agent reads from disk -- owns its context]
                      v
               agent writes artifacts + emits completion marker
                      |                              [STRUCTURED handoff: ## PLAN COMPLETE]
                      v
               workflow detects marker, routes accordingly
                      |
                      v
               workflow calls: node wf-tools.cjs state update/advance/record
                      |                              [ALL mutations via CLI -- safe, atomic]
```

## Patterns to Follow

### Pattern 1: Compound Init Commands (Highest Impact)

**What:** A single CLI call that returns all context needed for a workflow step as a JSON blob. The workflow never reads STATE.md, ROADMAP.md, or config.json directly -- the CLI does it once and returns a pre-computed context packet.

**Why:** This is GSD's single most impactful pattern. It reduces the orchestrator's context consumption from ~5-10 file reads to one CLI call + JSON parse. It also centralizes all "where are things" logic in the CLI, so workflow markdown files stay focused on orchestration logic.

**GSD Example:**
```bash
INIT=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" init execute-phase 3)
# Returns JSON with: executor_model, commit_docs, phase_dir, phase_number, 
# plans[], summaries[], incomplete_plans[], state_path, config_path,
# branch_name, milestone_version, etc.
```

**WF Current State:**
```bash
# WF currently returns minimal JSON:
INIT=$(node wf-tools.cjs init execute-phase)
# Returns: { config: {...}, state: {...}, planning_dir: ".planning" }
# Workflow must then do 4-8 additional file reads to gather equivalent info
```

**WF Target:**
```bash
INIT=$(node wf-tools.cjs init execute-phase 3)
# Should return: { phase_dir, phase_number, phase_name, plans[], summaries[],
#   incomplete_plans[], config_flags, model_config, state_path, has_verification,
#   has_context, has_research }
```

### Pattern 2: Agent Completion Contracts

**What:** Every agent type has a defined completion marker (an H2 heading in its output) and a handoff schema (what data it must include for the next workflow step).

**Why:** Without completion markers, workflows must guess whether an agent succeeded by reading output files. This is fragile and context-expensive. With markers, the workflow can regex-match the agent's last output.

**GSD Implementation:**
```
| Agent | Completion Markers |
|-------|-------------------|
| gsd-planner | ## PLANNING COMPLETE |
| gsd-executor | ## PLAN COMPLETE, ## CHECKPOINT REACHED |
| gsd-verifier | ## Verification Complete |
| gsd-researcher | ## RESEARCH COMPLETE, ## RESEARCH BLOCKED |
```

**WF Gap:** No completion markers defined. Agent success detection relies on checking if output files exist on disk.

### Pattern 3: State Mutation Safety (CLI-Only Writes)

**What:** STATE.md and ROADMAP.md are NEVER written to directly by workflows or agents. All mutations go through `gsd-tools.cjs` commands: `state update`, `state advance-plan`, `state record-metric`, `roadmap update-plan-progress`.

**Why:** Direct Write/Edit to STATE.md creates race conditions in parallel execution and format corruption. The CLI ensures consistent parsing, format preservation, and atomic updates.

**GSD Commands (25+ state mutation operations):**
```bash
gsd-tools state patch --field1 val1 --field2 val2   # Batch update
gsd-tools state advance-plan                          # Increment plan counter
gsd-tools state record-metric --phase 3 --plan 1     # Track execution metrics
gsd-tools state update-progress                       # Recalculate progress bar
gsd-tools state add-decision --summary "chose X"      # Append decision log
gsd-tools state begin-phase --phase 3 --name "Auth"   # Phase transition
```

**WF Current State:**
```bash
wf-tools state set <key> <value>  # Single key-value set only
wf-tools state get <key>          # Single key read
```

Missing: batch updates, progress calculation, metric recording, decision logging, phase transitions.

### Pattern 4: Context Budget Rules as Architecture

**What:** GSD treats context budget management as a first-class architectural concern, with explicit rules in reference docs that all workflows and agents must follow:
1. Never read agent definition files (auto-loaded by `subagent_type`)
2. Never inline large files into subagent prompts (tell agents to read from disk)
3. Read depth scales with context window size (frontmatter-only at 200k, full body at 1M)
4. Delegate heavy work to subagents (orchestrator routes, never executes)
5. 4-tier degradation model: PEAK (0-30%) -> GOOD (30-50%) -> DEGRADING (50-70%) -> POOR (70%+)

**WF Current State:** Context monitor hook exists (WARNING at 35%, CRITICAL at 25%) but no architectural rules about what workflows should read or delegate. Workflows freely read full files regardless of remaining context.

### Pattern 5: Modular CLI with Library Architecture

**What:** GSD's CLI is not one monolithic file. It is a 1,047-line router (`gsd-tools.cjs`) that dispatches to 21 specialized library modules in `bin/lib/`:

| Module | Lines | Purpose |
|--------|-------|---------|
| core.cjs | 1,533 | Path resolution, project root detection, output formatting |
| state.cjs | 1,353 | STATE.md CRUD with format-preserving mutations |
| init.cjs | 1,522 | Compound init commands for all workflows |
| commands.cjs | 1,013 | Git commit, slug generation, progress, scaffolding |
| verify.cjs | 1,032 | Plan structure, phase completeness, reference validation |
| phase.cjs | 931 | Phase CRUD (add, insert, remove, complete, decimal phases) |
| intel.cjs | 660 | Codebase intelligence queries |
| security.cjs | 503 | Path validation, safe JSON parse |
| workstream.cjs | 495 | Parallel milestone workstream support |
| config.cjs | 471 | Configuration management |
| frontmatter.cjs | 381 | YAML frontmatter CRUD |
| learnings.cjs | 378 | Cross-project learning database |
| roadmap.cjs | 353 | Roadmap parsing, phase extraction, progress |
| milestone.cjs | 282 | Milestone archival, phase clearing |
| uat.cjs | 282 | UAT audit, checkpoint rendering |
| template.cjs | 222 | Template selection and filling |
| model-profiles.cjs | 70 | Model selection by agent type |
| ... | ... | ... |

**WF Current State:** Single 324-line file. All functionality is inline. No separation of concerns. Adding new features means the file grows linearly.

### Pattern 6: Reference Documents as Architectural Guardrails

**What:** GSD has 35 reference documents that codify architectural decisions and behavioral rules. These are not just documentation -- they are actively referenced by workflows via `@` includes and by agents via `required_reading`.

**Key reference docs WF is missing:**
| Reference | Purpose | Impact on Quality |
|-----------|---------|-------------------|
| `agent-contracts.md` | Completion markers, handoff schemas | Eliminates agent completion detection bugs |
| `universal-anti-patterns.md` | 27 rules all workflows must follow | Prevents context waste, state corruption |
| `context-budget.md` | Read depth rules by context window | Prevents context exhaustion |
| `continuation-format.md` | Standard "next steps" output format | Consistent UX across all workflows |
| `checkpoints.md` | Human verification/decision protocol | Standardized agent-user interaction |
| `deviation-rules.md` | 4-rule system for unplanned work | Consistent deviation handling |
| `git-integration.md` | Commit conventions, staging rules | Prevents `git add .` disasters |
| `phase-argument-parsing.md` | Standard phase number extraction | Eliminates arg parsing bugs |

## Anti-Patterns to Avoid

### Anti-Pattern 1: Full File Reads in Orchestrator

**What:** Workflow orchestrator reads full STATE.md, ROADMAP.md, config.json, and PLAN.md files directly.
**Why bad:** Each full file read consumes context window. With 5 files at ~100 lines each, that is 500 lines of context consumed before any work begins. Over a multi-phase session, this compounds.
**Instead:** Use compound init commands. The CLI reads files once, extracts only the needed fields, returns structured JSON. The workflow parses the JSON (small footprint).

### Anti-Pattern 2: Monolithic CLI Tool

**What:** All CLI functionality in a single file with no module separation.
**Why bad:** Every new feature adds lines to the same file. No code reuse. Hard to test. Function naming collisions. WF's 324-line file will grow to 1000+ quickly.
**Instead:** Router pattern with `lib/` directory. Each domain (state, phase, roadmap, verify, init) gets its own module.

### Anti-Pattern 3: Direct State File Mutation

**What:** Workflows write to STATE.md using the Write or Edit tool.
**Why bad:** Format corruption (markdown parsing is fragile), race conditions (parallel agents writing simultaneously), loss of audit trail, inconsistent updates (updating progress but not position).
**Instead:** All mutations through CLI commands that parse, validate, and write atomically.

### Anti-Pattern 4: Inlining Context into Agent Prompts

**What:** Orchestrator reads a file and pastes its content into the agent's spawn prompt.
**Why bad:** The content appears in BOTH the orchestrator's context AND the agent's context. Double consumption. GSD's rule: "tell agents to read files from disk instead."
**Instead:** Pass file paths to agents. Agents read what they need from disk, using their own context window.

### Anti-Pattern 5: Missing Agent Handoff Schema

**What:** No defined contract for what an agent must output when it completes.
**Why bad:** The orchestrator cannot reliably detect agent completion or parse agent output. It resorts to reading output files (expensive) or pattern-matching unreliable output.
**Instead:** Define completion markers and required output fields for every agent type.

### Anti-Pattern 6: Hardcoded Planning Directory

**What:** `const PLANNING_DIR = '.planning'` with no project root resolution or workstream support.
**Why bad:** Breaks when Claude Code opens in a subdirectory. Breaks in multi-repo workspaces. Cannot support parallel milestones.
**Instead:** Dynamic project root resolution (walk up to find `.planning/`), workstream-scoped paths.

## Scalability Considerations

| Concern | WF Current | GSD Solution | WF Target |
|---------|------------|--------------|-----------|
| Context exhaustion in long sessions | Hook warning only | Tiered degradation model + read depth rules | Adopt degradation tiers + compound init |
| Parallel agent coordination | Worktree isolation | Worktree + agent tracking + commit routing | Add agent-history.json tracking |
| Multi-repo projects | Not supported | `sub_repos` config + `commit-to-subrepo` | Add sub-repo support in CLI |
| Session resumption | No support | `state record-session` + resume workflow | Add session continuity tracking |
| Milestone progression | Not supported | `milestone complete` + phase archival | Add milestone lifecycle |
| Decimal phase insertion | Not supported | `phase insert` + renumbering | Add decimal phase support |
| State validation | No validation | `validate health --repair` + `validate consistency` | Add state validation commands |
| Cross-project learning | Not supported | `learnings` commands + global learning store | Future enhancement |

## Optimization Priorities (Ranked by Impact)

### Priority 1: Compound Init Commands (CRITICAL)

**Impact:** Eliminates 60-70% of unnecessary context consumption in every workflow invocation.

**Scope:** Expand `wf-tools.cjs init` to return comprehensive JSON for each workflow type. Every workflow should start with exactly one CLI call that returns all paths, flags, states, and artifact existence checks.

**Effort:** Medium. Requires reading WF's existing workflows to catalog what data each one needs, then implementing the `init` subcommands.

### Priority 2: CLI Modularization (HIGH)

**Impact:** Enables all subsequent feature additions. Without modularization, every new feature makes the single file harder to maintain and more bug-prone.

**Scope:** Split `wf-tools.cjs` into router + `lib/` modules: `state.cjs`, `phase.cjs`, `roadmap.cjs`, `init.cjs`, `core.cjs`, `verify.cjs`.

**Effort:** Medium. Mostly mechanical refactoring of existing code + adding new functions.

### Priority 3: State Mutation Safety (HIGH)

**Impact:** Prevents state corruption, enables parallel execution, provides audit trail.

**Scope:** Add CLI commands: `state patch`, `state advance-plan`, `state record-metric`, `state update-progress`, `state begin-phase`, `state add-decision`. Update all workflows to use CLI commands instead of direct Write/Edit.

**Effort:** Medium. New CLI commands + workflow updates.

### Priority 4: Agent Completion Contracts (MEDIUM)

**Impact:** Makes agent-workflow handoff reliable. Eliminates a class of "workflow got confused after agent returned" bugs.

**Scope:** Define completion markers for all 5 WF agents. Add `wf/references/agent-contracts.md`. Update agent definitions to emit markers. Update workflows to detect markers.

**Effort:** Low-Medium. Mostly documentation + small agent prompt changes.

### Priority 5: Context Budget Architecture (MEDIUM)

**Impact:** Prevents context exhaustion in long autonomous runs. Improves quality of later-phase execution.

**Scope:** Add `wf/references/context-budget.md` and `wf/references/anti-patterns.md`. Update workflows to follow read-depth rules. Add context window size to config.

**Effort:** Low. Mostly documentation + workflow prompt updates.

### Priority 6: Reference Document Suite (MEDIUM)

**Impact:** Codifies architectural decisions so they are consistently followed across all workflows and agents.

**Scope:** Add reference docs for: agent contracts, anti-patterns, context budget, continuation format, checkpoint protocol, deviation rules, git integration, phase argument parsing.

**Effort:** Low. Documentation authoring. Can be done incrementally.

### Priority 7: Template Expansion (LOW)

**Impact:** Reduces agent improvisation when creating artifacts. Consistent document structure.

**Scope:** WF has 5 templates; GSD has 33. Prioritize: summary.md, verification-report.md, context.md, phase-prompt.md, debug.md.

**Effort:** Low. Template authoring based on GSD templates.

### Priority 8: Advanced Features (LOW -- FUTURE)

**Impact:** Quality-of-life improvements for complex projects.

**Scope:** Workstream support, milestone lifecycle, cross-project learnings, codebase intelligence, decimal phases, user profiling.

**Effort:** High per feature. These are GSD's mature features that took many iterations.

## Detailed Component Comparison

### CLI Tool Comparison: `wf-tools.cjs` vs `gsd-tools.cjs`

| Capability | WF | GSD | Gap Severity |
|------------|----|----|-------------|
| **State CRUD** | get/set/json (3 ops) | 18 subcommands (load, json, update, get, patch, advance-plan, record-metric, update-progress, add-decision, add-blocker, resolve-blocker, record-session, begin-phase, signal-waiting, signal-resume, planned-phase, validate, sync) | CRITICAL |
| **Roadmap analysis** | Basic phase listing | Full parse with disk status, dependency tracking, checkpoint detection | HIGH |
| **Phase operations** | Info only | next-decimal, add, insert, remove, complete, list | HIGH |
| **Init commands** | Minimal (3 types) | 16 workflow-specific init commands | CRITICAL |
| **Verification** | None | 7 verification subcommands (plan-structure, phase-completeness, references, commits, artifacts, key-links, schema-drift) | HIGH |
| **Git operations** | `git add .planning/` (blanket) | Specific file staging, sub-repo routing, amend support | MEDIUM |
| **Frontmatter** | Not supported | Full CRUD (get, set, merge, validate) | MEDIUM |
| **Template filling** | Not supported | Template selection and variable filling | LOW |
| **Scaffolding** | Not supported | Phase directory, context, UAT, verification scaffolding | LOW |
| **Validation** | Not supported | Consistency checks, health repair, agent installation check | MEDIUM |
| **Milestone ops** | Not supported | Complete, archive, phase clearing | LOW (future) |
| **Project root** | Hardcoded `.planning` | Walk-up resolution, worktree detection, multi-repo support | MEDIUM |
| **Error handling** | Minimal (stderr + exit) | Structured error function, path traversal prevention, flag validation | MEDIUM |
| **Output modes** | stdout JSON | JSON + raw mode + `--pick` field extraction + `@file:` for large output | MEDIUM |

### Workflow Comparison

| Metric | WF | GSD |
|--------|----|----|
| Workflow files | 9 | 68 |
| Total workflow lines | 1,334 | 24,773 |
| Average workflow detail | 148 lines | 364 lines |
| Agent types | 5 | 22+ |
| Reference documents | 3 | 35 |
| Templates | 5 | 33 |
| Context profiles | 0 | 3 (dev, research, review) |

### Hook Comparison

| Capability | WF | GSD |
|------------|----|----|
| Context monitoring | Yes (wf-context-monitor.js) | Config-driven (context-budget.md rules) |
| Prompt guard | Yes (wf-prompt-guard.js) | Not observed as separate hook |
| Status line | Yes (wf-statusline.js) | Not observed as separate hook |
| Debouncing | Yes (5 calls) | Referenced in context budget rules |
| Config toggle | Yes (hooks.context_warnings) | Yes (various config flags) |

## Sources

- GSD source code at `~/.claude/get-shit-done/` (v1.34.2) -- direct analysis
- WF source code at project root -- direct analysis
- GSD reference documents: agent-contracts.md, context-budget.md, universal-anti-patterns.md, gates.md, continuation-format.md
- GSD CLI: gsd-tools.cjs (1,047 lines) + 21 lib modules (13,573 lines)
- WF CLI: wf-tools.cjs (324 lines, monolithic)

---

*Architecture analysis: 2026-04-10*
