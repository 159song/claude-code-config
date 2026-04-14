#!/usr/bin/env node
// wf-context-monitor.test.cjs — Regression tests for context monitor hook
// Uses Node.js built-in test runner (node:test + node:assert)

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const HOOK_PATH = path.join(__dirname, 'wf-context-monitor.js');
const tmpDir = os.tmpdir();

/**
 * Generate a unique session ID for test isolation.
 * @param {string} label - Short test descriptor
 * @returns {string}
 */
function makeSessionId(label) {
  return `test-ctx-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Write a bridge metrics file for the given session.
 * @param {string} sessionId
 * @param {object} overrides - Fields to merge into the metrics object
 */
function writeBridge(sessionId, overrides = {}) {
  const metrics = {
    timestamp: Math.floor(Date.now() / 1000),
    remaining_percentage: 50,
    used_pct: 50,
    ...overrides
  };
  const bridgePath = path.join(tmpDir, `claude-ctx-${sessionId}.json`);
  fs.writeFileSync(bridgePath, JSON.stringify(metrics));
  return bridgePath;
}

/**
 * Run the context monitor hook with given input and return { exitCode, stdout }.
 * @param {object} inputObj - JSON object piped to stdin
 * @returns {{ exitCode: number, stdout: string }}
 */
function runHook(inputObj) {
  const input = JSON.stringify(inputObj);
  try {
    const stdout = execFileSync('node', [HOOK_PATH], {
      input,
      encoding: 'utf8',
      timeout: 5000
    });
    return { exitCode: 0, stdout };
  } catch (err) {
    return { exitCode: err.status || 1, stdout: err.stdout || '' };
  }
}

/**
 * Create a temporary cwd directory with optional .planning structure.
 * @param {object} opts
 * @param {boolean} opts.stateFile - Create .planning/STATE.md
 * @param {boolean} opts.continuationFile - Create .planning/CONTINUATION.md
 * @param {object|null} opts.config - Write .planning/config.json with this content
 * @returns {string} The temp directory path
 */
function makeTempCwd(opts = {}) {
  const dir = fs.mkdtempSync(path.join(tmpDir, 'ctx-test-cwd-'));
  if (opts.stateFile || opts.continuationFile || opts.config) {
    const planningDir = path.join(dir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    if (opts.stateFile) {
      fs.writeFileSync(path.join(planningDir, 'STATE.md'), '# State\nstatus: executing\n');
    }
    if (opts.continuationFile) {
      fs.writeFileSync(path.join(planningDir, 'CONTINUATION.md'), '# Checkpoint\nphase: 2\n');
    }
    if (opts.config) {
      fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify(opts.config));
    }
  }
  return dir;
}

/**
 * Clean up all temp files associated with a session and optional cwd.
 * @param {string} sessionId
 * @param {string|null} cwdDir
 */
function cleanup(sessionId, cwdDir) {
  const bridgePath = path.join(tmpDir, `claude-ctx-${sessionId}.json`);
  const warnPath = path.join(tmpDir, `claude-ctx-${sessionId}-warned.json`);
  try { fs.unlinkSync(bridgePath); } catch (e) {}
  try { fs.unlinkSync(warnPath); } catch (e) {}
  if (cwdDir) {
    try { fs.rmSync(cwdDir, { recursive: true, force: true }); } catch (e) {}
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('wf-context-monitor silent exits', () => {
  test('silent exit when no session_id', () => {
    const result = runHook({ cwd: '/tmp' });
    assert.equal(result.exitCode, 0, 'Should exit 0');
    assert.equal(result.stdout, '', 'Should produce no output');
  });

  test('silent exit when session_id is empty string', () => {
    const result = runHook({ session_id: '', cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '');
  });

  test('silent exit when session_id contains forward slash (path traversal)', () => {
    const result = runHook({ session_id: '../etc/passwd', cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Path traversal with / should be rejected');
  });

  test('silent exit when session_id contains backslash (path traversal)', () => {
    const result = runHook({ session_id: '..\\windows\\system32', cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Path traversal with \\ should be rejected');
  });

  test('silent exit when session_id contains dot-dot (path traversal)', () => {
    const result = runHook({ session_id: 'abc..def', cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Path traversal with .. should be rejected');
  });

  test('silent exit when no bridge file exists', () => {
    const sid = makeSessionId('no-bridge');
    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Missing bridge file should cause silent exit');
    cleanup(sid, null);
  });

  test('silent exit when metrics are stale (> 60 seconds)', () => {
    const sid = makeSessionId('stale');
    const staleTimestamp = Math.floor(Date.now() / 1000) - 120; // 2 minutes ago
    writeBridge(sid, { timestamp: staleTimestamp, remaining_percentage: 20, used_pct: 80 });

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Stale metrics should cause silent exit');
    cleanup(sid, null);
  });

  test('silent exit when remaining > 30% (no warning needed)', () => {
    const sid = makeSessionId('healthy');
    writeBridge(sid, { remaining_percentage: 50, used_pct: 50 });

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Healthy remaining should cause silent exit');
    cleanup(sid, null);
  });

  test('silent exit when remaining is exactly 31%', () => {
    const sid = makeSessionId('boundary-safe');
    writeBridge(sid, { remaining_percentage: 31, used_pct: 69 });

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'remaining=31 should not trigger warning');
    cleanup(sid, null);
  });
});

describe('wf-context-monitor warning thresholds', () => {
  test('WARNING output when remaining is between 15-30%', () => {
    const sid = makeSessionId('warning');
    writeBridge(sid, { remaining_percentage: 25, used_pct: 75 });

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'Should produce warning output');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('警告'), 'Should contain WARNING keyword');
    assert.ok(msg.includes('75%'), 'Should include used percentage');
    assert.ok(msg.includes('25%'), 'Should include remaining percentage');
    cleanup(sid, null);
  });

  test('WARNING at boundary remaining=30', () => {
    const sid = makeSessionId('warn-boundary');
    writeBridge(sid, { remaining_percentage: 30, used_pct: 70 });

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'remaining=30 should trigger warning');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('警告'), 'Should contain WARNING keyword');
    cleanup(sid, null);
  });

  test('CRITICAL output when remaining <= 15%', () => {
    const sid = makeSessionId('critical');
    writeBridge(sid, { remaining_percentage: 10, used_pct: 90 });

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'Should produce critical output');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('严重不足'), 'Should contain CRITICAL keyword');
    assert.ok(msg.includes('90%'), 'Should include used percentage');
    assert.ok(msg.includes('10%'), 'Should include remaining percentage');
    cleanup(sid, null);
  });

  test('CRITICAL at boundary remaining=15', () => {
    const sid = makeSessionId('crit-boundary');
    writeBridge(sid, { remaining_percentage: 15, used_pct: 85 });

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'remaining=15 should trigger critical');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('严重不足'), 'remaining=15 should be CRITICAL');
    cleanup(sid, null);
  });

  test('WARNING at remaining=16 (just above critical)', () => {
    const sid = makeSessionId('just-above-crit');
    writeBridge(sid, { remaining_percentage: 16, used_pct: 84 });

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'remaining=16 should trigger warning');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('警告'), 'remaining=16 should be WARNING, not CRITICAL');
    assert.ok(!msg.includes('严重不足'), 'remaining=16 should NOT be CRITICAL');
    cleanup(sid, null);
  });
});

describe('wf-context-monitor debounce', () => {
  test('second same-level warning within 60s produces no output', () => {
    const sid = makeSessionId('debounce');
    writeBridge(sid, { remaining_percentage: 25, used_pct: 75 });

    // First call should produce output
    const first = runHook({ session_id: sid, cwd: '/tmp' });
    assert.ok(first.stdout.length > 0, 'First warning should produce output');

    // Second call within 60s should be debounced
    const second = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(second.exitCode, 0);
    assert.equal(second.stdout, '', 'Second same-level warning should be debounced');
    cleanup(sid, null);
  });

  test('second same-level CRITICAL within 60s is debounced', () => {
    const sid = makeSessionId('debounce-crit');
    writeBridge(sid, { remaining_percentage: 10, used_pct: 90 });

    const first = runHook({ session_id: sid, cwd: '/tmp' });
    assert.ok(first.stdout.length > 0, 'First critical should produce output');

    const second = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(second.stdout, '', 'Second critical within 60s should be debounced');
    cleanup(sid, null);
  });

  test('severity escalation (warning -> critical) bypasses debounce', () => {
    const sid = makeSessionId('escalation');

    // First call at warning level
    writeBridge(sid, { remaining_percentage: 25, used_pct: 75 });
    const first = runHook({ session_id: sid, cwd: '/tmp' });
    assert.ok(first.stdout.length > 0, 'First warning should produce output');

    // Escalate to critical — should bypass debounce
    writeBridge(sid, { remaining_percentage: 10, used_pct: 90 });
    const second = runHook({ session_id: sid, cwd: '/tmp' });
    assert.ok(second.stdout.length > 0, 'Severity escalation should bypass debounce');

    const parsed = JSON.parse(second.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('严重不足'), 'Escalated message should be CRITICAL');
    cleanup(sid, null);
  });

  test('same critical-to-critical does NOT bypass debounce', () => {
    const sid = makeSessionId('no-bypass');

    // First call at critical level
    writeBridge(sid, { remaining_percentage: 10, used_pct: 90 });
    const first = runHook({ session_id: sid, cwd: '/tmp' });
    assert.ok(first.stdout.length > 0, 'First critical should produce output');

    // Second call still critical — should be debounced (not escalation)
    writeBridge(sid, { remaining_percentage: 8, used_pct: 92 });
    const second = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(second.stdout, '', 'Critical-to-critical is NOT escalation, should debounce');
    cleanup(sid, null);
  });
});

describe('wf-context-monitor config disable', () => {
  test('hooks.context_warnings === false suppresses all warnings', () => {
    const sid = makeSessionId('config-disable');
    const cwd = makeTempCwd({ config: { hooks: { context_warnings: false } } });
    writeBridge(sid, { remaining_percentage: 10, used_pct: 90 });

    const result = runHook({ session_id: sid, cwd });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Disabled config should suppress warnings');
    cleanup(sid, cwd);
  });

  test('hooks.context_warnings === true does NOT suppress warnings', () => {
    const sid = makeSessionId('config-enable');
    const cwd = makeTempCwd({ config: { hooks: { context_warnings: true } } });
    writeBridge(sid, { remaining_percentage: 10, used_pct: 90 });

    const result = runHook({ session_id: sid, cwd });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'Enabled config should allow warnings');
    cleanup(sid, cwd);
  });

  test('missing config file does NOT suppress warnings', () => {
    const sid = makeSessionId('no-config');
    const cwd = makeTempCwd({});
    writeBridge(sid, { remaining_percentage: 10, used_pct: 90 });

    const result = runHook({ session_id: sid, cwd });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'Missing config should allow warnings');
    cleanup(sid, cwd);
  });

  test('malformed config.json does NOT suppress warnings', () => {
    const sid = makeSessionId('bad-config');
    const cwd = makeTempCwd({});
    // Write invalid JSON to config path
    const planningDir = path.join(cwd, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'config.json'), '{not valid json!!!');
    writeBridge(sid, { remaining_percentage: 10, used_pct: 90 });

    const result = runHook({ session_id: sid, cwd });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'Malformed config should not suppress warnings');
    cleanup(sid, cwd);
  });
});

describe('wf-context-monitor WF active vs inactive messages', () => {
  test('WF active (STATE.md exists): warning message suggests CONTINUATION.md', () => {
    const sid = makeSessionId('wf-active-warn');
    const cwd = makeTempCwd({ stateFile: true });
    writeBridge(sid, { remaining_percentage: 25, used_pct: 75 });

    const result = runHook({ session_id: sid, cwd });
    assert.ok(result.stdout.length > 0, 'Should produce output');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('CONTINUATION.md'), 'WF active warning should mention CONTINUATION.md');
    cleanup(sid, cwd);
  });

  test('WF inactive (no STATE.md): warning message is generic', () => {
    const sid = makeSessionId('wf-inactive-warn');
    const cwd = makeTempCwd({});
    writeBridge(sid, { remaining_percentage: 25, used_pct: 75 });

    const result = runHook({ session_id: sid, cwd });
    assert.ok(result.stdout.length > 0, 'Should produce output');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('context'), 'Inactive warning should mention context');
    assert.ok(!msg.includes('CONTINUATION.md'), 'Inactive warning should NOT mention CONTINUATION.md');
    cleanup(sid, cwd);
  });

  test('WF active (STATE.md exists): critical message mentions auto-compact', () => {
    const sid = makeSessionId('wf-active-crit');
    const cwd = makeTempCwd({ stateFile: true });
    writeBridge(sid, { remaining_percentage: 10, used_pct: 90 });

    const result = runHook({ session_id: sid, cwd });
    assert.ok(result.stdout.length > 0, 'Should produce output');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('auto-compact'), 'WF active critical should mention auto-compact');
    cleanup(sid, cwd);
  });

  test('WF inactive: critical message asks user how to continue', () => {
    const sid = makeSessionId('wf-inactive-crit');
    const cwd = makeTempCwd({});
    writeBridge(sid, { remaining_percentage: 10, used_pct: 90 });

    const result = runHook({ session_id: sid, cwd });
    assert.ok(result.stdout.length > 0, 'Should produce output');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('通知用户'), 'Inactive critical should mention notifying user');
    cleanup(sid, cwd);
  });
});

describe('wf-context-monitor CONTINUATION.md detection', () => {
  test('WF active + CONTINUATION.md exists: warning says checkpoint ready', () => {
    const sid = makeSessionId('cont-warn');
    const cwd = makeTempCwd({ stateFile: true, continuationFile: true });
    writeBridge(sid, { remaining_percentage: 25, used_pct: 75 });

    const result = runHook({ session_id: sid, cwd });
    assert.ok(result.stdout.length > 0, 'Should produce output');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('已就绪'), 'Should indicate checkpoint is ready');
    cleanup(sid, cwd);
  });

  test('WF active + no CONTINUATION.md: warning suggests writing checkpoint', () => {
    const sid = makeSessionId('no-cont-warn');
    const cwd = makeTempCwd({ stateFile: true });
    writeBridge(sid, { remaining_percentage: 25, used_pct: 75 });

    const result = runHook({ session_id: sid, cwd });
    assert.ok(result.stdout.length > 0, 'Should produce output');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('建议') || msg.includes('写入'), 'Should suggest writing CONTINUATION.md');
    cleanup(sid, cwd);
  });

  test('WF active + CONTINUATION.md exists: critical says checkpoint exists', () => {
    const sid = makeSessionId('cont-crit');
    const cwd = makeTempCwd({ stateFile: true, continuationFile: true });
    writeBridge(sid, { remaining_percentage: 10, used_pct: 90 });

    const result = runHook({ session_id: sid, cwd });
    assert.ok(result.stdout.length > 0, 'Should produce output');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('检查点已存在'), 'Should indicate CONTINUATION.md checkpoint exists');
    assert.ok(msg.includes('auto-compact'), 'Should mention auto-compact recovery');
    cleanup(sid, cwd);
  });

  test('WF active + no CONTINUATION.md: critical urges writing checkpoint', () => {
    const sid = makeSessionId('no-cont-crit');
    const cwd = makeTempCwd({ stateFile: true });
    writeBridge(sid, { remaining_percentage: 10, used_pct: 90 });

    const result = runHook({ session_id: sid, cwd });
    assert.ok(result.stdout.length > 0, 'Should produce output');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('确保'), 'Should urge ensuring CONTINUATION.md is written');
    cleanup(sid, cwd);
  });
});

describe('wf-context-monitor output format', () => {
  test('output is valid hookSpecificOutput JSON', () => {
    const sid = makeSessionId('format');
    writeBridge(sid, { remaining_percentage: 20, used_pct: 80 });

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.ok(result.stdout.length > 0, 'Should produce output');

    const parsed = JSON.parse(result.stdout);
    assert.ok(parsed.hookSpecificOutput, 'Should have hookSpecificOutput');
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'PostToolUse', 'Should declare PostToolUse');
    assert.ok(typeof parsed.hookSpecificOutput.additionalContext === 'string', 'additionalContext should be string');
    cleanup(sid, null);
  });
});

describe('wf-context-monitor robustness', () => {
  test('malformed JSON input exits gracefully (code 0)', () => {
    try {
      const stdout = execFileSync('node', [HOOK_PATH], {
        input: 'not-json-at-all',
        encoding: 'utf8',
        timeout: 5000
      });
      // Exited 0 — correct
      assert.equal(stdout, '', 'Should produce no output on malformed JSON');
    } catch (e) {
      assert.equal(e.status, 0, 'Should exit 0 on malformed JSON');
    }
  });

  test('empty stdin exits gracefully (code 0)', () => {
    try {
      const stdout = execFileSync('node', [HOOK_PATH], {
        input: '',
        encoding: 'utf8',
        timeout: 5000
      });
      assert.equal(stdout, '', 'Should produce no output on empty stdin');
    } catch (e) {
      assert.equal(e.status, 0, 'Should exit 0 on empty stdin');
    }
  });

  test('bridge file with invalid JSON exits gracefully', () => {
    const sid = makeSessionId('bad-bridge');
    const bridgePath = path.join(tmpDir, `claude-ctx-${sid}.json`);
    fs.writeFileSync(bridgePath, '{invalid json content');

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0, 'Should exit 0 on bad bridge JSON');
    // The hook wraps everything in try/catch, so it exits 0 silently
    cleanup(sid, null);
  });

  test('hook always exits with code 0', () => {
    // Even with a triggering condition, exit code must be 0
    const sid = makeSessionId('exit-code');
    writeBridge(sid, { remaining_percentage: 5, used_pct: 95 });

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0, 'Must always exit 0');
    cleanup(sid, null);
  });
});

describe('wf-context-monitor edge cases', () => {
  test('remaining_percentage exactly 0', () => {
    const sid = makeSessionId('zero-remaining');
    writeBridge(sid, { remaining_percentage: 0, used_pct: 100 });

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'remaining=0 should produce critical output');

    const parsed = JSON.parse(result.stdout);
    const msg = parsed.hookSpecificOutput.additionalContext;
    assert.ok(msg.includes('严重不足'), 'remaining=0 should be CRITICAL');
    cleanup(sid, null);
  });

  test('metrics with no timestamp are treated as fresh (not stale)', () => {
    const sid = makeSessionId('no-timestamp');
    const bridgePath = path.join(tmpDir, `claude-ctx-${sid}.json`);
    // Write metrics without timestamp field
    fs.writeFileSync(bridgePath, JSON.stringify({
      remaining_percentage: 20,
      used_pct: 80
    }));

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    // The hook checks: if (metrics.timestamp && (now - metrics.timestamp) > STALE_SECONDS)
    // No timestamp means the staleness check is skipped, so it should produce output
    assert.ok(result.stdout.length > 0, 'Missing timestamp should not cause stale rejection');
    cleanup(sid, null);
  });

  test('timestamp exactly at stale boundary (60s ago) is NOT stale', () => {
    const sid = makeSessionId('boundary-stale');
    const exactlyAtBoundary = Math.floor(Date.now() / 1000) - 60;
    writeBridge(sid, {
      timestamp: exactlyAtBoundary,
      remaining_percentage: 20,
      used_pct: 80
    });

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    // (now - timestamp) === 60, and check is > 60, so this is NOT stale
    assert.ok(result.stdout.length > 0, 'Exactly 60s should NOT be stale (uses > not >=)');
    cleanup(sid, null);
  });

  test('timestamp 61 seconds ago IS stale', () => {
    const sid = makeSessionId('over-stale');
    const justPastBoundary = Math.floor(Date.now() / 1000) - 61;
    writeBridge(sid, {
      timestamp: justPastBoundary,
      remaining_percentage: 20,
      used_pct: 80
    });

    const result = runHook({ session_id: sid, cwd: '/tmp' });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', '61s old should be stale');
    cleanup(sid, null);
  });
});
