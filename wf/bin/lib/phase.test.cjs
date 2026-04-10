'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const phase = require('./phase.cjs');

test('phase module exports run function', () => {
  assert.strictEqual(typeof phase.run, 'function');
});

test('findPhaseDir supports phases/NN-slug/ naming convention (GSD-style)', () => {
  const tmpBase = path.join(os.tmpdir(), `wf-phase-${Date.now()}`);
  const planningDir = path.join(tmpBase, '.planning');
  const phaseDir = path.join(planningDir, 'phases', '01-cli-foundation');
  fs.mkdirSync(phaseDir, { recursive: true });
  // Create a dummy CONTEXT file
  fs.writeFileSync(path.join(phaseDir, '01-CONTEXT.md'), '# Context', 'utf8');

  const result = phase.findPhaseDir(tmpBase, 1);
  fs.rmSync(tmpBase, { recursive: true, force: true });

  assert.ok(result !== null, 'Should find phase directory');
  assert.ok(result.directory.includes('01-cli-foundation'), 'Should find GSD-style dir');
});

test('findPhaseDir supports phase-N/ naming convention (WF-style)', () => {
  const tmpBase = path.join(os.tmpdir(), `wf-phase-${Date.now()}`);
  const planningDir = path.join(tmpBase, '.planning');
  const phaseDir = path.join(planningDir, 'phase-1');
  fs.mkdirSync(phaseDir, { recursive: true });
  fs.writeFileSync(path.join(phaseDir, 'CONTEXT.md'), '# Context', 'utf8');

  const result = phase.findPhaseDir(tmpBase, 1);
  fs.rmSync(tmpBase, { recursive: true, force: true });

  assert.ok(result !== null, 'Should find WF-style phase directory');
  assert.ok(result.directory.includes('phase-1'), 'Should find WF-style dir');
});

test('findPhaseDir returns null when phase does not exist', () => {
  const tmpBase = path.join(os.tmpdir(), `wf-phase-${Date.now()}`);
  const planningDir = path.join(tmpBase, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  const result = phase.findPhaseDir(tmpBase, 99);
  fs.rmSync(tmpBase, { recursive: true, force: true });

  assert.strictEqual(result, null);
});
