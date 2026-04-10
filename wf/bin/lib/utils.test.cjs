'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Ensure the module is resolvable (will fail before implementation)
const utils = require('./utils.cjs');

test('readFile returns string content for existing file', () => {
  const tmpFile = path.join(os.tmpdir(), `wf-test-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'hello world', 'utf8');
  const result = utils.readFile(tmpFile);
  fs.unlinkSync(tmpFile);
  assert.strictEqual(result, 'hello world');
});

test('readFile returns null for missing file', () => {
  const result = utils.readFile('/nonexistent/path/file.txt');
  assert.strictEqual(result, null);
});

test('readJson returns parsed object for valid JSON file', () => {
  const tmpFile = path.join(os.tmpdir(), `wf-test-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, '{"key":"value"}', 'utf8');
  const result = utils.readJson(tmpFile);
  fs.unlinkSync(tmpFile);
  assert.deepStrictEqual(result, { key: 'value' });
});

test('readJson returns null for invalid JSON', () => {
  const tmpFile = path.join(os.tmpdir(), `wf-test-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, 'not valid json {{{', 'utf8');
  const result = utils.readJson(tmpFile);
  fs.unlinkSync(tmpFile);
  assert.strictEqual(result, null);
});

test('findProjectRoot from subdir of dir containing .planning/ returns parent', () => {
  const tmpBase = path.join(os.tmpdir(), `wf-proj-${Date.now()}`);
  const subDir = path.join(tmpBase, 'src', 'lib');
  const planningDir = path.join(tmpBase, '.planning');
  fs.mkdirSync(subDir, { recursive: true });
  fs.mkdirSync(planningDir, { recursive: true });
  const result = utils.findProjectRoot(subDir);
  fs.rmSync(tmpBase, { recursive: true, force: true });
  assert.strictEqual(result, tmpBase);
});

test('findProjectRoot from dir WITH .planning/ returns that dir', () => {
  const tmpBase = path.join(os.tmpdir(), `wf-proj-${Date.now()}`);
  const planningDir = path.join(tmpBase, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  const result = utils.findProjectRoot(tmpBase);
  fs.rmSync(tmpBase, { recursive: true, force: true });
  assert.strictEqual(result, tmpBase);
});

test('findProjectRoot stops at $HOME boundary, returns startDir as fallback', () => {
  // Use a temp dir that is NOT under any project with .planning/
  // and is NOT above HOME
  const tmpBase = path.join(os.tmpdir(), `wf-orphan-${Date.now()}`);
  fs.mkdirSync(tmpBase, { recursive: true });
  const result = utils.findProjectRoot(tmpBase);
  fs.rmSync(tmpBase, { recursive: true, force: true });
  // Should return the startDir itself as fallback (no .planning/ found)
  assert.strictEqual(result, tmpBase);
});

test('output writes JSON to fd 1 (blocking)', (t) => {
  // Verify output function exists and is callable
  assert.strictEqual(typeof utils.output, 'function');
  // We can't easily capture fd writes in tests, so just verify it runs without error
  // using a small payload. We'll use a subprocess approach.
  const { execFileSync } = require('child_process');
  const script = `
    const utils = require(${JSON.stringify(path.resolve(__dirname, 'utils.cjs'))});
    utils.output({ test: 'value' });
  `;
  const tmpScript = path.join(os.tmpdir(), `wf-test-${Date.now()}.cjs`);
  fs.writeFileSync(tmpScript, script, 'utf8');
  const result = execFileSync('node', [tmpScript], { encoding: 'utf8' });
  fs.unlinkSync(tmpScript);
  const parsed = JSON.parse(result);
  assert.deepStrictEqual(parsed, { test: 'value' });
});

test('output writes to temp file when JSON > 50KB', () => {
  const { execFileSync } = require('child_process');
  const largeData = { data: 'x'.repeat(51000) };
  const script = `
    const utils = require(${JSON.stringify(path.resolve(__dirname, 'utils.cjs'))});
    utils.output(${JSON.stringify(largeData)});
  `;
  const tmpScript = path.join(os.tmpdir(), `wf-test-${Date.now()}.cjs`);
  fs.writeFileSync(tmpScript, script, 'utf8');
  const result = execFileSync('node', [tmpScript], { encoding: 'utf8' });
  fs.unlinkSync(tmpScript);
  assert.ok(result.startsWith('@file:'), `Expected @file: prefix, got: ${result.substring(0, 50)}`);
  // Clean up temp file
  const tmpFilePath = result.trim().replace('@file:', '');
  if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
});
