'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const state = require('./state.cjs');
const { parseFrontmatter, serializeFrontmatter, parseYamlValue } = require('./frontmatter.cjs');

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

// === Existing tests (preserved) ===

test('parseFrontmatter extracts YAML from STATE.md format', () => {
  const result = parseFrontmatter(SAMPLE_STATE_MD);
  assert.ok(result.frontmatter, 'Should have frontmatter object');
  assert.strictEqual(result.frontmatter.gsd_state_version, 1.0);
  assert.strictEqual(result.frontmatter.milestone, 'v1.0');
  assert.strictEqual(result.frontmatter.status, 'planning');
  assert.ok(result.body, 'Should have body content');
  assert.ok(result.body.includes('# Project State'), 'Body should contain markdown content');
});

test('parseFrontmatter returns empty frontmatter for content without ---', () => {
  const result = parseFrontmatter('# No frontmatter here\n\nJust body');
  assert.deepStrictEqual(result.frontmatter, {});
});

test('state module exports run function', () => {
  assert.strictEqual(typeof state.run, 'function');
});

test('frontmatter module exports parseFrontmatter function', () => {
  assert.strictEqual(typeof parseFrontmatter, 'function');
});

// === Task 1: Nested YAML parsing tests ===

test('parseFrontmatter parses nested progress: with sub-keys', () => {
  const result = parseFrontmatter(NESTED_STATE_MD);
  assert.ok(result.frontmatter.progress, 'progress should not be null');
  assert.strictEqual(typeof result.frontmatter.progress, 'object');
  assert.strictEqual(result.frontmatter.progress.total_phases, 6);
  assert.strictEqual(result.frontmatter.progress.completed_phases, 1);
  assert.strictEqual(result.frontmatter.progress.total_plans, 3);
  assert.strictEqual(result.frontmatter.progress.completed_plans, 3);
  assert.strictEqual(result.frontmatter.progress.percent, 100);
});

test('parseFrontmatter handles mixed flat + nested keys in same frontmatter', () => {
  const result = parseFrontmatter(NESTED_STATE_MD);
  // Flat keys
  assert.strictEqual(result.frontmatter.gsd_state_version, 1.0);
  assert.strictEqual(result.frontmatter.milestone, 'v1.0');
  assert.strictEqual(result.frontmatter.status, 'planning');
  // Nested key
  assert.strictEqual(result.frontmatter.progress.total_phases, 6);
});

test('parseFrontmatter treats empty-value key followed by indented lines as nested object', () => {
  const content = `---
parent:
  child1: hello
  child2: 42
---

body
`;
  const result = parseFrontmatter(content);
  assert.strictEqual(typeof result.frontmatter.parent, 'object');
  assert.notStrictEqual(result.frontmatter.parent, null);
  assert.strictEqual(result.frontmatter.parent.child1, 'hello');
  assert.strictEqual(result.frontmatter.parent.child2, 42);
});

test('parseFrontmatter treats empty-value key NOT followed by indented lines as null', () => {
  const content = `---
empty_key:
next_key: value
---

body
`;
  const result = parseFrontmatter(content);
  assert.strictEqual(result.frontmatter.empty_key, null);
  assert.strictEqual(result.frontmatter.next_key, 'value');
});

test('parseYamlValue converts integers, floats, booleans, null, quoted strings, bare strings', () => {
  assert.strictEqual(parseYamlValue('42'), 42);
  assert.strictEqual(parseYamlValue('3.14'), 3.14);
  assert.strictEqual(parseYamlValue('true'), true);
  assert.strictEqual(parseYamlValue('false'), false);
  assert.strictEqual(parseYamlValue('null'), null);
  assert.strictEqual(parseYamlValue('~'), null);
  assert.strictEqual(parseYamlValue('"hello world"'), 'hello world');
  assert.strictEqual(parseYamlValue("'single quoted'"), 'single quoted');
  assert.strictEqual(parseYamlValue('bare string'), 'bare string');
});

test('serializeFrontmatter round-trips flat frontmatter without data loss', () => {
  const original = `---
status: planning
milestone: v1.0
count: 5
active: true
---

body
`;
  const { frontmatter, body } = parseFrontmatter(original);
  const serialized = serializeFrontmatter(frontmatter);
  const rebuilt = `---\n${serialized}\n---\n${body}`;
  const reparsed = parseFrontmatter(rebuilt);
  assert.deepStrictEqual(reparsed.frontmatter, frontmatter);
});

test('serializeFrontmatter round-trips nested frontmatter without data loss', () => {
  const { frontmatter, body } = parseFrontmatter(NESTED_STATE_MD);
  const serialized = serializeFrontmatter(frontmatter);
  const rebuilt = `---\n${serialized}\n---\n${body}`;
  const reparsed = parseFrontmatter(rebuilt);
  assert.deepStrictEqual(reparsed.frontmatter.progress, frontmatter.progress);
  assert.strictEqual(reparsed.frontmatter.status, frontmatter.status);
});

test('serializeFrontmatter quotes strings containing special YAML chars', () => {
  const fm = { key: 'value: with colon', another: 'hash # here' };
  const serialized = serializeFrontmatter(fm);
  assert.ok(serialized.includes('"value: with colon"'), 'Should quote string with colon');
  assert.ok(serialized.includes('"hash # here"'), 'Should quote string with hash');
});

test('serializeFrontmatter quotes strings matching ISO date pattern', () => {
  const fm = { last_updated: '2026-04-10T06:10:33.564Z' };
  const serialized = serializeFrontmatter(fm);
  assert.ok(serialized.includes('"2026-04-10T06:10:33.564Z"'), 'Should quote ISO date string');
});

test('stateGet with dotted key progress.total_phases returns 6 from nested STATE.md', () => {
  // Create a temp directory with a nested STATE.md
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'STATE.md'), NESTED_STATE_MD);

  // Capture output
  const originalWriteSync = fs.writeSync;
  let captured = '';
  fs.writeSync = (fd, data) => {
    if (fd === 1) captured = data;
    else originalWriteSync(fd, data);
  };

  try {
    state.stateGet(tmpDir, 'progress.total_phases');
    const result = JSON.parse(captured);
    assert.strictEqual(result.value, 6);
  } finally {
    fs.writeSync = originalWriteSync;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateGet with dotted key progress.nonexistent returns null', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'STATE.md'), NESTED_STATE_MD);

  const originalWriteSync = fs.writeSync;
  let captured = '';
  fs.writeSync = (fd, data) => {
    if (fd === 1) captured = data;
    else originalWriteSync(fd, data);
  };

  try {
    state.stateGet(tmpDir, 'progress.nonexistent');
    const result = JSON.parse(captured);
    assert.strictEqual(result.value, null);
  } finally {
    fs.writeSync = originalWriteSync;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateSet with dotted key progress.completed_phases updates only that sub-key', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'STATE.md'), NESTED_STATE_MD);

  state.stateSet(tmpDir, 'progress.completed_phases', '2');

  const content = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf8');
  const { frontmatter } = parseFrontmatter(content);
  assert.strictEqual(frontmatter.progress.completed_phases, 2);
  // Other sub-keys preserved
  assert.strictEqual(frontmatter.progress.total_phases, 6);
  assert.strictEqual(frontmatter.progress.total_plans, 3);
});

test('stateSet with dotted key on non-existent parent creates the parent object', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'STATE.md'), SAMPLE_STATE_MD);

  state.stateSet(tmpDir, 'metrics.total_time', '120');

  const content = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf8');
  const { frontmatter } = parseFrontmatter(content);
  assert.strictEqual(typeof frontmatter.metrics, 'object');
  assert.strictEqual(frontmatter.metrics.total_time, 120);
});

// === Task 2: patch, merge, validate subcommand tests ===

// Helper: create temp dir with STATE.md and return paths
function createTempState(content) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'STATE.md'), content);
  return { tmpDir, planningDir, statePath: path.join(planningDir, 'STATE.md') };
}

// Helper: capture stdout (fd 1) output
function captureOutput(fn) {
  const originalWriteSync = fs.writeSync;
  let captured = '';
  fs.writeSync = (fd, data) => {
    if (fd === 1) captured = data;
    else originalWriteSync(fd, data);
  };
  try {
    fn();
    return captured ? JSON.parse(captured) : null;
  } finally {
    fs.writeSync = originalWriteSync;
  }
}

// --- statePatch tests ---

test('statePatch with --status and --last_activity updates both keys', () => {
  const { tmpDir, statePath } = createTempState(NESTED_STATE_MD);
  try {
    const result = captureOutput(() => {
      state.statePatch(tmpDir, ['--status', 'executing', '--last_activity', '2026-04-10']);
    });
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.updated, ['status', 'last_activity']);

    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    assert.strictEqual(frontmatter.status, 'executing');
    assert.strictEqual(frontmatter.last_activity, '2026-04-10');
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

test('statePatch preserves unmodified keys (progress sub-object intact after patching status)', () => {
  const { tmpDir, statePath } = createTempState(NESTED_STATE_MD);
  try {
    captureOutput(() => {
      state.statePatch(tmpDir, ['--status', 'executing']);
    });

    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    assert.strictEqual(frontmatter.status, 'executing');
    // progress sub-object should be preserved
    assert.strictEqual(frontmatter.progress.total_phases, 6);
    assert.strictEqual(frontmatter.progress.completed_phases, 1);
    assert.strictEqual(frontmatter.progress.total_plans, 3);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- stateMerge tests ---

test('stateMerge with progress update deep-merges correctly', () => {
  const { tmpDir, statePath } = createTempState(NESTED_STATE_MD);
  try {
    const result = captureOutput(() => {
      state.stateMerge(tmpDir, ['{"progress":{"completed_phases":2}}']);
    });
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.merged, ['progress']);

    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    assert.strictEqual(frontmatter.progress.completed_phases, 2);
    // Other progress sub-keys preserved
    assert.strictEqual(frontmatter.progress.total_phases, 6);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateMerge with invalid JSON outputs error', () => {
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
    state.stateMerge(tmpDir, ['not valid json']);
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

test('stateMerge with new top-level key adds it to frontmatter', () => {
  const { tmpDir, statePath } = createTempState(NESTED_STATE_MD);
  try {
    captureOutput(() => {
      state.stateMerge(tmpDir, ['{"new_key":"new_value"}']);
    });

    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    assert.strictEqual(frontmatter.new_key, 'new_value');
    // Existing keys preserved
    assert.strictEqual(frontmatter.status, 'planning');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- stateValidate tests ---

test('stateValidate on valid STATE.md returns valid: true', () => {
  const validMd = `---
status: planning
last_updated: "2026-04-10T06:10:33.564Z"
last_activity: 2026-04-10
---

# Project State
`;
  const { tmpDir } = createTempState(validMd);
  try {
    const result = captureOutput(() => {
      state.stateValidate(tmpDir);
    });
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.issues, []);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateValidate on STATE.md missing status key reports issue', () => {
  const missingStatusMd = `---
last_updated: "2026-04-10T06:10:33.564Z"
last_activity: 2026-04-10
---

# Project State
`;
  const { tmpDir } = createTempState(missingStatusMd);
  try {
    const result = captureOutput(() => {
      state.stateValidate(tmpDir);
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.includes('status')), 'Should report missing status key');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateValidate on STATE.md without frontmatter closer reports issue', () => {
  const noCloserMd = `---
status: planning
last_updated: "2026-04-10T06:10:33.564Z"
last_activity: 2026-04-10

# Project State
`;
  const { tmpDir } = createTempState(noCloserMd);
  try {
    const result = captureOutput(() => {
      state.stateValidate(tmpDir);
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.includes('frontmatter')), 'Should report frontmatter issue');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- run dispatch tests ---

test('run dispatches patch subcommand correctly', () => {
  const { tmpDir } = createTempState(NESTED_STATE_MD);
  try {
    const result = captureOutput(() => {
      state.run(tmpDir, ['patch', '--status', 'executing']);
    });
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.updated, ['status']);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('run dispatches merge subcommand correctly', () => {
  const { tmpDir } = createTempState(NESTED_STATE_MD);
  try {
    const result = captureOutput(() => {
      state.run(tmpDir, ['merge', '{"status":"executing"}']);
    });
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.merged, ['status']);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('run dispatches validate subcommand correctly', () => {
  const validMd = `---
status: planning
last_updated: "2026-04-10T06:10:33.564Z"
last_activity: 2026-04-10
---

# Project State
`;
  const { tmpDir } = createTempState(validMd);
  try {
    const result = captureOutput(() => {
      state.run(tmpDir, ['validate']);
    });
    assert.strictEqual(result.valid, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// === Task 1 (Plan 02-03): stateBeginPhase and stateAdvancePlan tests ===

const BEGIN_PHASE_FIXTURE = `---
status: planning
stopped_at: Phase 1 completed
last_updated: "2026-04-10T06:00:00.000Z"
last_activity: 2026-04-10
milestone: v1.0
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
  percent: 100
---

# Project State
`;

const ADVANCE_PLAN_FIXTURE = `---
status: executing
stopped_at: Phase 2 started
last_updated: "2026-04-10T06:00:00.000Z"
last_activity: 2026-04-10
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 3
  completed_plans: 1
  percent: 33
---

# Project State
`;

// --- stateBeginPhase tests ---

test('stateBeginPhase with --phase 2 sets status to executing', () => {
  const { tmpDir, statePath } = createTempState(BEGIN_PHASE_FIXTURE);
  try {
    captureOutput(() => {
      state.stateBeginPhase(tmpDir, ['--phase', '2']);
    });
    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    assert.strictEqual(frontmatter.status, 'executing');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateBeginPhase with --phase 2 sets stopped_at to Phase 2 started', () => {
  const { tmpDir, statePath } = createTempState(BEGIN_PHASE_FIXTURE);
  try {
    captureOutput(() => {
      state.stateBeginPhase(tmpDir, ['--phase', '2']);
    });
    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    assert.strictEqual(frontmatter.stopped_at, 'Phase 2 started');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateBeginPhase with --phase 2 sets last_updated to ISO timestamp', () => {
  const { tmpDir, statePath } = createTempState(BEGIN_PHASE_FIXTURE);
  try {
    captureOutput(() => {
      state.stateBeginPhase(tmpDir, ['--phase', '2']);
    });
    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    // last_updated should be an ISO string (serializeFrontmatter quotes it)
    assert.ok(typeof frontmatter.last_updated === 'string', 'last_updated should be a string');
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(frontmatter.last_updated), 'last_updated should be ISO format');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateBeginPhase with --phase 2 sets last_activity to YYYY-MM-DD', () => {
  const { tmpDir, statePath } = createTempState(BEGIN_PHASE_FIXTURE);
  try {
    captureOutput(() => {
      state.stateBeginPhase(tmpDir, ['--phase', '2']);
    });
    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.last_activity), 'last_activity should be YYYY-MM-DD');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateBeginPhase preserves all other frontmatter keys', () => {
  const { tmpDir, statePath } = createTempState(BEGIN_PHASE_FIXTURE);
  try {
    captureOutput(() => {
      state.stateBeginPhase(tmpDir, ['--phase', '2']);
    });
    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    assert.strictEqual(frontmatter.milestone, 'v1.0');
    assert.strictEqual(frontmatter.progress.total_phases, 6);
    assert.strictEqual(frontmatter.progress.completed_phases, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateBeginPhase without --phase arg exits with error', () => {
  const { tmpDir } = createTempState(BEGIN_PHASE_FIXTURE);
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
    state.stateBeginPhase(tmpDir, []);
  } catch (e) {
    if (e.message !== 'EXIT') throw e;
  } finally {
    process.exit = originalExit;
    fs.writeSync = originalWriteSync;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  assert.strictEqual(exitCode, 1);
  assert.ok(stderrOutput.length > 0, 'Should output error message');
});

test('stateBeginPhase with non-numeric phase exits with error', () => {
  const { tmpDir } = createTempState(BEGIN_PHASE_FIXTURE);
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
    state.stateBeginPhase(tmpDir, ['--phase', 'abc']);
  } catch (e) {
    if (e.message !== 'EXIT') throw e;
  } finally {
    process.exit = originalExit;
    fs.writeSync = originalWriteSync;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  assert.strictEqual(exitCode, 1);
  assert.ok(stderrOutput.length > 0, 'Should output error message');
});

// --- stateAdvancePlan tests ---

test('stateAdvancePlan with --phase 2 --plan 1 increments completed_plans', () => {
  const { tmpDir, statePath } = createTempState(ADVANCE_PLAN_FIXTURE);
  try {
    captureOutput(() => {
      state.stateAdvancePlan(tmpDir, ['--phase', '2', '--plan', '1']);
    });
    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    assert.strictEqual(frontmatter.progress.completed_plans, 2);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateAdvancePlan recalculates percent as round((completed/total)*100)', () => {
  const { tmpDir, statePath } = createTempState(ADVANCE_PLAN_FIXTURE);
  try {
    captureOutput(() => {
      state.stateAdvancePlan(tmpDir, ['--phase', '2', '--plan', '1']);
    });
    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    // completed_plans was 1, now 2. total_plans is 3. 2/3*100 = 67
    assert.strictEqual(frontmatter.progress.percent, 67);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateAdvancePlan sets last_updated and last_activity timestamps', () => {
  const { tmpDir, statePath } = createTempState(ADVANCE_PLAN_FIXTURE);
  try {
    captureOutput(() => {
      state.stateAdvancePlan(tmpDir, ['--phase', '2', '--plan', '1']);
    });
    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    assert.ok(/^\d{4}-\d{2}-\d{2}T/.test(frontmatter.last_updated), 'last_updated should be ISO format');
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.last_activity), 'last_activity should be YYYY-MM-DD');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateAdvancePlan preserves progress.total_phases and progress.completed_phases', () => {
  const { tmpDir, statePath } = createTempState(ADVANCE_PLAN_FIXTURE);
  try {
    captureOutput(() => {
      state.stateAdvancePlan(tmpDir, ['--phase', '2', '--plan', '1']);
    });
    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    assert.strictEqual(frontmatter.progress.total_phases, 6);
    assert.strictEqual(frontmatter.progress.completed_phases, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('stateAdvancePlan without --phase or --plan exits with error', () => {
  const { tmpDir } = createTempState(ADVANCE_PLAN_FIXTURE);
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
    state.stateAdvancePlan(tmpDir, ['--phase', '2']);
  } catch (e) {
    if (e.message !== 'EXIT') throw e;
  } finally {
    process.exit = originalExit;
    fs.writeSync = originalWriteSync;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  assert.strictEqual(exitCode, 1);
  assert.ok(stderrOutput.length > 0, 'Should output error message');
});

// --- run dispatch tests for begin-phase and advance-plan ---

test('run dispatches begin-phase subcommand correctly', () => {
  const { tmpDir, statePath } = createTempState(BEGIN_PHASE_FIXTURE);
  try {
    const result = captureOutput(() => {
      state.run(tmpDir, ['begin-phase', '--phase', '3']);
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.phase, 3);
    const content = fs.readFileSync(statePath, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    assert.strictEqual(frontmatter.status, 'executing');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

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
    const { frontmatter } = parseFrontmatter(content);
    assert.strictEqual(frontmatter.progress.completed_plans, 2);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
