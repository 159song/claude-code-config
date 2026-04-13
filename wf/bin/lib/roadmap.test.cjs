'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const roadmap = require('./roadmap.cjs');

const SAMPLE_ROADMAP_H3 = `# Roadmap

## Phase Details

### Phase 1: CLI Foundation

**Goal:** Build the foundation

### Phase 2: State Management

**Goal:** Manage state

### Phase 3: Agent Contracts

**Goal:** Agent setup
`;

const SAMPLE_ROADMAP_H2 = `# Roadmap

## Phase 1: CLI Foundation

**Goal:** Build the foundation

## Phase 2: State Management

**Goal:** Manage state
`;

test('roadmap module exports run function', () => {
  assert.strictEqual(typeof roadmap.run, 'function');
});

test('roadmap regex matches ### Phase N: (H3 headers)', () => {
  // Check that the module uses #{2,3} flexible regex
  // We can verify this by looking at what the module exports or by testing behavior
  const moduleSrc = fs.readFileSync(path.join(__dirname, 'roadmap.cjs'), 'utf8');
  // The regex should match H3 headers
  assert.ok(
    moduleSrc.includes('#{2,3}') || moduleSrc.includes('#\\{2,3\\}'),
    'Module should use flexible #{2,3} regex pattern'
  );
});

test('roadmap analyze works with project root containing ROADMAP.md', () => {
  const tmpBase = path.join(os.tmpdir(), `wf-road-${Date.now()}`);
  const planningDir = path.join(tmpBase, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), SAMPLE_ROADMAP_H3, 'utf8');

  let output = null;
  const { execFileSync } = require('child_process');
  try {
    const script = `
      const roadmap = require(${JSON.stringify(path.resolve(__dirname, 'roadmap.cjs'))});
      roadmap.run(${JSON.stringify(tmpBase)}, ['analyze']);
    `;
    const tmpScript = path.join(os.tmpdir(), `wf-test-${Date.now()}.cjs`);
    fs.writeFileSync(tmpScript, script, 'utf8');
    output = execFileSync('node', [tmpScript], { encoding: 'utf8' });
    fs.unlinkSync(tmpScript);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }

  const result = JSON.parse(output);
  assert.strictEqual(result.total_phases, 3, `Expected 3 phases, got ${result.total_phases}`);
});

// === Helper: create a temp project directory with a ROADMAP.md ===

const SAMPLE_ROADMAP_WITH_PROGRESS = `# Roadmap

## Phase Details

### Phase 1: CLI Foundation

**Goal:** Build the foundation
**Depends on**: Nothing
**Requirements**: INFRA-01
**Plans**: TBD

### Phase 2: State Management

**Goal:** Manage state
**Depends on**: Phase 1
**Requirements**: STATE-01
**Plans**: TBD

### Phase 3: Agent Contracts

**Goal:** Agent setup
**Depends on**: Phase 2
**Requirements**: AGENT-01
**Plans**: TBD

## Progress

| Phase | Status |
|-------|--------|
| 1 | Complete |
`;

function createTmpProject(roadmapContent) {
  const tmpBase = path.join(os.tmpdir(), `wf-road-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const planningDir = path.join(tmpBase, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), roadmapContent || SAMPLE_ROADMAP_WITH_PROGRESS, 'utf8');
  return tmpBase;
}

function cleanTmpProject(tmpBase) {
  fs.rmSync(tmpBase, { recursive: true, force: true });
}

function readRoadmap(tmpBase) {
  return fs.readFileSync(path.join(tmpBase, '.planning', 'ROADMAP.md'), 'utf8');
}

// === addPhase tests ===

test('addPhase appends new phase after last phase block, before Progress section', () => {
  const tmpBase = createTmpProject();
  try {
    const result = roadmap.addPhase(tmpBase, 'Quality Tools', 'Code review workflow');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.phase_number, 4);
    assert.strictEqual(result.name, 'Quality Tools');

    const content = readRoadmap(tmpBase);
    assert.ok(content.includes('### Phase 4: Quality Tools'), 'Should contain new phase heading');
    assert.ok(content.includes('Code review workflow'), 'Should contain goal text');
    // New phase should appear BEFORE ## Progress
    const phaseIdx = content.indexOf('### Phase 4: Quality Tools');
    const progressIdx = content.indexOf('## Progress');
    assert.ok(progressIdx > -1, 'Progress section should exist');
    assert.ok(phaseIdx < progressIdx, 'New phase should appear before Progress section');
  } finally {
    cleanTmpProject(tmpBase);
  }
});

test('addPhase determines next integer from max existing phase number', () => {
  const tmpBase = createTmpProject();
  try {
    // Add two phases sequentially
    const result1 = roadmap.addPhase(tmpBase, 'Phase Four', 'Goal 4');
    assert.strictEqual(result1.phase_number, 4);
    const result2 = roadmap.addPhase(tmpBase, 'Phase Five', 'Goal 5');
    assert.strictEqual(result2.phase_number, 5);
  } finally {
    cleanTmpProject(tmpBase);
  }
});

// === insertPhase tests ===

test('insertPhase inserts decimal phase after specified phase with INSERTED marker', () => {
  const tmpBase = createTmpProject();
  try {
    const result = roadmap.insertPhase(tmpBase, 2, 'Hotfix', 'Emergency fix');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.phase_number, 2.5);
    assert.strictEqual(result.name, 'Hotfix');

    const content = readRoadmap(tmpBase);
    assert.ok(content.includes('### Phase 2.5: Hotfix **INSERTED**'), 'Should contain inserted phase with marker');
    assert.ok(content.includes('**Depends on**: Phase 2'), 'Should depend on afterPhase');
  } finally {
    cleanTmpProject(tmpBase);
  }
});

test('insertPhase preserves all existing phase content', () => {
  const tmpBase = createTmpProject();
  try {
    roadmap.insertPhase(tmpBase, 2, 'Hotfix', 'Emergency fix');
    const content = readRoadmap(tmpBase);

    // All original phases must still exist
    assert.ok(content.includes('### Phase 1: CLI Foundation'), 'Phase 1 preserved');
    assert.ok(content.includes('### Phase 2: State Management'), 'Phase 2 preserved');
    assert.ok(content.includes('### Phase 3: Agent Contracts'), 'Phase 3 preserved');
    // Inserted phase appears between Phase 2 and Phase 3
    const phase2Idx = content.indexOf('### Phase 2: State Management');
    const insertIdx = content.indexOf('### Phase 2.5: Hotfix');
    const phase3Idx = content.indexOf('### Phase 3: Agent Contracts');
    assert.ok(insertIdx > phase2Idx, 'Inserted phase after Phase 2');
    assert.ok(insertIdx < phase3Idx, 'Inserted phase before Phase 3');
  } finally {
    cleanTmpProject(tmpBase);
  }
});

// === removePhase tests ===

test('removePhase marks phase heading with REMOVED in ROADMAP text', () => {
  const tmpBase = createTmpProject();
  try {
    // Create phase 3 directory so it can be archived
    const phaseDir = path.join(tmpBase, '.planning', 'phases', '03-agent-contracts');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, 'CONTEXT.md'), '# Context', 'utf8');

    const result = roadmap.removePhase(tmpBase, 3);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.phase_number, 3);

    const content = readRoadmap(tmpBase);
    assert.ok(content.includes('**REMOVED**'), 'Should contain REMOVED marker');
  } finally {
    cleanTmpProject(tmpBase);
  }
});

test('removePhase moves phase directory to .planning/archive/', () => {
  const tmpBase = createTmpProject();
  try {
    const phaseDir = path.join(tmpBase, '.planning', 'phases', '03-agent-contracts');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, 'CONTEXT.md'), '# Context', 'utf8');

    roadmap.removePhase(tmpBase, 3);

    // Original dir should be gone
    assert.ok(!fs.existsSync(phaseDir), 'Original phase directory should be removed');
    // Archive dir should exist
    const archiveDir = path.join(tmpBase, '.planning', 'archive', '03-agent-contracts');
    assert.ok(fs.existsSync(archiveDir), 'Archive directory should exist');
    assert.ok(fs.existsSync(path.join(archiveDir, 'CONTEXT.md')), 'Archived files should be preserved');
  } finally {
    cleanTmpProject(tmpBase);
  }
});

test('removePhase creates .planning/archive/ directory if it does not exist', () => {
  const tmpBase = createTmpProject();
  try {
    const phaseDir = path.join(tmpBase, '.planning', 'phases', '03-agent-contracts');
    fs.mkdirSync(phaseDir, { recursive: true });

    const archivePath = path.join(tmpBase, '.planning', 'archive');
    assert.ok(!fs.existsSync(archivePath), 'Archive should not exist yet');

    roadmap.removePhase(tmpBase, 3);

    assert.ok(fs.existsSync(archivePath), 'Archive directory should be created');
  } finally {
    cleanTmpProject(tmpBase);
  }
});

test('roadmapAnalyze still works after add/insert/remove operations', () => {
  const tmpBase = createTmpProject();
  try {
    roadmap.addPhase(tmpBase, 'Quality Tools', 'Code review workflow');
    roadmap.insertPhase(tmpBase, 2, 'Hotfix', 'Emergency fix');

    const result = roadmap.roadmapAnalyze(tmpBase);
    // Original 3 + 1 added + 1 inserted = 5
    assert.strictEqual(result.total_phases, 5, `Expected 5 phases, got ${result.total_phases}`);

    // All phase numbers should be present
    const nums = result.phases.map(p => p.num);
    assert.ok(nums.includes(1), 'Phase 1 present');
    assert.ok(nums.includes(2), 'Phase 2 present');
    assert.ok(nums.includes(2.5), 'Phase 2.5 present');
    assert.ok(nums.includes(3), 'Phase 3 present');
    assert.ok(nums.includes(4), 'Phase 4 present');
  } finally {
    cleanTmpProject(tmpBase);
  }
});
