# Feature Landscape

**Domain:** Claude Code workflow/project management plugin (WF vs GSD comparison)
**Researched:** 2026-04-10
**Confidence:** HIGH (based on direct source code analysis of both systems)

## Methodology

Every feature below was identified by reading the actual source code of both systems:
- **WF:** 9 commands, 9 workflows, 5 agents, 4 hooks, 1 CLI tool (8 commands)
- **GSD:** 68+ workflows, 68+ skill commands, 21+ CLI lib modules, 35+ reference docs, 33+ templates

This is not a theoretical comparison. Each gap was verified against the actual workflow markdown files and CLI tool source code.

---

## Table Stakes

Features users expect from a mature Claude Code workflow system. Missing any of these makes the system feel incomplete.

| Feature | Why Expected | WF Has? | GSD Has? | Complexity | Notes |
|---------|--------------|---------|----------|------------|-------|
| Session pause/resume | Users switch sessions constantly; losing context kills productivity | NO | YES (pause-work + resume-work + HANDOFF.json) | Med | GSD has both machine-readable JSON and human-readable .continue-here.md |
| Smart next-step routing | Users shouldn't need to memorize which command to run next | PARTIAL (do.md routes) | YES (/gsd-next auto-advances with safety gates) | Low | WF's do.md routes intent but lacks state-aware auto-advancing |
| Milestone lifecycle | Real projects have releases; phases alone aren't enough | NO | YES (new-milestone + complete-milestone + archive) | High | GSD archives roadmaps, requirements, creates git tags, handles versioning |
| Codebase mapping | Brownfield projects need context before planning | NO | YES (map-codebase: 7 documents from parallel agents) | Med | Critical for existing codebases -- WF's new-project assumes greenfield |
| Health check / integrity validation | .planning/ state drifts; users need self-repair | NO | YES (/gsd-health with --repair flag) | Med | GSD validates config, STATE.md, phase numbering, offers auto-repair |
| Todo/idea capture | Ideas arise during work; need zero-friction capture | NO | YES (/gsd-add-todo, /gsd-check-todos, /gsd-note) | Low | Three separate GSD commands for different granularity levels |
| Trivial task shortcut | Config changes, typos shouldn't need full planning | NO | YES (/gsd-fast: inline, no agents, 3-file limit) | Low | WF's /wf-quick still spawns planner+executor for tiny tasks |
| Phase manipulation (add/insert/remove) | Roadmaps evolve; rigid phase lists break | NO | YES (add-phase, insert-phase, remove-phase with renumbering) | Med | GSD supports decimal phases (7.1) for urgent mid-milestone work |
| Settings/configuration UI | Users need to toggle features without editing JSON | NO | YES (/gsd-settings with interactive AskUserQuestion) | Low | WF has config.json but no interactive way to change it |
| Model profile management | Cost control matters; different tasks need different models | NO | YES (quality/balanced/budget/inherit profiles) | Low | GSD routes Opus/Sonnet/Haiku by task type based on profile |

## Feature Gaps: GSD Has, WF Lacks

These are the specific capabilities that give GSD an edge. Organized by impact tier.

### Tier 1: High Impact (directly affects daily workflow quality)

| Feature | GSD Implementation | Impact if WF Adds It | Complexity |
|---------|-------------------|---------------------|------------|
| **Session continuity** (pause/resume) | `/gsd-pause-work` writes HANDOFF.json + .continue-here.md; `/gsd-resume-work` restores full context with smart routing | Eliminates the "where was I?" problem across sessions | Med |
| **Auto-advance** (`/gsd-next`) | Detects project state, routes to next logical step, safety gates (checkpoint, error, verification), consecutive-call guard | Zero-friction progression without memorizing commands | Low-Med |
| **Milestone lifecycle** | `new-milestone` (questioning + research + requirements + roadmap), `complete-milestone` (archive + git tag + PROJECT.md evolution), `audit-milestone` (completion verification) | Supports real multi-release projects instead of single-roadmap | High |
| **Codebase mapping** | `/gsd-map-codebase` spawns 7 parallel mapper agents producing STACK.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, INTEGRATIONS.md, CONCERNS.md; `/gsd-scan` for lightweight single-focus scan | Brownfield projects get proper context before planning | Med |
| **Structured debugging** | `/gsd-debug` gathers symptoms via AskUserQuestion, spawns gsd-debugger agent, persists state in .planning/debug/, survives /clear, supports checkpoints and continuation agents | Systematic debugging that survives context resets | Med-High |
| **Code review** | `/gsd-code-review` computes file scope from SUMMARY/git diff, spawns gsd-code-reviewer agent, produces REVIEW.md; `/gsd-code-review-fix` acts on review findings | Quality gate between execution and shipping | Med |

### Tier 2: Medium Impact (improves DX and covers important edge cases)

| Feature | GSD Implementation | Impact if WF Adds It | Complexity |
|---------|-------------------|---------------------|------------|
| **Phase manipulation** | `add-phase`, `insert-phase` (decimal phases 7.1), `remove-phase` (with renumbering) | Roadmaps can evolve without manual editing | Med |
| **Shipping workflow** | `/gsd-ship` creates PRs from phase work with auto-generated body from SUMMARY/VERIFICATION; `/gsd-pr-branch` filters out .planning/ commits | Clean delivery pipeline from execution to PR | Med |
| **Cross-AI peer review** | `/gsd-review` invokes external CLIs (gemini, claude, codex, coderabbit) to independently review plans | Adversarial review catches blind spots | Med |
| **Test generation** | `/gsd-add-tests` classifies files (TDD/E2E/Skip), generates test plan, writes tests following RED-GREEN | Standardized test coverage post-phase | Med |
| **Docs generation** | `/gsd-docs-update` detects project type, dispatches parallel doc-writer + doc-verifier agents, handles API.md/CONTRIBUTING.md/DEPLOYMENT.md contextually | Documentation that matches live codebase | High |
| **Fast task execution** | `/gsd-fast` runs inline (no agents), max 3 file edits, redirects to /gsd-quick if too complex | Typo fixes without workflow overhead | Low |
| **Idea seeding** | `/gsd-plant-seed` captures forward-looking ideas with trigger conditions; auto-surfaces during new-milestone | Ideas don't get lost; they surface at the right time | Low |
| **Threads** | `/gsd-thread` creates persistent cross-session context stores not tied to any phase | Work that spans sessions without belonging to a phase | Low |
| **Notes** | `/gsd-note` is zero-friction (one Write call), supports list/promote subcommands, global scope fallback | Captures ideas faster than todo system | Low |

### Tier 3: Nice-to-Have (polish and specialized use cases)

| Feature | GSD Implementation | Impact if WF Adds It | Complexity |
|---------|-------------------|---------------------|------------|
| **Workstreams** | `/gsd-workstreams` manages parallel concurrent milestone work (create, switch, progress, complete) | Multi-branch parallel development | High |
| **Intel system** | `/gsd-intel` maintains JSON intelligence files (stack.json, api-map.json, dependency-graph.json, file-roles.json, arch-decisions.json) with freshness tracking | Machine-readable codebase knowledge for agents | High |
| **Explore / ideation** | `/gsd-explore` Socratic questioning, mid-conversation research offers, crystallizes into notes/todos/seeds/requirements/phases | Brainstorming that produces artifacts | Med |
| **User profiling** | `/gsd-profile-user` analyzes session history to build behavioral profile, personalizes Claude responses | Personalized workflow experience | Med |
| **Statistics** | `/gsd-stats` shows comprehensive project metrics (phases, plans, requirements, git, timeline) | Better visibility into project health | Low |
| **Cleanup/archival** | `/gsd-cleanup` archives completed milestone phase dirs to reduce .planning/ clutter | Long-running projects stay organized | Low |
| **Undo** | `/gsd-undo` safely reverts phase/plan commits using git revert (never reset), with dependency checks | Safe rollback without losing history | Med |
| **Import** | `/gsd-import` imports existing docs/PRDs into GSD format | Adoption from existing documentation | Med |
| **Dependency analysis** | `/gsd-analyze-dependencies` examines cross-phase dependencies | Detects ordering issues in roadmap | Low |
| **Discovery phase** | `/gsd-discovery-phase` structured exploration before committing to phases | Reduces planning waste for ambiguous scope | Med |
| **Inbox** (GitHub triage) | `/gsd-inbox` triages open issues/PRs against templates | OSS maintenance workflow | Med |
| **Forensics** | `/gsd-forensics` investigates git/codebase anomalies | Specialized debugging tool | Med |

---

## WF's Existing Strengths (vs GSD)

Features where WF already matches or exceeds GSD.

| Feature | WF Implementation | vs GSD |
|---------|-------------------|--------|
| 4-level verification model | EXISTS > SUBSTANTIVE > WIRED > DATA-FLOWING | More structured than GSD's verification patterns |
| Wave-grouped parallel execution | Tasks grouped into waves, parallel within waves, sequential across | Comparable to GSD's wave system |
| Quality gates (configurable) | Hard gates (3 retries), soft gates (warning), toggle via config.json | Comparable to GSD |
| Context budget monitoring | Hook monitors at 35% WARNING, 25% CRITICAL with debounce | Comparable to GSD |
| Prompt guard | Hook screens for unsafe patterns | GSD has similar but with different patterns |
| Security gate (OWASP) | Threat model check against OWASP Top 10 when enabled | GSD has /gsd-secure-phase with similar scope |
| Chinese language | All docs/prompts in Chinese for native experience | GSD is English-only |

---

## Differentiators

Features WF could build that would set it apart from GSD (not just catch up).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Smarter context management** | WF already has context-monitor hook; could add intelligent context pruning, selective agent context loading based on task type | Med | GSD uses a broad context budget system but doesn't optimize what gets loaded |
| **Phase-aware hook optimization** | Hooks that adapt their behavior based on current workflow stage (less intrusive during research, more guard-rails during execution) | Med | GSD hooks are static; WF could make them dynamic |
| **Granular gate control per phase** | Allow different phases to have different gate configurations (e.g., security gate on auth phases, skip on docs phases) | Low | GSD gates are milestone-wide; per-phase would be smarter |
| **Integrated rollback with state recovery** | Undo that also reverts STATE.md, ROADMAP.md progress markers, not just git commits | Med | GSD's undo only reverts git; planning state is left inconsistent |
| **Agent cost tracking** | Track and report token usage per agent spawn, per phase, per milestone | Low-Med | Neither system tracks this; useful for optimization |
| **Conflict resolution for parallel execution** | When parallel executors modify overlapping files, detect and resolve conflicts before merge | Med | GSD uses worktrees but doesn't handle conflicts structurally |
| **Progressive context loading** | Load only the minimal context for each operation, expanding on demand | Med | Could significantly reduce context waste per operation |

---

## Anti-Features

Features to explicitly NOT build. These look tempting but add complexity without proportional value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full GUI/web dashboard** | Violates CLI-first principle; maintenance burden is enormous; WF exists inside Claude Code | Keep rich terminal output with statusline hook |
| **Multi-user collaboration** | Claude Code is single-user; collaboration adds auth, conflict, sync complexity | One user per .planning/ directory |
| **Plugin/extension system** | Premature abstraction; WF is still stabilizing core features | Keep features as first-class workflows, not plugins |
| **AI model marketplace** | GSD has model profiles, but a marketplace adds dependency management nightmares | Support 3-4 fixed profiles (quality/balanced/budget/inherit) |
| **Automatic PR merge** | Too dangerous without human review; shipping should have human in the loop | Ship workflow creates PR; human merges |
| **Real-time file watching** | Hooks already trigger on tool use; filesystem watchers add complexity and resource drain | Use PostToolUse hooks for reactive behavior |
| **Copying GSD's skill library** | GSD has 80+ domain-specific skills (Unity, marketing, etc.); these are user-specific | Let users add custom skills as needed; don't ship a library |
| **Discord/community features** | Social features don't belong in a workflow tool | Focus on the tool's core value |
| **Workstream parallelism** | GSD's workstreams feature is complex and rarely used; most solo devs work sequentially | Support `--only N` in autonomous for phase-level focus |

---

## Feature Dependencies

```
Codebase Mapping ─── required before ──→ Brownfield new-project flow
                                          │
Settings UI ──────── enables ───────────→ Model Profile Management
                                          │
Pause/Resume ─────── required before ──→ Auto-advance (/next)
       │                                  │
       └── HANDOFF.json format ───────→ Resume-work context detection
                                          │
Milestone Lifecycle ─ requires ────────→ Phase Manipulation (add/insert/remove)
       │                                  │
       └── Archive system ─────────────→ Cleanup workflow
                                          │
Code Review ──────── feeds into ───────→ Ship workflow (PR creation)
       │                                  │
       └── REVIEW.md ──────────────────→ Plan-phase --reviews flag
                                          │
Debug system ─────── independent ──────→ (no dependencies, self-contained)
                                          │
Todo system ──────── feeds into ───────→ /next routing (pending todos surface)
       │                                  │
       └── Note system (lighter) ──────→ Promote to todo
```

---

## CLI Tool Gap Analysis

WF's `wf-tools.cjs` has 8 commands. GSD's `gsd-tools.cjs` has 35+ commands across 21 library modules.

### Critical CLI gaps (needed for table-stakes features):

| GSD CLI Command | Purpose | WF Equivalent | Priority |
|-----------------|---------|---------------|----------|
| `state load` | Full context initialization with config, model profiles | `init <type>` (basic) | HIGH |
| `state patch --field val` | Batch STATE.md updates | None (only single set) | Med |
| `state begin-phase` | Update STATE.md for new phase start | None | Med |
| `state signal-waiting` / `signal-resume` | WAITING.json for pause/resume | None | HIGH |
| `resolve-model <agent-type>` | Model selection by profile | None | Med |
| `find-phase <phase>` | Robust phase directory lookup (handles decimals) | `phase info` (basic) | Med |
| `verify-summary <path>` | Summary quality validation | None | Med |
| `phase add/insert/remove/complete` | Phase manipulation operations | None | HIGH |
| `roadmap get-phase` / `update-plan-progress` | Granular roadmap operations | `roadmap analyze` only | Med |
| `requirements mark-complete` | Mark REQ-IDs as done | None | Med |
| `milestone complete` | Archive milestone with phase archival | None | HIGH |
| `validate consistency` / `health` | Integrity checks with repair | None | HIGH |
| `scaffold context/uat/verification` | Template scaffolding per phase | None | Med |
| `frontmatter get/set/merge/validate` | Structured frontmatter CRUD | None | Med |
| `verify plan-structure` | Plan quality validation | None | Med |
| `websearch` | Brave API search for research agents | None | LOW |
| `commit <msg> --files` | Selective file commit | `commit <msg>` (adds all of .planning/) | Med |

### Reference docs gap:

GSD has 35 reference documents. WF has 3 (gates.md, ui-brand.md, verification-patterns.md).

Key missing references:
- **questioning.md** -- How to ask good questions in discuss-phase
- **agent-contracts.md** -- What each agent type must produce
- **context-budget.md** -- Context management strategies
- **continuation-format.md** -- How handoff/resume files work
- **git-integration.md** -- Git workflow patterns
- **model-profiles.md** -- Model selection per task
- **universal-anti-patterns.md** -- Patterns all agents must avoid
- **thinking-models-*.md** -- Optimization guides for reasoning models

---

## MVP Recommendation

For the optimization milestone, prioritize in this order:

### Wave 1: Foundation fixes (fix what exists)
1. **Harden wf-tools.cjs** -- Add error handling, selective file commits, batch state updates
2. **Add settings command** -- Interactive config.json editing via AskUserQuestion
3. **Add /wf-fast** -- Inline trivial task execution (no agents, 3-file limit)
4. **Improve do.md routing** -- Add state-aware routing (not just intent matching)

### Wave 2: Session continuity (biggest daily pain point)
5. **Add pause-work** -- Write HANDOFF.json + .continue-here.md
6. **Add resume-work** -- Restore context from handoff, detect incomplete work
7. **Add /wf-next** -- Auto-advance to next logical step with safety gates

### Wave 3: Lifecycle completeness
8. **Add phase manipulation** -- add-phase, insert-phase, remove-phase
9. **Add milestone lifecycle** -- new-milestone, complete-milestone with archival
10. **Add codebase mapping** -- For brownfield project support

### Defer these:
- **Debug system** -- Complex, high-value but standalone. Good Phase 2 candidate.
- **Code review / Ship** -- Important but requires stable execution first.
- **Intel system** -- Power feature, not needed for core workflow.
- **Workstreams** -- Rarely needed for solo dev.
- **User profiling** -- Nice-to-have, not essential.
- **Cross-AI review** -- Novel but niche.

---

## Quantitative Summary

| Metric | WF | GSD | Gap |
|--------|-----|-----|-----|
| Commands | 9 | 68+ | 59+ |
| Workflows | 9 | 68 | 59 |
| Agents | 5 | 8+ specialized types | 3+ |
| Hooks | 4 | similar | 0 |
| CLI commands | 8 | 35+ | 27+ |
| Reference docs | 3 | 35 | 32 |
| Templates | 5 | 33+ | 28+ |
| Lifecycle support | Single roadmap | Multi-milestone with archival | Major gap |
| Session management | None | Pause + Resume + Handoff | Major gap |
| Code quality tools | Verification only | Review + Test + Docs | Major gap |

---

## Sources

- Direct source code analysis of WF system at `/Users/zxs/Desktop/claude-code-config/`
- Direct source code analysis of GSD system at `~/.claude/get-shit-done/`
- GSD skill definitions at `~/.claude/skills/gsd-*/SKILL.md`
- Confidence: HIGH -- all findings verified against actual source files
