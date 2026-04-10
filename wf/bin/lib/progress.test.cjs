'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const progress = require('./progress.cjs');

// Helper: create temp directory structure simulating a project with phases
function createTempProject(phases) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-progress-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  // Create ROADMAP.md with phase entries
  let roadmapContent = '# Roadmap\n\n';
  for (const p of phases) {
    roadmapContent += `### Phase ${p.num}: ${p.name}\n\n`;
    if (p.files) {
      const phaseDir = path.join(planningDir, 'phases', p.dirName);
      fs.mkdirSync(phaseDir, { recursive: true });
      for (const [fileName, content] of Object.entries(p.files)) {
        fs.writeFileSync(path.join(phaseDir, fileName), content, 'utf8');
      }
    }
  }
  fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), roadmapContent, 'utf8');

  return tmpDir;
}

// --- Test: Phase with VERIFICATION.md containing PASS counts as 4/4 (100%) ---

test('calculateProgress counts phase with VERIFICATION.md containing PASS as 4/4 steps (100%)', () => {
  const tmpDir = createTempProject([{
    num: 1,
    name: 'Test Phase',
    dirName: '01-test',
    files: {
      '01-CONTEXT.md': '# Context',
      '01-01-PLAN.md': '# Plan',
      '01-01-SUMMARY.md': '# Summary',
      '01-VERIFICATION.md': 'Overall: PASS (5/5)',
    },
  }]);
  try {
    const result = progress.calculateProgress(tmpDir);
    assert.strictEqual(result.phases.length, 1);
    assert.strictEqual(result.phases[0].progress, 100);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- Test: Phase with VERIFICATION.md containing FAIL counts as 3/4 (75%) ---

test('calculateProgress counts phase with VERIFICATION.md containing FAIL as 3/4 steps (75%)', () => {
  const tmpDir = createTempProject([{
    num: 1,
    name: 'Test Phase',
    dirName: '01-test',
    files: {
      '01-CONTEXT.md': '# Context',
      '01-01-PLAN.md': '# Plan',
      '01-01-SUMMARY.md': '# Summary',
      '01-VERIFICATION.md': 'Overall: FAIL (3/5)',
    },
  }]);
  try {
    const result = progress.calculateProgress(tmpDir);
    assert.strictEqual(result.phases.length, 1);
    // has_verification is true but content says FAIL -- should NOT count verification step
    assert.strictEqual(result.phases[0].progress, 75);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- Test: Phase with no VERIFICATION.md counts based on other artifacts ---

test('calculateProgress counts phase with no VERIFICATION.md based on context/plans/summaries', () => {
  const tmpDir = createTempProject([{
    num: 1,
    name: 'Test Phase',
    dirName: '01-test',
    files: {
      '01-CONTEXT.md': '# Context',
      '01-01-PLAN.md': '# Plan',
    },
  }]);
  try {
    const result = progress.calculateProgress(tmpDir);
    assert.strictEqual(result.phases.length, 1);
    // context + plans = 2/4 = 50%
    assert.strictEqual(result.phases[0].progress, 50);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- Test: VERIFICATION.md with PASS embedded in longer text ---

test('calculateProgress counts VERIFICATION.md containing "Overall: PASS (14/14)" as passed', () => {
  const tmpDir = createTempProject([{
    num: 1,
    name: 'Test Phase',
    dirName: '01-test',
    files: {
      '01-CONTEXT.md': '# Context',
      '01-01-PLAN.md': '# Plan',
      '01-01-SUMMARY.md': '# Summary',
      '01-VERIFICATION.md': '# Verification Report\n\n## Results\n\nOverall: PASS (14/14)\n\nAll checks passed.',
    },
  }]);
  try {
    const result = progress.calculateProgress(tmpDir);
    assert.strictEqual(result.phases.length, 1);
    assert.strictEqual(result.phases[0].progress, 100);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- Test: progress module exports ---

test('progress module exports calculateProgress and run', () => {
  assert.strictEqual(typeof progress.calculateProgress, 'function');
  assert.strictEqual(typeof progress.run, 'function');
});
