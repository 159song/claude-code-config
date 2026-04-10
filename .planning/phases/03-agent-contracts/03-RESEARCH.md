# Phase 3: Agent Contracts - Research

**Researched:** 2026-04-10
**Domain:** Claude Code subagent system -- contracts, completion markers, context budget, native API fields
**Confidence:** HIGH

## Summary

Phase 3 adds structured input/output contracts and completion markers to the 5 WF agents (executor, planner, verifier, researcher, roadmapper), enables context-budget-aware execution in the executor agent, and aligns agent configuration with Claude Code's native subagent API fields. The primary technical challenge is designing a completion marker system that workflows can reliably parse to determine agent success/failure and route accordingly.

Claude Code's subagent system provides native frontmatter fields including `model`, `memory`, `effort`, `isolation`, `maxTurns`, `skills`, `hooks`, `permissionMode`, and `color`. The current WF agents use only `name`, `description`, and `tools` in their frontmatter. The key opportunity is to leverage `model`, `effort`, and `isolation` natively rather than hand-rolling configuration for these capabilities.

Context budget detection can reuse the existing `/tmp/claude-ctx-{session_id}.json` bridge file written by `wf-statusline.js`. The executor agent reads `used_pct` from this file between task boundaries and triggers a graceful save-and-stop when usage hits 70%.

**Primary recommendation:** Add `<input_contract>` and `<output_contract>` structured blocks to each agent .md file, implement JSON completion markers via stdout in the agent's final output, add context budget checking logic to the executor agent instructions, extend `config.json` with `agents.models` configuration, and create `wf/references/agent-contracts.md` as the unified contract reference document.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** All 5 agents return structured JSON completion markers: `{ status: 'complete'|'partial'|'failed', artifacts: [...], summary: '...' }`
- **D-02:** Minimal field set: status, artifacts (file path array), summary (short text). No tasks_done/tasks_total fields
- **D-03:** Workflow orchestrator parses JSON status field to determine success/failure/partial and auto-routes
- **D-04:** Executor reads `/tmp/claude-ctx-{session_id}.json` (existing statusline bridge file) between tasks
- **D-05:** At 70% context usage, executor saves progress: partial SUMMARY.md (done/pending marks) + `status: 'partial'` in completion marker
- **D-06:** Recovery: next executor session reads partial SUMMARY.md, resumes from pending tasks
- **D-07:** Each agent .md file gets `<input_contract>` and `<output_contract>` structured blocks
- **D-08:** Workflow constructs agent prompt per contract, ensuring structured input
- **D-09:** On agent failure (status:'failed'), orchestrator retries once with error info; second failure logs and reports to user
- **D-10:** Only executor uses `isolation: "worktree"`; other agents read files or write to .planning/ only
- **D-11:** Model field driven by config.json per agent type (e.g., executor: 'sonnet', researcher: 'haiku')
- **D-12:** Agent frontmatter includes model config key name (not hardcoded model name); resolved from config.json at runtime

### Claude's Discretion
- Whether completion marker JSON needs additional metadata (duration, context_used)
- Each agent's specific input_contract/output_contract field definitions
- config.json agent model configuration key naming and defaults
- agent-contracts.md reference document organization structure

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGENT-01 | Define completion markers and handoff patterns for all 5 agents | Completion marker JSON format defined (D-01/D-02), workflow parsing logic (D-03), retry semantics (D-09). Claude Code subagent API documented with all frontmatter fields |
| AGENT-02 | Executor adds context budget awareness (70% save-and-stop) | Bridge file format verified (`/tmp/claude-ctx-{session_id}.json` with `used_pct` field), threshold logic pattern from existing context-monitor hook, partial SUMMARY.md format (D-05), resume mechanism (D-06) |
| AGENT-03 | Agents use native Claude Code API fields (memory, isolation, effort) | Full frontmatter field inventory verified from official docs: model, effort, isolation, memory, maxTurns, skills, hooks, permissionMode, color, background. Model resolution order documented |
| AGENT-04 | agent-contracts.md reference document defines input/output contracts for each agent type | Contract block format (`<input_contract>`/`<output_contract>`), per-agent field definitions researched, document structure designed |
</phase_requirements>

## Standard Stack

This phase involves no new library installations. All work is in Markdown agent definitions, workflow instruction files, and config.json extension. The technology is:

### Core
| Technology | Version | Purpose | Why Standard |
|------------|---------|---------|--------------|
| Claude Code Subagent API | Current (2026) | Native agent frontmatter fields | Official platform API -- model, effort, isolation, memory are native fields [VERIFIED: code.claude.com/docs/en/sub-agents] |
| Node.js CommonJS | v14+ | CLI tools and hooks | Existing project stack [VERIFIED: codebase] |
| Markdown + YAML frontmatter | N/A | Agent definition files | Claude Code standard agent format [VERIFIED: code.claude.com/docs/en/sub-agents] |
| JSON | N/A | Completion markers, config | Existing project pattern for structured output [VERIFIED: codebase] |

### Supporting
| Technology | Purpose | When to Use |
|------------|---------|-------------|
| `wf-tools.cjs` CLI | Config reading, state management | Reading agent model config at runtime |
| `/tmp/claude-ctx-{session_id}.json` | Context metrics bridge | Executor reads this for budget awareness |

**Installation:** No new dependencies needed. Pure Markdown, JSON, and existing Node.js infrastructure.

## Architecture Patterns

### File Modification Map

```
agents/
  wf-executor.md       # Add input/output contract blocks, context budget instructions, model/effort frontmatter
  wf-planner.md        # Add input/output contract blocks, model frontmatter
  wf-verifier.md       # Add input/output contract blocks, model frontmatter
  wf-researcher.md     # Add input/output contract blocks, model frontmatter
  wf-roadmapper.md     # Add input/output contract blocks, model frontmatter

wf/workflows/
  execute-phase.md     # Update Agent() prompt construction and return parsing
  plan-phase.md        # Update Agent() prompt construction and return parsing
  new-project.md       # Update Agent() prompt construction and return parsing
  discuss-phase.md     # Update Agent() prompt construction and return parsing
  quick.md             # Update Agent() prompt construction and return parsing
  verify-work.md       # Update Agent() prompt construction (if uses verifier)

wf/references/
  agent-contracts.md   # NEW: unified contract reference document

wf/templates/
  config.json          # Add agents.models configuration section
```

### Pattern 1: Agent Completion Marker

**What:** Each agent outputs a structured JSON block as its final action, enabling workflow orchestrators to parse and route.
**When to use:** Every agent invocation must end with this pattern.

The completion marker is embedded in the agent's final textual output. The workflow orchestrator extracts the JSON from the agent's response text.

```markdown
<!-- In agent .md instructions -->
## Completion

When finished, output a JSON completion marker as your FINAL output:

\`\`\`json
{
  "status": "complete",
  "artifacts": [
    ".planning/phase-{N}/PLAN.md"
  ],
  "summary": "Generated execution plan: 12 tasks in 3 waves, 95% requirement coverage"
}
\`\`\`

Status values:
- `"complete"` -- all work done successfully
- `"partial"` -- some work done, rest saved for continuation (context budget or blocking issue)
- `"failed"` -- could not complete, error details in summary
```

[VERIFIED: codebase pattern -- hooks already use `process.stdout.write(JSON.stringify(output))` for structured communication]

### Pattern 2: Input/Output Contract Blocks

**What:** Structured XML-like blocks in agent .md files that define expected inputs and outputs.
**When to use:** Every agent definition file.

```markdown
<!-- In agent .md file -->
<input_contract>
## Input Contract

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| phase | number | Phase number being planned |
| goal | string | Phase goal statement |
| context_md | filepath | Path to CONTEXT.md |
| requirements_md | filepath | Path to REQUIREMENTS.md |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| research_md | filepath | Path to RESEARCH.md (if exists) |
| roadmap_md | filepath | Path to ROADMAP.md |
</input_contract>

<output_contract>
## Output Contract

### Artifacts
| File | Required | Description |
|------|----------|-------------|
| .planning/phase-{N}/PLAN.md | Yes | Execution plan with tasks |

### Completion Marker
\`\`\`json
{
  "status": "complete|partial|failed",
  "artifacts": ["filepath1", "filepath2"],
  "summary": "Brief description of what was produced"
}
\`\`\`

### Error Handling
- Missing required input: return `status: "failed"` with summary explaining what's missing
- Partial completion: return `status: "partial"` with artifacts produced so far
</output_contract>
```

[ASSUMED: This XML-block format aligns with existing codebase patterns (workflows use `<purpose>`, `<flags>`, `<process>` blocks) but the specific `<input_contract>`/`<output_contract>` tag names are a new convention]

### Pattern 3: Context Budget Detection in Executor

**What:** Executor reads context metrics file between task boundaries and triggers graceful shutdown at 70%.
**When to use:** Only in wf-executor.md instructions.

```markdown
<!-- In executor agent instructions -->
## Context Budget Awareness

After completing each task (before starting the next), check context usage:

1. Read `/tmp/claude-ctx-{session_id}.json`
2. Parse `used_pct` value
3. If `used_pct >= 70`:
   a. Generate partial SUMMARY.md marking completed tasks as "done", remaining as "pending"
   b. Output completion marker with `status: "partial"`
   c. Stop execution -- do NOT start the next task

The session_id is available from the environment. The bridge file is written by
the statusline hook on every tool call.

### Partial SUMMARY Format
\`\`\`markdown
# Phase {N} Partial Summary -- {{plan_name}}

## Status: PARTIAL (context budget)

| Task | Status | Notes |
|------|--------|-------|
| Task 1.1 | done | Committed abc1234 |
| Task 1.2 | done | Committed def5678 |
| Task 2.1 | pending | Not started |
| Task 2.2 | pending | Not started |

## Resume Point
Next task: Task 2.1
Wave: 2
\`\`\`
```

[VERIFIED: `/tmp/claude-ctx-{session_id}.json` format confirmed from `wf-statusline.js` lines 31-41, contains `session_id`, `remaining_percentage`, `used_pct`, `timestamp`]

### Pattern 4: Config-Driven Model Selection

**What:** Agent model preferences stored in config.json, resolved at Agent() invocation time.
**When to use:** All workflow files that call Agent().

```json
// In wf/templates/config.json
{
  "agents": {
    "models": {
      "executor": "sonnet",
      "planner": "sonnet",
      "verifier": "sonnet",
      "researcher": "haiku",
      "roadmapper": "haiku"
    }
  }
}
```

```markdown
<!-- In workflow .md file, when calling agent -->
Read agent model from config:
\`\`\`bash
MODEL=$(wf-tools config | jq -r '.agents.models.executor // "sonnet"')
\`\`\`

Then invoke:
\`\`\`javascript
Agent({
  subagent_type: "wf-executor",
  model: MODEL,
  isolation: "worktree",
  prompt: "..."
})
\`\`\`
```

[VERIFIED: Claude Code `model` field accepts aliases `sonnet`, `opus`, `haiku` or full model IDs. Resolution order: CLAUDE_CODE_SUBAGENT_MODEL env > per-invocation model > frontmatter model > inherit from parent. Source: code.claude.com/docs/en/sub-agents]

### Pattern 5: Workflow Retry Logic

**What:** Orchestrator retries failed agents once with error context, then reports to user.
**When to use:** All workflow files that parse agent completion markers.

```markdown
<!-- In workflow execution logic -->
Parse agent completion marker:
- If `status: "complete"` -> proceed to next step
- If `status: "partial"` -> log partial state, inform user of continuation point
- If `status: "failed"` -> retry ONCE with error info:

  Retry prompt includes:
  - Original task description
  - Error summary from failed attempt
  - Instruction to try alternative approach

  If retry also returns `status: "failed"`:
  - Log error to SUMMARY.md
  - Report to user with error details
  - Do NOT retry again
```

[ASSUMED: retry logic is a new workflow pattern, not yet implemented]

### Anti-Patterns to Avoid

- **Hardcoding model names in agent .md frontmatter:** Use a config key reference instead. The frontmatter `model` field should default to `inherit`, with the actual model resolved from config.json at invocation time by the workflow. [Reason: D-11/D-12 lock this decision]
- **Reading context metrics inside task execution:** Only check between tasks, not mid-task. Mid-task checks would interrupt atomic operations and leave code in inconsistent state.
- **Complex completion marker schemas:** Keep to the minimal 3-field set (status, artifacts, summary). Adding fields like `tasks_done`, `duration`, `context_used` increases parsing complexity without proportional benefit. [Reason: D-02 locks this]
- **Agents parsing their own completion markers:** The agent outputs the marker; the workflow parses it. Separation of concerns.

## Claude Code Subagent API -- Native Fields Reference

This section documents the native frontmatter fields available in Claude Code subagent .md files, verified from official documentation.

### Full Frontmatter Field Inventory

| Field | Required | Type | Description | WF Usage |
|-------|----------|------|-------------|----------|
| `name` | Yes | string | Unique identifier, lowercase + hyphens | Already used |
| `description` | Yes | string | When Claude should delegate to this subagent | Already used |
| `tools` | No | list | Tools the subagent can use (inherits all if omitted) | Already used |
| `disallowedTools` | No | list | Tools to deny | Not used |
| `model` | No | string | `sonnet`, `opus`, `haiku`, full ID, or `inherit` | **Add per D-12** |
| `permissionMode` | No | string | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan` | Not needed |
| `maxTurns` | No | number | Maximum agentic turns | Consider for budget control |
| `skills` | No | list | Skills to preload into context | Not used |
| `mcpServers` | No | list | MCP servers scoped to subagent | Not used |
| `hooks` | No | object | Lifecycle hooks scoped to subagent | Not used |
| `memory` | No | string | Persistent memory scope: `user`, `project`, `local` | Not needed (agents write to .planning/) |
| `background` | No | boolean | Run as background task | Not needed |
| `effort` | No | string | `low`, `medium`, `high`, `max` (Opus 4.6 only) | **Consider adding** |
| `isolation` | No | string | `worktree` for git worktree isolation | Already used for executor |
| `color` | No | string | Display color in UI | Optional aesthetic |
| `initialPrompt` | No | string | Auto-submitted first user turn | Not applicable |

[VERIFIED: code.claude.com/docs/en/sub-agents -- "Supported frontmatter fields" table]

### Model Resolution Order
1. `CLAUDE_CODE_SUBAGENT_MODEL` environment variable (if set)
2. Per-invocation `model` parameter in Agent() call
3. Subagent definition's `model` frontmatter
4. Main conversation's model (inherit)

[VERIFIED: code.claude.com/docs/en/sub-agents -- "Choose a model" section]

### Key Insight: Frontmatter model vs. Invocation model

Per D-12, agent frontmatter should contain the model config key name, NOT a hardcoded model. However, Claude Code's native `model` field in frontmatter IS a hardcoded value (e.g., `model: haiku`).

**Resolution approach:** Set agent frontmatter `model: inherit` (or omit it entirely, which defaults to `inherit`). The workflow reads the model from config.json and passes it as the per-invocation `model` parameter when calling Agent(). This way:
- Agent .md files don't hardcode model names
- config.json controls which model each agent type uses
- The per-invocation parameter (priority 2) overrides the frontmatter default (priority 3)

[VERIFIED: This approach works per the model resolution order documented above]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent model selection | Custom model-selection logic | Claude Code native `model` parameter on Agent() invocation | Native API supports per-invocation model override, config.json stores preferences |
| Git worktree isolation | Custom git worktree management | Claude Code native `isolation: "worktree"` | Already built into the platform, handles setup and cleanup |
| Agent effort control | Custom prompt engineering for thoroughness | Claude Code native `effort` field | Native API controls reasoning depth directly |
| Context metrics collection | New monitoring hooks | Existing `wf-statusline.js` bridge file | Already writes metrics to `/tmp/claude-ctx-{session_id}.json` on every statusline render |
| Agent turn limits | Custom turn counting | Claude Code native `maxTurns` field | Built-in hard stop after N turns |

**Key insight:** Claude Code's subagent API has grown significantly. Several capabilities the WF system previously had to simulate through prompt engineering are now native frontmatter fields. This phase should leverage these native fields rather than building custom alternatives.

## Common Pitfalls

### Pitfall 1: Completion Marker Not in Final Output
**What goes wrong:** Agent produces a completion marker mid-conversation but then continues working, or the workflow extracts a non-final JSON block.
**Why it happens:** Agent instructions don't clearly specify that the completion marker must be the absolute last thing output.
**How to avoid:** Agent instructions must state: "Output the completion marker as your FINAL action. Do not perform any further actions after outputting it."
**Warning signs:** Workflows see `status: "complete"` but artifacts list incomplete files.

### Pitfall 2: Context Budget Check Race Condition
**What goes wrong:** Executor checks context at 69%, starts a large task, and exceeds budget mid-task.
**Why it happens:** Context usage can spike significantly during a single task (file reads, code generation).
**How to avoid:** Use 70% as the threshold (not higher), which provides ~30% remaining for the save-and-stop process itself. The existing context-monitor hook's WARNING threshold is 35% remaining (~65% used), so 70% used gives ~13% buffer before the hook's WARNING level.
**Warning signs:** Executor generates partial/corrupt files without proper SUMMARY.md.

### Pitfall 3: Session ID Unavailability in Subagent
**What goes wrong:** Executor agent tries to read `/tmp/claude-ctx-{session_id}.json` but doesn't know the session_id.
**Why it happens:** Subagents run in their own context and may not have access to the parent session's ID.
**How to avoid:** Two approaches: (1) The workflow passes session_id as part of the executor's prompt/input contract, or (2) The executor scans `/tmp/claude-ctx-*.json` for the most recently written file (by timestamp). Approach 1 is more reliable.
**Warning signs:** Executor never triggers context budget save because it can't find the metrics file.

### Pitfall 4: Config.json Not Found in Worktree
**What goes wrong:** Executor runs in a git worktree (isolated) and can't read `.planning/config.json` because the worktree doesn't include `.planning/`.
**Why it happens:** Git worktrees share the git history but not untracked files.
**How to avoid:** `.planning/` should be committed to git (which it is -- the WF system commits planning artifacts). Verify that worktree includes `.planning/config.json`. The model config is read by the workflow BEFORE spawning the agent, not by the agent itself, so this only matters if the executor needs to read config during execution.
**Warning signs:** Agent uses default model instead of configured one.

### Pitfall 5: Partial SUMMARY.md Overwriting Complete SUMMARY.md
**What goes wrong:** An executor resumes from partial state, completes remaining tasks, but its new SUMMARY.md doesn't include the previously completed tasks.
**Why it happens:** Resume logic doesn't properly merge completed-before + completed-now.
**How to avoid:** Resume logic reads the existing partial SUMMARY.md, carries forward all "done" entries, and appends newly completed tasks. The final SUMMARY.md reflects ALL tasks across sessions.
**Warning signs:** VERIFICATION.md reports tasks as incomplete that were actually done in a previous session.

### Pitfall 6: Agent Markdown Body vs. Frontmatter Confusion
**What goes wrong:** Adding contract blocks to the YAML frontmatter instead of the markdown body.
**Why it happens:** Confusion between frontmatter (parsed by Claude Code engine) and body (system prompt text).
**How to avoid:** `<input_contract>` and `<output_contract>` blocks go in the markdown body (after the `---` frontmatter closer), not in the YAML frontmatter section. Frontmatter only contains the documented Claude Code fields.
**Warning signs:** Agent doesn't see its contract instructions because Claude Code's frontmatter parser ignores unknown fields.

## Code Examples

### Example 1: Executor Agent .md with Contracts and Context Budget

```markdown
---
name: wf-executor
description: Executes PLAN.md tasks sequentially, commits each, generates SUMMARY.md
tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
model: inherit
---

# WF Executor Agent

<input_contract>
## Input Contract

### Required
| Field | Type | Description |
|-------|------|-------------|
| phase | number | Phase number |
| plan_path | filepath | Path to PLAN.md being executed |
| context_md | filepath | Path to CONTEXT.md |
| session_id | string | Session ID for context metrics |

### Optional
| Field | Type | Description |
|-------|------|-------------|
| resume_from | filepath | Path to partial SUMMARY.md for resume |
| config | object | Agent configuration from config.json |
</input_contract>

<!-- ... existing executor instructions ... -->

## Context Budget Awareness

After completing each task (before starting the next):
1. Read `/tmp/claude-ctx-{session_id}.json`
2. If `used_pct >= 70`:
   - Generate partial SUMMARY.md (done/pending marks)
   - Output completion marker with `status: "partial"`
   - STOP immediately

<output_contract>
## Output Contract

### Artifacts
| File | Required | Description |
|------|----------|-------------|
| .planning/phase-{N}/SUMMARY-{plan}.md | Yes | Execution summary (full or partial) |
| git commits | Yes | One commit per completed task |

### Completion Marker
```json
{
  "status": "complete|partial|failed",
  "artifacts": [".planning/phase-{N}/SUMMARY-{plan}.md"],
  "summary": "Executed N/M tasks, K commits"
}
```
</output_contract>
```

[VERIFIED: frontmatter fields `name`, `description`, `tools`, `model` are valid Claude Code subagent fields. Source: code.claude.com/docs/en/sub-agents]

### Example 2: Workflow Agent Invocation with Contract

```markdown
<!-- In execute-phase.md -->
Read agent model from config:
```bash
MODEL=$(wf-tools config | jq -r '.agents.models.executor // "sonnet"')
```

Invoke executor per input contract:
```javascript
Agent({
  subagent_type: "wf-executor",
  model: MODEL,
  isolation: "worktree",
  prompt: `
    Execute plan for Phase ${N}.

    ## Input (per contract)
    - phase: ${N}
    - plan_path: .planning/phase-${N}/PLAN.md
    - context_md: .planning/phase-${N}/CONTEXT.md
    - session_id: ${SESSION_ID}
    ${resumePath ? `- resume_from: ${resumePath}` : ''}

    Read PLAN.md, then execute each task.
    When done, output the completion marker JSON.
  `
})
```

Parse completion marker from agent output:
- Extract JSON block from agent's final response
- Route based on `status` field:
  - `"complete"` -> proceed to next plan or verification
  - `"partial"` -> log partial state, inform user
  - `"failed"` -> retry once with error context
```

### Example 3: config.json Agent Models Section

```json
{
  "agents": {
    "models": {
      "executor": "sonnet",
      "planner": "sonnet",
      "verifier": "sonnet",
      "researcher": "haiku",
      "roadmapper": "haiku"
    }
  }
}
```

[ASSUMED: key naming and default values are Claude's discretion per CONTEXT.md. These defaults reflect the pattern: execution-critical agents use stronger models, research/discovery agents use faster/cheaper models]

### Example 4: agent-contracts.md Reference Document Structure

```markdown
# Agent Contracts Reference

## Overview
Defines input/output contracts for all 5 WF agent types.

## Universal Contract Rules
- All agents MUST output a completion marker as their final action
- Completion marker format: { status, artifacts, summary }
- Workflows parse status to route: complete -> next, partial -> save, failed -> retry

## Per-Agent Contracts

### wf-executor
**Input:** phase, plan_path, context_md, session_id, [resume_from]
**Output:** SUMMARY.md, git commits, completion marker
**Special:** Context budget awareness at 70%

### wf-planner
**Input:** phase, goal, context_md, requirements_md, [research_md]
**Output:** PLAN.md (or PLAN-*.md), completion marker

### wf-verifier
**Input:** phase, goal, requirements, plan_paths, summary_paths, context_md
**Output:** VERIFICATION.md, completion marker

### wf-researcher
**Input:** topic, tech_stack, [project_context], [decisions]
**Output:** RESEARCH.md or research report, completion marker

### wf-roadmapper
**Input:** project_md, requirements_md, [research_summary]
**Output:** ROADMAP.md, completion marker

## Error Handling
- Missing required input -> status: "failed", summary explains what's missing
- Partial completion -> status: "partial", artifacts list what was produced
- Workflow retries failed agents once with error context
```

## State of the Art

| Old Approach (current WF) | Current Approach (this phase) | Impact |
|---|---|---|
| Agent .md has only name/description/tools frontmatter | Add model (inherit), use all relevant native fields | Leverage Claude Code platform capabilities |
| No structured completion signal | JSON completion marker with status/artifacts/summary | Reliable workflow routing and error handling |
| Executor runs until done or context exhaustion | Executor checks context budget at 70% and saves state | Prevents lost work, enables multi-session execution |
| Agent prompts constructed ad-hoc in workflows | Structured input per contract definition | Consistent, documentable, verifiable agent interfaces |
| Model hardcoded or inherited | Config-driven model selection per agent type | Flexible, adjustable without code changes |

**Claude Code subagent API evolution (relevant to AGENT-03):**
- `model` field now accepts aliases (`sonnet`, `opus`, `haiku`) and full IDs [VERIFIED: docs]
- `effort` field controls reasoning depth: `low`, `medium`, `high`, `max` (Opus 4.6 only) [VERIFIED: docs]
- `isolation: "worktree"` creates temporary git worktree with auto-cleanup [VERIFIED: docs]
- `memory` field provides persistent memory directories across sessions [VERIFIED: docs]
- `maxTurns` provides hard stop after N agentic turns [VERIFIED: docs]
- `skills` field preloads skill content into subagent context [VERIFIED: docs]
- `hooks` field allows subagent-scoped lifecycle hooks [VERIFIED: docs]
- `background` field enables concurrent background execution [VERIFIED: docs]
- Agent Teams (experimental) provide multi-session coordination [VERIFIED: docs, but experimental -- not recommended for WF]

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `<input_contract>`/`<output_contract>` XML-block tag names are the right format for contract blocks in agent .md files | Architecture Patterns - Pattern 2 | LOW: tag names are just markdown content in the agent body, easily renamed |
| A2 | Retry logic pattern (retry once with error context) is implementable in workflow markdown instructions | Architecture Patterns - Pattern 5 | LOW: workflows already have conditional logic patterns |
| A3 | config.json `agents.models` key naming and defaults (executor: sonnet, researcher: haiku) are good choices | Code Examples - Example 3 | LOW: these are Claude's discretion per CONTEXT.md, easily adjusted |
| A4 | Subagent can access `/tmp/` directory to read the context metrics bridge file | Common Pitfalls - Pitfall 3 | MEDIUM: if subagent's filesystem access is restricted, this approach fails. Mitigation: test during implementation, fall back to passing metrics via prompt if needed |

**If this table is empty:** N/A -- 4 assumptions listed above.

## Open Questions

1. **Session ID availability in subagent context**
   - What we know: The parent session writes `claude-ctx-{session_id}.json` to `/tmp/`. The executor subagent needs to read this file.
   - What's unclear: Whether a subagent has access to the parent session's session_id, or whether it gets its own session_id.
   - Recommendation: Pass session_id explicitly in the executor's input contract prompt. This is the safest approach and aligns with D-04's intent.

2. **Completion marker extraction from agent output**
   - What we know: Agents output text (markdown + code blocks). The completion marker is a JSON block in the agent's final output.
   - What's unclear: Exact mechanism for the workflow orchestrator to extract JSON from the agent's text response. Unlike hooks that use `process.stdout.write(JSON.stringify(...))`, agent output is natural language text.
   - Recommendation: Instruct agents to output the completion marker in a fenced code block (` ```json ... ``` `) as their absolute final output. The workflow uses string matching to extract the last JSON code block. This is a convention, not a system guarantee, so the agent instructions must be explicit.

3. **Effort field -- which agents benefit?**
   - What we know: `effort` field controls reasoning depth. Available values: low, medium, high, max.
   - What's unclear: Which WF agents would benefit from explicit effort settings vs. inheriting the session default.
   - Recommendation: This is Claude's discretion. Suggestion: executor and planner benefit from `high` effort (complex multi-step reasoning), researcher and roadmapper can use default/inherit (medium). Verifier benefits from `high` for thorough checking. Defer to implementation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (existing pattern) |
| Config file | None (test files are standalone `.test.cjs` files) |
| Quick run command | `node wf/bin/lib/{module}.test.cjs` |
| Full suite command | `for f in wf/bin/lib/*.test.cjs; do node "$f"; done` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-01 | Completion marker JSON format valid | unit | `node wf/bin/lib/config.test.cjs` (extend for agents config) | Partial -- config.test.cjs exists, agent tests needed |
| AGENT-02 | Context budget detection logic | manual-only | Manual: run executor with constrained context, verify partial save | N/A (markdown instruction, not code) |
| AGENT-03 | Agent frontmatter contains valid native fields | smoke | `grep -c "model:" agents/wf-*.md` | N/A (file content check) |
| AGENT-04 | agent-contracts.md exists and covers all 5 agents | smoke | `test -f wf/references/agent-contracts.md && grep -c "wf-executor\|wf-planner\|wf-verifier\|wf-researcher\|wf-roadmapper" wf/references/agent-contracts.md` | Wave 0 |

Note: Most of this phase's work is in markdown instruction files, not executable code. Validation is primarily structural (files exist with correct content) rather than unit-testable.

### Sampling Rate
- **Per task commit:** Verify file exists and contains expected sections
- **Per wave merge:** Run full structural verification
- **Phase gate:** `wf-verifier` 4-level verification against phase success criteria

### Wave 0 Gaps
- None critical -- existing test infrastructure covers config.cjs; agent contract validation is structural

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A -- no user auth involved |
| V3 Session Management | No | N/A -- agents run in Claude Code session context |
| V4 Access Control | No | N/A -- no access control changes |
| V5 Input Validation | Yes (minimal) | Agent input contracts validate required fields; JSON completion marker parsed defensively |
| V6 Cryptography | No | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed completion marker JSON | Tampering | Defensive JSON parsing in workflow, fallback to "failed" status if unparseable |
| Config.json injection via agent model field | Tampering | Validate model values against allowlist (sonnet, opus, haiku, inherit) |
| Path traversal in artifacts array | Tampering | Validate artifact paths are under `.planning/` or project root |
| Excessive retry loops | Denial of Service | Hard limit of 1 retry per D-09 |

## Sources

### Primary (HIGH confidence)
- [Claude Code Official Docs - Sub-agents](https://code.claude.com/docs/en/sub-agents) -- Full subagent API, frontmatter fields, model resolution, isolation
- [Claude Code Official Docs - Agent Teams](https://code.claude.com/docs/en/agent-teams) -- Agent team architecture, not used but informs design
- Codebase analysis: `agents/wf-*.md` (5 files), `wf/workflows/*.md` (6 files), `hooks/wf-statusline.js`, `hooks/wf-context-monitor.js`, `wf/bin/lib/config.cjs`, `wf/bin/wf-tools.cjs`, `wf/templates/config.json`

### Secondary (MEDIUM confidence)
- Phase 2 completed work (state.cjs patterns, config.cjs patterns) -- established conventions for this codebase

### Tertiary (LOW confidence)
- None -- all claims are verified against official docs or codebase

## Project Constraints (from CLAUDE.md)

Relevant directives extracted from CLAUDE.md that constrain this phase:

1. **Language:** hooks/CLI must remain JavaScript/Node.js; documents must remain in Chinese
2. **Naming:** maintain `wf-` prefix convention for all agent and hook files
3. **Architecture:** maintain existing layered architecture, no breaking refactors
4. **CommonJS:** all JS must be CommonJS (`require()`, not `import`)
5. **Node.js standard library only:** no external npm dependencies
6. **Error handling:** defensive try/catch, silent failures in hooks, exit code 0 on errors
7. **Git conventions:** Conventional Commits format, one task = one atomic commit
8. **State management:** all STATE.md writes through CLI commands, never direct Write/Edit
9. **Configuration:** extend existing config.json patterns (camelCase keys, nested objects)
10. **Markdown conventions:** YAML frontmatter for metadata, H1/H2/H3 hierarchy, tables for structured data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, pure Markdown/JSON/existing infrastructure
- Architecture: HIGH -- patterns directly derived from locked decisions (D-01 through D-12) and verified Claude Code API
- Pitfalls: HIGH -- identified from codebase analysis and Claude Code documentation
- Native API fields: HIGH -- verified from official documentation at code.claude.com

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable domain -- Claude Code subagent API unlikely to break within 30 days)
