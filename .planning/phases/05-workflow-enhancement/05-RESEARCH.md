# Phase 5: Workflow Enhancement - Research

**Researched:** 2026-04-13
**Domain:** Workflow orchestration, CLI tooling, prompt guard regex, Markdown reference documentation
**Confidence:** HIGH

## Summary

Phase 5 enhances the WF workflow system across five areas: (1) rewriting `autonomous.md` from pseudocode to real Skill() chain invocations, (2) adding phase operations (add/insert/remove) to the CLI and ROADMAP system, (3) creating an interactive `/wf-settings` command for configuration management, (4) authoring three new reference documents, and (5) hardening the prompt guard hook with negative lookahead patterns to reduce false positives.

The codebase has strong foundations from Phases 1-4: a modular CLI router (`wf-tools.cjs` + `lib/` modules), established Skill() routing patterns (from `session.md` and `next.md`), ROADMAP parsing (`roadmap.cjs`), config loading (`config.cjs`), and agent contracts (`agent-contracts.md`). All work is additive -- no existing modules need destructive refactoring. WF-06 (git --files) is already implemented and confirmed complete (D-14).

**Primary recommendation:** Structure implementation around 4-5 plans organized by deliverable area. Autonomous rewrite is the highest-risk item (largest scope, touches orchestration logic). Phase-ops and settings are medium complexity with clear CLI patterns to follow. Prompt guard and reference docs are lowest risk.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** autonomous.md rewrite uses Skill() chain: `Skill(discuss-phase --auto)` -> `Skill(plan-phase --auto)` -> `Skill(execute-phase)` per phase
- **D-02:** Cross-phase failure: single retry (gap closure) + pause. No skip-to-next on failure
- **D-03:** discuss uses `--auto` in autonomous mode; `--interactive` flag for manual override
- **D-04:** Insert-phase uses decimal numbering (Phase 2.5), no directory renaming
- **D-05:** remove-phase: mark removed in ROADMAP + move directory to `.planning/archive/`
- **D-06:** add-phase appends at end with next integer; insert-phase uses decimal between existing phases
- **D-07:** /wf-settings: no-arg = AskUserQuestion interactive menu; `set key value` = direct CLI
- **D-08:** Expose behavior configs (mode, granularity, parallelization, auto_advance, discuss_mode, research). Hide internal state (`_auto_chain_active`)
- **D-09:** New files: `commands/wf/settings.md` command + `wf/workflows/settings.md` workflow
- **D-10:** Prompt guard: negative lookahead + whitelist dual strategy. Per-regex lookahead for code blocks/docs, file suffix whitelist (.md -> warning downgrade)
- **D-11:** Keep advisory (non-blocking) mode for prompt guard
- **D-12:** 3 new reference docs: `anti-patterns.md`, `context-budget.md`, `continuation-format.md` in `wf/references/`
- **D-13:** Each doc 50-150 lines, pragmatic style matching `gates.md` and `verification-patterns.md`
- **D-14:** WF-06 already implemented. No additional work needed

### Claude's Discretion
- Autonomous progress display format and frequency
- Phase-ops CLI argument design (`--after N` vs positional args)
- Settings interactive menu grouping and display order
- Specific regex negative lookahead patterns for prompt guard
- Reference document content organization and chapter structure

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WF-01 | autonomous.md rewrite with Skill() calls and error recovery | Skill() patterns from session.md/next.md, agent-contracts.md completion markers, error handling patterns |
| WF-02 | Phase operations: add-phase, insert-phase, remove-phase with renumbering | roadmap.cjs PHASE_PATTERN regex, decimal numbering support already in ROADMAP format, phase.cjs findPhaseDir |
| WF-03 | /wf-settings interactive configuration management | config.cjs CONFIG_DEFAULTS + loadConfig, AskUserQuestion pattern, command/workflow file structure |
| WF-04 | Reference doc suite: anti-patterns, context-budget, continuation-format | Existing reference docs (gates.md: 81 lines, verification-patterns.md: 89 lines) as style templates |
| WF-05 | Prompt guard negative lookahead, reduce false positives | Current 13 INJECTION_PATTERNS in wf-prompt-guard.js, GSD equivalent patterns for comparison |
| WF-06 | Git commit --files selective staging | Already implemented in git.cjs. D-14 confirms no work needed |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Compatibility**: Must maintain Claude Code hook/command/agent spec compatibility
- **Architecture**: Preserve existing layered architecture, no breaking refactors
- **Naming**: Keep `wf-` prefix convention for all new files
- **Language**: hooks/CLI in JavaScript/Node.js (CommonJS), docs in Chinese
- **Error handling**: Silent failures for hooks (exit 0 on error), defensive try/catch for I/O
- **Module design**: Each hook is self-contained, lib/ modules export reusable functions
- **Code style**: 2-space indent, semicolons, CommonJS `require()`
- **File budget**: 200-400 lines typical, 800 max per file

## Standard Stack

This phase uses only the existing project stack -- no new external dependencies.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | v24.5.0 | Runtime for all CLI tools and hooks | Already installed, project requires v14+ [VERIFIED: `node --version`] |
| fs (stdlib) | built-in | File system operations | Exclusive I/O mechanism in this project [VERIFIED: codebase grep] |
| path (stdlib) | built-in | Path resolution and manipulation | Standard path handling [VERIFIED: codebase grep] |
| child_process (stdlib) | built-in | Git operations in git.cjs | Used by git.cjs and session.cjs [VERIFIED: codebase grep] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| os (stdlib) | built-in | tmpdir() for large output, homedir() for root boundary | Already used in utils.cjs [VERIFIED: codebase grep] |

### Alternatives Considered
None -- this project explicitly avoids third-party dependencies. All modules use Node.js standard library only. [VERIFIED: package.json has zero dependencies]

## Architecture Patterns

### Recommended Project Structure (New Files)
```
commands/wf/
  settings.md            # NEW: /wf-settings command entry point
wf/
  bin/
    wf-tools.cjs         # MODIFY: add phase-ops + settings routes
    lib/
      roadmap.cjs        # MODIFY: add addPhase, insertPhase, removePhase
      config.cjs          # MODIFY: add saveConfig, getConfigSchema
  workflows/
    autonomous.md        # REWRITE: pseudocode -> Skill() chains
    settings.md          # NEW: settings workflow logic
  references/
    anti-patterns.md     # NEW: workflow anti-patterns
    context-budget.md    # NEW: context budget management guide
    continuation-format.md  # NEW: session continuation format spec
hooks/
  wf-prompt-guard.js     # MODIFY: add negative lookahead patterns
```

### Pattern 1: Skill() Chain Invocation (from Phase 4)
**What:** Workflow files invoke other workflows via `Skill(workflow-name, { args })` rather than duplicating logic
**When to use:** Autonomous mode calling discuss -> plan -> execute per phase
**Example:**
```markdown
// Source: wf/workflows/next.md (verified in codebase)
Skill(discuss-phase, { phase: N })
Skill(plan-phase, { phase: N })
Skill(execute-phase, { phase: N })
Skill(verify-work)
```
[VERIFIED: next.md lines 77-80 use exactly this pattern]

### Pattern 2: CLI Router + Lib Module
**What:** wf-tools.cjs dispatches to lib/ modules via switch statement. Each lib module exports a `run(cwd, args)` function.
**When to use:** Adding new phase-ops and settings sub-commands
**Example:**
```javascript
// Source: wf-tools.cjs (verified)
case 'phase-ops':
  phaseOps.run(cwd, subArgs);
  break;
case 'settings':
  settings.run(cwd, subArgs);
  break;
```
[VERIFIED: wf-tools.cjs follows this exact pattern for all 10 existing commands]

### Pattern 3: Config Deep Merge with Defaults
**What:** `config.cjs` provides `CONFIG_DEFAULTS` constant and `deepMerge()` for layering project config over defaults
**When to use:** Settings command needs to read defaults, display current values, and write overrides
**Example:**
```javascript
// Source: config.cjs (verified)
const CONFIG_DEFAULTS = { mode: 'auto', granularity: 'standard', ... };
function loadConfig(cwd) {
  const projectConfig = utils.readJson(configPath) || {};
  return deepMerge(CONFIG_DEFAULTS, projectConfig);
}
```
[VERIFIED: config.cjs lines 12-94]

### Pattern 4: ROADMAP Phase Parsing
**What:** Regex-based ROADMAP.md parser extracts phase numbers (including decimals), names, and status
**When to use:** Phase-ops needs to read, insert into, and modify ROADMAP.md
**Example:**
```javascript
// Source: roadmap.cjs (verified)
const PHASE_PATTERN = /^#{2,3}\s+Phase\s+(\d[\d.]*?):\s*(.+)$/gm;
```
[VERIFIED: roadmap.cjs line 11, already supports decimal phase numbers]

### Anti-Patterns to Avoid
- **Direct STATE.md writes:** All state mutations MUST go through `wf-tools state` CLI commands (established in Phase 2) [VERIFIED: CLAUDE.md and workflow conventions]
- **Deep Task nesting:** Use Skill() chains instead of nested Task() calls (established in Phase 4) [VERIFIED: discuss-phase context D-01]
- **Blocking hooks:** Prompt guard MUST remain advisory-only (exit 0 even on findings) to prevent deadlocks [VERIFIED: D-11]
- **Hardcoded paths:** Use `$HOME/.claude/` prefix pattern from settings.json, not absolute paths [VERIFIED: settings.json]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom YAML parser | `state.cjs` parseFrontmatter/serializeFrontmatter | Already handles 2-level nesting, value type coercion [VERIFIED: state.cjs] |
| Config loading | Read raw JSON | `config.cjs` loadConfig with deepMerge | Handles defaults, missing file, nested merge [VERIFIED: config.cjs] |
| Project root discovery | Manual traversal | `utils.cjs` findProjectRoot | Handles $HOME boundary, .planning detection [VERIFIED: utils.cjs] |
| Phase directory lookup | Custom directory scan | `phase.cjs` findPhaseDir | Supports both GSD and WF naming conventions [VERIFIED: phase.cjs] |
| ROADMAP phase extraction | Custom regex | `roadmap.cjs` roadmapAnalyze | Already supports decimal phases, H2/H3 headers [VERIFIED: roadmap.cjs] |
| Agent completion parsing | Custom JSON extraction | Agent contracts pattern (extract last JSON block, check status field) | Standardized in agent-contracts.md [VERIFIED: agent-contracts.md] |
| Structured JSON output | console.log | `utils.cjs` output() with large-payload file fallback | Handles >50KB payloads via tmpfile, uses blocking writeSync [VERIFIED: utils.cjs] |

**Key insight:** The lib/ module architecture from Phase 1 provides all the building blocks. Phase 5's CLI work is primarily about extending existing modules (`roadmap.cjs` add write capability, `config.cjs` add save capability) and adding a new thin module for settings CLI, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: ROADMAP.md Write Corruption
**What goes wrong:** Writing to ROADMAP.md without preserving exact formatting breaks the regex parser (`PHASE_PATTERN`).
**Why it happens:** The parser expects exact `## Phase N:` or `### Phase N:` format. Extra spaces, wrong heading level, or missing colon breaks parsing.
**How to avoid:** Read existing ROADMAP.md content, insert/modify using string manipulation at precise positions (not regex replace which can lose content). Always re-validate with `roadmapAnalyze()` after write.
**Warning signs:** `roadmap analyze` returns fewer phases than expected after modification.

### Pitfall 2: Decimal Phase Directory Naming
**What goes wrong:** Creating a directory like `phase-2.5` or `025-inserted-phase` that doesn't match the directory lookup regex in `phase.cjs`.
**Why it happens:** `findPhaseDir` uses `Math.floor(num)` which maps 2.5 -> 2, conflicting with the actual Phase 2 directory.
**How to avoid:** D-04 says insert-phase uses decimal numbering but does NOT create directories (only modifies ROADMAP.md). If a directory is needed, use a naming like `02.5-phase-name` and update `findPhaseDir` regex to handle decimals.
**Warning signs:** `init phase-op 2.5` returns `phase_found: false`.

### Pitfall 3: Config File Location Mismatch
**What goes wrong:** `/wf-settings` writes to `.planning/config.json` but the template is at `wf/templates/config.json`. The WF system merges both (defaults from template, overrides from `.planning/config.json`).
**Why it happens:** `config.cjs` only reads `.planning/config.json` (line 91). The template is a reference, not loaded at runtime.
**How to avoid:** Settings command must write ONLY to `.planning/config.json`. Never modify `wf/templates/config.json`. The `loadConfig` function handles the merge automatically.
**Warning signs:** Changes appear to work but disappear after reinstalling WF.

### Pitfall 4: Prompt Guard Regex Catastrophic Backtracking
**What goes wrong:** Complex negative lookahead patterns with nested quantifiers cause exponential matching time on large file content.
**Why it happens:** Regex engines use backtracking; patterns like `(?!.*long.*pattern)` combined with `.*` at multiple levels create O(2^n) behavior.
**How to avoid:** Keep negative lookaheads simple and anchored. Test each pattern against 100KB+ content. Use fixed-length lookaheads where possible. The hook has a 5-second timeout (settings.json) as a safety net.
**Warning signs:** Hook timeout triggers (3-second stdinTimeout in wf-prompt-guard.js), Claude Code reports slow hook execution.

### Pitfall 5: Autonomous Mode Context Exhaustion
**What goes wrong:** Running all phases in autonomous mode exhausts the context window before completing.
**Why it happens:** Each Skill() call adds context. Discuss + plan + execute for a single phase can consume 30-50% of context. Multiple phases sequentially will overflow.
**How to avoid:** Autonomous workflow should check context budget between phases (using wf-context-monitor mechanism). D-02 already specifies pause on failure; add context-budget-based pause too. The `continuation-format.md` reference doc should address this.
**Warning signs:** Agent output truncation, incomplete SUMMARY.md files.

### Pitfall 6: Archive Directory for remove-phase
**What goes wrong:** `remove-phase` moves directory to `.planning/archive/` but that directory may not exist, or git status shows unexpected changes.
**Why it happens:** D-05 specifies moving to archive, but the directory isn't part of the standard `.planning/` structure.
**How to avoid:** Use `fs.mkdirSync(archivePath, { recursive: true })` before moving. Add `.planning/archive/` to the known directory structure. Consider whether archive contents should be gitignored.
**Warning signs:** `ENOENT` error when moving directory, unexpected staged files in git.

## Code Examples

### Example 1: Autonomous Skill() Chain Pattern
```markdown
<!-- Source: Synthesis of next.md Skill() pattern + D-01/D-02/D-03 decisions -->

<step name="phase_loop">
## 2. Phase Loop

For each pending phase N:

### 2.1 Discuss
Run discuss-phase in auto mode (D-03):
```
Skill(discuss-phase, { phase: N, flags: "--auto --batch" })
```

If --interactive flag was passed to autonomous, use interactive discuss instead:
```
Skill(discuss-phase, { phase: N })
```

### 2.2 Plan
```
Skill(plan-phase, { phase: N })
```

### 2.3 Execute
```
Skill(execute-phase, { phase: N })
```

### 2.4 Verify & Gap Closure (D-02)
Check verification result. If FAIL:
1. Generate gap closure plan
2. Execute gap closure
3. Re-verify once
4. If still FAIL -> pause autonomous, report to user
```
[VERIFIED: Pattern consistent with next.md lines 77-80 and agent-contracts.md retry rules]

### Example 2: Phase-Ops ROADMAP Insertion
```javascript
// Source: Synthesis of roadmap.cjs + D-04/D-06 decisions
// New function to add to roadmap.cjs

function insertPhaseToRoadmap(cwd, afterPhase, name, goal) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const content = utils.readFile(roadmapPath);

  // Calculate decimal phase number (D-04)
  const decimalNum = afterPhase + 0.5; // e.g., Phase 2.5

  // Find insertion point: after the Phase afterPhase details block
  // Insert new phase entry in ROADMAP
  const newPhaseBlock = [
    '',
    `### Phase ${decimalNum}: ${name} **INSERTED**`,
    `**Goal**: ${goal}`,
    `**Depends on**: Phase ${afterPhase}`,
    `**Requirements**: TBD`,
    `**Plans**: TBD`,
    ''
  ].join('\n');

  // Insert after the afterPhase block, before next phase
  // ... string manipulation logic ...

  utils.writeFile(roadmapPath, modifiedContent);
}
```
[ASSUMED: Exact insertion logic needs careful testing against ROADMAP.md format]

### Example 3: Settings Config Save
```javascript
// Source: Synthesis of config.cjs + D-07/D-08 decisions
// New function to add to config.cjs or new settings.cjs

function saveConfig(cwd, key, value) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const existing = utils.readJson(configPath) || {};

  // Support dotted keys: "workflow.research" -> { workflow: { research: value } }
  const parts = key.split('.');
  let target = existing;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!target[parts[i]] || typeof target[parts[i]] !== 'object') {
      target[parts[i]] = {};
    }
    target = target[parts[i]];
  }
  target[parts[parts.length - 1]] = parseValue(value);

  utils.writeFile(configPath, JSON.stringify(existing, null, 2));
}
```
[VERIFIED: Pattern follows config.cjs deepMerge approach; configPath confirmed at line 91]

### Example 4: Prompt Guard Negative Lookahead
```javascript
// Source: Analysis of current wf-prompt-guard.js + D-10 decision

// BEFORE: High false positive rate
/you\s+are\s+now\s+(?:a|an|the)\s+/i,

// AFTER: Negative lookahead excludes code blocks and documentation context
/you\s+are\s+now\s+(?:a|an|the)\s+(?!.*(?:```|`[^`]+`|#\s+|>\s+))./i,

// BEFORE: Catches legitimate "act as a plan" references
/act\s+as\s+(?:a|an|the)\s+(?!plan|phase|wave)/i,

// AFTER: Extended exclusion list for workflow terminology
/act\s+as\s+(?:a|an|the)\s+(?!plan|phase|wave|step|task|agent|researcher|executor|planner|verifier)/i,

// File suffix whitelist (D-10): .md files produce warnings instead of alerts
const REDUCED_SEVERITY_EXTENSIONS = ['.md', '.txt', '.log'];
```
[ASSUMED: Specific lookahead patterns need testing against real false-positive corpus]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pseudocode autonomous.md (161 lines) | Skill() chain with real error recovery | Phase 5 | Autonomous mode becomes actually executable |
| Read-only roadmap.cjs | Read + write ROADMAP operations | Phase 5 | Dynamic phase management enabled |
| Hardcoded config (edit JSON manually) | Interactive /wf-settings command | Phase 5 | User-friendly config without file editing |
| 13 raw regex patterns in prompt guard | Negative lookahead + whitelist patterns | Phase 5 | Fewer false positives, same security |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Decimal phase directories (02.5-name) need findPhaseDir update to handle non-integer phase numbers | Pitfalls | insert-phase creates orphan directories that CLI can't find |
| A2 | Specific negative lookahead regex patterns will effectively reduce false positives without creating security gaps | Code Examples | May need iterative tuning based on real usage patterns |
| A3 | ROADMAP.md string manipulation for insert/remove won't corrupt the markdown format | Pitfalls | ROADMAP becomes unparseable, breaking all phase detection |
| A4 | `.planning/archive/` is the right location for removed phase directories | Code Examples | Git history confusion or accidental inclusion in workflows |

## Open Questions

1. **Decimal phase directory support**
   - What we know: ROADMAP regex (`PHASE_PATTERN`) already supports decimal numbers (e.g., `\d[\d.]*?`). D-04 says decimal numbering with no directory renaming.
   - What's unclear: Should `insert-phase` create a directory for the decimal phase, or only modify ROADMAP.md? If a directory is created, `findPhaseDir` uses `Math.floor(num)` which maps 2.5 -> 2, conflicting with Phase 2's directory.
   - Recommendation: insert-phase should create a directory using a pattern like `phases/02.5-phase-name/`. Update `findPhaseDir` to check for exact decimal match before falling back to `Math.floor`. This is minimal code change in phase.cjs.

2. **Settings command scope for config keys**
   - What we know: D-08 specifies exposing "behavior" configs but hiding internal state. CONFIG_DEFAULTS in config.cjs has clear structure.
   - What's unclear: The `.planning/config.json` in this project has GSD-specific keys (`model_profile`, `brave_search`, `firecrawl`, etc.) that don't exist in WF's CONFIG_DEFAULTS. Should /wf-settings only manage WF-known keys?
   - Recommendation: /wf-settings should expose keys from CONFIG_DEFAULTS structure. Unknown keys in `.planning/config.json` are preserved but not displayed in the interactive menu. Keys starting with `_` are hidden per D-08.

3. **Autonomous mode context budget between phases**
   - What we know: context-monitor hook warns at 35%/25% remaining. Executor has 70% budget pause. But autonomous orchestrator runs in the main session.
   - What's unclear: How does the main session (running autonomous) detect its own context budget to decide whether to start the next phase?
   - Recommendation: Document in `context-budget.md` reference. Autonomous workflow should use wf-context-monitor's mechanism or check the statusline metrics file before starting each new phase. If remaining < 40%, pause and save state.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All CLI tools | Yes | v24.5.0 | -- |
| Git | git.cjs, session.cjs | Yes | 2.53.0 | -- |
| fs module | All file operations | Yes | built-in | -- |
| child_process | git operations | Yes | built-in | -- |

No missing dependencies. All tools required by Phase 5 are available.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`.test.cjs` files) |
| Config file | None -- tests are standalone scripts |
| Quick run command | `node wf/bin/lib/<module>.test.cjs` |
| Full suite command | `for f in wf/bin/lib/*.test.cjs; do node "$f"; done` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WF-01 | autonomous.md Skill() chain | manual-only | N/A (Markdown workflow, not executable code) | N/A |
| WF-02 | roadmap add/insert/remove | unit | `node wf/bin/lib/roadmap.test.cjs` | Exists (needs extension) |
| WF-03 | config save/get/schema | unit | `node wf/bin/lib/config.test.cjs` | Exists (needs extension) |
| WF-04 | Reference docs exist and are substantive | smoke | `test -s wf/references/anti-patterns.md && echo PASS` | Wave 0 |
| WF-05 | prompt guard negative lookahead | unit | `node hooks/wf-prompt-guard.test.cjs` | Wave 0 |
| WF-06 | git --files | unit | `node wf/bin/lib/git.test.cjs` | Already done |

### Sampling Rate
- **Per task commit:** `node wf/bin/lib/<modified_module>.test.cjs`
- **Per wave merge:** `for f in wf/bin/lib/*.test.cjs; do node "$f"; done`
- **Phase gate:** Full suite green before `/wf-verify-work`

### Wave 0 Gaps
- [ ] `wf/bin/lib/roadmap.test.cjs` -- extend with addPhase/insertPhase/removePhase tests
- [ ] `wf/bin/lib/config.test.cjs` -- extend with saveConfig/getSchema tests (file exists but needs WF-03 coverage)
- [ ] `hooks/wf-prompt-guard.test.cjs` -- new test file for false-positive regression testing

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | -- |
| V3 Session Management | No | -- |
| V4 Access Control | No | -- |
| V5 Input Validation | Yes | CLI argument validation (parseFlag pattern, key format validation via VALID_KEY_PATTERN) |
| V6 Cryptography | No | -- |

### Known Threat Patterns for CLI Tools + Prompt Guard

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via phase number input | Tampering | parseInt validation (already in phase.cjs, state.cjs) |
| Config key injection via /wf-settings set | Tampering | Key whitelist against CONFIG_DEFAULTS structure |
| Prompt injection bypassing negative lookahead | Spoofing | Keep advisory mode; lookaheads are defense-in-depth, not sole defense |
| ROADMAP.md corruption via malformed insert | Tampering | Validate ROADMAP parse result after write; rollback on failure |

## Sources

### Primary (HIGH confidence)
- `wf/bin/wf-tools.cjs` -- CLI router structure, all 10 existing commands verified
- `wf/bin/lib/roadmap.cjs` -- PHASE_PATTERN regex, roadmapAnalyze function, decimal support
- `wf/bin/lib/config.cjs` -- CONFIG_DEFAULTS (57 lines), loadConfig, deepMerge
- `wf/bin/lib/state.cjs` -- parseFrontmatter/serializeFrontmatter, VALID_KEY_PATTERN
- `wf/bin/lib/phase.cjs` -- findPhaseDir with dual naming convention support
- `wf/bin/lib/session.cjs` -- createHandoff, parseFlag utility
- `wf/bin/lib/utils.cjs` -- readFile, readJson, writeFile, output, findProjectRoot
- `wf/bin/lib/git.cjs` -- --files support confirmed implemented
- `hooks/wf-prompt-guard.js` -- 13 INJECTION_PATTERNS, advisory mode, 3s timeout
- `wf/workflows/autonomous.md` -- current 161-line pseudocode implementation
- `wf/workflows/session.md` -- Skill() routing pattern reference
- `wf/workflows/next.md` -- State detection + Skill() delegation pattern
- `wf/workflows/discuss-phase.md` -- --auto/--batch/--chain flag patterns
- `wf/workflows/execute-phase.md` -- Agent contracts invocation, completion parsing
- `wf/workflows/plan-phase.md` -- Research + plan + check workflow
- `wf/references/agent-contracts.md` -- Completion marker format, retry rules, model config
- `wf/references/gates.md` -- Quality gate definitions (81 lines)
- `wf/references/verification-patterns.md` -- 4-level verification model (89 lines)
- `wf/references/ui-brand.md` -- Visual spec for status displays
- `wf/templates/config.json` -- Template config structure (44 lines)
- `commands/wf/autonomous.md` -- Command entry point with frontmatter
- `settings.json` -- Hook bindings (PreToolUse timeout: 5s)
- `.planning/config.json` -- Current project config
- `.planning/ROADMAP.md` -- Phase numbering convention and progress table

### Secondary (MEDIUM confidence)
- `~/.claude/hooks/gsd-prompt-guard.js` -- GSD equivalent for pattern comparison (14 patterns, includes `<<SYS>>` not in WF version)

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all from existing codebase
- Architecture: HIGH -- patterns verified from Phase 4 Skill() implementations
- Pitfalls: HIGH -- identified from code analysis of actual modules
- Code examples: MEDIUM -- synthesis of verified patterns, but exact implementation details may vary

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable internal project, no external dependency drift)
