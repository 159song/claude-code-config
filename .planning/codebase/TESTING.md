# Testing Patterns

**Analysis Date:** 2026-04-13

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`)
- Version: Node.js v14+ (CommonJS support)
- Assertion library: `node:assert` / `node:assert/strict`

**Run Commands:**
```bash
node wf/bin/lib/utils.test.cjs              # Run single test file
node --test 'wf/bin/lib/**/*.test.cjs'      # Run all tests matching pattern
node --test wf/bin/lib/state.test.cjs       # Run tests from state module
```

**Test Framework Imports:**
```javascript
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { strictEqual, deepStrictEqual, ok } = require('node:assert/strict');
```

## Test File Organization

**Location:**
- Co-located with source: Test files in same directory as implementation
- Pattern: `module.cjs` + `module.test.cjs`
- Examples:
  - `wf/bin/lib/utils.cjs` → `wf/bin/lib/utils.test.cjs`
  - `wf/bin/lib/state.cjs` → `wf/bin/lib/state.test.cjs`
  - `wf/bin/lib/phase.cjs` → `wf/bin/lib/phase.test.cjs`
  - `hooks/wf-prompt-guard.js` → `hooks/wf-prompt-guard.test.cjs`

**Naming:**
- Test files: `.test.cjs` suffix (not `.spec.cjs` or `.test.js`)
- Test module exports: None (tests run via `require()` side effects)

**Structure:**
```
wf/bin/lib/
├── utils.cjs
├── utils.test.cjs
├── state.cjs
├── state.test.cjs
├── phase.cjs
├── phase.test.cjs
├── validate.cjs
├── validate.test.cjs
└── ...
```

## Test Structure

**Suite Organization (AAA Pattern):**

```javascript
const { test, describe } = require('node:test');
const assert = require('node:assert');

describe('Feature area name', () => {
  test('specific behavior under specific condition', () => {
    // Arrange: set up test fixtures
    const input = { key: 'value' };
    const expected = 'result';

    // Act: call function under test
    const result = functionUnderTest(input);

    // Assert: verify result
    assert.strictEqual(result, expected);
  });

  test('another behavior', () => {
    // Arrange
    const tmpFile = path.join(os.tmpdir(), `test-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, 'content', 'utf8');

    // Act
    const result = utils.readFile(tmpFile);

    // Assert + Cleanup
    assert.strictEqual(result, 'content');
    fs.unlinkSync(tmpFile);
  });
});
```

**Nested Describe Blocks:**
Used to group related tests and reduce duplication:

```javascript
describe('wf-prompt-guard negative lookahead', () => {
  test('content "act as a plan" does NOT trigger', () => {
    // test body
  });

  test('content "act as a hacker" DOES trigger', () => {
    // test body
  });
});

describe('wf-prompt-guard file whitelist severity', () => {
  test('.md file path produces reduced severity', () => {
    // test body
  });

  test('.js file path produces full severity', () => {
    // test body
  });
});
```

## Test Naming

Use descriptive names that explain the behavior under test:

```javascript
test('readFile returns string content for existing file', () => {});
test('readFile returns null for missing file', () => {});
test('readJson returns parsed object for valid JSON file', () => {});
test('readJson returns null for invalid JSON', () => {});
test('findProjectRoot from subdir of dir containing .planning/ returns parent', () => {});
test('parseFrontmatter extracts YAML from STATE.md format', () => {});
test('parseFrontmatter parses nested progress: with sub-keys', () => {});
test('stateGet with dotted key progress.total_phases returns 6 from nested STATE.md', () => {});
test('stateSet with dotted key progress.completed_phases updates only that sub-key', () => {});
test('statePatch preserves unmodified keys (progress sub-object intact after patching status)', () => {});
test('hook always exits with code 0 (advisory mode)', () => {});
```

**Pattern:** `<function> <does/returns/produces> <expected result> [when/given <condition>]`

## Mocking

**Framework:** No mocking library (e.g., Sinon, Jest mock) detected. Manual mocking patterns used.

**Patterns:**

### Stdout/Stderr Capture (from `state.test.cjs`):
```javascript
function captureOutput(fn) {
  const originalWriteSync = fs.writeSync;
  let captured = '';
  fs.writeSync = (fd, data) => {
    if (fd === 1) captured = data;  // Capture stdout (fd 1)
    else originalWriteSync(fd, data);
  };
  try {
    fn();
    return captured ? JSON.parse(captured) : null;
  } finally {
    fs.writeSync = originalWriteSync;
  }
}
```

### Process.exit Interception (from `state.test.cjs`):
```javascript
const originalExit = process.exit;
const originalWriteSync = fs.writeSync;
let exitCode = null;
let stderrOutput = '';

process.exit = (code) => { exitCode = code; throw new Error('EXIT'); };
fs.writeSync = (fd, data) => {
  if (fd === 2) stderrOutput += data;  // Capture stderr
  else if (fd !== 1) originalWriteSync(fd, data);
};

try {
  state.statePatch(tmpDir, []);
} catch (e) {
  if (e.message !== 'EXIT') throw e;
} finally {
  process.exit = originalExit;
  fs.writeSync = originalWriteSync;
}

assert.strictEqual(exitCode, 1);
assert.ok(stderrOutput.length > 0);
```

### Subprocess Execution (from `utils.test.cjs`):
```javascript
const { execFileSync } = require('child_process');
const script = `
  const utils = require(${JSON.stringify(path.resolve(__dirname, 'utils.cjs'))});
  utils.output({ test: 'value' });
`;
const tmpScript = path.join(os.tmpdir(), `wf-test-${Date.now()}.cjs`);
fs.writeFileSync(tmpScript, script, 'utf8');
const result = execFileSync('node', [tmpScript], { encoding: 'utf8' });
fs.unlinkSync(tmpScript);
const parsed = JSON.parse(result);
assert.deepStrictEqual(parsed, { test: 'value' });
```

**What to Mock:**
- File system operations: use `fs.mkdtempSync()` + temp files for real I/O
- External processes: use `execFileSync` for subprocess testing (hook scripts)
- Process methods: `process.exit`, `fs.writeSync` for capture
- Functions: manual reassignment (`const originalFn = module.fn; module.fn = newFn;`)

**What NOT to Mock:**
- Core filesystem operations: use real temp directories (`os.tmpdir()`)
- Core Node.js modules: `fs`, `path`, `os` — test with real I/O
- Module dependencies: test full integration with actual modules

## Fixtures and Factories

**Test Data:**

Markdown frontmatter fixtures for state testing:

```javascript
const SAMPLE_STATE_MD = `---
gsd_state_version: 1.0
milestone: v1.0
status: planning
stopped_at: Phase 1 context gathered
---

# Project State

## Current Position

- **Phase:** 1 of 6 (CLI Foundation)
- **Status:** Ready to plan
`;

const NESTED_STATE_MD = `---
gsd_state_version: 1.0
milestone: v1.0
status: planning
stopped_at: Phase 1 context gathered
last_updated: "2026-04-10T06:10:33.564Z"
last_activity: 2026-04-10
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# Project State
`;
```

JSON input fixtures for hook testing:

```javascript
function runHook(filePath, content) {
  const input = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: filePath, content }
  });

  try {
    const stdout = execFileSync('node', [HOOK_PATH], {
      input,
      encoding: 'utf8',
      timeout: 5000
    });
    return { exitCode: 0, stdout };
  } catch (err) {
    return { exitCode: err.status || 1, stdout: err.stdout || '' };
  }
}
```

**Factory Helper (from `state.test.cjs`):**
```javascript
function createTempState(content) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'STATE.md'), content);
  return { tmpDir, planningDir, statePath: path.join(planningDir, 'STATE.md') };
}
```

**Location:**
- Fixtures defined at module scope as constants: `SAMPLE_STATE_MD`, `NESTED_STATE_MD`
- Factories as helper functions: `createTempState()`, `captureOutput()`, `runHook()`
- Temporary files cleaned up in finally blocks: `fs.rmSync(tmpDir, { recursive: true, force: true });`

## Coverage

**Requirements:** No explicit coverage target specified in config; 80% recommended per global rules

**View Coverage:**
```bash
# No built-in coverage reporting in node:test; use c8 if needed:
npm install --save-dev c8
c8 node --test 'wf/bin/lib/**/*.test.cjs'
```

**Coverage Tooling:** Not currently configured; would require `c8` package

## Test Types

**Unit Tests:**
- Scope: Individual functions and utilities
- Approach: Test pure functions with fixture data
- Examples: `readFile()`, `readJson()`, `findProjectRoot()`, `parseYamlValue()`, `serializeFrontmatter()`
- Location: `wf/bin/lib/*.test.cjs`

**Integration Tests:**
- Scope: Filesystem operations, frontmatter parsing round-trips, state management workflows
- Approach: Create temp directories, write/read files, verify state transitions
- Examples: `stateSet()` updates frontmatter correctly, `statePatch()` preserves unmodified keys, `stateAdvancePlan()` recalculates progress
- Location: Within `state.test.cjs`, `utils.test.cjs`, `phase.test.cjs`

**E2E Tests (Hook Scripts):**
- Scope: Hook scripts (`wf-prompt-guard.js`, `wf-statusline.js`) run end-to-end
- Approach: Spawn subprocess with stdin input, capture stdout/exit code
- Examples: `wf-prompt-guard.test.cjs` tests hook detection and output format
- Framework: `execFileSync` for process spawning
- Location: `hooks/wf-prompt-guard.test.cjs`

## Common Patterns

**Async Testing:**
Not used; all code is synchronous. Filesystem operations are `*Sync` methods.

**Error Testing:**

```javascript
test('stateSet with dotted key on non-existent parent creates the parent object', () => {
  const { tmpDir, statePath } = createTempState(SAMPLE_STATE_MD);
  try {
    state.stateSet(tmpDir, 'metrics.total_time', '120');

    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = state.parseFrontmatter(content);
    assert.strictEqual(typeof frontmatter.metrics, 'object');
    assert.strictEqual(frontmatter.metrics.total_time, 120);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('statePatch with no args outputs error and exits', () => {
  const { tmpDir } = createTempState(NESTED_STATE_MD);
  const originalExit = process.exit;
  const originalWriteSync = fs.writeSync;
  let exitCode = null;
  let stderrOutput = '';

  process.exit = (code) => { exitCode = code; throw new Error('EXIT'); };
  fs.writeSync = (fd, data) => {
    if (fd === 2) stderrOutput += data;
    else if (fd !== 1) originalWriteSync(fd, data);
  };

  try {
    state.statePatch(tmpDir, []);
  } catch (e) {
    if (e.message !== 'EXIT') throw e;
  } finally {
    process.exit = originalExit;
    fs.writeSync = originalWriteSync;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  assert.strictEqual(exitCode, 1);
  assert.ok(stderrOutput.length > 0, 'Should output error message to stderr');
});
```

**Filesystem Isolation:**

```javascript
test('readFile returns string content for existing file', () => {
  // Arrange: Create isolated temp file
  const tmpFile = path.join(os.tmpdir(), `wf-test-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'hello world', 'utf8');

  // Act
  const result = utils.readFile(tmpFile);

  // Assert + Cleanup
  fs.unlinkSync(tmpFile);
  assert.strictEqual(result, 'hello world');
});
```

**Round-Trip Testing:**

```javascript
test('serializeFrontmatter round-trips nested frontmatter without data loss', () => {
  const { frontmatter, body } = state.parseFrontmatter(NESTED_STATE_MD);
  const serialized = state.serializeFrontmatter(frontmatter);
  const rebuilt = `---\n${serialized}\n---\n${body}`;
  const reparsed = state.parseFrontmatter(rebuilt);
  assert.deepStrictEqual(reparsed.frontmatter.progress, frontmatter.progress);
  assert.strictEqual(reparsed.frontmatter.status, frontmatter.status);
});
```

## Test Execution

**Running Tests:**

From project root:
```bash
# Run all tests in a directory
node --test 'wf/bin/lib/**/*.test.cjs'

# Run single test file
node wf/bin/lib/utils.test.cjs
node wf/bin/lib/state.test.cjs
node hooks/wf-prompt-guard.test.cjs

# Run with verbose output
node --test-reporter=tap wf/bin/lib/**/*.test.cjs
```

**CI Integration:**
- No CI/CD pipeline configuration found in codebase
- Tests would be run via `node --test` in CI environment

## State Management Tests

**Comprehensive Coverage in `state.test.cjs` (806 lines):**

Tests cover:
- YAML frontmatter parsing with flat and nested keys
- Value type coercion (integers, floats, booleans, null, quoted strings)
- Frontmatter serialization (quoting strings with special YAML chars)
- State getters/setters with dotted key notation: `stateGet()`, `stateSet()`
- State patch operations: `statePatch()` with flag arguments
- State merge operations: `stateMerge()` with JSON input, deep merging
- State validation: `stateValidate()` for required keys and format
- Phase transitions: `stateBeginPhase()`, `stateAdvancePlan()`
- Command dispatch: `run()` subcommand routing

Example comprehensive test:
```javascript
test('run dispatches advance-plan subcommand correctly', () => {
  const { tmpDir, statePath } = createTempState(ADVANCE_PLAN_FIXTURE);
  try {
    const result = captureOutput(() => {
      state.run(tmpDir, ['advance-plan', '--phase', '2', '--plan', '2']);
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.phase, 2);
    assert.strictEqual(result.plan, 2);
    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = state.parseFrontmatter(content);
    assert.strictEqual(frontmatter.progress.completed_plans, 2);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
```

---

*Testing analysis: 2026-04-13*
