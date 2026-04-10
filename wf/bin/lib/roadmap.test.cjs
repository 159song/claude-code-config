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
