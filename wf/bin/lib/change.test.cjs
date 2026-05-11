'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const change = require('./change.cjs');

// Helpers ------------------------------------------------------

function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-change-test-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'specs'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.planning', 'changes'), { recursive: true });
  return tmpDir;
}

function writeMasterSpec(cwd, cap, content) {
  const dir = path.join(cwd, '.planning', 'specs', cap);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'spec.md'), content, 'utf8');
}

function writeChangeFile(cwd, id, relPath, content) {
  const full = path.join(cwd, '.planning', 'changes', id, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

const MASTER_SPEC = `# Auth Specification

## Purpose

The system SHALL authenticate users via email and password.

## Requirements

### Requirement: User Login

The system SHALL accept valid credentials.

#### Scenario: valid credentials
- **WHEN** a user submits valid credentials
- **THEN** a token is issued

### Requirement: Session Expiry

The system MUST expire idle sessions.

#### Scenario: idle timeout
- **WHEN** 30 minutes pass idle
- **THEN** the session is invalidated
`;

// splitRequirements -------------------------------------------

test('splitRequirements extracts named requirement blocks', () => {
  const result = change.splitRequirements(MASTER_SPEC);
  assert.strictEqual(result.requirements.length, 2);
  assert.strictEqual(result.requirements[0].name, 'User Login');
  assert.strictEqual(result.requirements[1].name, 'Session Expiry');
  assert.ok(result.preamble.includes('## Purpose'));
});

test('splitRequirements handles empty input', () => {
  const result = change.splitRequirements('');
  assert.strictEqual(result.requirements.length, 0);
});

// parseDelta --------------------------------------------------

test('parseDelta extracts ADDED requirements', () => {
  const delta = change.parseDelta(`## ADDED Requirements

### Requirement: Password Reset
body
#### Scenario: s
- WHEN x
- THEN y
`);
  assert.strictEqual(delta.added.length, 1);
  assert.strictEqual(delta.added[0].name, 'Password Reset');
});

test('parseDelta extracts MODIFIED requirements', () => {
  const delta = change.parseDelta(`## MODIFIED Requirements

### Requirement: User Login
new body
#### Scenario: new
- WHEN x
- THEN y
`);
  assert.strictEqual(delta.modified.length, 1);
  assert.strictEqual(delta.modified[0].name, 'User Login');
});

test('parseDelta extracts REMOVED requirements', () => {
  const delta = change.parseDelta(`## REMOVED Requirements

### Requirement: Obsolete Feature
reason: deprecated
`);
  assert.strictEqual(delta.removed.length, 1);
  assert.strictEqual(delta.removed[0].name, 'Obsolete Feature');
});

test('parseDelta extracts RENAMED requirements with From line', () => {
  const delta = change.parseDelta(`## RENAMED Requirements

### Requirement: User Authentication

- From: User Login

new body describing the renamed requirement.
`);
  assert.strictEqual(delta.renamed.length, 1);
  assert.strictEqual(delta.renamed[0].name, 'User Authentication');
  assert.strictEqual(delta.renamed[0].from, 'User Login');
});

test('parseDelta combines multiple sections', () => {
  const delta = change.parseDelta(`## ADDED Requirements

### Requirement: A
body
#### Scenario: s
- WHEN x
- THEN y

## REMOVED Requirements

### Requirement: B
reason
`);
  assert.strictEqual(delta.added.length, 1);
  assert.strictEqual(delta.removed.length, 1);
});

test('parseDelta returns empty arrays for empty input', () => {
  const delta = change.parseDelta('');
  assert.strictEqual(delta.added.length, 0);
  assert.strictEqual(delta.modified.length, 0);
  assert.strictEqual(delta.removed.length, 0);
  assert.strictEqual(delta.renamed.length, 0);
});

// validateDelta -----------------------------------------------

test('validateDelta flags empty delta', () => {
  const issues = change.validateDelta(change.parseDelta(''));
  assert.ok(issues.some(i => i.message.includes('no ADDED')));
});

test('validateDelta flags RENAMED missing From', () => {
  const delta = change.parseDelta(`## RENAMED Requirements

### Requirement: New Name

new body
`);
  const issues = change.validateDelta(delta);
  assert.ok(issues.some(i => i.message.includes('missing From line')));
});

test('validateDelta flags ADDED+MODIFIED conflict', () => {
  const delta = change.parseDelta(`## ADDED Requirements

### Requirement: X
body
#### Scenario: s
- WHEN x
- THEN y

## MODIFIED Requirements

### Requirement: X
new body
`);
  const issues = change.validateDelta(delta);
  assert.ok(issues.some(i => i.message.includes('both ADDED and MODIFIED')));
});

// applyDeltaToSpec -------------------------------------------

test('applyDeltaToSpec appends ADDED to master', () => {
  const delta = change.parseDelta(`## ADDED Requirements

### Requirement: Password Reset
body
#### Scenario: s
- WHEN x
- THEN y
`);
  const result = change.applyDeltaToSpec(MASTER_SPEC, delta, { capability: 'auth' });
  assert.ok(result.includes('### Requirement: User Login'));
  assert.ok(result.includes('### Requirement: Session Expiry'));
  assert.ok(result.includes('### Requirement: Password Reset'));
});

test('applyDeltaToSpec replaces MODIFIED block integrally', () => {
  const delta = change.parseDelta(`## MODIFIED Requirements

### Requirement: User Login

The system SHALL accept OAuth tokens in addition to email/password.

#### Scenario: oauth
- **WHEN** an OAuth token is submitted
- **THEN** a session is issued
`);
  const result = change.applyDeltaToSpec(MASTER_SPEC, delta);
  assert.ok(result.includes('OAuth tokens'));
  assert.ok(!result.includes('accept valid credentials'), 'old body should be gone');
  assert.ok(result.includes('Session Expiry'), 'other requirements untouched');
});

test('applyDeltaToSpec removes REMOVED requirement', () => {
  const delta = change.parseDelta(`## REMOVED Requirements

### Requirement: Session Expiry
removing
`);
  const result = change.applyDeltaToSpec(MASTER_SPEC, delta);
  assert.ok(!result.includes('### Requirement: Session Expiry'));
  assert.ok(result.includes('### Requirement: User Login'));
});

test('applyDeltaToSpec renames header when RENAMED has no body', () => {
  const delta = change.parseDelta(`## RENAMED Requirements

### Requirement: User Authentication

- From: User Login
`);
  const result = change.applyDeltaToSpec(MASTER_SPEC, delta);
  assert.ok(result.includes('### Requirement: User Authentication'));
  assert.ok(!result.includes('### Requirement: User Login'));
  assert.ok(result.includes('accept valid credentials'), 'body preserved');
});

test('applyDeltaToSpec replaces body when RENAMED has new body', () => {
  const delta = change.parseDelta(`## RENAMED Requirements

### Requirement: User Authentication

- From: User Login

Brand new body for the renamed requirement.

#### Scenario: new
- **WHEN** x
- **THEN** y
`);
  const result = change.applyDeltaToSpec(MASTER_SPEC, delta);
  assert.ok(result.includes('### Requirement: User Authentication'));
  assert.ok(result.includes('Brand new body'));
  assert.ok(!result.includes('accept valid credentials'));
});

test('applyDeltaToSpec throws when ADDED already exists', () => {
  const delta = change.parseDelta(`## ADDED Requirements

### Requirement: User Login
dup
#### Scenario: s
- WHEN x
- THEN y
`);
  assert.throws(() => change.applyDeltaToSpec(MASTER_SPEC, delta), /already exists/);
});

test('applyDeltaToSpec throws when MODIFIED target missing', () => {
  const delta = change.parseDelta(`## MODIFIED Requirements

### Requirement: Ghost
body
#### Scenario: s
- WHEN x
- THEN y
`);
  assert.throws(() => change.applyDeltaToSpec(MASTER_SPEC, delta), /not found/);
});

test('applyDeltaToSpec throws when REMOVED target missing', () => {
  const delta = change.parseDelta(`## REMOVED Requirements

### Requirement: Ghost
reason
`);
  assert.throws(() => change.applyDeltaToSpec(MASTER_SPEC, delta), /not found/);
});

test('applyDeltaToSpec throws when RENAMED target conflicts', () => {
  const delta = change.parseDelta(`## RENAMED Requirements

### Requirement: Session Expiry

- From: User Login
`);
  assert.throws(() => change.applyDeltaToSpec(MASTER_SPEC, delta), /already exists/);
});

test('applyDeltaToSpec allows creating new capability from null master when allowCreate', () => {
  const delta = change.parseDelta(`## ADDED Requirements

### Requirement: First Thing
body
#### Scenario: s
- WHEN x
- THEN y
`);
  const result = change.applyDeltaToSpec(null, delta, { capability: 'newcap', allowCreate: true });
  assert.ok(result.includes('### Requirement: First Thing'));
  assert.ok(result.includes('# newcap Specification'));
});

// listChanges / showChange -----------------------------------

test('listChanges returns empty when changes/ absent', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-change-none-'));
  try {
    const result = change.listChanges(tmp);
    assert.deepStrictEqual(result.changes, []);
  } finally { cleanup(tmp); }
});

test('listChanges lists active changes and ignores archive', () => {
  const tmp = createTempProject();
  try {
    writeChangeFile(tmp, 'add-feature-x', 'proposal.md', '# x');
    writeChangeFile(tmp, 'add-feature-x', 'tasks.md', '- [ ] 1');
    writeChangeFile(tmp, 'add-feature-x', 'specs/auth/spec.md', '## ADDED Requirements\n### Requirement: R\nbody\n#### Scenario: s\n- WHEN x\n- THEN y\n');
    fs.mkdirSync(path.join(tmp, '.planning', 'changes', 'archive', '2026-01-01-old'), { recursive: true });
    const result = change.listChanges(tmp);
    assert.strictEqual(result.changes.length, 1);
    assert.strictEqual(result.changes[0].id, 'add-feature-x');
    assert.strictEqual(result.changes[0].has_proposal, true);
    assert.strictEqual(result.changes[0].deltas.length, 1);
    assert.strictEqual(result.archived.length, 1);
  } finally { cleanup(tmp); }
});

test('showChange returns structured summary', () => {
  const tmp = createTempProject();
  try {
    writeChangeFile(tmp, 'x', 'proposal.md', '# p');
    writeChangeFile(tmp, 'x', 'tasks.md', '- [ ] t');
    writeChangeFile(tmp, 'x', 'specs/auth/spec.md', `## ADDED Requirements

### Requirement: A
body
#### Scenario: s
- WHEN x
- THEN y

## REMOVED Requirements

### Requirement: B
reason
`);
    const result = change.showChange(tmp, 'x');
    assert.strictEqual(result.id, 'x');
    assert.strictEqual(result.deltas[0].added_count, 1);
    assert.strictEqual(result.deltas[0].removed_count, 1);
  } finally { cleanup(tmp); }
});

test('showChange rejects invalid id', () => {
  const result = change.showChange('/tmp', 'Bad_ID');
  assert.ok(result.error.includes('invalid'));
});

// validateChange ---------------------------------------------

test('validateChange passes on well-formed change', () => {
  const tmp = createTempProject();
  try {
    writeMasterSpec(tmp, 'auth', MASTER_SPEC);
    writeChangeFile(tmp, 'ok', 'proposal.md', '# p');
    writeChangeFile(tmp, 'ok', 'tasks.md', '- [ ] t');
    writeChangeFile(tmp, 'ok', 'specs/auth/spec.md', `## ADDED Requirements

### Requirement: Password Reset
body
#### Scenario: s
- WHEN x
- THEN y
`);
    const result = change.validateChange(tmp, 'ok');
    assert.strictEqual(result.valid, true);
  } finally { cleanup(tmp); }
});

test('validateChange flags missing proposal and tasks', () => {
  const tmp = createTempProject();
  try {
    writeChangeFile(tmp, 'bare', 'specs/auth/spec.md', `## ADDED Requirements
### Requirement: X
body
#### Scenario: s
- WHEN x
- THEN y
`);
    const result = change.validateChange(tmp, 'bare');
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.message.includes('proposal.md')));
    assert.ok(result.issues.some(i => i.message.includes('tasks.md')));
  } finally { cleanup(tmp); }
});

test('validateChange flags semantic conflicts against master', () => {
  const tmp = createTempProject();
  try {
    writeMasterSpec(tmp, 'auth', MASTER_SPEC);
    writeChangeFile(tmp, 'conflict', 'proposal.md', '#');
    writeChangeFile(tmp, 'conflict', 'tasks.md', '-');
    writeChangeFile(tmp, 'conflict', 'specs/auth/spec.md', `## ADDED Requirements

### Requirement: User Login
duplicate of existing
#### Scenario: s
- WHEN x
- THEN y

## MODIFIED Requirements

### Requirement: Ghost
body
#### Scenario: s
- WHEN x
- THEN y
`);
    const result = change.validateChange(tmp, 'conflict');
    assert.strictEqual(result.valid, false);
    assert.ok(result.issues.some(i => i.message.includes('already exists')));
    assert.ok(result.issues.some(i => i.message.includes('not found')));
  } finally { cleanup(tmp); }
});

// archiveChange ----------------------------------------------

test('archiveChange merges ADDED into master and moves to archive', () => {
  const tmp = createTempProject();
  try {
    writeMasterSpec(tmp, 'auth', MASTER_SPEC);
    writeChangeFile(tmp, 'add-reset', 'proposal.md', '# p');
    writeChangeFile(tmp, 'add-reset', 'tasks.md', '- [x] t');
    writeChangeFile(tmp, 'add-reset', 'specs/auth/spec.md', `## ADDED Requirements

### Requirement: Password Reset

The system SHALL allow resetting forgotten passwords via email.

#### Scenario: reset flow
- **WHEN** user requests reset
- **THEN** a reset email is sent
`);
    const result = change.archiveChange(tmp, 'add-reset');
    assert.strictEqual(result.ok, true);

    // Master spec now contains new requirement
    const updated = fs.readFileSync(path.join(tmp, '.planning', 'specs', 'auth', 'spec.md'), 'utf8');
    assert.ok(updated.includes('### Requirement: Password Reset'));
    assert.ok(updated.includes('### Requirement: User Login'));

    // Change dir moved
    assert.ok(!fs.existsSync(path.join(tmp, '.planning', 'changes', 'add-reset')));
    const archivedParent = fs.readdirSync(path.join(tmp, '.planning', 'changes', 'archive'));
    assert.ok(archivedParent.some(n => n.endsWith('-add-reset')));
  } finally { cleanup(tmp); }
});

test('archiveChange dry-run does not modify files', () => {
  const tmp = createTempProject();
  try {
    writeMasterSpec(tmp, 'auth', MASTER_SPEC);
    writeChangeFile(tmp, 'c1', 'proposal.md', '#');
    writeChangeFile(tmp, 'c1', 'tasks.md', '-');
    writeChangeFile(tmp, 'c1', 'specs/auth/spec.md', `## ADDED Requirements

### Requirement: P
body
#### Scenario: s
- WHEN x
- THEN y
`);
    const result = change.archiveChange(tmp, 'c1', { dryRun: true });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.dry_run, true);
    // Still exists
    assert.ok(fs.existsSync(path.join(tmp, '.planning', 'changes', 'c1')));
    const master = fs.readFileSync(path.join(tmp, '.planning', 'specs', 'auth', 'spec.md'), 'utf8');
    assert.ok(!master.includes('### Requirement: P'));
  } finally { cleanup(tmp); }
});

test('archiveChange fails when validation fails', () => {
  const tmp = createTempProject();
  try {
    writeChangeFile(tmp, 'broken', 'specs/auth/spec.md', `## ADDED Requirements
### Requirement: X
body
#### Scenario: s
- WHEN x
- THEN y
`);
    // Missing proposal.md and tasks.md
    const result = change.archiveChange(tmp, 'broken');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'validation failed');
  } finally { cleanup(tmp); }
});

test('archiveChange handles new capability (master does not exist yet)', () => {
  const tmp = createTempProject();
  try {
    writeChangeFile(tmp, 'add-new-cap', 'proposal.md', '#');
    writeChangeFile(tmp, 'add-new-cap', 'tasks.md', '-');
    writeChangeFile(tmp, 'add-new-cap', 'specs/payments/spec.md', `## ADDED Requirements

### Requirement: Charge Card
body
#### Scenario: ok
- WHEN x
- THEN y
`);
    const result = change.archiveChange(tmp, 'add-new-cap');
    assert.strictEqual(result.ok, true);
    const created = fs.readFileSync(path.join(tmp, '.planning', 'specs', 'payments', 'spec.md'), 'utf8');
    assert.ok(created.includes('### Requirement: Charge Card'));
  } finally { cleanup(tmp); }
});

test('archiveChange fails cleanly on merge conflict', () => {
  const tmp = createTempProject();
  try {
    writeMasterSpec(tmp, 'auth', MASTER_SPEC);
    writeChangeFile(tmp, 'dup', 'proposal.md', '#');
    writeChangeFile(tmp, 'dup', 'tasks.md', '-');
    // MODIFIED a requirement that doesn't exist in master; validation catches this first
    writeChangeFile(tmp, 'dup', 'specs/auth/spec.md', `## MODIFIED Requirements

### Requirement: Nonexistent
body
#### Scenario: s
- WHEN x
- THEN y
`);
    const result = change.archiveChange(tmp, 'dup');
    assert.strictEqual(result.ok, false);
    // Change dir still present
    assert.ok(fs.existsSync(path.join(tmp, '.planning', 'changes', 'dup')));
  } finally { cleanup(tmp); }
});
