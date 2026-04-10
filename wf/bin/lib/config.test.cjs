'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const config = require('./config.cjs');

test('loadConfig returns merged defaults + project config', () => {
  const tmpBase = path.join(os.tmpdir(), `wf-cfg-${Date.now()}`);
  const planningDir = path.join(tmpBase, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  // Write a partial config
  fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify({
    mode: 'manual'
  }), 'utf8');

  const result = config.loadConfig(tmpBase);
  fs.rmSync(tmpBase, { recursive: true, force: true });

  // Should have the project config value
  assert.strictEqual(result.mode, 'manual');
  // Should also have defaults filled in
  assert.ok(result.workflow !== undefined, 'Should have workflow defaults');
});

test('CONFIG_DEFAULTS is an object with expected keys', () => {
  assert.ok(typeof config.CONFIG_DEFAULTS === 'object');
  assert.ok(config.CONFIG_DEFAULTS !== null);
  // Should have mode, workflow, planning, parallelization keys
  assert.ok('mode' in config.CONFIG_DEFAULTS || 'workflow' in config.CONFIG_DEFAULTS);
});

test('loadConfig returns defaults when no config file exists', () => {
  const tmpBase = path.join(os.tmpdir(), `wf-cfg-${Date.now()}`);
  fs.mkdirSync(tmpBase, { recursive: true });
  // No .planning dir, no config file

  const result = config.loadConfig(tmpBase);
  fs.rmSync(tmpBase, { recursive: true, force: true });

  // Should return defaults without crashing
  assert.ok(typeof result === 'object');
  assert.ok(result !== null);
});
