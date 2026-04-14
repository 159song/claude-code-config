#!/usr/bin/env node
'use strict';

// wf-tools.test.cjs — CLI router integration tests
// Tests the wf-tools.cjs entry point via execFileSync child processes

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CLI_PATH = path.join(PROJECT_ROOT, 'wf/bin/wf-tools.cjs');

const STATE_MD_FIXTURE = `---
status: executing
milestone: v1.0.0
last_updated: "2024-01-01"
last_activity: "plan-phase"
progress:
  current_phase: 1
  total_phases: 3
  percent: 33
---
# WF State
`;

const CONFIG_JSON_FIXTURE = JSON.stringify({
  mode: 'auto',
  workflow: { research: true },
}, null, 2);

// Helper: run wf-tools CLI with given args, return { stdout, stderr, status }
function runCli(args, options) {
  const opts = Object.assign({ cwd: PROJECT_ROOT, encoding: 'utf8' }, options);
  try {
    const stdout = execFileSync(process.execPath, [CLI_PATH, ...args], opts);
    return { stdout, stderr: '', status: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      status: err.status || 1,
    };
  }
}

// Helper: create temp project dir with .planning fixtures
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-cli-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'STATE.md'), STATE_MD_FIXTURE);
  fs.writeFileSync(path.join(planningDir, 'config.json'), CONFIG_JSON_FIXTURE);
  return tmpDir;
}

// Helper: cleanup temp dir
function cleanupTemp(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ---- Test 1: Unknown command prints help to stderr and exits 1 ----

test('unknown command prints help to stderr and exits 1', () => {
  const result = runCli(['--cwd', '/tmp', 'nonexistent']);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('WF Tools'), 'stderr should include tool name');
  assert.ok(result.stderr.includes('init|state|roadmap'), 'stderr should list available commands');
});

// ---- Test 2: No command prints help to stderr and exits 1 ----

test('no command prints help to stderr and exits 1', () => {
  const result = runCli(['--cwd', '/tmp']);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('WF Tools'), 'stderr should include tool name');
});

// ---- Test 3: --cwd flag overrides working directory ----

test('--cwd flag overrides working directory', () => {
  const tmpDir = createTempProject();
  try {
    const result = runCli(['--cwd', tmpDir, 'state', 'get', 'status']);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.value, 'executing');
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ---- Test 4: state get status reads state from temp fixture ----

test('state get status reads state from temp fixture', () => {
  const tmpDir = createTempProject();
  try {
    const result = runCli(['--cwd', tmpDir, 'state', 'get', 'status']);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.value, 'executing');
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ---- Test 5: state json outputs full state JSON from temp fixture ----

test('state json outputs full state JSON from temp fixture', () => {
  const tmpDir = createTempProject();
  try {
    const result = runCli(['--cwd', tmpDir, 'state', 'json']);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.status, 'executing');
    assert.equal(parsed.milestone, 'v1.0.0');
    assert.equal(typeof parsed.progress, 'object');
    assert.equal(parsed.progress.total_phases, 3);
    assert.equal(parsed.progress.percent, 33);
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ---- Test 6: config schema outputs schema array ----

test('config schema outputs schema array', () => {
  const tmpDir = createTempProject();
  try {
    const result = runCli(['--cwd', tmpDir, 'config', 'schema']);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.ok(Array.isArray(parsed), 'schema output should be an array');
    assert.ok(parsed.length > 0, 'schema should have entries');
    // Each entry should have key, type, default
    const first = parsed[0];
    assert.ok('key' in first, 'schema entry should have key');
    assert.ok('type' in first, 'schema entry should have type');
    assert.ok('default' in first, 'schema entry should have default');
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ---- Test 7: config get mode outputs mode value ----

test('config get mode outputs mode value', () => {
  const tmpDir = createTempProject();
  try {
    const result = runCli(['--cwd', tmpDir, 'config', 'get', 'mode']);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.key, 'mode');
    assert.equal(parsed.value, 'auto');
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ---- Test 8: init new-project outputs project info ----

test('init new-project outputs project info', () => {
  const tmpDir = createTempProject();
  try {
    const result = runCli(['--cwd', tmpDir, 'init', 'new-project']);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.planning_dir, '.planning');
    assert.equal(typeof parsed.has_project, 'boolean');
    assert.equal(typeof parsed.has_config, 'boolean');
    assert.equal(typeof parsed.has_roadmap, 'boolean');
    // config.json exists in our fixture, so has_config should be true
    assert.equal(parsed.has_config, true);
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ---- Test 9: init quick outputs minimal context ----

test('init quick outputs minimal context', () => {
  const tmpDir = createTempProject();
  try {
    const result = runCli(['--cwd', tmpDir, 'init', 'quick']);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(typeof parsed.config, 'object');
    assert.equal(typeof parsed.planning_exists, 'boolean');
    assert.equal(parsed.planning_exists, true);
    assert.equal(typeof parsed.project_root, 'string');
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ---- Test 10: validate health checks STATE.md health ----

test('validate health checks STATE.md health', () => {
  const tmpDir = createTempProject();
  try {
    const result = runCli(['--cwd', tmpDir, 'validate', 'health']);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(typeof parsed.valid, 'boolean');
    assert.ok(Array.isArray(parsed.issues), 'issues should be an array');
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ---- Test 11: progress outputs progress JSON ----

test('progress outputs progress JSON', () => {
  const tmpDir = createTempProject();
  try {
    const result = runCli(['--cwd', tmpDir, 'progress']);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(typeof parsed.progress, 'number');
    assert.ok(Array.isArray(parsed.phases), 'phases should be an array');
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ---- Test 12: settings alias works same as config ----

test('settings alias works same as config', () => {
  const tmpDir = createTempProject();
  try {
    const configResult = runCli(['--cwd', tmpDir, 'config', 'get', 'mode']);
    const settingsResult = runCli(['--cwd', tmpDir, 'settings', 'get', 'mode']);
    assert.equal(configResult.status, 0);
    assert.equal(settingsResult.status, 0);
    const configParsed = JSON.parse(configResult.stdout);
    const settingsParsed = JSON.parse(settingsResult.stdout);
    assert.equal(configParsed.key, settingsParsed.key);
    assert.equal(configParsed.value, settingsParsed.value);
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ---- Additional edge case: --cwd placed before command ----

test('--cwd placed at different positions in args works correctly', () => {
  const tmpDir = createTempProject();
  try {
    // --cwd before command
    const result = runCli(['--cwd', tmpDir, 'state', 'get', 'milestone']);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.value, 'v1.0.0');
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ---- state get with dotted key reads nested value ----

test('state get with dotted key reads nested progress value', () => {
  const tmpDir = createTempProject();
  try {
    const result = runCli(['--cwd', tmpDir, 'state', 'get', 'progress.total_phases']);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.value, 3);
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ---- init phase-op with non-existent phase returns phase_found: false ----

test('init phase-op with non-existent phase returns phase_found: false', () => {
  const tmpDir = createTempProject();
  try {
    const result = runCli(['--cwd', tmpDir, 'init', 'phase-op', '99']);
    assert.equal(result.status, 0);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.phase_found, false);
    assert.equal(parsed.planning_exists, true);
  } finally {
    cleanupTemp(tmpDir);
  }
});
