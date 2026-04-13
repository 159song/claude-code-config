'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const config = require('./config.cjs');

// Helper: create a temp directory with .planning/config.json
function makeTmp(configObj) {
  const tmpBase = path.join(os.tmpdir(), `wf-cfg-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const planningDir = path.join(tmpBase, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  if (configObj !== undefined) {
    fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify(configObj), 'utf8');
  }
  return tmpBase;
}

function cleanTmp(tmpBase) {
  fs.rmSync(tmpBase, { recursive: true, force: true });
}

// --- Existing tests ---

test('loadConfig returns merged defaults + project config', () => {
  const tmp = makeTmp({ mode: 'manual' });
  const result = config.loadConfig(tmp);
  cleanTmp(tmp);
  assert.strictEqual(result.mode, 'manual');
  assert.ok(result.workflow !== undefined, 'Should have workflow defaults');
});

test('CONFIG_DEFAULTS is an object with expected keys', () => {
  assert.ok(typeof config.CONFIG_DEFAULTS === 'object');
  assert.ok(config.CONFIG_DEFAULTS !== null);
  assert.ok('mode' in config.CONFIG_DEFAULTS || 'workflow' in config.CONFIG_DEFAULTS);
});

test('loadConfig returns defaults when no config file exists', () => {
  const tmp = path.join(os.tmpdir(), `wf-cfg-${Date.now()}-nofile`);
  fs.mkdirSync(tmp, { recursive: true });
  const result = config.loadConfig(tmp);
  cleanTmp(tmp);
  assert.ok(typeof result === 'object');
  assert.ok(result !== null);
});

// --- saveConfig tests ---

test('saveConfig writes top-level key to .planning/config.json', () => {
  const tmp = makeTmp({});
  const result = config.saveConfig(tmp, 'mode', 'manual');
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'config.json'), 'utf8'));
  cleanTmp(tmp);
  assert.strictEqual(saved.mode, 'manual');
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.key, 'mode');
  assert.strictEqual(result.value, 'manual');
});

test('saveConfig writes nested dotted key to .planning/config.json', () => {
  const tmp = makeTmp({});
  const result = config.saveConfig(tmp, 'workflow.research', 'false');
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'config.json'), 'utf8'));
  cleanTmp(tmp);
  assert.strictEqual(saved.workflow.research, false);
  assert.strictEqual(result.value, false);
});

test('saveConfig preserves existing config keys not being modified', () => {
  const tmp = makeTmp({ mode: 'manual', granularity: 'detailed' });
  config.saveConfig(tmp, 'mode', 'auto');
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'config.json'), 'utf8'));
  cleanTmp(tmp);
  assert.strictEqual(saved.mode, 'auto');
  assert.strictEqual(saved.granularity, 'detailed');
});

test('saveConfig coerces string "true"/"false" to boolean', () => {
  const tmp = makeTmp({});
  config.saveConfig(tmp, 'workflow.verifier', 'true');
  config.saveConfig(tmp, 'workflow.research', 'false');
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'config.json'), 'utf8'));
  cleanTmp(tmp);
  assert.strictEqual(saved.workflow.verifier, true);
  assert.strictEqual(saved.workflow.research, false);
});

test('saveConfig coerces numeric strings to numbers', () => {
  const tmp = makeTmp({});
  config.saveConfig(tmp, 'parallelization.max_concurrent_agents', '5');
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'config.json'), 'utf8'));
  cleanTmp(tmp);
  assert.strictEqual(saved.parallelization.max_concurrent_agents, 5);
});

test('saveConfig rejects keys not in CONFIG_DEFAULTS schema', () => {
  const tmp = makeTmp({});
  const result = config.saveConfig(tmp, 'nonexistent.key', 'value');
  cleanTmp(tmp);
  assert.strictEqual(result.success, false);
  assert.ok(result.error);
});

// --- getConfigSchema tests ---

test('getConfigSchema returns flat array of {key, type, default}', () => {
  const schema = config.getConfigSchema();
  assert.ok(Array.isArray(schema));
  assert.ok(schema.length > 0);
  const modeEntry = schema.find(s => s.key === 'mode');
  assert.ok(modeEntry, 'Should contain mode key');
  assert.strictEqual(modeEntry.type, 'string');
  assert.strictEqual(modeEntry.default, 'auto');
});

test('getConfigSchema excludes keys starting with "_"', () => {
  const schema = config.getConfigSchema();
  const underscoreKeys = schema.filter(s => s.key.includes('._') || s.key.startsWith('_'));
  assert.strictEqual(underscoreKeys.length, 0, 'Should not contain underscore-prefixed keys');
});

test('getConfigSchema flattens nested keys with dot notation', () => {
  const schema = config.getConfigSchema();
  const researchEntry = schema.find(s => s.key === 'workflow.research');
  assert.ok(researchEntry, 'Should contain workflow.research');
  assert.strictEqual(researchEntry.type, 'boolean');
  assert.strictEqual(researchEntry.default, true);
});

// --- getConfigValue tests ---

test('getConfigValue returns current value for a key', () => {
  const tmp = makeTmp({ mode: 'manual' });
  const result = config.getConfigValue(tmp, 'mode');
  cleanTmp(tmp);
  assert.strictEqual(result.key, 'mode');
  assert.strictEqual(result.value, 'manual');
  assert.strictEqual(result.is_default, false);
});

test('getConfigValue returns default value and is_default=true', () => {
  const tmp = makeTmp({});
  const result = config.getConfigValue(tmp, 'mode');
  cleanTmp(tmp);
  assert.strictEqual(result.value, 'auto');
  assert.strictEqual(result.is_default, true);
});

test('getConfigValue navigates dotted key paths', () => {
  const tmp = makeTmp({ workflow: { research: false } });
  const result = config.getConfigValue(tmp, 'workflow.research');
  cleanTmp(tmp);
  assert.strictEqual(result.value, false);
  assert.strictEqual(result.is_default, false);
});

// --- run sub-commands tests ---

test('run with set sub-command writes config and outputs success', () => {
  const tmp = makeTmp({});
  // Capture stdout
  const origWriteSync = fs.writeSync;
  let captured = '';
  fs.writeSync = (fd, data) => { if (fd === 1) captured += data; else origWriteSync(fd, data); };
  try {
    config.run(tmp, ['set', 'mode', 'manual']);
  } finally {
    fs.writeSync = origWriteSync;
  }
  const output = JSON.parse(captured);
  assert.strictEqual(output.success, true);
  assert.strictEqual(output.key, 'mode');
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, '.planning', 'config.json'), 'utf8'));
  cleanTmp(tmp);
  assert.strictEqual(saved.mode, 'manual');
});

test('run with get sub-command outputs current value', () => {
  const tmp = makeTmp({ mode: 'manual' });
  const origWriteSync = fs.writeSync;
  let captured = '';
  fs.writeSync = (fd, data) => { if (fd === 1) captured += data; else origWriteSync(fd, data); };
  try {
    config.run(tmp, ['get', 'mode']);
  } finally {
    fs.writeSync = origWriteSync;
  }
  const output = JSON.parse(captured);
  cleanTmp(tmp);
  assert.strictEqual(output.key, 'mode');
  assert.strictEqual(output.value, 'manual');
});

test('run with schema sub-command outputs config schema array', () => {
  const tmp = makeTmp({});
  const origWriteSync = fs.writeSync;
  let captured = '';
  fs.writeSync = (fd, data) => { if (fd === 1) captured += data; else origWriteSync(fd, data); };
  try {
    config.run(tmp, ['schema']);
  } finally {
    fs.writeSync = origWriteSync;
  }
  const output = JSON.parse(captured);
  cleanTmp(tmp);
  assert.ok(Array.isArray(output));
  assert.ok(output.length > 0);
  assert.ok(output[0].key);
});

test('run with no args outputs full merged config', () => {
  const tmp = makeTmp({ mode: 'manual' });
  const origWriteSync = fs.writeSync;
  let captured = '';
  fs.writeSync = (fd, data) => { if (fd === 1) captured += data; else origWriteSync(fd, data); };
  try {
    config.run(tmp, []);
  } finally {
    fs.writeSync = origWriteSync;
  }
  const output = JSON.parse(captured);
  cleanTmp(tmp);
  assert.strictEqual(output.mode, 'manual');
  assert.ok(output.workflow);
});
