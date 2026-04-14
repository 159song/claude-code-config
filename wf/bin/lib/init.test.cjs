'use strict';

// init.test.cjs — TDD tests for lib/init.cjs
// Uses temp fixtures so tests are self-contained and don't depend on repo state

const assert = require('assert');
const { test } = require('node:test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

// Use the worktree cwd as a real project root (has .planning/)
const CWD = path.resolve(__dirname, '../../..');

// Create a temp fixture with a proper phase directory structure
function createFixtureCwd() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-init-test-'));
  const planning = path.join(tmp, '.planning');
  fs.mkdirSync(path.join(planning, 'phases', '01-cli-foundation'), { recursive: true });
  fs.writeFileSync(path.join(planning, 'PROJECT.md'), '# Test Project\n');
  fs.writeFileSync(path.join(planning, 'config.json'), '{}');
  fs.writeFileSync(path.join(planning, 'ROADMAP.md'), '# Roadmap\n');
  fs.writeFileSync(path.join(planning, 'REQUIREMENTS.md'), '# Requirements\n');
  fs.writeFileSync(path.join(planning, 'phases', '01-cli-foundation', 'CONTEXT.md'), '# Context\n');
  return tmp;
}

function cleanupFixture(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

test('init module exports correct functions', () => {
  const init = require('./init.cjs');
  assert.strictEqual(typeof init.run, 'function', 'run should be a function');
  assert.strictEqual(typeof init.initPhaseOp, 'function', 'initPhaseOp should be a function');
  assert.strictEqual(typeof init.initNewProject, 'function', 'initNewProject should be a function');
  assert.strictEqual(typeof init.initQuick, 'function', 'initQuick should be a function');
});

test('initPhaseOp returns all D-08 fields for existing phase 1', () => {
  const { initPhaseOp } = require('./init.cjs');
  const result = initPhaseOp(CWD, '1');

  // All required D-08 fields
  assert.ok('phase_found' in result, 'must have phase_found');
  assert.ok('phase_dir' in result, 'must have phase_dir');
  assert.ok('phase_number' in result, 'must have phase_number');
  assert.ok('phase_name' in result, 'must have phase_name');
  assert.ok('phase_slug' in result, 'must have phase_slug');
  assert.ok('padded_phase' in result, 'must have padded_phase');
  assert.ok('has_context' in result, 'must have has_context');
  assert.ok('has_research' in result, 'must have has_research');
  assert.ok('has_plans' in result, 'must have has_plans');
  assert.ok('plan_count' in result, 'must have plan_count');
  assert.ok('has_verification' in result, 'must have has_verification');
  assert.ok('roadmap_exists' in result, 'must have roadmap_exists');
  assert.ok('planning_exists' in result, 'must have planning_exists');
  assert.ok('project_root' in result, 'must have project_root');
  assert.ok('commit_docs' in result, 'must have commit_docs');
  assert.ok('response_language' in result, 'must have response_language (D-09)');
});

test('initPhaseOp for existing phase 1 returns phase_found=true', () => {
  const fixture = createFixtureCwd();
  try {
    const { initPhaseOp } = require('./init.cjs');
    const result = initPhaseOp(fixture, '1');
    assert.strictEqual(result.phase_found, true, 'phase_found should be true for phase 1');
    assert.ok(result.phase_dir, 'phase_dir should be non-null');
    assert.ok(result.phase_dir.includes('01-cli-foundation'), 'phase_dir should contain 01-cli-foundation');
  } finally {
    cleanupFixture(fixture);
  }
});

test('initPhaseOp for non-existent phase 99 returns phase_found=false', () => {
  const { initPhaseOp } = require('./init.cjs');
  const result = initPhaseOp(CWD, '99');
  assert.strictEqual(result.phase_found, false, 'phase_found should be false for phase 99');
  assert.strictEqual(result.phase_dir, null, 'phase_dir should be null when not found');
});

test('initPhaseOp rejects non-numeric phase number (T-02-01 security)', () => {
  const { initPhaseOp } = require('./init.cjs');
  // Non-numeric should be rejected — phase_found false, no directory traversal
  const result = initPhaseOp(CWD, '../etc');
  assert.strictEqual(result.phase_found, false, 'non-numeric phase should return phase_found=false');
});

test('initPhaseOp padded_phase is zero-padded string', () => {
  const { initPhaseOp } = require('./init.cjs');
  const result = initPhaseOp(CWD, '1');
  if (result.phase_found) {
    assert.ok(typeof result.padded_phase === 'string', 'padded_phase should be string');
    assert.ok(result.padded_phase.length >= 2, 'padded_phase should be at least 2 chars');
  }
});

test('initNewProject returns all required fields', () => {
  const { initNewProject } = require('./init.cjs');
  const result = initNewProject(CWD);

  assert.ok('planning_dir' in result, 'must have planning_dir');
  assert.ok('has_project' in result, 'must have has_project');
  assert.ok('has_config' in result, 'must have has_config');
  assert.ok('has_roadmap' in result, 'must have has_roadmap');
  assert.ok('has_requirements' in result, 'must have has_requirements');
  assert.ok('response_language' in result, 'must have response_language (D-09)');
  assert.ok('project_root' in result, 'must have project_root');
});

test('initNewProject has_project=true for real project', () => {
  const fixture = createFixtureCwd();
  try {
    const { initNewProject } = require('./init.cjs');
    const result = initNewProject(fixture);
    assert.strictEqual(result.has_project, true, 'fixture has PROJECT.md so has_project must be true');
  } finally {
    cleanupFixture(fixture);
  }
});

test('initQuick returns config, project_root, planning_exists, has_roadmap, response_language', () => {
  const { initQuick } = require('./init.cjs');
  const result = initQuick(CWD);

  assert.ok('config' in result, 'must have config');
  assert.ok('project_root' in result, 'must have project_root');
  assert.ok('planning_exists' in result, 'must have planning_exists');
  assert.ok('has_roadmap' in result, 'must have has_roadmap');
  assert.ok('response_language' in result, 'must have response_language (D-09)');
});

test('initQuick config is object', () => {
  const { initQuick } = require('./init.cjs');
  const result = initQuick(CWD);
  assert.ok(typeof result.config === 'object' && result.config !== null, 'config should be an object');
});

test('response_language is in all sub-mode outputs (D-09)', () => {
  const { initPhaseOp, initNewProject, initQuick } = require('./init.cjs');
  const r1 = initPhaseOp(CWD, '1');
  const r2 = initNewProject(CWD);
  const r3 = initQuick(CWD);
  assert.ok('response_language' in r1, 'initPhaseOp must have response_language');
  assert.ok('response_language' in r2, 'initNewProject must have response_language');
  assert.ok('response_language' in r3, 'initQuick must have response_language');
});

test('run with unknown sub-mode exits with error', () => {
  let threw = false;
  try {
    execFileSync(process.execPath, [
      '-e',
      `require('./init.cjs').run(${JSON.stringify(CWD)}, ['unknown-mode'])`,
    ], { cwd: __dirname, stdio: 'pipe' });
  } catch (e) {
    threw = true;
    assert.ok(e.status !== 0, 'should exit with non-zero code');
  }
  assert.ok(threw, 'run with unknown sub-mode should throw/exit non-zero');
});

test('run with phase-op sub-mode writes JSON to stdout', () => {
  const fixture = createFixtureCwd();
  try {
    const out = execFileSync(process.execPath, [
      '-e',
      `require('./init.cjs').run(${JSON.stringify(fixture)}, ['phase-op', '1'])`,
    ], { cwd: __dirname, stdio: ['pipe', 'pipe', 'pipe'] });
    const json = JSON.parse(out.toString());
    assert.strictEqual(json.phase_found, true, 'JSON output should have phase_found=true');
  } finally {
    cleanupFixture(fixture);
  }
});

test('run with new-project sub-mode writes JSON to stdout', () => {
  const out = execFileSync(process.execPath, [
    '-e',
    `require('./init.cjs').run(${JSON.stringify(CWD)}, ['new-project'])`,
  ], { cwd: __dirname, stdio: ['pipe', 'pipe', 'pipe'] });
  const json = JSON.parse(out.toString());
  assert.ok('has_project' in json, 'JSON output should have has_project');
});

test('run aliases: execute-phase, plan-phase, discuss-phase all behave like phase-op', () => {
  for (const alias of ['execute-phase', 'plan-phase', 'discuss-phase']) {
    const out = execFileSync(process.execPath, [
      '-e',
      `require('./init.cjs').run(${JSON.stringify(CWD)}, [${JSON.stringify(alias)}, '1'])`,
    ], { cwd: __dirname, stdio: ['pipe', 'pipe', 'pipe'] });
    const json = JSON.parse(out.toString());
    assert.ok('phase_found' in json, `${alias} alias should produce phase_found field`);
  }
});
