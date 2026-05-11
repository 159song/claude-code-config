'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const spec = require('./spec.cjs');

// Helpers ------------------------------------------------------

function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-spec-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'specs'), { recursive: true });
  return tmpDir;
}

function writeSpec(cwd, capability, content) {
  const dir = path.join(cwd, '.planning', 'specs', capability);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'spec.md'), content, 'utf8');
}

function cleanupTemp(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

const GOOD_SPEC = `# Auth Specification

## Purpose

The system SHALL authenticate users via email and password.

## Requirements

### Requirement: User Login

The system SHALL accept valid email/password pairs and issue a session token.

#### Scenario: Valid credentials

- **WHEN** a user submits valid credentials
- **THEN** a session token is returned
- **AND** the user is redirected to /dashboard

#### Scenario: Invalid password

- **GIVEN** an existing user
- **WHEN** a wrong password is submitted
- **THEN** a 401 response is returned

### Requirement: Session Expiry

The system MUST invalidate sessions after 30 minutes of inactivity.

#### Scenario: Idle timeout

- **WHEN** 30 minutes pass without activity
- **THEN** the session is invalidated
`;

// parseSpec ---------------------------------------------------

test('parseSpec extracts purpose and requirements', () => {
  const parsed = spec.parseSpec(GOOD_SPEC);
  assert.ok(parsed.purpose.includes('authenticate users'));
  assert.strictEqual(parsed.requirements.length, 2);
  assert.strictEqual(parsed.requirements[0].name, 'User Login');
  assert.strictEqual(parsed.requirements[1].name, 'Session Expiry');
});

test('parseSpec extracts scenarios under each requirement', () => {
  const parsed = spec.parseSpec(GOOD_SPEC);
  assert.strictEqual(parsed.requirements[0].scenarios.length, 2);
  assert.strictEqual(parsed.requirements[0].scenarios[0].name, 'Valid credentials');
  assert.strictEqual(parsed.requirements[1].scenarios.length, 1);
});

test('parseSpec extracts WHEN/THEN/AND steps from scenario body', () => {
  const parsed = spec.parseSpec(GOOD_SPEC);
  const scenario = parsed.requirements[0].scenarios[0];
  const keywords = scenario.steps.map(s => s.keyword);
  assert.ok(keywords.includes('WHEN'));
  assert.ok(keywords.includes('THEN'));
  assert.ok(keywords.includes('AND'));
});

test('parseSpec handles steps without markdown bold', () => {
  const content = `## Purpose\nx\n## Requirements\n### Requirement: R\nbody\n#### Scenario: S\n- WHEN foo\n- THEN bar\n`;
  const parsed = spec.parseSpec(content);
  const steps = parsed.requirements[0].scenarios[0].steps;
  assert.strictEqual(steps.length, 2);
  assert.strictEqual(steps[0].keyword, 'WHEN');
  assert.strictEqual(steps[1].keyword, 'THEN');
});

test('parseSpec returns empty structure for empty input', () => {
  const parsed = spec.parseSpec('');
  assert.strictEqual(parsed.purpose, '');
  assert.deepStrictEqual(parsed.requirements, []);
});

// listSpecs ---------------------------------------------------

test('listSpecs returns empty when specs/ absent', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-spec-empty-'));
  try {
    const result = spec.listSpecs(tmpDir);
    assert.deepStrictEqual(result, { capabilities: [] });
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('listSpecs reports each capability with counts', () => {
  const tmpDir = createTempProject();
  try {
    writeSpec(tmpDir, 'auth', GOOD_SPEC);
    writeSpec(tmpDir, 'payments', `# Payments\n## Purpose\nx\n## Requirements\n### Requirement: Charge\nbody\n#### Scenario: ok\n- WHEN x\n- THEN y\n`);
    const result = spec.listSpecs(tmpDir);
    assert.strictEqual(result.capabilities.length, 2);
    const auth = result.capabilities.find(c => c.capability === 'auth');
    assert.strictEqual(auth.requirement_count, 2);
    assert.strictEqual(auth.scenario_count, 3);
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('listSpecs skips directories with invalid kebab-case names', () => {
  const tmpDir = createTempProject();
  try {
    writeSpec(tmpDir, 'Auth_System', GOOD_SPEC); // bad
    writeSpec(tmpDir, 'auth', GOOD_SPEC);        // good
    const result = spec.listSpecs(tmpDir);
    assert.strictEqual(result.capabilities.length, 1);
    assert.strictEqual(result.capabilities[0].capability, 'auth');
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('listSpecs skips capability dir without spec.md', () => {
  const tmpDir = createTempProject();
  try {
    fs.mkdirSync(path.join(tmpDir, '.planning', 'specs', 'orphan'), { recursive: true });
    writeSpec(tmpDir, 'auth', GOOD_SPEC);
    const result = spec.listSpecs(tmpDir);
    assert.strictEqual(result.capabilities.length, 1);
    assert.strictEqual(result.capabilities[0].capability, 'auth');
  } finally {
    cleanupTemp(tmpDir);
  }
});

// showSpec ----------------------------------------------------

test('showSpec returns parsed structure for valid capability', () => {
  const tmpDir = createTempProject();
  try {
    writeSpec(tmpDir, 'auth', GOOD_SPEC);
    const result = spec.showSpec(tmpDir, 'auth');
    assert.strictEqual(result.capability, 'auth');
    assert.strictEqual(result.requirements.length, 2);
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('showSpec returns error for missing capability', () => {
  const tmpDir = createTempProject();
  try {
    const result = spec.showSpec(tmpDir, 'nonexistent');
    assert.ok(result.error);
    assert.ok(result.error.includes('not found'));
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('showSpec rejects invalid capability name', () => {
  const result = spec.showSpec('/tmp', 'Bad_Name');
  assert.ok(result.error.includes('invalid capability'));
});

test('showSpec requires capability argument', () => {
  const result = spec.showSpec('/tmp', '');
  assert.ok(result.error.includes('required'));
});

// validateOne -------------------------------------------------

test('validateOne passes on well-formed spec', () => {
  const tmpDir = createTempProject();
  try {
    writeSpec(tmpDir, 'auth', GOOD_SPEC);
    const result = spec.validateOne(tmpDir, 'auth');
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.issues.length, 0);
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateOne fails when Purpose missing', () => {
  const tmpDir = createTempProject();
  try {
    writeSpec(tmpDir, 'auth', `# Spec\n## Requirements\n### Requirement: R\nbody\n#### Scenario: S\n- WHEN x\n- THEN y\n`);
    const result = spec.validateOne(tmpDir, 'auth');
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.message.includes('Purpose')));
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateOne fails when no requirements', () => {
  const tmpDir = createTempProject();
  try {
    writeSpec(tmpDir, 'auth', `# Spec\n## Purpose\nx\n## Requirements\n`);
    const result = spec.validateOne(tmpDir, 'auth');
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.message.includes('no ### Requirement')));
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateOne flags requirement without scenario when require_scenarios=true', () => {
  const tmpDir = createTempProject();
  try {
    writeSpec(tmpDir, 'auth', `# Spec\n## Purpose\nx\n## Requirements\n### Requirement: R\nbody\n`);
    const result = spec.validateOne(tmpDir, 'auth');
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.message.includes('no #### Scenario')));
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateOne allows scenario-less requirement when require_scenarios=false', () => {
  const tmpDir = createTempProject();
  try {
    writeSpec(tmpDir, 'auth', `# Spec\n## Purpose\nx\n## Requirements\n### Requirement: R\nsome body text\n`);
    const result = spec.validateOne(tmpDir, 'auth', { requireScenarios: false });
    assert.strictEqual(result.valid, true);
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateOne detects duplicate requirement names', () => {
  const tmpDir = createTempProject();
  try {
    writeSpec(tmpDir, 'auth', `# Spec
## Purpose
x
## Requirements
### Requirement: Login
body1
#### Scenario: a
- WHEN x
- THEN y
### Requirement: Login
body2
#### Scenario: b
- WHEN x
- THEN y
`);
    const result = spec.validateOne(tmpDir, 'auth');
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.message.includes('duplicate requirement')));
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateOne detects scenario missing WHEN or THEN', () => {
  const tmpDir = createTempProject();
  try {
    writeSpec(tmpDir, 'auth', `# Spec
## Purpose
x
## Requirements
### Requirement: R
body
#### Scenario: broken
- **GIVEN** a state
- **AND** something else
`);
    const result = spec.validateOne(tmpDir, 'auth');
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.message.includes('missing WHEN')));
    assert.ok(result.issues.some(i => i.message.includes('missing THEN')));
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateOne fails on invalid capability name', () => {
  const result = spec.validateOne('/tmp', 'Bad_Name');
  assert.strictEqual(result.valid, false);
  assert.ok(result.issues[0].message.includes('kebab-case'));
});

test('validateOne fails when spec.md absent', () => {
  const tmpDir = createTempProject();
  try {
    const result = spec.validateOne(tmpDir, 'ghost');
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.message.includes('not found')));
  } finally {
    cleanupTemp(tmpDir);
  }
});

// validateAll -------------------------------------------------

test('validateAll returns valid when specs/ missing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-spec-noroot-'));
  try {
    const result = spec.validateAll(tmpDir);
    assert.strictEqual(result.valid, true);
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateAll aggregates issues across capabilities', () => {
  const tmpDir = createTempProject();
  try {
    writeSpec(tmpDir, 'good', GOOD_SPEC);
    writeSpec(tmpDir, 'bad', `# Spec\n## Requirements\n`);
    const result = spec.validateAll(tmpDir);
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.total, 2);
    const bad = result.capabilities.find(c => c.capability === 'bad');
    assert.ok(bad.issues.length > 0);
  } finally {
    cleanupTemp(tmpDir);
  }
});

test('validateAll flags capability dir with invalid kebab-case name', () => {
  const tmpDir = createTempProject();
  try {
    writeSpec(tmpDir, 'Bad_Name', GOOD_SPEC);
    const result = spec.validateAll(tmpDir);
    assert.strictEqual(result.valid, false);
    const bad = result.capabilities.find(c => c.capability === 'Bad_Name');
    assert.ok(bad.issues.some(i => i.message.includes('kebab-case')));
  } finally {
    cleanupTemp(tmpDir);
  }
});

// ============================================================
// Phase D-3: coverageQuery (reverse traceability)
// ============================================================

test('coverageQuery requires a non-empty query', () => {
  const result = spec.coverageQuery('/tmp', '');
  assert.ok(result.error.includes('required'));
});

test('coverageQuery finds FR-N in REQUIREMENTS.md with word-boundary matching', () => {
  const tmp = createTempProject();
  try {
    const fs2 = require('fs');
    const pth = require('path');
    fs2.writeFileSync(pth.join(tmp, '.planning', 'REQUIREMENTS.md'),
      '- FR-01: user login\n- FR-10: admin panel\n', 'utf8');
    const r = spec.coverageQuery(tmp, 'FR-01');
    assert.ok(r.traces.some(t => t.source === 'REQUIREMENTS.md' && t.detail.text.includes('FR-01')));
    assert.ok(!r.traces.some(t => t.source === 'REQUIREMENTS.md' && t.detail.text.includes('FR-10')),
      'FR-01 should NOT match FR-10 (word boundary)');
  } finally { cleanupTemp(tmp); }
});

test('coverageQuery finds requirement by header in specs/', () => {
  const tmp = createTempProject();
  try {
    writeSpec(tmp, 'auth', GOOD_SPEC);
    const r = spec.coverageQuery(tmp, 'User Login');
    assert.ok(r.traces.some(t => t.source === 'specs/<capability>' && t.detail.requirement === 'User Login'));
  } finally { cleanupTemp(tmp); }
});

test('coverageQuery finds capability by name in specs/', () => {
  const tmp = createTempProject();
  try {
    writeSpec(tmp, 'auth', GOOD_SPEC);
    const r = spec.coverageQuery(tmp, 'auth');
    assert.ok(r.traces.some(t => t.source === 'specs/<capability>' && t.detail.match === 'capability name'));
  } finally { cleanupTemp(tmp); }
});

test('coverageQuery scans phase-N PLAN/SUMMARY files', () => {
  const tmp = createTempProject();
  try {
    const fs2 = require('fs');
    const pth = require('path');
    const phaseDir = pth.join(tmp, '.planning', 'phase-1');
    fs2.mkdirSync(phaseDir, { recursive: true });
    fs2.writeFileSync(pth.join(phaseDir, 'PLAN.md'), 'task covers FR-01 via src/auth.ts\n', 'utf8');
    fs2.writeFileSync(pth.join(phaseDir, 'SUMMARY.md'), 'completed FR-01\n', 'utf8');
    const r = spec.coverageQuery(tmp, 'FR-01');
    const phaseTraces = r.traces.filter(t => t.source === 'phase');
    assert.ok(phaseTraces.length >= 2, 'should hit both PLAN and SUMMARY');
  } finally { cleanupTemp(tmp); }
});

test('coverageQuery picks up active changes and archived changes separately', () => {
  const tmp = createTempProject();
  try {
    const fs2 = require('fs');
    const pth = require('path');

    // active change referencing the requirement
    const activeDir = pth.join(tmp, '.planning', 'changes', 'add-oauth', 'specs', 'auth');
    fs2.mkdirSync(activeDir, { recursive: true });
    fs2.writeFileSync(pth.join(activeDir, 'spec.md'),
      '## MODIFIED Requirements\n### Requirement: User Login\nnew body\n', 'utf8');

    // archived change referencing it
    const archDir = pth.join(tmp, '.planning', 'changes', 'archive', '2026-01-01-old', 'specs', 'auth');
    fs2.mkdirSync(archDir, { recursive: true });
    fs2.writeFileSync(pth.join(archDir, 'spec.md'),
      '## ADDED Requirements\n### Requirement: User Login\n...\n', 'utf8');

    const r = spec.coverageQuery(tmp, 'User Login');
    assert.ok(r.traces.some(t => t.source === 'changes' && t.detail.change_id === 'add-oauth'));
    assert.ok(r.traces.some(t => t.source === 'changes/archive' && t.detail.change_id === '2026-01-01-old'));
  } finally { cleanupTemp(tmp); }
});

test('coverageQuery returns empty traces for unknown query', () => {
  const tmp = createTempProject();
  try {
    const r = spec.coverageQuery(tmp, 'NonexistentThing');
    assert.strictEqual(r.total, 0);
    assert.ok(Array.isArray(r.traces));
  } finally { cleanupTemp(tmp); }
});

test('coverageQuery returns error when .planning/ absent', () => {
  const fs2 = require('fs');
  const os2 = require('os');
  const pth = require('path');
  const tmp = fs2.mkdtempSync(pth.join(os2.tmpdir(), 'wf-cov-bare-'));
  try {
    const r = spec.coverageQuery(tmp, 'anything');
    assert.ok(r.error && r.error.includes('.planning/'));
  } finally { cleanupTemp(tmp); }
});
