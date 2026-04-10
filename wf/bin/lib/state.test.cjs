'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const state = require('./state.cjs');

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
  const result = state.parseFrontmatter(SAMPLE_STATE_MD);
  assert.ok(result.frontmatter, 'Should have frontmatter object');
  assert.strictEqual(result.frontmatter.gsd_state_version, 1.0);
  assert.strictEqual(result.frontmatter.milestone, 'v1.0');
  assert.strictEqual(result.frontmatter.status, 'planning');
  assert.ok(result.body, 'Should have body content');
  assert.ok(result.body.includes('# Project State'), 'Body should contain markdown content');
});

test('parseFrontmatter returns empty frontmatter for content without ---', () => {
  const result = state.parseFrontmatter('# No frontmatter here\n\nJust body');
  assert.deepStrictEqual(result.frontmatter, {});
});

test('state module exports run function', () => {
  assert.strictEqual(typeof state.run, 'function');
});

test('state module exports parseFrontmatter function', () => {
  assert.strictEqual(typeof state.parseFrontmatter, 'function');
});

// === Task 1: Nested YAML parsing tests ===

test('parseFrontmatter parses nested progress: with sub-keys', () => {
  const result = state.parseFrontmatter(NESTED_STATE_MD);
  assert.ok(result.frontmatter.progress, 'progress should not be null');
  assert.strictEqual(typeof result.frontmatter.progress, 'object');
  assert.strictEqual(result.frontmatter.progress.total_phases, 6);
  assert.strictEqual(result.frontmatter.progress.completed_phases, 1);
  assert.strictEqual(result.frontmatter.progress.total_plans, 3);
  assert.strictEqual(result.frontmatter.progress.completed_plans, 3);
  assert.strictEqual(result.frontmatter.progress.percent, 100);
});

test('parseFrontmatter handles mixed flat + nested keys in same frontmatter', () => {
  const result = state.parseFrontmatter(NESTED_STATE_MD);
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
  const result = state.parseFrontmatter(content);
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
  const result = state.parseFrontmatter(content);
  assert.strictEqual(result.frontmatter.empty_key, null);
  assert.strictEqual(result.frontmatter.next_key, 'value');
});

test('parseYamlValue converts integers, floats, booleans, null, quoted strings, bare strings', () => {
  assert.strictEqual(state.parseYamlValue('42'), 42);
  assert.strictEqual(state.parseYamlValue('3.14'), 3.14);
  assert.strictEqual(state.parseYamlValue('true'), true);
  assert.strictEqual(state.parseYamlValue('false'), false);
  assert.strictEqual(state.parseYamlValue('null'), null);
  assert.strictEqual(state.parseYamlValue('~'), null);
  assert.strictEqual(state.parseYamlValue('"hello world"'), 'hello world');
  assert.strictEqual(state.parseYamlValue("'single quoted'"), 'single quoted');
  assert.strictEqual(state.parseYamlValue('bare string'), 'bare string');
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
  const { frontmatter, body } = state.parseFrontmatter(original);
  const serialized = state.serializeFrontmatter(frontmatter);
  const rebuilt = `---\n${serialized}\n---\n${body}`;
  const reparsed = state.parseFrontmatter(rebuilt);
  assert.deepStrictEqual(reparsed.frontmatter, frontmatter);
});

test('serializeFrontmatter round-trips nested frontmatter without data loss', () => {
  const { frontmatter, body } = state.parseFrontmatter(NESTED_STATE_MD);
  const serialized = state.serializeFrontmatter(frontmatter);
  const rebuilt = `---\n${serialized}\n---\n${body}`;
  const reparsed = state.parseFrontmatter(rebuilt);
  assert.deepStrictEqual(reparsed.frontmatter.progress, frontmatter.progress);
  assert.strictEqual(reparsed.frontmatter.status, frontmatter.status);
});

test('serializeFrontmatter quotes strings containing special YAML chars', () => {
  const fm = { key: 'value: with colon', another: 'hash # here' };
  const serialized = state.serializeFrontmatter(fm);
  assert.ok(serialized.includes('"value: with colon"'), 'Should quote string with colon');
  assert.ok(serialized.includes('"hash # here"'), 'Should quote string with hash');
});

test('serializeFrontmatter quotes strings matching ISO date pattern', () => {
  const fm = { last_updated: '2026-04-10T06:10:33.564Z' };
  const serialized = state.serializeFrontmatter(fm);
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
  const { frontmatter } = state.parseFrontmatter(content);
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
  const { frontmatter } = state.parseFrontmatter(content);
  assert.strictEqual(typeof frontmatter.metrics, 'object');
  assert.strictEqual(frontmatter.metrics.total_time, 120);
});
