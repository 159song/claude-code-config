# Coding Conventions

**Analysis Date:** 2026-04-13

## Naming Patterns

**Files:**
- Kebab-case with functional prefix: `wf-prompt-guard.js`, `wf-statusline.js`, `wf-context-monitor.js`, `wf-session-state.js`
- Markdown documents: kebab-case with lowercase: `verification-patterns.md`, `plan-phase.md`, `execute-phase.md`
- Test files: Append `.test.cjs` to module name: `utils.test.cjs`, `state.test.cjs`, `phase.test.cjs`
- Configuration files: lowercase: `config.json`, `settings.json`

**Functions:**
- camelCase for all function names: `readFile`, `writeFile`, `findProjectRoot`, `parseVal`, `detectStep`, `runHook`
- Descriptive names that indicate action or state: `ensurePlanningDir`, `parseFrontmatter`, `serializeFrontmatter`, `stateGet`, `stateSet`

**Variables:**
- camelCase for locals and parameters: `filePath`, `stdinTimeout`, `sessionId`, `bridgeData`, `usableRemaining`, `tmpDir`, `projectRoot`
- Descriptive compound names for clarity: `shouldProduceOutput`, `hasHandoff`, `isReducedSeverity`, `firstWarn`, `severityEscalated`

**Constants:**
- UPPER_SNAKE_CASE for module-level constants: `WARNING_THRESHOLD = 35`, `CRITICAL_THRESHOLD = 25`, `STALE_SECONDS = 60`, `DEBOUNCE_CALLS = 5`, `AUTO_COMPACT_BUFFER_PCT = 16.5`
- `INJECTION_PATTERNS`, `REDUCED_SEVERITY_EXTENSIONS` — constant array/object declarations
- Regular expression literals: `const PATTERN_NAME = /pattern/flags;` format example: `/^\d{4}-\d{2}-\d{2}$/`

**Types/Interfaces:**
- No explicit TypeScript used; JavaScript CommonJS modules only
- JSDoc comments used to document parameter and return types: `@param {string} filePath`, `@returns {object|null}`

## Code Style

**Formatting:**
- 2-space indentation (observed consistently in all `.js` and `.cjs` files)
- No explicit ESLint/Prettier configuration detected (follows Node.js standard conventions)
- Semicolons required at end of statements
- Single quotes for strings where used, double quotes in JSON

**Linting:**
- No linting configuration found (`.eslintrc*`, `eslint.config.*` absent)
- Code follows Node.js idiomatic conventions by inspection

**Entry Points:**
- All hook files use shebang: `#!/usr/bin/env node` on line 1
- Executable scripts (hooks): Entry code runs at module scope within process.stdin listeners
- Library modules: Use `module.exports = { ... }` to export public API
- Example: `module.exports = { readFile, readJson, writeFile, ensurePlanningDir, findProjectRoot, output, error };`

## Import Organization

**Module Loading:**
- CommonJS only: `const module = require('path/to/module.cjs');`
- Built-in Node.js modules first: `const fs = require('fs');`, `const path = require('path');`, `const os = require('os');`
- Local modules after: `const utils = require('./utils.cjs');`
- No path aliases detected; simple relative paths used: `require('./lib/utils.cjs')`

**Dependency Structure:**
- Leaf modules depend only on Node.js builtins (e.g., `utils.cjs`)
- Consumer modules depend on leaf modules (e.g., `state.cjs` depends on utilities, validates, filesystem)
- No circular dependencies observed

## Error Handling

**Defensive Patterns:**
- Try-catch wraps all I/O operations that may fail: `try { ... } catch (e) { }`
- Silent failures preferred for monitoring/hook scripts to prevent deadlock: `try { ... } catch (e) {}`
- No error propagation in hook contexts; fail safely and exit gracefully
- Exit code 0 on any error to prevent system interruption: `process.exit(0);`

**Input Validation:**
- Guard clauses at function start: `if (!sessionId) process.exit(0);`
- Path traversal prevention: `if (/[/\\]|\.\./.test(sessionId)) process.exit(0);`
- JSON parsing with try-catch: `try { const data = JSON.parse(input); } catch { ... }`
- Type checking before operations: `if (remaining != null)`, `if (fs.existsSync(path))`

**Error Messages:**
- Write to stderr using `fs.writeSync(2, message)`: `fs.writeSync(2, message + '\n');`
- Console output via structured JSON: `process.stdout.write(JSON.stringify(output));`
- ANSI color codes for UI feedback: `\x1b[32m` (green), `\x1b[33m` (yellow), `\x1b[0m` (reset)

**Example Error Handling (from `wf-context-monitor.js`):**
```javascript
try {
  const data = JSON.parse(input);
  const sessionId = data.session_id;
  if (!sessionId) process.exit(0);
  if (/[/\\]|\.\./.test(sessionId)) process.exit(0);
  // ... process data
} catch (e) {
  process.exit(0);
}
```

## Logging

**Framework:** Process stdout redirection for structured output; no logging library used

**Patterns:**
- Structured JSON output for hook communication: `process.stdout.write(JSON.stringify(output));`
- ANSI color codes for terminal visual feedback: `\x1b[32m` (green), `\x1b[33m` (yellow), `\x1b[38;5;208m` (orange), `\x1b[31m` (red)
- Unicode block characters for progress indicators: `█` (filled), `░` (empty)
- Human-readable prefixes for message clarity: `[Info]`, `[Stdout]`, `⚠️ PROMPT INJECTION 警告`

**When to Log:**
- Hook outputs: Use `process.stdout.write()` with JSON envelope for structured data
- Warnings: ANSI color red + bold + blink for CRITICAL: `\x1b[5;31m` (blinking red)
- Progress: Terminalbar with filled/empty blocks, percentage
- Errors: Write to stderr (fd 2) via `fs.writeSync(2, message)`
- Debug: No explicit debug logging; use defensive try-catch instead

**Example (from `wf-statusline.js`):**
```javascript
const output = {
  hookSpecificOutput: {
    hookEventName: 'StatusLine',
    additionalContext: message,
  },
};
process.stdout.write(JSON.stringify(output));
```

## Comments

**Inline Comments:**
- Explain non-obvious thresholds: `// 16.5% buffer for auto-compaction`
- Document magic numbers: `// Context 使用率显示`
- Clarify regex patterns or complex conditionals: `// Severity downgrade for documentation files`
- Avoid over-commenting obvious code

**Block Comments:**
- Function purpose at module scope: `// wf-prompt-guard.js — PreToolUse hook`
- Implementation notes: `// 防御性措施：在注入指令进入 agent context 之前发现它们。`

**JSDoc:**
- Parameter and return types documented: `@param {string} filePath - file absolute path`, `@returns {string|null}`
- Used in library modules (`utils.cjs`, `state.cjs`) not in hook scripts

**Frontmatter:**
- YAML frontmatter in Markdown for metadata: `---\nkey: value\n---`
- Nested YAML keys for structured data: `progress:\n  total_phases: 6\n  completed_phases: 1`
- ISO date format in frontmatter: `last_updated: "2026-04-10T06:10:33.564Z"`

## Function Design

**Size:** Typical 15-40 lines; complex logic extracted into separate helpers

**Parameters:**
- Maximum 3-5 parameters per function
- Use object destructuring for configuration: `const { session_id, remaining_percentage } = data;`
- Flag arguments parsed from command-line: `['--phase', '2', '--plan', '1']`

**Return Values:**
- Library functions return primitives or objects: `{ success: true, updated: ['status'] }`
- Hook scripts cause side effects (file writes) rather than returning values
- Output via `process.stdout.write()` or `fs.writeSync()` for structured data

**Example Function (from `utils.cjs`):**
```javascript
/**
 * Find project root by walking up from startDir to .planning/ directory
 * @param {string} startDir - starting directory
 * @returns {string} project root path
 */
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
    
    const parentPlanning = path.join(parent, '.planning');
    if (fs.existsSync(parentPlanning) && fs.statSync(parentPlanning).isDirectory()) {
      return parent;
    }
    dir = parent;
  }

  return resolved;
}
```

## Module Design

**Exports:**
- CommonJS `module.exports = { fn1, fn2, ... };` at module end
- Example: `module.exports = { readFile, readJson, writeFile, ensurePlanningDir, findProjectRoot, output, error };`

**Barrel Files:**
- No barrel files (index.js) used in this codebase

**Module Organization:**
- Leaf modules: `wf/bin/lib/utils.cjs` — no local dependencies, only Node.js builtins
- Consumer modules: `wf/bin/lib/state.cjs` — depends on utils, validates, performs state operations
- Hook scripts: Self-contained executables in `hooks/` — no exports, run via stdin listener

**File Organization:**
- Related functionality grouped in directories: `hooks/` for hook scripts, `wf/bin/lib/` for library modules
- Test files co-located with source: `utils.cjs` + `utils.test.cjs` in same directory
- Configuration and references in `wf/references/`, `wf/templates/`

## Key Patterns

**Stdin Listener Pattern (Hook Scripts):**
Used in all hook scripts: `wf-prompt-guard.js`, `wf-statusline.js`, `wf-context-monitor.js`, `wf-session-state.js`

```javascript
let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    // process data
    process.stdout.write(JSON.stringify(output));
  } catch (e) {
    process.exit(0);
  }
});
```

**Path Traversal Safety:**
```javascript
if (/[/\\]|\.\./.test(sessionId)) process.exit(0);
```

**Timeout Safety:**
```javascript
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
// ... process.stdin listeners ...
clearTimeout(stdinTimeout);
```

**Defensive File I/O:**
```javascript
try {
  const content = fs.readFileSync(filePath, 'utf8');
  return content;
} catch {
  return null;
}
```

---

*Convention analysis: 2026-04-13*
