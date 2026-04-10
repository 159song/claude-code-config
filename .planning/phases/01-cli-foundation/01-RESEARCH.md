# Phase 1: CLI Foundation - Research

**Researched:** 2026-04-10
**Domain:** Node.js CommonJS CLI modularization, path resolution, compound init patterns
**Confidence:** HIGH

## Summary

Phase 1 transforms `wf-tools.cjs` from a 324-line monolithic script into a modular `router + lib/` architecture, implements compound `init` commands that return all workflow context in a single JSON call, fixes hook path mismatches, replaces all `{{WF_ROOT}}` template placeholders with `$HOME/.claude/wf/` absolute paths, and adds `--cwd` + `findProjectRoot()` for subdirectory operation.

The current codebase has four critical bugs blocking all WF functionality: (1) hooks point to `.claude/hooks/` but files live at `hooks/` (all 4 hooks silently non-functional), (2) `{{WF_ROOT}}` is never resolved (all 9 commands broken), (3) `roadmapAnalyze()` regex expects `## Phase N:` but ROADMAP uses `### Phase N:` (progress returns 0 phases), (4) no `--cwd` or project root resolution (breaks in subdirectories and sub-agents).

**Primary recommendation:** Follow the GSD modular pattern (router + `lib/*.cjs` modules) using CommonJS with zero external dependencies. Use `$HOME/.claude/wf/` absolute paths in all command files. Implement `findProjectRoot()` traversing upward for `.planning/`. Use Node.js built-in `node:test` for module testing.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Split into `wf/bin/lib/` modules: utils.cjs, state.cjs, roadmap.cjs, phase.cjs, progress.cjs, git.cjs, init.cjs, config.cjs (at least 8)
- **D-02:** wf-tools.cjs main file becomes pure router (~40 lines), only command dispatch
- **D-03:** Each module exports functions via `module.exports`, reusable by hooks via `require()`
- **D-04:** Replace `{{WF_ROOT}}` with `$HOME/.claude/wf/` absolute path (matches GSD's `$HOME/.claude/get-shit-done/` pattern)
- **D-05:** WF install location fixed at `$HOME/.claude/wf/`, no custom install path support
- **D-06:** All 9 command files' `execution_context` and `process` sections: `@{{WF_ROOT}}/...` becomes `@$HOME/.claude/wf/...`
- **D-07:** init supports sub-modes: `init phase-op N`, `init new-project`, `init quick`, etc. with common base + mode-specific fields
- **D-08:** phase-op mode returns GSD-compatible fields: phase_found, phase_dir, phase_name, phase_slug, padded_phase, has_context, has_research, has_plans, plan_count, has_verification, roadmap_exists, planning_exists, project_root, commit_docs
- **D-09:** Include `response_language` field from config
- **D-10:** Implement `findProjectRoot()`: traverse up from cwd, find first parent with `.planning/`
- **D-11:** Fallback to cwd when `.planning/` not found (new project friendly)
- **D-12:** Support `--cwd <path>` flag with higher priority than auto-detection

### Claude's Discretion
- Internal API signatures for each module
- Error handling strategy (which silent, which throw)
- init sub-mode field extensions beyond base fields
- findProjectRoot max traversal depth limit

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Hook paths match settings.json, all 4 hooks trigger | Hook path audit (Section: Hook Path Consistency); current mismatch analysis; fix strategy documented |
| INFRA-02 | `{{WF_ROOT}}` replaced with real paths in command files | WF_ROOT replacement analysis (Section: Path Resolution); 31 occurrences across 9 files mapped |
| INFRA-03 | --cwd + findProjectRoot for subdirectory operation | findProjectRoot pattern from GSD (Section: Architecture Patterns); traversal algorithm documented |
| INFRA-04 | Router + lib/ modular architecture (8+ modules) | Module decomposition analysis (Section: Architecture Patterns); function migration map from current wf-tools.cjs |
| INFRA-05 | Compound init returning full context JSON | Init sub-mode design (Section: Architecture Patterns); GSD init output fields reference |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | v24.5.0 (available on machine) | Runtime | Already installed; project requires v14+ [VERIFIED: `node --version`] |
| fs (built-in) | N/A | File I/O | Zero-dependency constraint from CLAUDE.md [VERIFIED: codebase audit] |
| path (built-in) | N/A | Path manipulation | Cross-platform path joining [VERIFIED: codebase audit] |
| os (built-in) | N/A | Home directory, tmpdir | For `$HOME` resolution [VERIFIED: codebase audit] |
| child_process (built-in) | N/A | Git operations | For `execFileSync` git commands [VERIFIED: codebase audit] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:test (built-in) | v24.5.0 | Unit testing | Module-level tests without external deps [VERIFIED: `node -e "require('node:test')"`] |
| node:assert (built-in) | v24.5.0 | Test assertions | Paired with node:test [VERIFIED: `node -e "require('node:assert')"`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node:test | jest/vitest | Would add external dependency, violates project constraint |
| Manual module pattern | npm workspaces | Over-engineering for 8-10 modules in a single package |

**Installation:**
```bash
# No installation needed -- all dependencies are Node.js built-ins
```

**Version verification:** Node.js v24.5.0 confirmed on machine [VERIFIED: `node --version`]. `node:test` stable since Node.js v20 [ASSUMED].

## Project Constraints (from CLAUDE.md)

- **Language:** hooks/CLI must be JavaScript/Node.js, docs in Chinese
- **Module system:** CommonJS (`{"type":"commonjs"}` in package.json)
- **Dependencies:** Node.js standard library modules only
- **Naming:** `wf-` prefix convention; kebab-case files, camelCase functions
- **Style:** 2-space indentation, semicolons, `#!/usr/bin/env node` shebang
- **Error handling:** Silent failures for hooks (exit 0), explicit errors for CLI
- **Output:** JSON via `process.stdout.write(JSON.stringify(...))`
- **Git:** Conventional Commits format, one task = one atomic commit
- **Architecture:** Preserve layered architecture, no breaking refactors

## Architecture Patterns

### Recommended Project Structure

```
wf/bin/
  wf-tools.cjs          # Router (~40 lines): parse args, dispatch to lib/
  lib/
    utils.cjs            # readFile, readJson, writeFile, ensurePlanningDir, findProjectRoot
    state.cjs            # parseStateMd, stateGet, stateSet, stateJson
    roadmap.cjs          # roadmapAnalyze (fixed regex), roadmapGetPhase
    phase.cjs            # phaseInfo, findPhaseDir, getPhaseFileStats
    progress.cjs         # calculateProgress
    git.cjs              # gitCommitPlanning (with --files support)
    init.cjs             # init sub-modes: phase-op, new-project, execute-phase, plan-phase, quick
    config.cjs           # loadConfig, CONFIG_DEFAULTS, mergeConfig
```

### Pattern 1: Router + Module Dispatch

**What:** The main entry point (`wf-tools.cjs`) becomes a thin router that parses CLI arguments and delegates to the appropriate module function.
**When to use:** Always -- this is the locked decision (D-02).
**Example:**

```javascript
// Source: GSD gsd-tools.cjs pattern [VERIFIED: ~/.claude/get-shit-done/bin/gsd-tools.cjs lines 159-298]
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const core = require('./lib/utils.cjs');
const state = require('./lib/state.cjs');
const roadmap = require('./lib/roadmap.cjs');
const phase = require('./lib/phase.cjs');
const progress = require('./lib/progress.cjs');
const git = require('./lib/git.cjs');
const init = require('./lib/init.cjs');
const config = require('./lib/config.cjs');

// --cwd resolution
let cwd = process.cwd();
const args = process.argv.slice(2);
const cwdIdx = args.indexOf('--cwd');
if (cwdIdx !== -1 && args[cwdIdx + 1]) {
  cwd = path.resolve(args[cwdIdx + 1]);
  args.splice(cwdIdx, 2);
} else {
  cwd = core.findProjectRoot(cwd);
}

const command = args[0];
switch (command) {
  case 'init':    init.run(cwd, args.slice(1)); break;
  case 'state':   state.run(cwd, args.slice(1)); break;
  case 'roadmap': roadmap.run(cwd, args.slice(1)); break;
  case 'phase':   phase.run(cwd, args.slice(1)); break;
  case 'progress': progress.run(cwd); break;
  case 'commit':  git.run(cwd, args.slice(1)); break;
  default:
    process.stderr.write('WF Tools v1.0.0\n...');
    process.exit(1);
}
```

### Pattern 2: findProjectRoot Traversal

**What:** Walk up from cwd to find the first ancestor directory containing `.planning/`. Used by router before any file operations.
**When to use:** On every CLI invocation when `--cwd` is not explicitly provided.
**Example:**

```javascript
// Source: GSD core.cjs findProjectRoot [VERIFIED: ~/.claude/get-shit-done/bin/lib/core.cjs lines 76-140]
function findProjectRoot(startDir) {
  const resolved = path.resolve(startDir);
  const root = path.parse(resolved).root;
  const homedir = require('os').homedir();

  // If startDir already has .planning/, it IS the project root
  if (fs.existsSync(path.join(resolved, '.planning'))) {
    return resolved;
  }

  let dir = resolved;
  while (dir !== root) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    if (parent === homedir) break; // never go above $HOME

    const parentPlanning = path.join(parent, '.planning');
    if (fs.existsSync(parentPlanning) && fs.statSync(parentPlanning).isDirectory()) {
      return parent;
    }
    dir = parent;
  }

  // Fallback: return original dir (new project friendly, per D-11)
  return resolved;
}
```

### Pattern 3: Compound Init Output

**What:** A single CLI call returns all context a workflow needs as structured JSON. Eliminates multiple file reads from workflow scripts.
**When to use:** Every workflow entry point calls `init <sub-mode>` first.
**Example:**

```javascript
// Source: GSD init.cjs cmdInitExecutePhase pattern [VERIFIED: ~/.claude/get-shit-done/bin/lib/init.cjs lines 50-171]
function initPhaseOp(cwd, phaseNum) {
  const config = loadConfig(cwd);
  const phaseInfo = findPhaseDir(cwd, phaseNum);
  const planningDir = path.join(cwd, '.planning');

  const result = {
    // Config flags
    commit_docs: config.planning?.commit_docs ?? true,
    response_language: config.response_language || null,

    // Phase info
    phase_found: !!phaseInfo,
    phase_dir: phaseInfo?.directory || null,
    phase_number: phaseInfo?.phase_number || null,
    phase_name: phaseInfo?.phase_name || null,
    phase_slug: phaseInfo?.phase_slug || null,
    padded_phase: phaseInfo ? String(phaseInfo.phase_number).padStart(2, '0') : null,

    // File existence
    has_context: phaseInfo?.has_context || false,
    has_research: phaseInfo?.has_research || false,
    has_plans: (phaseInfo?.plans?.length || 0) > 0,
    plan_count: phaseInfo?.plans?.length || 0,
    has_verification: phaseInfo?.has_verification || false,

    // Global existence
    roadmap_exists: fs.existsSync(path.join(planningDir, 'ROADMAP.md')),
    planning_exists: fs.existsSync(planningDir),
    project_root: cwd,
  };

  process.stdout.write(JSON.stringify(result, null, 2));
}
```

### Pattern 4: JSON Output with Large Payload Handling

**What:** When JSON output exceeds ~50KB, write to a temp file and return `@file:/path` prefix so callers can detect and read it.
**When to use:** Any command that might return large structured data.
**Example:**

```javascript
// Source: GSD core.cjs output() [VERIFIED: ~/.claude/get-shit-done/bin/lib/core.cjs lines 178-199]
function output(result) {
  const json = JSON.stringify(result, null, 2);
  if (json.length > 50000) {
    const tmpPath = path.join(require('os').tmpdir(), `wf-${Date.now()}.json`);
    fs.writeFileSync(tmpPath, json, 'utf-8');
    fs.writeSync(1, '@file:' + tmpPath);
  } else {
    // fs.writeSync(1, ...) blocks until kernel accepts bytes
    // Prevents data loss from async process.stdout.write + process.exit race
    fs.writeSync(1, json);
  }
}
```

### Anti-Patterns to Avoid

- **Relative PLANNING_DIR constant:** Current code uses `const PLANNING_DIR = '.planning'` which breaks in subdirectories. Always resolve to absolute path using `findProjectRoot()` first. [VERIFIED: wf-tools.cjs line 21]
- **process.stdout.write + process.exit race:** Using `process.stdout.write()` followed by `process.exit()` can lose output when stdout is piped. Use `fs.writeSync(1, data)` instead for blocking writes. [VERIFIED: GSD core.cjs lines 196-199]
- **Hardcoded Chinese section headers in regex:** Current `stateSet()` uses `## 当前状态` literal which breaks if template changes. Use a generic section finder or frontmatter. [VERIFIED: wf-tools.cjs lines 99-101]
- **File existence = status:** Current `roadmapAnalyze()` treats "VERIFICATION.md exists" as "verified". Must read content for actual PASS/FAIL status. [VERIFIED: wf-tools.cjs lines 138-143]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex parser | Simple `---\n...\n---` boundary detection + line-by-line key:value extraction | STATE.md uses YAML frontmatter already; regex gets tricky with multiline values |
| CLI argument parsing | Complex flag parser | Simple `indexOf('--flag')` + splice pattern (GSD style) | Only 2-3 flags needed (--cwd, --pick, --raw); full arg parsing is over-engineering |
| Path traversal security | Custom sanitizer | `path.resolve()` + check result starts with expected prefix | Path traversal in session IDs already checked in hooks; apply same pattern to --cwd |
| JSON output buffering | Custom stream handler | `fs.writeSync(1, data)` for blocking stdout writes | Avoids process.stdout.write + process.exit race condition |

**Key insight:** This phase extends an existing 324-line tool, not building from scratch. Reuse all existing utility functions (readFile, readJson, writeFile, ensurePlanningDir) by moving them to `lib/utils.cjs` -- do not rewrite them.

## Common Pitfalls

### Pitfall 1: Hook Path Mismatch (CRITICAL - Currently Broken)

**What goes wrong:** `settings.json` references `.claude/hooks/wf-*.js` but hook files are at `hooks/wf-*.js`. All 4 hooks are silently non-functional.
**Why it happens:** The repo was designed for installation into `~/.claude/` but no install step copies hooks there. The settings.json uses relative `.claude/hooks/` paths that don't resolve when the config repo itself is the `.claude/` source.
**How to avoid:** Update settings.json to use absolute paths like GSD does: `node "$HOME/.claude/hooks/wf-context-monitor.js"`. Alternatively, move hook files into a `.claude/hooks/` directory within the repo.
**Warning signs:** No statusline appears; no context warnings fire when context is > 65% used.
[VERIFIED: settings.json lines 8,15,23,39 vs `ls hooks/` -- path mismatch confirmed]

### Pitfall 2: Roadmap Regex Mismatch (Currently Broken)

**What goes wrong:** `roadmapAnalyze()` uses regex `^##\s+Phase\s+(\d+):` but the actual ROADMAP.md uses `### Phase N:` (H3 headers, not H2).
**Why it happens:** The roadmap template was likely designed for H2 headers, but the actual roadmap was generated with H3 under a `## Phase Details` parent section.
**How to avoid:** Update regex to match `###\s+Phase\s+(\d+):` or make it flexible: `^#{2,3}\s+Phase\s+(\d+):`.
**Warning signs:** `node wf-tools.cjs roadmap analyze` returns `{"total_phases": 0, "phases": []}` despite 6 phases existing.
[VERIFIED: wf-tools.cjs line 123 regex vs ROADMAP.md line 24 actual format]

### Pitfall 3: Phase Directory Naming Convention Conflict

**What goes wrong:** WF code constructs phase dirs as `phase-${num}` (e.g., `phase-1`) but GSD (which manages this project's `.planning/`) uses `phases/01-cli-foundation/` pattern.
**Why it happens:** WF was designed with its own convention before being managed by GSD tooling.
**How to avoid:** The new `findPhaseDir()` function must support BOTH conventions: (a) `phases/NN-slug/` (GSD-style, used when WF is developed by GSD) and (b) `phase-N/` (WF's own convention, used when WF manages other projects). Implement a directory scanner that matches by phase number regardless of naming pattern.
**Warning signs:** `phase info 1` returns `{"exists": false}` even though `.planning/phases/01-cli-foundation/` exists.
[VERIFIED: wf-tools.cjs line 160 constructs `phase-1` but actual dir is `phases/01-cli-foundation/`]

### Pitfall 4: `$HOME` in Markdown Not Expanded by Claude Code

**What goes wrong:** Writing literal `$HOME` in command markdown files' `@$HOME/.claude/wf/...` references. Claude Code's `@` file reference mechanism needs actual resolvable paths, but `$HOME` is a shell variable that may not be expanded in the markdown parsing context.
**Why it happens:** The decision (D-04) says "use `$HOME/.claude/wf/`" but Claude Code command files are parsed as markdown, not as shell scripts.
**How to avoid:** Verify how Claude Code resolves `@` references in command files. If `$HOME` is not expanded, use the expanded absolute path `/Users/zxs/.claude/wf/...` or a relative path that Claude Code can resolve. GSD's settings.json uses full absolute paths. The implementation should test which format Claude Code actually resolves.
**Warning signs:** Commands reference files that Claude cannot load; Claude asks "what should I do?" instead of following the workflow.
[ASSUMED -- needs verification of how Claude Code parses `@` references with environment variables]

### Pitfall 5: Module Circular Dependencies

**What goes wrong:** When splitting a monolith into modules, it's easy to create circular `require()` chains (e.g., `init.cjs` requires `config.cjs` which requires `utils.cjs` which requires `config.cjs`).
**Why it happens:** Shared utilities are needed across modules, and the dependency graph isn't planned upfront.
**How to avoid:** Establish a strict dependency hierarchy: `utils.cjs` has NO local requires; `config.cjs` requires only `utils.cjs`; `state.cjs`, `roadmap.cjs`, `phase.cjs` require `utils.cjs` and optionally `config.cjs`; `init.cjs` requires all others but nothing requires `init.cjs`. The router requires `init.cjs` and all other modules.
**Warning signs:** Node.js returns `{}` for a `require()` that hits a circular dependency.
[ASSUMED -- standard Node.js CommonJS behavior]

### Pitfall 6: STATE.md Format Incompatibility

**What goes wrong:** The current `parseStateMd()` uses regex `^-\s+\*\*(.+?):\*\*\s+(.+)$` to extract key-value pairs from markdown bullet lists. But the actual STATE.md uses YAML frontmatter (lines 1-15) for machine-readable data and markdown body for human-readable display.
**Why it happens:** `parseStateMd()` was written before YAML frontmatter was adopted for STATE.md.
**How to avoid:** The new `state.cjs` module must parse YAML frontmatter as the primary data source, falling back to bullet-list parsing for legacy compatibility. Frontmatter delimiter is `---\n...\n---`.
**Warning signs:** `state json` returns `{}` when STATE.md has rich frontmatter data.
[VERIFIED: STATE.md lines 1-15 use YAML frontmatter; wf-tools.cjs parseStateMd() only parses bullet lists]

## Code Examples

### Module Export Pattern

```javascript
// Source: Project conventions [VERIFIED: .planning/codebase/CONVENTIONS.md]
// lib/utils.cjs
const fs = require('fs');
const path = require('path');
const os = require('os');

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function readJson(filePath) {
  const content = readFile(filePath);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function findProjectRoot(startDir) {
  const resolved = path.resolve(startDir);
  const root = path.parse(resolved).root;
  const homedir = os.homedir();

  if (fs.existsSync(path.join(resolved, '.planning'))) {
    return resolved;
  }

  let dir = resolved;
  while (dir !== root) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    if (parent === homedir) break;

    if (fs.existsSync(path.join(parent, '.planning'))) {
      return parent;
    }
    dir = parent;
  }

  return resolved;
}

module.exports = { readFile, readJson, findProjectRoot, /* ... */ };
```

### YAML Frontmatter Parsing

```javascript
// Source: Pattern needed for STATE.md frontmatter [VERIFIED: STATE.md format]
// lib/state.cjs
function parseFrontmatter(content) {
  if (!content || !content.startsWith('---\n')) return { frontmatter: {}, body: content };

  const endIdx = content.indexOf('\n---\n', 4);
  if (endIdx === -1) return { frontmatter: {}, body: content };

  const yamlBlock = content.slice(4, endIdx);
  const frontmatter = {};

  for (const line of yamlBlock.split('\n')) {
    // Simple key: value parsing (no nested objects for now)
    const match = line.match(/^(\w[\w_]*):\s*(.*)$/);
    if (match) {
      let value = match[2].trim();
      // Handle quoted strings
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Handle numbers
      else if (/^\d+$/.test(value)) value = parseInt(value, 10);
      // Handle booleans
      else if (value === 'true') value = true;
      else if (value === 'false') value = false;

      frontmatter[match[1]] = value;
    }
  }

  const body = content.slice(endIdx + 5);
  return { frontmatter, body };
}
```

### Hook Path Fix in settings.json

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$HOME/.claude/hooks/wf-session-state.sh\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash|Edit|Write|MultiEdit|Agent|Task",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/.claude/hooks/wf-context-monitor.js\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### WF_ROOT Replacement in Command Files

```markdown
<!-- BEFORE (broken) -->
<execution_context>
@{{WF_ROOT}}/wf/workflows/do.md
@{{WF_ROOT}}/wf/references/ui-brand.md
</execution_context>

<!-- AFTER (with $HOME expansion) -->
<execution_context>
@$HOME/.claude/wf/workflows/do.md
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>
```

**Note:** Verify that Claude Code's `@` file reference mechanism expands `$HOME`. If it does not, the absolute expanded path must be used instead (e.g., `@/Users/zxs/.claude/wf/workflows/do.md`). See Pitfall 4 and Open Question 1.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-file CLI tool | Modular lib/ pattern | GSD established this; WF adopting | Testable modules, easier maintenance |
| Relative `.planning` path | findProjectRoot() + absolute paths | GSD established; WF still using old | Critical for sub-agent and subdirectory operation |
| `process.stdout.write()` for output | `fs.writeSync(1, data)` for blocking writes | GSD discovered race condition | Prevents output loss when stdout is piped |
| `## Phase N:` regex | Flexible `#{2,3}\s+Phase` regex | N/A -- WF-specific fix | Current regex returns 0 phases from valid ROADMAP |

**Deprecated/outdated:**
- `parseStateMd()` bullet-list parser: STATE.md now uses YAML frontmatter as primary data format. The bullet parser should become a fallback only.
- `phase-N/` directory naming: When WF manages projects, this is fine. But when operating in a GSD-managed project, phase dirs follow `phases/NN-slug/` pattern. Support both.

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `node:test` has been stable since Node.js v20 | Standard Stack | LOW -- even if API changed slightly, v24 clearly supports it |
| A2 | Claude Code's `@` file reference expands `$HOME` environment variable | Pitfall 4 | HIGH -- if not expanded, all 9 command files remain broken even after fix. Must verify before implementation. |
| A3 | Node.js returns `{}` for circular `require()` dependencies | Pitfall 5 | LOW -- well-known CommonJS behavior, easy to verify |

## Open Questions

1. **Does Claude Code expand `$HOME` in `@` file references within command markdown?**
   - What we know: GSD's settings.json uses full absolute paths for hooks (`/Users/zxs/.claude/hooks/...`). Decision D-04 specifies `$HOME/.claude/wf/` pattern.
   - What's unclear: Whether Claude Code's markdown `@file` reference parser performs shell expansion on `$HOME`.
   - Recommendation: During implementation, test with a single command file first. If `$HOME` doesn't expand, use the full absolute path. Consider adding a one-time "resolve paths" init step that writes expanded paths.

2. **Should the module also support GSD's `phases/NN-slug/` directory naming or only WF's `phase-N/` naming?**
   - What we know: This project uses GSD's naming (`phases/01-cli-foundation/`). WF's own code expects `phase-N/`. Other projects managed by WF would use WF's convention.
   - What's unclear: Whether WF should permanently support both or just its own convention.
   - Recommendation: Support both via a directory scanner (check `phases/` then `phase-N/`). This is cheap to implement and prevents confusion.

3. **What is the correct phaseInfo file-matching pattern for the new naming?**
   - What we know: WF currently checks for `CONTEXT.md`, `PLAN*`, `SUMMARY*`, `VERIFICATION.md`. GSD uses padded prefix: `01-CONTEXT.md`, `01-PLAN.md`, `01-RESEARCH.md`.
   - What's unclear: Whether WF should adopt the padded prefix convention or keep bare filenames.
   - Recommendation: Support both patterns in file detection. Match files containing `CONTEXT`, `PLAN`, `SUMMARY`, `VERIFICATION`, `RESEARCH` regardless of prefix.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert` (v24.5.0) |
| Config file | None needed -- built-in runner uses no config |
| Quick run command | `node --test wf/bin/lib/*.test.cjs` |
| Full suite command | `node --test wf/bin/lib/*.test.cjs` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Hook paths in settings.json match actual files | smoke | `node --test wf/bin/lib/utils.test.cjs` (path validation test) | Wave 0 |
| INFRA-02 | No `{{WF_ROOT}}` in any command file | smoke | `node --test wf/bin/lib/utils.test.cjs` (grep test) | Wave 0 |
| INFRA-03 | findProjectRoot resolves from subdirectory | unit | `node --test wf/bin/lib/utils.test.cjs` | Wave 0 |
| INFRA-03 | --cwd flag overrides auto-detection | unit | `node --test wf/bin/lib/utils.test.cjs` | Wave 0 |
| INFRA-04 | Router dispatches to all module commands | unit | `node --test wf/bin/lib/init.test.cjs` | Wave 0 |
| INFRA-04 | Each module exports expected functions | unit | `node --test wf/bin/lib/*.test.cjs` | Wave 0 |
| INFRA-05 | init phase-op returns all required fields | unit | `node --test wf/bin/lib/init.test.cjs` | Wave 0 |
| INFRA-05 | init new-project returns expected structure | unit | `node --test wf/bin/lib/init.test.cjs` | Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test wf/bin/lib/*.test.cjs`
- **Per wave merge:** `node --test wf/bin/lib/*.test.cjs`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `wf/bin/lib/utils.test.cjs` -- covers INFRA-01, INFRA-02, INFRA-03 (findProjectRoot, path validation)
- [ ] `wf/bin/lib/init.test.cjs` -- covers INFRA-04 module exports, INFRA-05 init output structure
- [ ] `wf/bin/lib/state.test.cjs` -- covers frontmatter parsing, stateGet/stateSet
- [ ] `wf/bin/lib/roadmap.test.cjs` -- covers fixed regex, phase detection
- [ ] No framework install needed -- `node:test` is built-in

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A -- local CLI tool |
| V3 Session Management | No | N/A -- stateless CLI |
| V4 Access Control | No | N/A -- runs as local user |
| V5 Input Validation | Yes | Validate --cwd path, session IDs, phase numbers |
| V6 Cryptography | No | N/A -- no secrets handling |

### Known Threat Patterns for Node.js CLI

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via --cwd | Tampering | `path.resolve()` + verify directory exists + never traverse above `$HOME` |
| Session ID path injection | Tampering | Reject session IDs containing `/`, `\`, `..` (already implemented in hooks) |
| Arbitrary file read via phase number | Information Disclosure | Validate phase number is numeric; use `path.join()` not string concatenation |
| Large JSON output DoS | Denial of Service | Temp file fallback for >50KB output (GSD pattern) |

## Sources

### Primary (HIGH confidence)
- `wf/bin/wf-tools.cjs` -- Full source audit of 324-line current implementation
- `~/.claude/get-shit-done/bin/gsd-tools.cjs` + `lib/` -- Reference modular architecture (21 modules, 1047-line router)
- `~/.claude/get-shit-done/bin/lib/core.cjs` -- findProjectRoot, output, findPhaseInternal patterns
- `~/.claude/get-shit-done/bin/lib/init.cjs` -- Compound init output field patterns
- `settings.json` -- Hook path bindings (verified mismatch with actual file locations)
- `commands/wf/*.md` -- All 9 command files audited for `{{WF_ROOT}}` occurrences
- `hooks/wf-*.js` + `wf-session-state.sh` -- All 4 hook files audited
- `.planning/ROADMAP.md` -- Actual H3 format verified vs H2 regex expectation
- `.planning/STATE.md` -- YAML frontmatter format confirmed
- `.planning/research/PITFALLS.md` -- Pre-existing pitfall analysis (18 pitfalls documented)
- `.planning/codebase/STRUCTURE.md` -- Directory layout reference
- `.planning/codebase/CONVENTIONS.md` -- Code style and module design conventions

### Secondary (MEDIUM confidence)
- Node.js v24.5.0 `node:test` availability -- verified by `node -e "require('node:test')"`
- GSD hook path convention -- verified by `~/.claude/settings.json` showing absolute paths

### Tertiary (LOW confidence)
- Claude Code `@` file reference `$HOME` expansion behavior -- not verified, flagged in Open Questions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero external dependencies, all Node.js built-ins verified
- Architecture: HIGH -- GSD reference implementation thoroughly audited, all patterns verified in source
- Pitfalls: HIGH -- all critical pitfalls verified against actual source code with line numbers
- Path resolution: MEDIUM -- `$HOME` expansion in Claude Code `@` references needs runtime verification

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable domain -- Node.js CommonJS, file I/O, no fast-moving dependencies)

## Appendix: Function Migration Map

Current `wf-tools.cjs` functions and their target modules:

| Current Function | Lines | Target Module | Changes Needed |
|-----------------|-------|---------------|----------------|
| `readFile()` | 25-31 | lib/utils.cjs | No changes |
| `readJson()` | 33-41 | lib/utils.cjs | No changes |
| `writeFile()` | 43-49 | lib/utils.cjs | No changes |
| `ensurePlanningDir()` | 51-55 | lib/utils.cjs | Accept cwd parameter |
| `parseStateMd()` | 59-75 | lib/state.cjs | Add frontmatter parsing as primary source |
| `stateGet()` | 77-83 | lib/state.cjs | Use frontmatter parser |
| `stateSet()` | 85-106 | lib/state.cjs | Remove hardcoded Chinese header regex |
| `stateJson()` | 108-111 | lib/state.cjs | Return frontmatter data as primary |
| `roadmapAnalyze()` | 115-155 | lib/roadmap.cjs | Fix H3 regex; read VERIFICATION.md content for status |
| `phaseInfo()` | 159-195 | lib/phase.cjs | Support both dir naming conventions; fix regex |
| `calculateProgress()` | 199-233 | lib/progress.cjs | Fix H3 regex; use findPhaseDir() |
| `gitCommitPlanning()` | 237-246 | lib/git.cjs | Add --files parameter support |
| `init()` | 250-278 | lib/init.cjs | Expand to sub-modes with full context output |
| (new) | -- | lib/config.cjs | loadConfig, CONFIG_DEFAULTS, validate |
| (new) | -- | lib/utils.cjs | findProjectRoot, output, error |

## Appendix: WF_ROOT Replacement Inventory

All 9 command files requiring `{{WF_ROOT}}` replacement:

| File | Occurrences | References |
|------|-------------|------------|
| `commands/wf/do.md` | 3 | workflows/do.md, references/ui-brand.md |
| `commands/wf/new-project.md` | 5 | workflows/new-project.md, references/ui-brand.md, templates/project.md, templates/requirements.md |
| `commands/wf/discuss-phase.md` | 3 | workflows/discuss-phase.md, references/ui-brand.md |
| `commands/wf/plan-phase.md` | 4 | workflows/plan-phase.md, references/ui-brand.md, references/gates.md |
| `commands/wf/execute-phase.md` | 4 | workflows/execute-phase.md, references/ui-brand.md, references/verification-patterns.md |
| `commands/wf/verify-work.md` | 3 | workflows/verify-work.md, references/ui-brand.md |
| `commands/wf/autonomous.md` | 3 | workflows/autonomous.md, references/ui-brand.md |
| `commands/wf/quick.md` | 3 | workflows/quick.md, references/ui-brand.md |
| `commands/wf/progress.md` | 3 | workflows/progress.md, references/ui-brand.md |
| **Total** | **31** | -- |
