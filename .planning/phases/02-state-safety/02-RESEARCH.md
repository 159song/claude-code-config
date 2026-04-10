# Phase 2: State Safety - Research

**Researched:** 2026-04-10
**Domain:** State management CLI, YAML frontmatter CRUD, format validation/repair
**Confidence:** HIGH

## Summary

Phase 2 extends the existing `state.cjs` module (established in Phase 1) with additional CLI subcommands to make STATE.md and ROADMAP.md mutations safe, atomic, and CLI-only. The codebase already has a working `state get/set/json` foundation, a `parseFrontmatter` function, and the router + lib/ module architecture pattern from Phase 1. The primary work is: (1) enhancing the YAML frontmatter parser to handle nested objects, (2) adding new subcommands (`patch`, `merge`, `begin-phase`, `advance-plan`, `validate`), (3) adding a `validate` command with `--repair`, (4) updating roadmap.cjs for content-based verification detection (partially done already), and (5) updating workflow/agent markdown files to reference CLI commands instead of direct Write/Edit.

The most critical technical finding is that the current `parseFrontmatter` silently drops nested YAML objects -- the `progress:` field in STATE.md (which has 5 sub-keys) is parsed as `null`. This must be fixed before any other state commands can work correctly with the full STATE.md structure. The fix is straightforward since the codebase uses a custom line-based parser (no external YAML library needed, per project constraints).

**Primary recommendation:** Fix nested YAML parsing first (foundation for everything else), then implement new subcommands in state.cjs, then add validate.cjs as a new module, then update workflow markdown files to use CLI commands.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None explicitly locked -- this is an infrastructure phase with all implementation choices at Claude's discretion.

### Claude's Discretion
All implementation choices are at Claude's discretion -- pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from Phase 1:
- wf-tools.cjs is a pure router dispatching to lib/ modules (Phase 1 established this pattern)
- All new CLI commands should follow the router + lib/ module pattern
- CommonJS modules with module.exports
- Node.js standard library only (no external dependencies)

### Deferred Ideas (OUT OF SCOPE)
None -- discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STATE-01 | All STATE.md writes via CLI, no direct Write/Edit | Workflow migration analysis identifies 6 workflow files and 3 agent files that need markdown updates to reference CLI commands. See "Migration Scope" section. |
| STATE-02 | Roadmap status detection reads file content (PASS/FAIL), not just file existence | roadmap.cjs already partially implements this (lines 72-76). Needs review to ensure `verificationPassed` is used for status correctly and progress.cjs also uses content-based detection. |
| STATE-03 | Health check command validate/health with --repair | New `validate.cjs` module needed. Research identifies 5 concrete validation rules and 3 repair strategies. |
| STATE-04 | YAML frontmatter CRUD (get/set/merge/validate) | parseFrontmatter needs nested YAML support fix. New `merge` and `validate` subcommands for frontmatter operations. |
| STATE-05 | Batch state updates (state patch --field1 val1 --field2 val2) | New `patch` subcommand in state.cjs. Pattern: parse key-value pairs from args, call stateSet in sequence, single file write. |
| STATE-06 | Phase transition commands (state begin-phase, state advance-plan) | New compound subcommands that atomically update multiple frontmatter fields + progress recalculation. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | v24.5.0 | Runtime | Already installed, project requires v14+ [VERIFIED: node --version] |
| node:test | built-in | Test framework | Already used in all 6 existing test files [VERIFIED: codebase inspection] |
| node:assert | built-in | Assertions | Already used in all tests [VERIFIED: codebase inspection] |
| node:fs | built-in | File I/O | Project constraint: Node.js standard library only [VERIFIED: CLAUDE.md] |
| node:path | built-in | Path manipulation | Already used in all modules [VERIFIED: codebase inspection] |

### Supporting
No additional libraries needed. This phase operates entirely within the existing Node.js standard library constraint.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom YAML parser | js-yaml npm package | Project constraint prohibits external dependencies. Custom parser is adequate for the 2-level nesting used in STATE.md frontmatter. |
| JSON Schema validation | ajv npm package | Overkill for this use case. Hand-written validation rules are simpler and match the codebase pattern. |

## Architecture Patterns

### Recommended Project Structure
```
wf/bin/
  wf-tools.cjs          # Pure router (add 'validate' case)
  lib/
    state.cjs            # Extend with: patch, merge, begin-phase, advance-plan, frontmatter ops
    roadmap.cjs          # Fix: content-based verification in progress calc
    validate.cjs         # NEW: health check, format validation, --repair
    progress.cjs         # Update: use content-based verification (mirrors roadmap.cjs fix)
    utils.cjs            # No changes needed
    phase.cjs            # Minor: may expose helpers for begin-phase
    config.cjs           # No changes needed
    init.cjs             # No changes needed
    git.cjs              # No changes needed
```

### Pattern 1: Subcommand Extension (Established in Phase 1)
**What:** Each lib/ module has a `run(cwd, args)` function that dispatches to sub-functions based on `args[0]`.
**When to use:** For all new state subcommands.
**Example:**
```javascript
// Source: wf/bin/lib/state.cjs (existing pattern) [VERIFIED: codebase]
function run(cwd, args) {
  const sub = args[0];
  if (sub === 'get') {
    stateGet(cwd, args[1]);
  } else if (sub === 'set') {
    stateSet(cwd, args[1], args.slice(2).join(' '));
  } else if (sub === 'json') {
    stateJson(cwd);
  // NEW subcommands follow the same pattern:
  } else if (sub === 'patch') {
    statePatch(cwd, args.slice(1));
  } else if (sub === 'merge') {
    stateMerge(cwd, args.slice(1));
  } else if (sub === 'begin-phase') {
    stateBeginPhase(cwd, args.slice(1));
  } else if (sub === 'advance-plan') {
    stateAdvancePlan(cwd, args.slice(1));
  } else {
    utils.error('用法: wf-tools state [get|set|json|patch|merge|begin-phase|advance-plan]');
    process.exit(1);
  }
}
```

### Pattern 2: Format-Preserving Frontmatter Mutation
**What:** Read file, parse frontmatter + body, mutate frontmatter fields, serialize frontmatter back, rewrite file. Body content is never modified.
**When to use:** All STATE.md mutations.
**Example:**
```javascript
// Source: state.cjs stateSet pattern [VERIFIED: codebase line 107-138]
// Read → Parse → Mutate → Serialize → Write
function stateSet(cwd, key, value) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = utils.readFile(statePath);
  // ... parse frontmatter, update key, serialize back, writeFile
}
```

### Pattern 3: New Module Registration (Router Pattern)
**What:** New modules are added to `wf-tools.cjs` router via `require()` + `case` in switch.
**When to use:** For the new `validate` module.
**Example:**
```javascript
// Source: wf/bin/wf-tools.cjs [VERIFIED: codebase]
const validate = require('./lib/validate.cjs');
// ... in switch:
case 'validate':
  validate.run(cwd, subArgs);
  break;
```

### Pattern 4: JSON Output Convention
**What:** All commands output structured JSON via `utils.output()`. Error messages go to stderr via `utils.error()`.
**When to use:** All new subcommands must follow this.
**Example:**
```javascript
// Source: utils.cjs [VERIFIED: codebase]
utils.output({ success: true, updated: ['status', 'last_activity'] });
utils.error('用法: wf-tools validate [health|format] [--repair]');
```

### Anti-Patterns to Avoid
- **Direct STATE.md Write/Edit in workflows:** This is exactly what Phase 2 eliminates. Workflows must call `wf-tools.cjs state <subcommand>` via Bash instead.
- **External YAML library:** Project constraint forbids external deps. The custom parser handles the 2-level nesting in STATE.md adequately.
- **Body content mutation via frontmatter commands:** Frontmatter CRUD must never touch the markdown body. The `parseFrontmatter` → edit → `serializeFrontmatter` pattern preserves body content byte-for-byte.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing (full spec) | Full YAML parser | Custom 2-level line-based parser | Only flat + 1-level nested objects needed for STATE.md frontmatter. Full YAML spec is massive and external deps are forbidden. |
| File locking for concurrent access | OS-level file locks | Single-process synchronous fs.writeFileSync | wf-tools.cjs runs as single CLI invocations, not a long-running server. Synchronous writes are atomic enough. |
| Date/time formatting | Custom date formatter | `new Date().toISOString()` | ISO 8601 is the standard already used in STATE.md [VERIFIED: `last_updated` field]. |
| Progress bar rendering | ASCII progress calculation | `Math.round((completed / total) * 100)` | Progress percentage is the meaningful metric. The visual bar `[████░░░░]` is rendered by workflow display, not the CLI tool. |

**Key insight:** This phase is about adding more subcommands to an already-working module, not building a new system. The existing `state.cjs` has the right architecture; it just needs more operations.

## Codebase Analysis: Current State

### Existing state.cjs Capabilities [VERIFIED: codebase inspection]
| Function | Status | Notes |
|----------|--------|-------|
| `parseFrontmatter(content)` | Working, needs fix | Drops nested YAML objects (progress: parsed as null) |
| `parseStateMd(cwd)` | Working | Combines frontmatter + bullet-list fallback |
| `stateGet(cwd, key)` | Working | Single key read |
| `stateSet(cwd, key, value)` | Working | Single key write to frontmatter |
| `stateJson(cwd)` | Working | Full state as JSON |
| `statePatch(cwd, args)` | Missing | Need: batch key-value updates |
| `stateMerge(cwd, jsonStr)` | Missing | Need: deep merge JSON into frontmatter |
| `stateBeginPhase(cwd, args)` | Missing | Need: atomic phase transition |
| `stateAdvancePlan(cwd, args)` | Missing | Need: increment plan counter + update progress |

### Critical Bug: Nested YAML Parsing [VERIFIED: live test]

**Current behavior:**
```javascript
// Running parseFrontmatter on actual STATE.md:
// progress: { total_phases: 6, completed_phases: 1, ... }
// Result: progress: null  <-- SILENTLY DROPPED
```

**Root cause (state.cjs lines 29-30):**
```javascript
// Skips indented lines (which are nested object children):
if (!line || /^\s/.test(line)) continue;
// Empty-string value matches null case:
} else if (value === 'null' || value === '~' || value === '') {
  value = null;
}
```

The parser skips all indented lines (sub-keys of `progress:`) and treats the parent key's empty value as `null`.

**Fix approach:** When a key has an empty value AND the next lines are indented, collect them into a sub-object. Only 2-level nesting needed (e.g., `progress.total_phases`). The serializer must also handle writing nested objects back.

### Existing roadmap.cjs Verification Logic [VERIFIED: codebase inspection]

roadmap.cjs already reads VERIFICATION.md content and checks for `PASS` (line 75):
```javascript
verificationPassed = verContent ? /\bPASS\b/i.test(verContent) : false;
```

However, `progress.cjs` does NOT use content-based verification. It only checks `has_verification` (file existence) on line 43. This inconsistency needs fixing for STATE-02.

### Migration Scope: Files Referencing Direct STATE.md Writes [VERIFIED: grep audit]

Workflow files that instruct agents to write STATE.md directly:

| File | What It Does | Migration Action |
|------|-------------|------------------|
| `wf/workflows/execute-phase.md` (line 108, 148-150) | "更新 STATE.md 中的进度百分比" and "当前阶段标记为 completed" | Replace with `wf-tools.cjs state advance-plan` and `wf-tools.cjs state begin-phase` |
| `wf/workflows/autonomous.md` (line 98) | "更新 STATE.md，继续下一阶段" | Replace with `wf-tools.cjs state begin-phase` |
| `wf/workflows/new-project.md` (step 6, lines 124-128) | "生成 .planning/STATE.md" | Initial creation is acceptable (file doesn't exist yet). Add note to use CLI for subsequent updates. |
| `wf/workflows/discuss-phase.md` (line 25) | Reads STATE.md (read-only) | No change needed -- reads are safe |
| `wf/workflows/progress.md` (line 10) | Reads STATE.md (read-only) | No change needed -- reads are safe |
| `commands/wf/autonomous.md` (line 22) | "STATE.md -- 实时更新" | Update to reference CLI commands |
| `hooks/wf-context-monitor.js` (line 88) | Reads STATE.md for isWfActive check (read-only) | No change needed |
| `hooks/wf-session-state.sh` (line 8-10) | Reads STATE.md via `head -20` (read-only) | No change needed (Phase 4 will improve this) |

**Agent files (markdown instructions):**
| File | Reference | Migration Action |
|------|-----------|------------------|
| `agents/wf-planner.md` | Reads ROADMAP.md, REQUIREMENTS.md (read-only) | No change needed |
| `agents/wf-verifier.md` | Reads PLAN.md, SUMMARY.md (read-only) | No change needed |
| `agents/wf-roadmapper.md` | Writes ROADMAP.md (initial creation) | Initial creation acceptable. No mutation of existing ROADMAP.md |

**Summary:** 3 workflow markdown files need migration (execute-phase.md, autonomous.md, new-project.md step note). 1 command file needs update (autonomous.md command). All agent files are read-only -- no changes needed.

## New Module: validate.cjs

### Validation Rules for STATE.md [ASSUMED]

| Rule | Check | Repair Strategy |
|------|-------|-----------------|
| Frontmatter exists | Starts with `---\n` | Wrap existing content in empty frontmatter |
| Frontmatter closes | Has matching `\n---\n` | Append `\n---\n` after last YAML line |
| Required keys present | `status`, `last_updated`, `last_activity` exist | Add missing keys with sensible defaults |
| Progress consistency | `progress.total_phases` matches ROADMAP.md phase count | Recalculate from roadmap |
| Phase number valid | `stopped_at` or current focus references existing phase | Set to first non-verified phase |

### Validate Command Interface
```bash
# Health check (report only)
wf-tools validate health

# Health check with auto-repair
wf-tools validate health --repair

# Format check only
wf-tools validate format

# Output:
# { "valid": true, "issues": [], "repaired": [] }
# { "valid": false, "issues": ["missing frontmatter closer"], "repaired": ["added ---"] }
```

## Frontmatter CRUD Operations (STATE-04)

### Operation Definitions

| Operation | CLI | Behavior |
|-----------|-----|----------|
| **get** | `state get <key>` | Read single key (exists) |
| **get** (dotted) | `state get progress.total_phases` | Read nested key (needs new nested parse) |
| **set** | `state set <key> <value>` | Write single key (exists) |
| **set** (dotted) | `state set progress.completed_phases 2` | Write nested key (needs nested write) |
| **merge** | `state merge '{"progress":{"completed_phases":2}}'` | Deep merge JSON into frontmatter |
| **validate** | `state validate` | Check frontmatter structure, report issues |
| **patch** | `state patch --status active --last_activity 2026-04-10` | Set multiple keys at once (STATE-05) |

### Nested YAML Serializer

The serializer must produce valid YAML for 2-level objects:
```yaml
---
status: active
last_updated: "2026-04-10T12:00:00.000Z"
progress:
  total_phases: 6
  completed_phases: 2
  percent: 33
---
```

Algorithm:
1. For each key in frontmatter object
2. If value is a plain object (not null, not array), write `key:` on its own line, then each sub-key indented with 2 spaces
3. If value is string containing special chars, wrap in quotes
4. If value is number/boolean/null, write literal

## Phase Transition Commands (STATE-06)

### begin-phase
```bash
wf-tools state begin-phase --phase 2
```
Atomic operations:
1. Set `status` to "executing" (or "planning" depending on context)
2. Set `stopped_at` to "Phase 2 started"
3. Set `last_updated` to current ISO timestamp
4. Set `last_activity` to current date
5. Update `Current Position` section in body (if present)

### advance-plan
```bash
wf-tools state advance-plan --phase 2 --plan 1
```
Atomic operations:
1. Increment `progress.completed_plans`
2. Recalculate `progress.percent` based on completed vs total
3. Set `last_updated` to current ISO timestamp
4. Set `last_activity` to current date

## Common Pitfalls

### Pitfall 1: Nested YAML Silent Data Loss
**What goes wrong:** parseFrontmatter skips indented lines, losing nested object values. `progress.total_phases`, `progress.completed_phases`, etc. all become invisible.
**Why it happens:** The parser was designed for flat key-value pairs only. STATE.md evolved to use nested `progress:` object but the parser was not updated.
**How to avoid:** Fix parseFrontmatter first, before any other work. Add test cases for nested objects. Ensure `stateJson` returns the full nested structure.
**Warning signs:** `state json` returns `"progress": null` when STATE.md clearly has progress sub-fields.

### Pitfall 2: Frontmatter Serialization Destroys Formatting
**What goes wrong:** When writing back frontmatter after mutation, naive serialization can reorder keys, change quoting style, or strip comments.
**Why it happens:** Parse-mutate-serialize round-trip doesn't preserve original formatting.
**How to avoid:** Use a line-based mutation approach for simple set operations (regex replace the specific line). Only use full re-serialization for merge/patch operations. For re-serialization, maintain a consistent key ordering.
**Warning signs:** `git diff` shows reformatted frontmatter lines that weren't actually changed.

### Pitfall 3: stateSet Regex Matching Breaks on Nested Keys
**What goes wrong:** `stateSet` uses regex `^(key:)\\s*(.*)$` to find and replace. For a key like `progress` that has sub-keys, this replaces the parent line but leaves orphaned indented children.
**Why it happens:** stateSet was designed for flat keys only.
**How to avoid:** For nested key writes (dotted paths like `progress.completed_phases`), the setter must: (1) find the parent block, (2) find/update the sub-key within that block, (3) re-serialize the parent block. For top-level key writes that replace a nested object with a flat value, remove the orphaned indented lines.
**Warning signs:** STATE.md has orphaned indented lines after a `state set progress 5`.

### Pitfall 4: progress.cjs Uses File Existence Instead of Content
**What goes wrong:** `progress.cjs` calculates phase progress by checking `has_verification` (file exists) but doesn't check if verification actually PASSED. A phase with a FAIL verification file would still count as progressed.
**Why it happens:** progress.cjs and roadmap.cjs were written independently. roadmap.cjs already fixed this (reads VERIFICATION.md content), but progress.cjs didn't get the same fix.
**How to avoid:** Update progress.cjs to use content-based verification detection, same as roadmap.cjs.
**Warning signs:** Progress shows 100% for a phase that has a VERIFICATION.md with FAIL result.

### Pitfall 5: Patch Command Argument Parsing Ambiguity
**What goes wrong:** `state patch --status active --last_activity 2026-04-10` -- how do you distinguish `--status` (a frontmatter key) from `--repair` (a command flag)?
**Why it happens:** Key names in frontmatter and command flags share the `--` prefix.
**How to avoid:** Convention: `state patch` treats ALL `--key value` pairs as frontmatter updates. No command flags for patch. If flags are needed in the future, use a `--` separator.
**Warning signs:** `state patch --repair true` sets frontmatter key `repair` to `true` instead of triggering repair mode.

## Code Examples

### Example 1: Fixed parseFrontmatter with Nested YAML Support
```javascript
// Approach: collect indented lines under parent key into sub-object
function parseFrontmatter(content) {
  if (!content || !content.startsWith('---\n')) {
    return { frontmatter: {}, body: content || '' };
  }
  const endIdx = content.indexOf('\n---\n', 4);
  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }
  const yamlBlock = content.slice(4, endIdx);
  const lines = yamlBlock.split('\n');
  const frontmatter = {};
  let currentParent = null;

  for (const line of lines) {
    if (!line) continue;

    // Indented line = sub-key of currentParent
    const indentMatch = line.match(/^(\s+)([\w][\w_]*):\s*(.*)$/);
    if (indentMatch && currentParent) {
      if (typeof frontmatter[currentParent] !== 'object' || frontmatter[currentParent] === null) {
        frontmatter[currentParent] = {};
      }
      frontmatter[currentParent][indentMatch[2]] = parseYamlValue(indentMatch[3].trim());
      continue;
    }

    // Top-level key
    const match = line.match(/^([\w][\w_]*):\s*(.*)$/);
    if (match) {
      const value = match[2].trim();
      if (value === '' || value === null) {
        // Could be a parent of nested object -- set to null, will be replaced if sub-keys follow
        frontmatter[match[1]] = null;
        currentParent = match[1];
      } else {
        frontmatter[match[1]] = parseYamlValue(value);
        currentParent = null;
      }
    }
  }

  const body = content.slice(endIdx + 5);
  return { frontmatter, body };
}

function parseYamlValue(value) {
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null' || value === '~') return null;
  return value;
}
```

### Example 2: Frontmatter Serializer
```javascript
function serializeFrontmatter(fm) {
  const lines = [];
  for (const [key, val] of Object.entries(fm)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const [subKey, subVal] of Object.entries(val)) {
        lines.push(`  ${subKey}: ${formatYamlValue(subVal)}`);
      }
    } else {
      lines.push(`${key}: ${formatYamlValue(val)}`);
    }
  }
  return lines.join('\n');
}

function formatYamlValue(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'number') return String(val);
  // Quote strings that contain special YAML chars or look like timestamps
  if (typeof val === 'string') {
    if (/[:#\[\]{}|>!&*?,]/.test(val) || /^\d{4}-\d{2}/.test(val)) {
      return `"${val}"`;
    }
    return val;
  }
  return String(val);
}
```

### Example 3: statePatch Implementation
```javascript
function statePatch(cwd, args) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = utils.readFile(statePath);
  if (!content) {
    utils.error('STATE.md 不存在');
    process.exit(1);
  }

  const { frontmatter, body } = parseFrontmatter(content);
  const updated = [];

  // Parse --key value pairs
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      const key = args[i].slice(2);
      const value = parseYamlValue(args[i + 1]);
      frontmatter[key] = value;
      updated.push(key);
      i += 2;
    } else {
      i++;
    }
  }

  // Re-serialize
  const newFm = serializeFrontmatter(frontmatter);
  content = `---\n${newFm}\n---\n${body}`;
  utils.writeFile(statePath, content);
  utils.output({ success: true, updated });
}
```

### Example 4: stateBeginPhase Implementation
```javascript
function stateBeginPhase(cwd, args) {
  // Parse --phase N
  let phaseNum = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--phase' && args[i + 1]) {
      phaseNum = parseInt(args[i + 1], 10);
    }
  }
  if (!phaseNum) {
    utils.error('用法: wf-tools state begin-phase --phase <N>');
    process.exit(1);
  }

  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const content = utils.readFile(statePath);
  if (!content) {
    utils.error('STATE.md 不存在');
    process.exit(1);
  }

  const { frontmatter, body } = parseFrontmatter(content);
  const now = new Date();

  frontmatter.status = 'executing';
  frontmatter.stopped_at = `Phase ${phaseNum} started`;
  frontmatter.last_updated = `"${now.toISOString()}"`;
  frontmatter.last_activity = now.toISOString().slice(0, 10);

  const newFm = serializeFrontmatter(frontmatter);
  const newContent = `---\n${newFm}\n---\n${body}`;
  utils.writeFile(statePath, newContent);
  utils.output({ success: true, phase: phaseNum });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct Write/Edit to STATE.md | CLI-only mutations via wf-tools.cjs | Phase 2 (this phase) | Eliminates format corruption and parallel conflicts |
| Flat-only frontmatter parsing | 2-level nested YAML parsing | Phase 2 (this phase) | `progress:` sub-fields now accessible |
| File-existence verification check | Content-based PASS/FAIL verification | Phase 2 (this phase) | Accurate phase completion detection |

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Validate module needs 5 specific validation rules (frontmatter exists, closes, required keys, progress consistency, phase number valid) | New Module: validate.cjs | Low -- rules can be added/removed during implementation without architectural impact |
| A2 | 2-level nesting (flat + one level of sub-objects) is sufficient for STATE.md | Architecture Patterns | Low -- current STATE.md only uses 1 level of nesting (progress:). If deeper nesting is needed later, the parser can be extended |
| A3 | `begin-phase` should set status to "executing" | Phase Transition Commands | Low -- the exact status string can be adjusted during implementation |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in) v24.5.0 |
| Config file | None (uses node --test directly) |
| Quick run command | `node --test wf/bin/lib/state.test.cjs` |
| Full suite command | `node --test wf/bin/lib/state.test.cjs wf/bin/lib/roadmap.test.cjs wf/bin/lib/progress.test.cjs wf/bin/lib/validate.test.cjs` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STATE-01 | CLI-only writes (workflow migration) | manual | Grep for direct Write/Edit patterns in workflow .md files | N/A (documentation check) |
| STATE-02 | Content-based verification detection | unit | `node --test wf/bin/lib/roadmap.test.cjs` | Existing, needs new test cases |
| STATE-03 | validate health with --repair | unit | `node --test wf/bin/lib/validate.test.cjs` | No -- Wave 0 |
| STATE-04 | Frontmatter get/set/merge/validate | unit | `node --test wf/bin/lib/state.test.cjs` | Existing, needs new test cases |
| STATE-05 | Batch state patch | unit | `node --test wf/bin/lib/state.test.cjs` | Existing, needs new test cases |
| STATE-06 | begin-phase, advance-plan | unit | `node --test wf/bin/lib/state.test.cjs` | Existing, needs new test cases |

### Sampling Rate
- **Per task commit:** `node --test wf/bin/lib/state.test.cjs`
- **Per wave merge:** `node --test wf/bin/lib/state.test.cjs wf/bin/lib/roadmap.test.cjs wf/bin/lib/validate.test.cjs`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `wf/bin/lib/validate.test.cjs` -- covers STATE-03
- [ ] `wf/bin/lib/progress.test.cjs` -- needs content-based verification tests (STATE-02, may need creation if doesn't exist with enough coverage)
- [ ] Additional test cases in `state.test.cjs` for: nested YAML parsing, patch, merge, begin-phase, advance-plan

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A (local CLI tool) |
| V3 Session Management | No | N/A (stateless CLI invocations) |
| V4 Access Control | No | N/A (runs as local user) |
| V5 Input Validation | Yes | Validate CLI args: phase numbers must be integers, key names must match `[\w_]+` pattern, JSON for merge must parse correctly |
| V6 Cryptography | No | N/A (no secrets handled) |

### Known Threat Patterns for CLI state management

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via --phase arg | Tampering | parseInt validation (already in init.cjs pattern) [VERIFIED: init.cjs line 26] |
| Malformed JSON in merge command | Tampering | try/catch on JSON.parse, exit with error message |
| STATE.md corruption from partial write | Tampering | Synchronous writeFileSync (atomic at OS level for small files) |

## Open Questions

1. **Body content update for `begin-phase`**
   - What we know: STATE.md has a "Current Position" section in the body with human-readable text like "Phase: 2 of 6 (state safety)"
   - What's unclear: Should `begin-phase` also update this body text, or only the frontmatter?
   - Recommendation: Update frontmatter only. Body is for human display and can be regenerated from frontmatter by the progress workflow. This keeps the CLI simple and avoids fragile body-text parsing.

2. **ROADMAP.md checkbox updates**
   - What we know: ROADMAP.md has `- [ ] **Phase N:** ...` checkbox lines and a Progress table
   - What's unclear: Should Phase 2 add a CLI command to update ROADMAP.md checkboxes when a phase completes?
   - Recommendation: Out of scope for Phase 2. ROADMAP.md updates can be handled by `advance-plan` updating only STATE.md, and a future phase can add roadmap mutation commands if needed.

3. **validate --repair scope**
   - What we know: Repair can fix frontmatter structure issues
   - What's unclear: Should repair also fix body content (e.g., missing sections)?
   - Recommendation: Repair frontmatter only. Body content is authored by workflows and has too many valid variations for automated repair.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `wf/bin/lib/state.cjs` -- existing parser and CRUD operations
- Codebase inspection: `wf/bin/lib/roadmap.cjs` -- existing verification content detection
- Codebase inspection: `wf/bin/lib/progress.cjs` -- file-existence-only progress calculation
- Codebase inspection: `wf/bin/wf-tools.cjs` -- router pattern established in Phase 1
- Codebase inspection: `wf/bin/lib/init.cjs` -- compound command pattern
- Live test: `parseFrontmatter` on actual STATE.md confirms nested YAML data loss
- Live test: All 38 existing tests pass (clean baseline)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` -- GSD pattern analysis (Pattern 3: State Mutation Safety)
- `.planning/research/FEATURES.md` -- CLI gap analysis identifying needed commands
- `.planning/research/PITFALLS.md` -- Pitfall 6: CLI feature parity gap

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, same patterns as Phase 1
- Architecture: HIGH -- extending existing modules with established patterns
- Pitfalls: HIGH -- verified the nested YAML bug with live testing, identified from codebase inspection
- Migration scope: HIGH -- grep audit identified all files referencing STATE.md

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable -- internal codebase, no external dependency drift)
