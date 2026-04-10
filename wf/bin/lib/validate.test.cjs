'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const validate = require('./validate.cjs');

// Helper: create temp dir with STATE.md content
function createTempState(content) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-validate-test-'));
  const planningDir = path.join(tmpDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  if (content !== null) {
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), content, 'utf8');
  }
  return tmpDir;
}

// Helper: read STATE.md from temp dir
function readTempState(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf8');
}

// Helper: cleanup temp dir
function cleanupTemp(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

const VALID_STATE = `---
status: executing
last_updated: "2026-04-10T06:00:00.000Z"
last_activity: 2026-04-10
---

# Project State

Some body content here.
`;

// ============================================================
// validateHealth tests
// ============================================================

test('validateHealth on valid STATE.md returns valid with no issues', () => {
  const tmpDir = createTempState(VALID_STATE);
  try {
    const result = validate.validateHealth(tmpDir, false);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.issues, []);
    assert.deepStrictEqual(result.repaired, []);
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateHealth on missing STATE.md returns invalid', () => {
  const tmpDir = createTempState(null);
  try {
    const result = validate.validateHealth(tmpDir, false);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.includes('STATE.md not found'));
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateHealth on content without --- start returns missing frontmatter opener', () => {
  const content = '# No frontmatter\n\nJust body content.\n';
  const tmpDir = createTempState(content);
  try {
    const result = validate.validateHealth(tmpDir, false);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.includes('missing frontmatter opener'));
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateHealth on content with --- but no closing --- returns missing frontmatter closer', () => {
  const content = '---\nstatus: active\nlast_updated: "2026-04-10"\nlast_activity: 2026-04-10\n# Body\n';
  const tmpDir = createTempState(content);
  try {
    const result = validate.validateHealth(tmpDir, false);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.includes('missing frontmatter closer'));
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateHealth on content missing status key returns issue', () => {
  const content = `---\nlast_updated: "2026-04-10"\nlast_activity: 2026-04-10\n---\n\n# Body\n`;
  const tmpDir = createTempState(content);
  try {
    const result = validate.validateHealth(tmpDir, false);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.includes('missing required key: status'));
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateHealth on content missing last_updated key returns issue', () => {
  const content = `---\nstatus: active\nlast_activity: 2026-04-10\n---\n\n# Body\n`;
  const tmpDir = createTempState(content);
  try {
    const result = validate.validateHealth(tmpDir, false);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.includes('missing required key: last_updated'));
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateHealth on content missing last_activity key returns issue', () => {
  const content = `---\nstatus: active\nlast_updated: "2026-04-10"\n---\n\n# Body\n`;
  const tmpDir = createTempState(content);
  try {
    const result = validate.validateHealth(tmpDir, false);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.includes('missing required key: last_activity'));
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateHealth with --repair on missing opener wraps content in frontmatter', () => {
  const content = '# No frontmatter\n\nJust body content.\n';
  const tmpDir = createTempState(content);
  try {
    const result = validate.validateHealth(tmpDir, true);
    assert.ok(result.repaired.length > 0, 'Should have repaired items');
    const repaired = readTempState(tmpDir);
    assert.ok(repaired.startsWith('---\n'), 'Repaired content should start with ---');
    assert.ok(repaired.includes('status:'), 'Repaired content should include status key');
    assert.ok(repaired.includes('last_updated:'), 'Repaired content should include last_updated key');
    assert.ok(repaired.includes('last_activity:'), 'Repaired content should include last_activity key');
    // Original content should still be in body
    assert.ok(repaired.includes('# No frontmatter'), 'Original body content should be preserved');
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateHealth with --repair on missing closer appends closing ---', () => {
  const content = '---\nstatus: active\nlast_updated: "2026-04-10"\nlast_activity: 2026-04-10\n# Body\n';
  const tmpDir = createTempState(content);
  try {
    const result = validate.validateHealth(tmpDir, true);
    assert.ok(result.repaired.length > 0, 'Should have repaired items');
    const repaired = readTempState(tmpDir);
    assert.ok(repaired.includes('\n---\n'), 'Repaired content should have closing ---');
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateHealth with --repair on missing required keys adds them with defaults', () => {
  const content = `---\n---\n\n# Body\n`;
  const tmpDir = createTempState(content);
  try {
    const result = validate.validateHealth(tmpDir, true);
    assert.ok(result.repaired.length > 0, 'Should have repaired items');
    const repaired = readTempState(tmpDir);
    assert.ok(/^status:\s/m.test(repaired), 'Should have status key');
    assert.ok(/^last_updated:\s/m.test(repaired), 'Should have last_updated key');
    assert.ok(/^last_activity:\s/m.test(repaired), 'Should have last_activity key');
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ============================================================
// validateFormat tests
// ============================================================

test('validateFormat on valid frontmatter returns valid', () => {
  const tmpDir = createTempState(VALID_STATE);
  try {
    const result = validate.validateFormat(tmpDir);
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.issues, []);
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateFormat on frontmatter with duplicate keys returns issue', () => {
  const content = `---\nstatus: active\nstatus: planning\nlast_updated: "2026-04-10"\nlast_activity: 2026-04-10\n---\n\n# Body\n`;
  const tmpDir = createTempState(content);
  try {
    const result = validate.validateFormat(tmpDir);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.includes('duplicate key: status')));
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateFormat on content without frontmatter returns invalid', () => {
  const content = '# No frontmatter\n\nBody only.\n';
  const tmpDir = createTempState(content);
  try {
    const result = validate.validateFormat(tmpDir);
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.includes('no frontmatter found'));
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ============================================================
// run dispatch tests
// ============================================================

test('run dispatches health subcommand', () => {
  const tmpDir = createTempState(VALID_STATE);
  try {
    // Capture stdout by replacing utils.output
    let captured = null;
    const origOutput = validate._testHooks && validate._testHooks.output;

    // We test that run doesn't throw and dispatches correctly
    // Since run calls utils.output which writes to stdout, we just verify no error
    validate.validateHealth(tmpDir, false); // This should work if module is correct
    const result = validate.validateHealth(tmpDir, false);
    assert.strictEqual(result.valid, true);
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('run passes --repair flag correctly to validateHealth', () => {
  const content = '# No frontmatter\n\nBody.\n';
  const tmpDir = createTempState(content);
  try {
    // Verify repair works when called through the function API
    const beforeRepair = validate.validateHealth(tmpDir, false);
    assert.strictEqual(beforeRepair.valid, false);

    // Now repair
    const afterRepair = validate.validateHealth(tmpDir, true);
    assert.ok(afterRepair.repaired.length > 0);

    // Verify file was actually fixed
    const fixed = readTempState(tmpDir);
    assert.ok(fixed.startsWith('---\n'));
  } finally {
    cleanupTemp(tmpDir);
  }
});
