'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const state = require('./state.cjs');

const SAMPLE_STATE_MD = `---
gsd_state_version: 1.0
milestone: v1.0
status: planning
stopped_at: Phase 1 context gathered
---

# Project State

## Current Position

- **Phase:** 1 of 6 (CLI Foundation)
- **Status:** Ready to plan
`;

test('parseFrontmatter extracts YAML from STATE.md format', () => {
  const result = state.parseFrontmatter(SAMPLE_STATE_MD);
  assert.ok(result.frontmatter, 'Should have frontmatter object');
  assert.strictEqual(result.frontmatter.gsd_state_version, 1.0);
  assert.strictEqual(result.frontmatter.milestone, 'v1.0');
  assert.strictEqual(result.frontmatter.status, 'planning');
  assert.ok(result.body, 'Should have body content');
  assert.ok(result.body.includes('# Project State'), 'Body should contain markdown content');
});

test('parseFrontmatter returns empty frontmatter for content without ---', () => {
  const result = state.parseFrontmatter('# No frontmatter here\n\nJust body');
  assert.deepStrictEqual(result.frontmatter, {});
});

test('state module exports run function', () => {
  assert.strictEqual(typeof state.run, 'function');
});

test('state module exports parseFrontmatter function', () => {
  assert.strictEqual(typeof state.parseFrontmatter, 'function');
});
