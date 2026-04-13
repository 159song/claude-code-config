'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const review = require('./review.cjs');

// Helper: create temp dir simulating a project with .planning/
function makeTmp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-review-test-'));
  const planningDir = path.join(tmpDir, '.planning', 'phases', '01-test-phase');
  fs.mkdirSync(planningDir, { recursive: true });
  return tmpDir;
}

function cleanTmp(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// Helper: write a SUMMARY.md with key_files section
function writeSummary(tmpDir, phaseSlug, planNum, files) {
  const summaryPath = path.join(
    tmpDir, '.planning', 'phases', phaseSlug,
    `01-${String(planNum).padStart(2, '0')}-SUMMARY.md`
  );
  const lines = ['---', 'phase: 01', '---', '', '# Summary', '', '## 变更文件', ''];
  for (const f of files) {
    lines.push(`- \`${f}\``);
  }
  lines.push('');
  fs.writeFileSync(summaryPath, lines.join('\n'), 'utf8');
}

// Helper: write a REVIEW.md with frontmatter
function writeReview(tmpDir, frontmatter) {
  const reviewPath = path.join(tmpDir, 'REVIEW.md');
  const lines = ['---'];
  for (const [k, v] of Object.entries(frontmatter)) {
    if (typeof v === 'object' && v !== null) {
      lines.push(`${k}:`);
      for (const [sk, sv] of Object.entries(v)) {
        lines.push(`  ${sk}: ${sv}`);
      }
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push('# Review');
  fs.writeFileSync(reviewPath, lines.join('\n'), 'utf8');
  return reviewPath;
}

// ============================================================
// computeFileScope tests
// ============================================================

test('computeFileScope with --files override returns files with tier "--files"', () => {
  const tmpDir = makeTmp();
  // Create files so they exist
  const testFile = path.join(tmpDir, 'src', 'app.js');
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.writeFileSync(testFile, '// app', 'utf8');
  try {
    const result = review.computeFileScope(tmpDir, null, '01', ['src/app.js']);
    assert.deepStrictEqual(result.files, ['src/app.js']);
    assert.strictEqual(result.tier, '--files');
  } finally {
    cleanTmp(tmpDir);
  }
});

test('computeFileScope rejects path traversal in --files', () => {
  const tmpDir = makeTmp();
  try {
    const result = review.computeFileScope(tmpDir, null, '01', ['../../../etc/passwd']);
    // Traversal path should be rejected (not in result.files)
    assert.ok(!result.files.includes('../../../etc/passwd'));
    assert.strictEqual(result.files.length, 0);
  } finally {
    cleanTmp(tmpDir);
  }
});

test('computeFileScope reads SUMMARY.md key_files when no --files', () => {
  const tmpDir = makeTmp();
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test-phase');
  // Create a source file so it passes filter
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'src', 'index.js'), '// hi', 'utf8');
  writeSummary(tmpDir, '01-test-phase', 1, ['src/index.js']);
  try {
    const result = review.computeFileScope(tmpDir, phaseDir, '01', null);
    assert.ok(result.files.includes('src/index.js'));
    assert.strictEqual(result.tier, 'SUMMARY.md');
  } finally {
    cleanTmp(tmpDir);
  }
});

test('computeFileScope falls back to git diff when no SUMMARY key_files', () => {
  const tmpDir = makeTmp();
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test-phase');
  try {
    // No SUMMARY.md, no git — should fall to empty or git diff
    const result = review.computeFileScope(tmpDir, phaseDir, '01', null);
    assert.ok(result.tier === 'git diff' || result.tier === 'empty');
    assert.ok(Array.isArray(result.files));
  } finally {
    cleanTmp(tmpDir);
  }
});

// ============================================================
// extractKeyFilesFromSummaries tests
// ============================================================

test('extractKeyFilesFromSummaries extracts files from SUMMARY.md', () => {
  const tmpDir = makeTmp();
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test-phase');
  writeSummary(tmpDir, '01-test-phase', 1, ['src/a.js', 'src/b.ts']);
  writeSummary(tmpDir, '01-test-phase', 2, ['src/b.ts', 'src/c.cjs']);
  try {
    const files = review.extractKeyFilesFromSummaries(phaseDir);
    assert.ok(files.includes('src/a.js'));
    assert.ok(files.includes('src/b.ts'));
    assert.ok(files.includes('src/c.cjs'));
    // Deduplication: b.ts appears once
    assert.strictEqual(files.filter(f => f === 'src/b.ts').length, 1);
  } finally {
    cleanTmp(tmpDir);
  }
});

// ============================================================
// filterReviewFiles tests
// ============================================================

test('filterReviewFiles excludes planning .md, .env, node_modules, binary extensions', () => {
  const tmpDir = makeTmp();
  try {
    const input = [
      'src/app.js',
      '.planning/STATE.md',
      '.env',
      '.env.local',
      'node_modules/foo/bar.js',
      'assets/logo.png',
      'assets/icon.ico',
      'package-lock.json',
      'src/style.css',
      'docs/README.md',
    ];
    const result = review.filterReviewFiles(tmpDir, input);
    assert.ok(result.includes('src/app.js'));
    assert.ok(result.includes('src/style.css'));
    // .md outside .planning/ should be kept
    assert.ok(result.includes('docs/README.md'));
    // These should be excluded
    assert.ok(!result.includes('.planning/STATE.md'));
    assert.ok(!result.includes('.env'));
    assert.ok(!result.includes('.env.local'));
    assert.ok(!result.includes('node_modules/foo/bar.js'));
    assert.ok(!result.includes('assets/logo.png'));
    assert.ok(!result.includes('assets/icon.ico'));
  } finally {
    cleanTmp(tmpDir);
  }
});

// ============================================================
// parseReviewFrontmatter tests
// ============================================================

test('parseReviewFrontmatter extracts status, depth, findings from REVIEW.md', () => {
  const tmpDir = makeTmp();
  const reviewPath = writeReview(tmpDir, {
    status: 'issues_found',
    depth: 'standard',
    phase: 1,
    files_reviewed: 5,
    findings: { critical: 0, high: 2, medium: 3, low: 1, total: 6 },
    iteration: 1,
  });
  try {
    const result = review.parseReviewFrontmatter(reviewPath);
    assert.ok(result !== null);
    assert.strictEqual(result.status, 'issues_found');
    assert.strictEqual(result.depth, 'standard');
    assert.strictEqual(result.findings.high, 2);
    assert.strictEqual(result.findings.total, 6);
    assert.strictEqual(result.iteration, 1);
  } finally {
    cleanTmp(tmpDir);
  }
});

test('parseReviewFrontmatter returns null for malformed frontmatter', () => {
  const tmpDir = makeTmp();
  const badPath = path.join(tmpDir, 'bad-review.md');
  fs.writeFileSync(badPath, 'No frontmatter here\nJust regular text\n', 'utf8');
  try {
    const result = review.parseReviewFrontmatter(badPath);
    assert.strictEqual(result, null);
  } finally {
    cleanTmp(tmpDir);
  }
});

test('parseReviewFrontmatter returns null for non-existent file', () => {
  const result = review.parseReviewFrontmatter('/tmp/does-not-exist-review.md');
  assert.strictEqual(result, null);
});

// ============================================================
// run dispatch tests
// ============================================================

test('run scope subcommand outputs JSON with files and tier', () => {
  const tmpDir = makeTmp();
  const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test-phase');
  fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'src', 'main.js'), '// main', 'utf8');
  writeSummary(tmpDir, '01-test-phase', 1, ['src/main.js']);
  const origWriteSync = fs.writeSync;
  let captured = '';
  fs.writeSync = (fd, data) => { if (fd === 1) captured += data; else origWriteSync(fd, data); };
  try {
    review.run(tmpDir, ['scope', '1']);
  } finally {
    fs.writeSync = origWriteSync;
  }
  const output = JSON.parse(captured);
  assert.ok(Array.isArray(output.files));
  assert.ok(typeof output.tier === 'string');
  cleanTmp(tmpDir);
});

test('run parse subcommand outputs parsed frontmatter JSON', () => {
  const tmpDir = makeTmp();
  const reviewPath = writeReview(tmpDir, {
    status: 'clean',
    depth: 'quick',
    phase: 2,
    files_reviewed: 3,
    findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
    iteration: 1,
  });
  const origWriteSync = fs.writeSync;
  let captured = '';
  fs.writeSync = (fd, data) => { if (fd === 1) captured += data; else origWriteSync(fd, data); };
  try {
    review.run(tmpDir, ['parse', reviewPath]);
  } finally {
    fs.writeSync = origWriteSync;
  }
  const output = JSON.parse(captured);
  assert.strictEqual(output.status, 'clean');
  cleanTmp(tmpDir);
});
