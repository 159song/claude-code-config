# Technology Stack

**Project:** WF Workflow System Optimization
**Researched:** 2026-04-10
**Overall Confidence:** HIGH (verified against official Claude Code docs at code.claude.com + GSD reference system at ~/.claude/get-shit-done/)

## Executive Summary

WF is a Claude Code personal configuration system (hooks, commands, agents, CLI tools) built with JavaScript/Node.js and Markdown. This research identifies the optimal stack for optimizing WF by examining the Claude Code extension ecosystem as of v2.1.98, comparing against the GSD reference system, and recommending specific approaches for each WF component.

The key finding: **WF's current tech choices (Node.js CJS, Markdown-based commands/agents, JSON state management) are correct for the Claude Code ecosystem.** The optimization opportunity is not in changing technologies but in adopting patterns GSD uses that WF lacks, leveraging new Claude Code APIs (Skills, agent hooks, persistent memory, HTTP hooks), and modularizing WF's monolithic wf-tools.cjs.

## Recommended Stack

### Core Runtime

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js (CJS) | System Node (18+) | Hooks, CLI tools, statusline | Claude Code hooks execute via `node` command. CJS is mandatory -- hooks must work without build step. ESM would require `--experimental-modules` flag or `.mjs` extension which adds fragility. GSD uses CJS exclusively. |
| Bash | System shell | SessionStart hooks, simple guards | Simpler hooks that just read files or run basic checks. Bash is lighter than Node for trivial operations. |
| Markdown + YAML frontmatter | N/A | Commands, agents, skills, workflows | This IS the Claude Code extension format. No alternative exists. YAML frontmatter defines metadata (name, description, tools, model). Markdown body defines system prompt / instructions. |
| JSON | N/A | State persistence, configuration | Claude Code config files (settings.json, .mcp.json) are JSON. WF state (.planning/config.json) should remain JSON. Markdown for human-readable state (STATE.md, ROADMAP.md). |

**Confidence: HIGH** -- Verified against Claude Code v2.1.98 official docs and GSD codebase.

### Hook Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| stdin JSON protocol | Claude Code native | Hook input/output | All hooks receive JSON on stdin with session_id, cwd, tool_name, tool_input. Output via stdout JSON with hookSpecificOutput. Exit 0 = success, exit 2 = block. This is the ONLY interface. |
| /tmp bridge files | N/A | Inter-hook communication | statusline writes metrics to /tmp/claude-ctx-{session}.json, context-monitor reads them. This pattern is correct -- hooks have no shared memory. GSD uses identical pattern. |
| Debounce via /tmp state | N/A | Warning frequency control | Store warning counters in /tmp files. GSD and WF both use this. No better alternative in stateless hook model. |

**Confidence: HIGH** -- Verified against official hooks documentation.

### CLI Tools Architecture

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js CJS (modular lib/) | N/A | wf-tools.cjs with lib/ modules | GSD's architecture: thin entry point (1047 lines) dispatching to 21 specialized modules in lib/ totaling ~500KB. WF has a single 324-line file. Modularizing enables testability, maintainability, and feature parity. |
| process.argv parsing | Built-in | CLI argument handling | No npm dependencies allowed -- hooks/tools must work with zero `npm install`. GSD parses argv manually. Keep it simple. |
| fs + path (built-in) | Built-in | File operations | All state is filesystem-based (.planning/ directory). No database, no network calls. This is correct for the domain. |

**Confidence: HIGH** -- Direct comparison of WF (324 lines) vs GSD (21 modules, ~500KB).

### Extension Points (Claude Code APIs to Leverage)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Skills (SKILL.md) | Claude Code 2.1+ | Supplement or eventually replace commands/ | Skills are the modern evolution of commands/. They support: supporting files directory, model invocation control (disable-model-invocation), path-based activation, context: fork for subagent execution, shell injection (!`command`), and $ARGUMENTS substitution. WF should adopt skills format for new functionality. |
| Agent frontmatter hooks | Claude Code 2.1+ | Per-agent lifecycle hooks | Agents can define PreToolUse/PostToolUse/Stop hooks in their YAML frontmatter. WF agents don't use this -- they should for safety guardrails per-agent. |
| Agent persistent memory | Claude Code 2.1+ | Cross-session agent learning | `memory: user\|project\|local` field in agent frontmatter. Agents get a persistent directory (~/.claude/agent-memory/) to accumulate knowledge across sessions. WF agents should use this for learning patterns. |
| Agent isolation: worktree | Claude Code 2.1+ | Parallel safe execution | `isolation: worktree` runs agent in temporary git worktree with automatic cleanup. WF execute-phase describes worktree isolation in workflow docs but should use the native API field. |
| Agent effort level | Claude Code 2.1+ | Quality control per agent | `effort: low\|medium\|high\|max` in agent frontmatter. Use `high` for executor/verifier, `low` for lightweight reconnaissance agents. |
| Agent model selection | Claude Code 2.1+ | Cost/speed optimization | `model: sonnet\|opus\|haiku\|inherit` per agent. Use haiku for researcher exploration, opus for complex execution. |
| Agent background execution | Claude Code 2.1+ | Non-blocking parallel work | `background: true` runs agent concurrently. Permission prompts are pre-approved before launch. |
| HTTP hooks | Claude Code 2.1+ | Webhook integration | `type: http` hooks POST to endpoints. Could enable external monitoring. Lower priority. |
| Prompt/Agent hooks | Claude Code 2.1+ | LLM-evaluated guards | `type: prompt` and `type: agent` hooks use LLM to evaluate conditions. More flexible than regex-based guards. Consider for prompt-guard evolution. |

**Confidence: HIGH** -- All features verified in official Claude Code documentation.

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Markdown with structured patterns | N/A | Human-readable state (STATE.md, ROADMAP.md) | Markdown is both human-readable and agent-readable. The `**Key:** Value` pattern for state extraction is proven in both GSD and WF. Keep it. |
| YAML frontmatter in plan files | N/A | Machine-readable metadata | PLAN.md files should use YAML frontmatter for wave, depends_on, files_modified. GSD has a full frontmatter CRUD system (get/set/merge/validate). WF should add this. |
| JSON config | N/A | Workflow configuration | .planning/config.json for behavior toggles. Keep JSON for machine-parseable config. |

**Confidence: HIGH** -- Both GSD and WF use this pattern successfully.

## Comparison: WF vs GSD Component Coverage

### Hooks (4 vs 8)

| Hook | GSD Has | WF Has | Gap |
|------|---------|--------|-----|
| SessionStart (state injection) | gsd-session-state.sh | wf-session-state.sh | Parity |
| PostToolUse (context monitor) | gsd-context-monitor.js | wf-context-monitor.js | Near parity (GSD has Gemini AfterTool support) |
| PreToolUse (prompt guard) | gsd-prompt-guard.js | wf-prompt-guard.js | Near parity |
| PreToolUse (read guard) | gsd-read-guard.js | -- | **MISSING**: prevents infinite edit-without-read loops |
| PreToolUse (workflow guard) | gsd-workflow-guard.js | -- | **MISSING**: warns when editing files outside workflow |
| PreToolUse (commit validator) | gsd-validate-commit.sh | -- | **MISSING**: enforces Conventional Commits format |
| PostToolUse (phase boundary) | gsd-phase-boundary.sh | -- | **MISSING**: detects phase boundary crossings |
| SessionStart (update checker) | gsd-check-update.js | -- | Low priority (personal config, not distributing) |
| Statusline | gsd-statusline.js | wf-statusline.js | Near parity (GSD has update notification) |

### CLI Tools (324 lines vs 21 modules)

| Capability | GSD Has | WF Has | Gap Severity |
|------------|---------|--------|-------------|
| State CRUD | Full (load/get/set/json/patch/begin-phase/signal-waiting/signal-resume) | Basic (get/set/json) | **HIGH**: missing batch update, phase begin, waiting signals |
| Roadmap operations | get-phase, analyze, update-plan-progress | analyze only | **MEDIUM**: missing per-phase extraction, progress update |
| Phase operations | next-decimal, add, insert, remove, complete | info only | **HIGH**: no phase lifecycle management |
| Frontmatter CRUD | get/set/merge/validate with plan/summary/verification schemas | None | **HIGH**: missing entirely |
| Verification suite | plan-structure validation, summary verification | None | **HIGH**: missing entirely |
| Requirements ops | mark-complete by ID | None | **MEDIUM** |
| Milestone ops | complete with archive, MILESTONES.md generation | None | **LOW** (personal config) |
| Validation | consistency check, health check with --repair, agent installation check | None | **HIGH**: missing entirely |
| Progress rendering | json/table/bar formats | Basic json only | **MEDIUM** |
| Git commit | Smart commit with file routing, sub-repo support | Basic commit only | **MEDIUM** |
| Scaffolding | context/uat/verification/phase-dir template generation | None | **MEDIUM** |
| Intel system | query/status/update/diff/snapshot/validate/extract-exports | None | **LOW** (complex, personal config) |
| Web search | Brave API integration | None | **LOW** |
| Model profiles | Agent-specific model resolution | None | **LOW** (use native agent model field) |
| Modular structure | 21 lib/ modules organized by domain | Single 324-line file | **CRITICAL**: fundamental architecture gap |

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| TypeScript for hooks/tools | No build step allowed. Hooks must execute directly via `node`. TypeScript compilation adds complexity and a build requirement that would break in arbitrary project directories. GSD is pure CJS and it works. |
| ESM modules | CJS is simpler for CLI tools that need `require()`. ESM would require `.mjs` extensions or package.json type:module which can conflict with project configurations where WF is installed. |
| npm dependencies (any) | Hooks run in arbitrary project directories. Cannot assume `node_modules` exists. Must use only Node.js built-in modules (fs, path, os, crypto, child_process). GSD has zero npm dependencies and this is by design. |
| Database (SQLite, etc.) | Overkill. .planning/ directory with markdown/json files is the correct persistence layer. Both GSD and Claude Code itself use filesystem state. |
| YAML for config files | JSON is the Claude Code standard (settings.json, .mcp.json, config.json). YAML is only for frontmatter in markdown files. Don't introduce a third config format. |
| React/Vue/Web UI | Explicitly out of scope per PROJECT.md. WF is a CLI system operating within Claude Code sessions. |
| Shell scripts for complex hooks | Bash is fine for simple hooks (session-state, phase-boundary). Complex logic (JSON parsing, state management, debouncing) must be Node.js. GSD's validate-commit.sh already uses `node -e` for JSON parsing inside bash -- this is a code smell that should be pure Node. |
| jq for JSON processing | Not guaranteed to be installed on all systems. GSD explicitly avoids jq dependency by using `node -e` inline. All JSON processing should be in Node.js. |
| Plugin packaging (for now) | WF is a personal config at project .claude/ level. Plugin format adds namespace prefix (plugin-name:skill-name) and distribution complexity. Convert to plugin format only if sharing with others later. The architecture should be plugin-compatible but not plugin-packaged. |
| Commander.js / yargs | External CLI framework dependency. Not allowed in zero-dependency environment. GSD's manual arg parsing via process.argv works for 50+ commands. |
| Jest / Vitest | No test framework needed for hooks/CLI tools that run as one-shot processes. Validate by running workflows. GSD also has no test suite. |

## How WF Should Relate to GSD

GSD is the reference system but WF should NOT copy it wholesale:

| Aspect | Approach | Rationale |
|--------|----------|-----------|
| Architecture patterns | **Adopt**: Modular lib/ structure, frontmatter CRUD, state snapshot, validation commands | These are proven patterns that solve real problems WF faces |
| Hook coverage | **Adopt**: Add read-guard, workflow-guard, commit-validator, phase-boundary | Direct feature gaps causing workflow fragility |
| CLI tool depth | **Selectively adopt**: Phase lifecycle, frontmatter ops, scaffolding, validation | Skip intel system (too complex for personal config), model profiles (use native agent model field instead) |
| New Claude Code APIs | **Surpass GSD**: Use native agent memory, isolation, effort, hooks frontmatter, skills | These APIs may have been released after GSD's architecture was designed. WF has the opportunity to be more modern. |
| Workflow design | **Maintain independence**: 9-command model, 4-level verification, wave grouping | These are WF's design strengths and differentiators |
| Language | **Maintain Chinese**: Documentation and user-facing messages stay Chinese | Per PROJECT.md constraints. Chinese is WF's identity. |

## Target Architecture for wf-tools.cjs Modularization

```
wf/bin/
  wf-tools.cjs              # Entry point: arg parsing + dispatch (~300 lines)
  lib/
    core.cjs                 # Shared utilities, path helpers, output formatting, planning dir resolution
    state.cjs                # STATE.md CRUD (get/set/patch/json/begin-phase/signal)
    roadmap.cjs              # ROADMAP.md parsing, per-phase extraction, progress table update
    phase.cjs                # Phase lifecycle (add, complete, info, next-decimal)
    frontmatter.cjs          # YAML frontmatter CRUD (get/set/merge/validate)
    verify.cjs               # Plan structure validation, summary verification
    scaffold.cjs             # Template rendering and file scaffolding
    progress.cjs             # Progress calculation, json/table/bar rendering
    config.cjs               # Config.json management, defaults, validation
    commit.cjs               # Git commit with smart file staging
```

Estimated: ~10 modules, each 200-400 lines, totaling ~3000 lines. This brings WF from 324 lines to feature parity with GSD's most important capabilities while remaining maintainable.

## New Claude Code APIs -- Implementation Priority

### Priority 1: Agent Enhancements (High Impact, Low Effort)

Add native Claude Code agent features via frontmatter:

```yaml
# Example: Enhanced wf-executor agent
---
name: wf-executor
description: Executes PLAN.md tasks with atomic commits
tools: Read, Write, Edit, Bash, Glob, Grep
memory: project
isolation: worktree
effort: high
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "node .claude/hooks/wf-validate-commit.sh"
  Stop:
    - hooks:
        - type: command
          command: "node .claude/wf/bin/wf-tools.cjs state set last_executor_result success"
---
```

### Priority 2: Missing Hooks (High Impact, Low Effort)

Add the 4 missing hooks following GSD's proven patterns:

| New Hook | File | Effort | Impact |
|----------|------|--------|--------|
| Read guard | wf-read-guard.js | ~80 lines | Prevents edit-without-read infinite loops |
| Workflow guard | wf-workflow-guard.js | ~95 lines | Warns on edits outside workflow context |
| Commit validator | wf-validate-commit.sh or .js | ~50 lines | Enforces Conventional Commits |
| Phase boundary | wf-phase-boundary.sh | ~40 lines | Detects when work crosses phase boundaries |

### Priority 3: CLI Modularization (High Impact, Medium Effort)

Restructure wf-tools.cjs into modular lib/ following the architecture above. This is the prerequisite for adding all missing CLI capabilities.

### Priority 4: Skills Format (Medium Impact, Medium Effort)

Create skills for frequently-used workflows:

```yaml
# .claude/skills/wf-quick/SKILL.md
---
name: wf-quick
description: Quick task execution for small changes without full phase ceremony
disable-model-invocation: true
context: fork
allowed-tools: Read Write Edit Bash Glob Grep
---
```

## Sources

| Source | Type | Confidence |
|--------|------|-----------|
| https://code.claude.com/docs/en/hooks | Official documentation (comprehensive hook API reference) | HIGH |
| https://code.claude.com/docs/en/sub-agents | Official documentation (agent frontmatter, memory, isolation) | HIGH |
| https://code.claude.com/docs/en/skills | Official documentation (skills format, invocation control) | HIGH |
| https://code.claude.com/docs/en/plugins | Official documentation (plugin structure, distribution) | HIGH |
| https://code.claude.com/docs/en/commands | Official documentation (commands reference) | HIGH |
| ~/.claude/get-shit-done/ (local filesystem) | GSD v1.34.2 reference codebase, directly inspected | HIGH |
| /Users/zxs/Desktop/claude-code-config/ (local filesystem) | WF v1.0.0 current codebase, directly inspected | HIGH |
| Claude Code v2.1.98 (local installation) | Runtime version verification | HIGH |

---

*Stack research: 2026-04-10*
