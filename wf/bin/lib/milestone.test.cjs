'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const milestone = require('./milestone.cjs');

// Helper: create temp dir simulating a .planning/ structure
function makeTmp(opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-milestone-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  // Create ROADMAP.md
  if (opts.roadmap !== false) {
    fs.writeFileSync(
      path.join(planningDir, 'ROADMAP.md'),
      '# Roadmap\n\n## Phase 1: CLI Foundation\n\nSome content.\n',
      'utf8'
    );
  }

  // Create REQUIREMENTS.md
  if (opts.requirements !== false) {
    fs.writeFileSync(
      path.join(planningDir, 'REQUIREMENTS.md'),
      '# Requirements\n\n- REQ-01: Some requirement\n',
      'utf8'
    );
  }

  // Create STATE.md
  if (opts.state !== false) {
    fs.writeFileSync(
      path.join(planningDir, 'STATE.md'),
      '---\nstatus: executing\n---\n# State\n',
      'utf8'
    );
  }

  // Create PROJECT.md
  fs.writeFileSync(
    path.join(planningDir, 'PROJECT.md'),
    '# Project\n\nCore value: Test project.\n',
    'utf8'
  );

  // Create config.json
  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify({ mode: 'auto' }),
    'utf8'
  );

  // Create phase directories with content
  if (opts.phases !== false) {
    const phase1Dir = path.join(planningDir, 'phases', '01-cli-foundation');
    fs.mkdirSync(phase1Dir, { recursive: true });
    fs.writeFileSync(path.join(phase1Dir, '01-CONTEXT.md'), '# Context\n', 'utf8');
    fs.writeFileSync(path.join(phase1Dir, '01-01-PLAN.md'), '# Plan\n', 'utf8');
    fs.writeFileSync(path.join(phase1Dir, '01-01-SUMMARY.md'), '# Summary\n', 'utf8');

    const phase2Dir = path.join(planningDir, 'phases', '02-state-mgmt');
    fs.mkdirSync(phase2Dir, { recursive: true });
    fs.writeFileSync(path.join(phase2Dir, '02-CONTEXT.md'), '# Context P2\n', 'utf8');
  }

  return tmpDir;
}

function cleanTmp(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ============================================================
// archiveMilestone tests
// ============================================================

test('archiveMilestone creates archive directory with version prefix', () => {
  const tmpDir = makeTmp();
  try {
    const result = milestone.archiveMilestone(tmpDir, 'v1.0');
    assert.strictEqual(result.success, true);
    const archiveDir = path.join(tmpDir, '.planning', 'milestones', 'v1.0');
    assert.ok(fs.existsSync(archiveDir), 'Archive directory should exist');
  } finally {
    cleanTmp(tmpDir);
  }
});

test('archiveMilestone copies ROADMAP.md with version prefix', () => {
  const tmpDir = makeTmp();
  try {
    milestone.archiveMilestone(tmpDir, 'v1.0');
    const archived = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'v1.0-ROADMAP.md');
    assert.ok(fs.existsSync(archived), 'Archived ROADMAP.md should exist');
    const content = fs.readFileSync(archived, 'utf8');
    assert.ok(content.includes('# Roadmap'));
  } finally {
    cleanTmp(tmpDir);
  }
});

test('archiveMilestone copies REQUIREMENTS.md with version prefix', () => {
  const tmpDir = makeTmp();
  try {
    milestone.archiveMilestone(tmpDir, 'v1.0');
    const archived = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'v1.0-REQUIREMENTS.md');
    assert.ok(fs.existsSync(archived), 'Archived REQUIREMENTS.md should exist');
  } finally {
    cleanTmp(tmpDir);
  }
});

test('archiveMilestone copies phase directories into archive/phases/', () => {
  const tmpDir = makeTmp();
  try {
    const result = milestone.archiveMilestone(tmpDir, 'v1.0');
    assert.strictEqual(result.success, true);
    const archivedPhase1 = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'phases', '01-cli-foundation');
    assert.ok(fs.existsSync(archivedPhase1), 'Archived phase 1 directory should exist');
    assert.ok(fs.existsSync(path.join(archivedPhase1, '01-CONTEXT.md')), 'Archived phase files should exist');
    assert.ok(result.files_copied > 0, 'Should report files copied count');
  } finally {
    cleanTmp(tmpDir);
  }
});

test('archiveMilestone returns success with archive_dir and files_copied', () => {
  const tmpDir = makeTmp();
  try {
    const result = milestone.archiveMilestone(tmpDir, 'v1.0');
    assert.strictEqual(result.success, true);
    assert.ok(result.archive_dir);
    assert.ok(typeof result.files_copied === 'number');
    assert.ok(result.files_copied >= 5); // ROADMAP + REQUIREMENTS + STATE + phase files
  } finally {
    cleanTmp(tmpDir);
  }
});

test('archiveMilestone returns error when ROADMAP.md missing', () => {
  const tmpDir = makeTmp({ roadmap: false });
  try {
    const result = milestone.archiveMilestone(tmpDir, 'v1.0');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('ROADMAP.md'));
  } finally {
    cleanTmp(tmpDir);
  }
});

test('archiveMilestone handles missing REQUIREMENTS.md gracefully', () => {
  const tmpDir = makeTmp({ requirements: false });
  try {
    const result = milestone.archiveMilestone(tmpDir, 'v1.0');
    assert.strictEqual(result.success, true);
    assert.ok(result.warnings.some(w => w.includes('REQUIREMENTS.md')));
  } finally {
    cleanTmp(tmpDir);
  }
});

test('archiveMilestone rejects invalid version format', () => {
  const tmpDir = makeTmp();
  try {
    const result = milestone.archiveMilestone(tmpDir, 'bad-version');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('version'));
  } finally {
    cleanTmp(tmpDir);
  }
});

// ============================================================
// resetForNewMilestone tests
// ============================================================

test('resetForNewMilestone removes phase directories', () => {
  const tmpDir = makeTmp();
  try {
    const result = milestone.resetForNewMilestone(tmpDir);
    assert.strictEqual(result.success, true);
    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    // phases directory itself may still exist but should be empty
    if (fs.existsSync(phasesDir)) {
      const entries = fs.readdirSync(phasesDir);
      assert.strictEqual(entries.length, 0, 'Phases directory should be empty');
    }
  } finally {
    cleanTmp(tmpDir);
  }
});

test('resetForNewMilestone preserves PROJECT.md, STATE.md, config.json', () => {
  const tmpDir = makeTmp();
  try {
    milestone.resetForNewMilestone(tmpDir);
    const planningDir = path.join(tmpDir, '.planning');
    assert.ok(fs.existsSync(path.join(planningDir, 'PROJECT.md')), 'PROJECT.md should be preserved');
    assert.ok(fs.existsSync(path.join(planningDir, 'STATE.md')), 'STATE.md should be preserved');
    assert.ok(fs.existsSync(path.join(planningDir, 'config.json')), 'config.json should be preserved');
  } finally {
    cleanTmp(tmpDir);
  }
});

test('resetForNewMilestone returns removed dirs and files', () => {
  const tmpDir = makeTmp();
  try {
    const result = milestone.resetForNewMilestone(tmpDir);
    assert.strictEqual(result.success, true);
    assert.ok(Array.isArray(result.removed_dirs));
    assert.ok(Array.isArray(result.removed_files));
    // Should have removed at least 2 phase dirs
    assert.ok(result.removed_dirs.length >= 2);
  } finally {
    cleanTmp(tmpDir);
  }
});

// ============================================================
// run dispatch tests
// ============================================================

test('run archive subcommand outputs JSON result', () => {
  const tmpDir = makeTmp();
  const origWriteSync = fs.writeSync;
  let captured = '';
  fs.writeSync = (fd, data) => { if (fd === 1) captured += data; else origWriteSync(fd, data); };
  try {
    milestone.run(tmpDir, ['archive', 'v1.0']);
  } finally {
    fs.writeSync = origWriteSync;
  }
  const output = JSON.parse(captured);
  assert.strictEqual(output.success, true);
  cleanTmp(tmpDir);
});

test('run reset subcommand outputs JSON result', () => {
  const tmpDir = makeTmp();
  const origWriteSync = fs.writeSync;
  let captured = '';
  fs.writeSync = (fd, data) => { if (fd === 1) captured += data; else origWriteSync(fd, data); };
  try {
    milestone.run(tmpDir, ['reset']);
  } finally {
    fs.writeSync = origWriteSync;
  }
  const output = JSON.parse(captured);
  assert.strictEqual(output.success, true);
  cleanTmp(tmpDir);
});

// ============================================================
// Phase C: specs/ and changes/ archive behavior
// ============================================================

test('archiveMilestone copies specs/ directory into archive', () => {
  const tmpDir = makeTmp();
  try {
    const specsDir = path.join(tmpDir, '.planning', 'specs', 'auth');
    fs.mkdirSync(specsDir, { recursive: true });
    fs.writeFileSync(path.join(specsDir, 'spec.md'), '# Auth\n## Purpose\nx\n## Requirements\n### Requirement: R\nbody\n#### Scenario: s\n- WHEN x\n- THEN y\n', 'utf8');

    const result = milestone.archiveMilestone(tmpDir, 'v1.0');
    assert.strictEqual(result.success, true);
    const archivedSpec = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'specs', 'auth', 'spec.md');
    assert.ok(fs.existsSync(archivedSpec), 'specs/ should be copied into archive');
    assert.ok(fs.readFileSync(archivedSpec, 'utf8').includes('### Requirement: R'));
  } finally {
    cleanTmp(tmpDir);
  }
});

test('archiveMilestone copies changes/archive/ into archive/changes-archive/', () => {
  const tmpDir = makeTmp();
  try {
    const archivedChange = path.join(tmpDir, '.planning', 'changes', 'archive', '2026-01-01-past-change');
    fs.mkdirSync(archivedChange, { recursive: true });
    fs.writeFileSync(path.join(archivedChange, 'proposal.md'), '# p', 'utf8');

    const result = milestone.archiveMilestone(tmpDir, 'v1.0');
    assert.strictEqual(result.success, true);
    const snapshotted = path.join(tmpDir, '.planning', 'milestones', 'v1.0', 'changes-archive', '2026-01-01-past-change', 'proposal.md');
    assert.ok(fs.existsSync(snapshotted), 'changes/archive/ should be snapshotted into milestone');
  } finally {
    cleanTmp(tmpDir);
  }
});

test('archiveMilestone warns when active (unarchived) changes exist', () => {
  const tmpDir = makeTmp();
  try {
    const activeChange = path.join(tmpDir, '.planning', 'changes', 'add-thing');
    fs.mkdirSync(activeChange, { recursive: true });
    fs.writeFileSync(path.join(activeChange, 'proposal.md'), '# p', 'utf8');

    const result = milestone.archiveMilestone(tmpDir, 'v1.0');
    assert.strictEqual(result.success, true);
    assert.ok(result.warnings.some(w => w.includes('active') && w.includes('add-thing')),
      'should warn about active change');
  } finally {
    cleanTmp(tmpDir);
  }
});

test('archiveMilestone does NOT warn about archive/ subdir masquerading as active change', () => {
  const tmpDir = makeTmp();
  try {
    const archivedOnly = path.join(tmpDir, '.planning', 'changes', 'archive', '2026-01-01-x');
    fs.mkdirSync(archivedOnly, { recursive: true });

    const result = milestone.archiveMilestone(tmpDir, 'v1.0');
    assert.ok(!result.warnings.some(w => w.includes('active')),
      'archive/ subdir should not count as active change');
  } finally {
    cleanTmp(tmpDir);
  }
});

test('resetForNewMilestone preserves specs/ (规格跨里程碑保留)', () => {
  const tmpDir = makeTmp();
  try {
    const specPath = path.join(tmpDir, '.planning', 'specs', 'auth', 'spec.md');
    fs.mkdirSync(path.dirname(specPath), { recursive: true });
    fs.writeFileSync(specPath, '# Auth\n## Purpose\nx\n', 'utf8');

    milestone.resetForNewMilestone(tmpDir);
    assert.ok(fs.existsSync(specPath), 'specs/ should survive milestone reset');
  } finally {
    cleanTmp(tmpDir);
  }
});
