# Phase 6: Quality Tools - Research

**Researched:** 2026-04-13
**Domain:** Code review workflow + milestone lifecycle management (Markdown-based workflow system, Node.js CLI)
**Confidence:** HIGH

## Summary

Phase 6 builds two independent capabilities on top of WF's existing infrastructure: (1) a code review workflow with automatic fix chaining, and (2) milestone lifecycle management (create, complete, archive). Both capabilities follow well-established patterns already present in the codebase -- the GSD reference implementation provides mature designs that can be adapted to WF's conventions (Skill() chains, agent contracts, CLI router + lib/ modules).

The code review subsystem introduces one new agent (`wf-reviewer`) and three new files (command, workflow, agent), plus integration into `verify-work.md`. The fix chain reuses the existing `wf-executor` agent rather than creating a separate fixer agent. The milestone subsystem introduces two commands and workflows (`complete-milestone`, `new-milestone`), reuses `wf-researcher` and `wf-roadmapper` agents, and adds a `milestone.cjs` CLI module for archival operations.

**Primary recommendation:** Implement code review first (QUAL-01), then milestone lifecycle (QUAL-02). Code review is self-contained; milestone management touches more files but follows simpler patterns (mostly file operations and agent reuse).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Code review integrates into verify-work workflow; also available as standalone `/wf-code-review {phase}` command
- **D-02:** File scope from SUMMARY.md key_files first, git diff fallback, `--files` override
- **D-03:** Review depth via config.json (quick/standard/deep), `--depth` flag overrides, default standard
- **D-04:** code-review auto-chains to fix flow; single continuous operation
- **D-05:** All issues auto-fixed regardless of severity; failed fixes marked in report
- **D-06:** Max 3 review-fix iterations, then stop and report remaining
- **D-07:** complete-milestone archives ROADMAP.md + REQUIREMENTS.md + all phase artifacts to `.planning/milestones/vX.Y/`
- **D-08:** Phase numbering resets to 1 for new milestones (default behavior)
- **D-09:** complete-milestone auto-starts new-milestone flow
- **D-10:** new-milestone reuses researcher + roadmapper agent flow (same as new-project)
- **D-11:** New `wf-reviewer.md` agent follows Phase 3 agent contract spec (input/output contract, JSON completion marker, config-driven model)
- **D-12:** wf-reviewer performs comprehensive review: bugs, security, quality, performance; depth controlled by `--depth`
- **D-13:** Fix logic reuses wf-executor agent (has isolation/worktree); no separate fixer agent

### Claude's Discretion
- REVIEW.md output format and severity level definitions
- verify-work code review step insertion position and conditions
- complete-milestone archive directory organization details
- new-milestone to complete-milestone state handoff mechanism
- wf-reviewer agent prompt design and checklist items

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QUAL-01 | Code review workflow (code-review + review-fix auto-chain) | GSD reference (code-review.md, code-review-fix.md) provides complete pattern; WF adaptation uses Skill() chains and agent contracts from Phase 3/5; wf-reviewer new agent follows established contract format; wf-executor reused for fixes |
| QUAL-02 | Milestone lifecycle (new-milestone, complete-milestone, archive) | GSD reference (complete-milestone.md, new-milestone.md) provides archival and re-initialization patterns; WF adaptation adds milestone.cjs CLI module, reuses researcher + roadmapper agents, adds config for review depth |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js std (fs, path, child_process) | v14+ | All CLI modules | Project constraint: no external deps [VERIFIED: package.json] |
| node:test | v14+ | Unit testing | Already used across all lib/*.test.cjs files [VERIFIED: codebase grep] |
| node:assert | v14+ | Test assertions | Already used across all test files [VERIFIED: codebase grep] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Git CLI (via child_process) | Any | Diff computation, commit operations | File scope fallback, milestone git tag |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual YAML parsing in REVIEW.md | js-yaml npm package | Would break "no external deps" constraint; regex parsing sufficient for structured frontmatter |
| Separate wf-fixer agent | wf-executor reuse | D-13 locks this: executor already has worktree isolation and task execution capability |

## Architecture Patterns

### Recommended Project Structure (New Files)

```
agents/
  wf-reviewer.md              # NEW: Code review agent (per D-11)

commands/wf/
  code-review.md              # NEW: /wf-code-review command
  complete-milestone.md        # NEW: /wf-complete-milestone command
  new-milestone.md             # NEW: /wf-new-milestone command

wf/workflows/
  code-review.md              # NEW: Review orchestration workflow
  code-review-fix.md          # NEW: Fix chain workflow (or merged into code-review.md)
  complete-milestone.md        # NEW: Milestone completion workflow
  new-milestone.md             # NEW: Milestone initialization workflow
  verify-work.md              # MODIFIED: Add optional code-review step

wf/bin/lib/
  milestone.cjs               # NEW: Milestone archival operations
  milestone.test.cjs           # NEW: Tests for milestone module
  review.cjs                   # NEW: Review file scope computation + REVIEW.md parsing
  review.test.cjs              # NEW: Tests for review module

wf/bin/wf-tools.cjs           # MODIFIED: Add 'review' and 'milestone' subcommands

wf/bin/lib/config.cjs         # MODIFIED: Add code_review config defaults
wf/templates/config.json      # MODIFIED: Add code_review section
```

### Pattern 1: Skill() Chain for Review-Fix Loop (Adapting Phase 5 Pattern)

**What:** The code-review workflow uses Skill() chaining (established in Phase 4/5) to link review -> fix without deep Task nesting.
**When to use:** When review finds issues and D-04 requires automatic fix chaining.
**Example:**

```markdown
<!-- In code-review.md workflow -->
<step name="review_fix_chain">
## Review-Fix Chain

<!-- Iteration 1: Review -->
Skill(wf-reviewer) → produces REVIEW.md

<!-- Check: are there findings? -->
IF REVIEW.md status !== "clean":
  <!-- Construct fix task list from REVIEW.md findings -->
  <!-- Delegate to wf-executor with fix tasks -->
  Skill(wf-executor) → applies fixes, commits atomically
  
  <!-- Re-review (iteration 2) -->
  Skill(wf-reviewer) → produces updated REVIEW.md
  
  <!-- If still issues, one more round (iteration 3 max per D-06) -->
  IF still issues: Skill(wf-executor) + Skill(wf-reviewer)
  
  <!-- After 3 iterations, stop and report -->
</step>
```

[VERIFIED: Skill() pattern used in autonomous.md, next.md, and other Phase 4/5 workflows]

### Pattern 2: Agent Contract for wf-reviewer (Per Phase 3 Spec)

**What:** wf-reviewer follows the exact same contract format as other 5 agents.
**When to use:** For the new code review agent definition.
**Example:**

```markdown
---
name: wf-reviewer
description: 审查源代码质量、安全性、性能问题，生成结构化 REVIEW.md
model: inherit
effort: high
tools:
  - Read
  - Glob
  - Grep
  - Bash
---

<input_contract>
## Input Contract

### Required
| Field | Type | Description |
|-------|------|-------------|
| phase | number | Phase number being reviewed |
| files | filepath[] | List of source files to review |
| review_path | filepath | Output path for REVIEW.md |
| depth | string | Review depth: quick/standard/deep |

### Optional
| Field | Type | Description |
|-------|------|-------------|
| diff_base | string | Git commit hash for diff context |
| config | object | Agent configuration from config.json |
</input_contract>

<output_contract>
## Output Contract

### Artifacts
| Artifact | Required | Description |
|----------|----------|-------------|
| REVIEW.md | Yes | Structured review report with YAML frontmatter |

### Completion Marker
```json
{
  "status": "complete|partial|failed",
  "artifacts": ["<filepath>"],
  "summary": "<brief description>"
}
```
</output_contract>
```

[VERIFIED: Contract format from wf/references/agent-contracts.md and all 5 existing agents]

### Pattern 3: CLI Router Extension for New Subcommands

**What:** wf-tools.cjs router gets `review` and `milestone` cases.
**When to use:** For all new CLI operations.
**Example:**

```javascript
// In wf-tools.cjs switch block
case 'review':
  review.run(cwd, subArgs);
  break;
case 'milestone':
  milestone.run(cwd, subArgs);
  break;
```

[VERIFIED: Exact pattern from existing wf-tools.cjs router with state/roadmap/phase/config/etc.]

### Pattern 4: Milestone Archival via CLI Module

**What:** milestone.cjs handles file copy/move operations for archival, keeping workflow logic in .md files.
**When to use:** For complete-milestone archive operations.
**Example:**

```javascript
// lib/milestone.cjs
function archiveMilestone(cwd, version) {
  const archiveDir = path.join(cwd, '.planning', 'milestones', version);
  fs.mkdirSync(archiveDir, { recursive: true });
  
  // Copy ROADMAP.md to archive
  const roadmapSrc = path.join(cwd, '.planning', 'ROADMAP.md');
  const roadmapDst = path.join(archiveDir, `${version}-ROADMAP.md`);
  fs.copyFileSync(roadmapSrc, roadmapDst);
  
  // Copy REQUIREMENTS.md to archive
  const reqSrc = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  const reqDst = path.join(archiveDir, `${version}-REQUIREMENTS.md`);
  fs.copyFileSync(reqSrc, reqDst);
  
  // Copy all phase directories
  // ...
  
  return { success: true, archive_dir: archiveDir };
}
```

[VERIFIED: Pattern consistent with git.cjs, session.cjs, validate.cjs modules]

### Anti-Patterns to Avoid
- **Deep Task nesting for review-fix iterations:** Use Skill() chain instead (D-04, Phase 5 pattern). Task() creates new agents; Skill() stays in orchestrator context.
- **Creating a separate wf-fixer agent:** D-13 locks this -- reuse wf-executor. The executor already handles task lists with atomic commits.
- **Direct STATE.md writes from milestone workflows:** All state changes through `wf-tools state` CLI (Phase 2 constraint).
- **Hardcoding review depth:** Must read from config, allow `--depth` override (D-03).
- **Skipping YAML frontmatter validation on REVIEW.md:** GSD learned this the hard way -- always validate frontmatter has required fields before committing.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File scope computation | Custom git diff parser | Adapt GSD's 3-tier logic (--files > SUMMARY.md > git diff) | Edge cases: deleted files, binary files, path traversal, deduplication |
| REVIEW.md frontmatter parsing | Ad-hoc regex per consumer | Centralized review.cjs module with `parseReviewFrontmatter()` | Multiple consumers: workflow, fix chain, verify-work, present_results |
| Phase directory discovery | Manual path construction | Existing `phaseLib.findPhaseDir()` from phase.cjs | Already handles both GSD-style and WF-style directory naming |
| Config loading with defaults | Manual config merge | Existing `configLib.loadConfig()` with deepMerge | Already handles missing keys, type coercion, nested paths |
| Git operations | Raw exec calls | Existing `git.cjs` module `gitCommitPlanning()` | Handles staging, commit, error reporting consistently |
| Agent model resolution | Hardcoded model strings | `config.agents.models.reviewer` from config.json | Consistent with Phase 3 contract pattern |

**Key insight:** The GSD code-review.md and code-review-fix.md contain 500+ lines of battle-tested file scoping, iteration, and error handling logic. The core algorithms should be ported to WF conventions rather than reinvented.

## Common Pitfalls

### Pitfall 1: Review-Fix Iteration Loop Not Converging
**What goes wrong:** The 3-iteration review-fix loop finds new issues each round because fixes introduce new problems, or the reviewer keeps flagging the same issues with different descriptions.
**Why it happens:** Without deduplication, the same code pattern can be reported with slightly different wording, causing infinite-seeming fix loops.
**How to avoid:** (1) Use finding IDs in REVIEW.md (e.g., CR-01, CR-02) that persist across iterations. (2) Track which findings were "attempted" vs "resolved" in REVIEW-FIX.md. (3) On iteration 3, only fix NEW findings not seen in previous iterations.
**Warning signs:** Iteration count always hitting max (3); same files being modified in every iteration.

### Pitfall 2: File Scope Empty in New Projects
**What goes wrong:** SUMMARY.md has no `key_files` section and git diff has no phase-specific commits, resulting in empty review scope.
**Why it happens:** First phase of a project, or phase was executed without SUMMARY.md generation.
**How to avoid:** (1) Git diff fallback should use the full diff from first commit to HEAD when no phase commits exist. (2) Warn user and suggest `--files` flag for explicit specification. (3) Never spawn reviewer with empty file list.
**Warning signs:** "No source files changed" message when files clearly exist.

### Pitfall 3: Milestone Archive Leaves Stale State
**What goes wrong:** After complete-milestone, STATE.md still references old phase numbers, or ROADMAP.md still has old phase entries.
**Why it happens:** Archive copies files but forgets to reset/clean the source state.
**How to avoid:** (1) complete-milestone must update STATE.md via CLI (not direct write). (2) ROADMAP.md gets rebuilt (not just edited) after archival. (3) Per D-09, auto-trigger new-milestone which creates fresh ROADMAP.md and REQUIREMENTS.md.
**Warning signs:** `/wf-progress` shows stale phases after milestone completion.

### Pitfall 4: Review Agent Context Overload with Large File Sets
**What goes wrong:** Passing 50+ files to wf-reviewer causes context budget exhaustion before review completes.
**Why it happens:** Each file is read into agent context; large files or many files exceed budget.
**How to avoid:** (1) Warn when file count > 50 and auto-downgrade to `quick` depth (from GSD code-review.md). (2) For `deep` reviews with many files, split into batches. (3) Reviewer should read files lazily (only when examining a specific finding) rather than all upfront.
**Warning signs:** Reviewer returns `status: "partial"` with few findings.

### Pitfall 5: Phase Numbering Collision on New Milestone
**What goes wrong:** D-08 resets phase numbering to 1, but old `.planning/phases/01-*` directories still exist from the previous milestone.
**Why it happens:** complete-milestone archives to `milestones/vX.Y/` but doesn't clean up `phases/` directory.
**How to avoid:** (1) complete-milestone must move or delete old phase directories before new-milestone creates phase 1. (2) Archive phase directories into the milestone archive. (3) Verify `phases/` is empty before numbering reset.
**Warning signs:** Multiple `01-*` directories in `.planning/phases/`.

### Pitfall 6: Config Not Extended Before Workflow Runs
**What goes wrong:** Workflow reads `config.workflow.code_review` but it's undefined because CONFIG_DEFAULTS wasn't updated.
**Why it happens:** New config keys added to template but not to CONFIG_DEFAULTS in config.cjs.
**How to avoid:** Add ALL new config keys to BOTH `CONFIG_DEFAULTS` in config.cjs AND `wf/templates/config.json` in the SAME task.
**Warning signs:** `config-get workflow.code_review` returns `undefined`.

## Code Examples

### File Scope Computation (review.cjs)

```javascript
// Source: Adapted from GSD code-review.md, ported to Node.js module
// [VERIFIED: GSD code-review.md step compute_file_scope]

/**
 * Compute review file scope with 3-tier precedence
 * @param {string} cwd - Project root
 * @param {string} phaseDir - Phase directory path
 * @param {string} paddedPhase - Zero-padded phase number
 * @param {string[]} [filesOverride] - --files override array
 * @returns {{ files: string[], tier: string }}
 */
function computeFileScope(cwd, phaseDir, paddedPhase, filesOverride) {
  // Tier 1: --files override
  if (filesOverride && filesOverride.length > 0) {
    const validated = filesOverride.filter(f => {
      const abs = path.resolve(cwd, f);
      return abs.startsWith(cwd) && fs.existsSync(abs);
    });
    return { files: validated, tier: '--files' };
  }

  // Tier 2: SUMMARY.md key_files extraction
  const summaryFiles = extractKeyFilesFromSummaries(phaseDir);
  if (summaryFiles.length > 0) {
    return { files: filterReviewFiles(cwd, summaryFiles), tier: 'SUMMARY.md' };
  }

  // Tier 3: git diff fallback
  const diffFiles = getGitDiffFiles(cwd, paddedPhase);
  return { files: filterReviewFiles(cwd, diffFiles), tier: 'git diff' };
}
```

### REVIEW.md Frontmatter Structure (Claude's Discretion)

```yaml
---
status: issues_found  # clean | issues_found | error
depth: standard       # quick | standard | deep
phase: 6
files_reviewed: 12
files_reviewed_list:
  - wf/bin/lib/review.cjs
  - wf/bin/lib/milestone.cjs
findings:
  critical: 0
  high: 2
  medium: 5
  low: 3
  total: 10
iteration: 1
---
```

[ASSUMED: Format designed for this phase based on GSD patterns and D-12 requirements]

### Config Extension for Code Review

```javascript
// In CONFIG_DEFAULTS (config.cjs)
workflow: {
  // ... existing keys ...
  code_review: true,           // Enable/disable code review gate
  code_review_depth: 'standard', // Default depth: quick/standard/deep
  code_review_auto_fix: true,  // Enable auto-fix chain (D-04)
  code_review_max_iterations: 3, // Max review-fix iterations (D-06)
},
agents: {
  models: {
    // ... existing models ...
    reviewer: 'sonnet',  // wf-reviewer model (D-11)
  },
},
```

[VERIFIED: Config pattern from config.cjs CONFIG_DEFAULTS structure]

### Milestone Archive Directory Structure

```
.planning/milestones/
  v1.0/
    v1.0-ROADMAP.md          # Archived roadmap
    v1.0-REQUIREMENTS.md     # Archived requirements
    phases/                   # Archived phase directories
      01-cli-foundation/
      02-state-safety/
      03-agent-contracts/
      04-session-management/
      05-workflow-enhancement/
      06-quality-tools/
```

[ASSUMED: Directory structure designed for D-07; GSD uses similar pattern but without phases/ subdirectory]

### Command File Format

```markdown
---
name: wf:code-review
description: 代码审查 -- 审查阶段变更文件，自动修复问题
argument-hint: "<phase> [--depth quick|standard|deep] [--files file1,file2]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - Agent
---
<objective>
审查指定阶段的代码变更，发现问题后自动修复。
</objective>

<execution_context>
@$HOME/.claude/wf/workflows/code-review.md
@$HOME/.claude/wf/references/agent-contracts.md
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
按照 @$HOME/.claude/wf/workflows/code-review.md 端到端执行。
</process>
```

[VERIFIED: Command format from commands/wf/quick.md and other existing commands]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GSD: Task() for review agents | WF: Skill() chain for review-fix loop | Phase 4-5 | Lower context cost, no deep nesting |
| GSD: separate gsd-code-fixer agent | WF: reuse wf-executor (D-13) | This phase | One fewer agent to maintain |
| GSD: no config gate for code review | WF: config.workflow.code_review gate (D-03) | This phase | Opt-out capability per project |
| GSD: REQUIREMENTS.md preserved across milestones | WF: fresh REQUIREMENTS.md per milestone (D-07) | This phase | Cleaner state, no stale requirements |
| GSD: manual phase numbering continuation | WF: auto-reset to Phase 1 per milestone (D-08) | This phase | Independent milestone scoping |

## Assumptions Log

> List all claims tagged [ASSUMED] in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | REVIEW.md frontmatter format (status/depth/findings fields) | Code Examples | Low -- format is at Claude's discretion per CONTEXT.md; planner can define final format |
| A2 | Milestone archive uses `v1.0/phases/` subdirectory structure | Code Examples | Low -- directory organization is at Claude's discretion per CONTEXT.md |
| A3 | review.cjs and milestone.cjs as separate lib modules | Architecture Patterns | Low -- could be merged into existing modules, but separation follows established pattern |

**If this table is empty:** N/A -- 3 assumptions listed above, all LOW risk.

## Open Questions

1. **verify-work code review insertion position**
   - What we know: D-01 says integrate into verify-work; CONTEXT.md specifics say "before or after UAT"
   - What's unclear: Should code review run BEFORE UAT (so UAT tests against reviewed code) or AFTER (so UAT catches behavioral issues first)?
   - Recommendation: Run code review BEFORE UAT. Rationale: fix code quality issues first, then let user validate behavior. This matches GSD's approach and is more natural flow.

2. **Review-fix task list format for executor**
   - What we know: D-13 reuses wf-executor; executor expects PLAN.md format with tasks
   - What's unclear: Should review findings be converted to PLAN.md-compatible task format, or should executor receive a simplified "fix list"?
   - Recommendation: Generate a lightweight fix plan (not full PLAN.md) that executor can parse. Each finding becomes a task with `action: "fix finding CR-XX"` and `verify: "re-run review"`.

3. **new-milestone automatic trigger mechanism**
   - What we know: D-09 says complete-milestone auto-starts new-milestone
   - What's unclear: Should this be a direct Skill() call or suggest the user run `/wf-new-milestone`?
   - Recommendation: Use Skill() call at the end of complete-milestone workflow, with a gate (user confirmation) before proceeding. Auto-start is the default per D-09, but user should be able to decline.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All CLI modules | Yes | v14+ | -- |
| Git | File scope diff, milestone tagging | Yes | Available | -- |
| node:test | Unit tests | Yes | Built-in | -- |

Step 2.6: No external dependencies beyond what's already in use. All new code is pure Node.js + Markdown.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, no install) |
| Config file | None -- tests run directly via `node lib/file.test.cjs` |
| Quick run command | `node wf/bin/lib/review.test.cjs && node wf/bin/lib/milestone.test.cjs` |
| Full suite command | `for f in wf/bin/lib/*.test.cjs; do node "$f"; done` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUAL-01a | computeFileScope returns files from --files override | unit | `node wf/bin/lib/review.test.cjs` | No -- Wave 0 |
| QUAL-01b | computeFileScope extracts from SUMMARY.md key_files | unit | `node wf/bin/lib/review.test.cjs` | No -- Wave 0 |
| QUAL-01c | computeFileScope falls back to git diff | unit | `node wf/bin/lib/review.test.cjs` | No -- Wave 0 |
| QUAL-01d | parseReviewFrontmatter extracts status/findings | unit | `node wf/bin/lib/review.test.cjs` | No -- Wave 0 |
| QUAL-01e | config.code_review defaults and override | unit | `node wf/bin/lib/config.test.cjs` | Yes (extend) |
| QUAL-02a | archiveMilestone copies files to milestones/vX.Y/ | unit | `node wf/bin/lib/milestone.test.cjs` | No -- Wave 0 |
| QUAL-02b | archiveMilestone handles missing files gracefully | unit | `node wf/bin/lib/milestone.test.cjs` | No -- Wave 0 |
| QUAL-02c | resetPhaseNumbering clears phases directory | unit | `node wf/bin/lib/milestone.test.cjs` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `node wf/bin/lib/review.test.cjs` or `node wf/bin/lib/milestone.test.cjs` (whichever was modified)
- **Per wave merge:** `for f in wf/bin/lib/*.test.cjs; do node "$f"; done`
- **Phase gate:** Full suite green before `/wf-verify-work`

### Wave 0 Gaps
- [ ] `wf/bin/lib/review.test.cjs` -- covers QUAL-01a through QUAL-01d
- [ ] `wf/bin/lib/milestone.test.cjs` -- covers QUAL-02a through QUAL-02c
- [ ] Extend `wf/bin/lib/config.test.cjs` -- covers QUAL-01e (new config keys)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A -- CLI tool, no user auth |
| V3 Session Management | No | N/A -- stateless CLI operations |
| V4 Access Control | No | N/A -- single-user local tool |
| V5 Input Validation | Yes | Path validation for --files (prevent traversal); phase number validation (integer check); depth value validation (whitelist) |
| V6 Cryptography | No | N/A -- no crypto operations |

### Known Threat Patterns for Node.js CLI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via --files | Tampering | Validate paths are within project root (realpath check, as in GSD code-review.md) |
| Command injection via phase arg | Tampering | parseInt validation (already in init.cjs); reject non-numeric input |
| Arbitrary file read via review scope | Information Disclosure | Filter to known source extensions; exclude .env, credentials, secrets |
| Malformed REVIEW.md injection | Tampering | Validate YAML frontmatter structure before consuming; reject unexpected status values |

## Sources

### Primary (HIGH confidence)
- GSD code-review.md workflow -- complete file scoping, agent spawning, result presentation [VERIFIED: read in full]
- GSD code-review-fix.md workflow -- iteration loop, --auto mode, commit timing [VERIFIED: read in full]
- GSD complete-milestone.md -- archival, git tag, ROADMAP reorganization, state update [VERIFIED: read in full]
- GSD new-milestone.md -- context loading, research reuse, phase numbering, REQUIREMENTS generation [VERIFIED: read in full]
- WF agent-contracts.md reference -- input/output contract format, completion markers, model config [VERIFIED: read in full]
- WF config.cjs source -- CONFIG_DEFAULTS structure, deepMerge, saveConfig, getConfigValue [VERIFIED: read in full]
- WF wf-tools.cjs source -- router pattern, subcommand dispatch [VERIFIED: read in full]
- All 5 existing WF agent files -- contract format, frontmatter fields, tools list [VERIFIED: read in full]
- All existing WF workflows -- Skill() pattern, agent invocation, verify-work structure [VERIFIED: read in full]
- All existing WF commands -- command file format, execution_context references [VERIFIED: read in full]
- All existing lib/*.cjs modules -- module structure, utils usage, run() pattern [VERIFIED: read in full]

### Secondary (MEDIUM confidence)
- CONTEXT.md D-01 through D-13 decisions -- all verified against codebase feasibility
- ROADMAP.md phase dependency and success criteria -- verified against existing infrastructure

### Tertiary (LOW confidence)
- None -- all claims verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns verified in codebase
- Architecture: HIGH -- all new files follow exact patterns from existing modules/agents/workflows
- Pitfalls: HIGH -- derived from GSD battle-testing + codebase analysis of actual edge cases

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable -- no external dependency drift risk)
