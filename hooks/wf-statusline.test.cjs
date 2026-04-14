#!/usr/bin/env node
// wf-statusline.test.cjs — TDD tests for statusline hook
// Uses Node.js built-in test runner (node:test + node:assert)

const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const HOOK_PATH = path.join(__dirname, 'wf-statusline.js');

/**
 * Strip ANSI escape codes from a string for content assertions.
 * @param {string} str
 * @returns {string}
 */
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Generate a unique session ID for a test to avoid collisions.
 * @param {string} name - Short test identifier
 * @returns {string}
 */
function testSessionId(name) {
  return `test-sl-${name}-${process.pid}`;
}

/**
 * Build a stdin JSON payload for the statusline hook.
 * @param {object} overrides - Fields to merge into the default payload
 * @returns {string}
 */
function makeInput(overrides = {}) {
  const base = {
    model: { display_name: 'Opus 4.5' },
    workspace: { current_dir: '/tmp/test-project' },
    session_id: testSessionId('default'),
    context_window: { remaining_percentage: 75 }
  };

  // Allow deep overrides for nested keys
  const merged = { ...base, ...overrides };
  if (overrides.model !== undefined) merged.model = overrides.model;
  if (overrides.workspace !== undefined) merged.workspace = overrides.workspace;
  if (overrides.context_window !== undefined) merged.context_window = overrides.context_window;

  return JSON.stringify(merged);
}

/**
 * Run the statusline hook with the given stdin string.
 * @param {string} input - JSON string piped to stdin
 * @returns {{ exitCode: number, stdout: string }}
 */
function runHook(input) {
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

/** Paths of bridge files created during this test run, cleaned up after each test. */
const bridgeFilesToClean = [];

afterEach(() => {
  for (const fp of bridgeFilesToClean) {
    try { fs.unlinkSync(fp); } catch (_) {}
  }
  bridgeFilesToClean.length = 0;
});

/**
 * Register a bridge file for post-test cleanup.
 * @param {string} sessionId
 * @returns {string} The bridge file path
 */
function trackBridge(sessionId) {
  const bp = path.join(os.tmpdir(), `claude-ctx-${sessionId}.json`);
  bridgeFilesToClean.push(bp);
  return bp;
}

// ---------------------------------------------------------------------------
// 1. Basic output format
// ---------------------------------------------------------------------------
describe('wf-statusline basic output format', () => {
  test('contains WF prefix in output', () => {
    const sid = testSessionId('basic-wf');
    trackBridge(sid);
    const result = runHook(makeInput({ session_id: sid }));
    assert.equal(result.exitCode, 0);
    const clean = stripAnsi(result.stdout);
    assert.ok(clean.includes('WF'), 'Output must contain WF prefix');
  });

  test('contains model display name', () => {
    const sid = testSessionId('basic-model');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      model: { display_name: 'Sonnet 4.5' }
    }));
    const clean = stripAnsi(result.stdout);
    assert.ok(clean.includes('Sonnet 4.5'), 'Output must contain model name');
  });

  test('contains directory basename (not full path)', () => {
    const sid = testSessionId('basic-dir');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      workspace: { current_dir: '/home/user/my-project' }
    }));
    const clean = stripAnsi(result.stdout);
    assert.ok(clean.includes('my-project'), 'Output must contain directory basename');
    assert.ok(!clean.includes('/home/user/'), 'Output must NOT contain full path');
  });

  test('uses pipe separator between fields', () => {
    const sid = testSessionId('basic-sep');
    trackBridge(sid);
    const result = runHook(makeInput({ session_id: sid }));
    const clean = stripAnsi(result.stdout);
    assert.ok(clean.includes('\u2502'), 'Output must contain \u2502 separator');
  });
});

// ---------------------------------------------------------------------------
// 2. Context percentage calculation
// ---------------------------------------------------------------------------
describe('wf-statusline context percentage calculation', () => {
  test('remaining=100% yields used ~0%', () => {
    const sid = testSessionId('pct-100');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 100 }
    }));
    const clean = stripAnsi(result.stdout);
    assert.ok(clean.includes('0%'), 'remaining=100 should show 0% used');
  });

  test('remaining=16.5% yields used=100%', () => {
    const sid = testSessionId('pct-165');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 16.5 }
    }));
    const clean = stripAnsi(result.stdout);
    assert.ok(clean.includes('100%'), 'remaining=16.5 should show 100% used');
  });

  test('remaining=50% yields used ~60%', () => {
    const sid = testSessionId('pct-50');
    trackBridge(sid);
    // usableRemaining = ((50 - 16.5) / 83.5) * 100 = 40.12
    // used = 100 - 40 = 60 (rounded)
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 50 }
    }));
    const clean = stripAnsi(result.stdout);
    assert.ok(clean.includes('60%'), `remaining=50 should show ~60% used, got: ${clean}`);
  });

  test('remaining=0% (below buffer) yields used=100%', () => {
    const sid = testSessionId('pct-0');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 0 }
    }));
    const clean = stripAnsi(result.stdout);
    assert.ok(clean.includes('100%'), 'remaining=0 should show 100% used');
  });

  test('remaining=58.25% yields used=50%', () => {
    const sid = testSessionId('pct-5825');
    trackBridge(sid);
    // usableRemaining = ((58.25 - 16.5) / 83.5) * 100 = 50.0
    // used = 100 - 50 = 50
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 58.25 }
    }));
    const clean = stripAnsi(result.stdout);
    assert.ok(clean.includes('50%'), `remaining=58.25 should show 50% used, got: ${clean}`);
  });
});

// ---------------------------------------------------------------------------
// 3. Progress bar rendering
// ---------------------------------------------------------------------------
describe('wf-statusline progress bar rendering', () => {
  test('low usage has more empty segments', () => {
    const sid = testSessionId('bar-low');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 100 }
    }));
    // used=0% => 0 filled, 10 empty
    assert.ok(result.stdout.includes('\u2591'.repeat(10)), 'All 10 segments should be empty at 0% used');
  });

  test('high usage has more filled segments', () => {
    const sid = testSessionId('bar-high');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 16.5 }
    }));
    // used=100% => 10 filled, 0 empty
    assert.ok(result.stdout.includes('\u2588'.repeat(10)), 'All 10 segments should be filled at 100% used');
  });

  test('medium usage shows mix of filled and empty', () => {
    const sid = testSessionId('bar-mid');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 50 }
    }));
    // used=60% => 6 filled, 4 empty
    const bar = '\u2588'.repeat(6) + '\u2591'.repeat(4);
    assert.ok(result.stdout.includes(bar), `Expected bar ${bar} for 60% used`);
  });
});

// ---------------------------------------------------------------------------
// 4. Color thresholds
// ---------------------------------------------------------------------------
describe('wf-statusline color thresholds', () => {
  test('<50% used renders green (\\x1b[32m)', () => {
    const sid = testSessionId('color-green');
    trackBridge(sid);
    // used=0% which is <50
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 100 }
    }));
    assert.ok(result.stdout.includes('\x1b[32m'), 'Should use green ANSI for <50% used');
  });

  test('50% used renders yellow (\\x1b[33m)', () => {
    const sid = testSessionId('color-yellow');
    trackBridge(sid);
    // remaining=58.25 => used=50 which is >=50 and <65
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 58.25 }
    }));
    assert.ok(result.stdout.includes('\x1b[33m'), 'Should use yellow ANSI for 50-64% used');
  });

  test('65% used renders orange (\\x1b[38;5;208m)', () => {
    const sid = testSessionId('color-orange');
    trackBridge(sid);
    // need used=65: usableRemaining=35, remaining = 35*83.5/100 + 16.5 = 29.225 + 16.5 = 45.725
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 45.725 }
    }));
    const clean = stripAnsi(result.stdout);
    // Verify used% is in the 65-79 range
    const pctMatch = clean.match(/(\d+)%/);
    assert.ok(pctMatch, 'Should contain percentage');
    const used = parseInt(pctMatch[1], 10);
    assert.ok(used >= 65 && used < 80, `used=${used} should be in orange range 65-79`);
    assert.ok(result.stdout.includes('\x1b[38;5;208m'), 'Should use orange ANSI for 65-79% used');
  });

  test('>=80% used renders red+blink (\\x1b[5;31m) with skull emoji', () => {
    const sid = testSessionId('color-red');
    trackBridge(sid);
    // remaining=16.5 => used=100 which is >=80
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 16.5 }
    }));
    assert.ok(result.stdout.includes('\x1b[5;31m'), 'Should use red+blink ANSI for >=80% used');
    assert.ok(result.stdout.includes('\u{1F480}'), 'Should contain skull emoji for >=80% used');
  });

  test('79% used still renders orange (boundary check)', () => {
    const sid = testSessionId('color-boundary');
    trackBridge(sid);
    // need used=79: usableRemaining=21, remaining = 21*83.5/100 + 16.5 = 17.535 + 16.5 = 34.035
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 34.035 }
    }));
    const clean = stripAnsi(result.stdout);
    const pctMatch = clean.match(/(\d+)%/);
    assert.ok(pctMatch, 'Should contain percentage');
    const used = parseInt(pctMatch[1], 10);
    assert.ok(used >= 65 && used < 80, `used=${used} should be in orange range`);
    assert.ok(result.stdout.includes('\x1b[38;5;208m'), 'Should use orange ANSI, not red');
    assert.ok(!result.stdout.includes('\x1b[5;31m'), 'Should NOT use red+blink');
  });
});

// ---------------------------------------------------------------------------
// 5. Bridge file written correctly
// ---------------------------------------------------------------------------
describe('wf-statusline bridge file', () => {
  test('writes bridge file to /tmp with correct fields', () => {
    const sid = testSessionId('bridge-write');
    const bp = trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      context_window: { remaining_percentage: 75 }
    }));
    assert.equal(result.exitCode, 0);
    assert.ok(fs.existsSync(bp), `Bridge file should exist at ${bp}`);

    const bridge = JSON.parse(fs.readFileSync(bp, 'utf8'));
    assert.equal(bridge.session_id, sid);
    assert.equal(bridge.remaining_percentage, 75);
    assert.equal(typeof bridge.used_pct, 'number');
    assert.equal(typeof bridge.timestamp, 'number');

    // Verify used_pct calculation: remaining=75 => usable=((75-16.5)/83.5)*100=70.06 => used=30
    assert.equal(bridge.used_pct, 30, 'used_pct should be 30 for remaining=75');
  });

  test('bridge file timestamp is a reasonable unix timestamp', () => {
    const sid = testSessionId('bridge-ts');
    const bp = trackBridge(sid);
    const before = Math.floor(Date.now() / 1000);
    runHook(makeInput({ session_id: sid }));
    const after = Math.floor(Date.now() / 1000);

    const bridge = JSON.parse(fs.readFileSync(bp, 'utf8'));
    assert.ok(bridge.timestamp >= before, 'Timestamp should be >= test start');
    assert.ok(bridge.timestamp <= after + 1, 'Timestamp should be <= test end');
  });
});

// ---------------------------------------------------------------------------
// 6. Session ID path traversal validation
// ---------------------------------------------------------------------------
describe('wf-statusline session_id path traversal', () => {
  test('"../hack" session_id does NOT write bridge file', () => {
    const malicious = '../hack';
    const bp = path.join(os.tmpdir(), `claude-ctx-${malicious}.json`);
    // Ensure no pre-existing file
    try { fs.unlinkSync(bp); } catch (_) {}

    const result = runHook(makeInput({
      session_id: malicious,
      context_window: { remaining_percentage: 50 }
    }));
    assert.equal(result.exitCode, 0);
    assert.ok(!fs.existsSync(bp), 'Bridge file must NOT be written for path traversal session_id');
  });

  test('"foo/bar" session_id does NOT write bridge file', () => {
    const malicious = 'foo/bar';
    const bp = path.join(os.tmpdir(), `claude-ctx-${malicious}.json`);
    const result = runHook(makeInput({
      session_id: malicious,
      context_window: { remaining_percentage: 50 }
    }));
    assert.equal(result.exitCode, 0);
    // The path itself is malformed so existsSync on the literal path is fine
    assert.ok(!fs.existsSync(bp), 'Bridge file must NOT be written for session_id with /');
  });

  test('"foo\\\\bar" session_id does NOT write bridge file', () => {
    const malicious = 'foo\\bar';
    const bp = path.join(os.tmpdir(), `claude-ctx-${malicious}.json`);
    const result = runHook(makeInput({
      session_id: malicious,
      context_window: { remaining_percentage: 50 }
    }));
    assert.equal(result.exitCode, 0);
    assert.ok(!fs.existsSync(bp), 'Bridge file must NOT be written for session_id with backslash');
  });

  test('empty session_id does NOT write bridge file', () => {
    const bp = path.join(os.tmpdir(), 'claude-ctx-.json');
    try { fs.unlinkSync(bp); } catch (_) {}

    const result = runHook(makeInput({
      session_id: '',
      context_window: { remaining_percentage: 50 }
    }));
    assert.equal(result.exitCode, 0);
    assert.ok(!fs.existsSync(bp), 'Bridge file must NOT be written for empty session_id');
  });
});

// ---------------------------------------------------------------------------
// 7. No remaining_percentage
// ---------------------------------------------------------------------------
describe('wf-statusline no remaining_percentage', () => {
  test('no context bar rendered when remaining_percentage is absent', () => {
    const sid = testSessionId('no-rem');
    const bp = trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      context_window: {}
    }));
    assert.equal(result.exitCode, 0);
    const clean = stripAnsi(result.stdout);
    assert.ok(!clean.includes('%'), 'Should not contain percentage when remaining is absent');
    assert.ok(!clean.includes('\u2588'), 'Should not contain filled bar segments');
    assert.ok(!clean.includes('\u2591'), 'Should not contain empty bar segments');
  });

  test('no bridge file written when remaining_percentage is absent', () => {
    const sid = testSessionId('no-rem-bridge');
    const bp = trackBridge(sid);
    runHook(makeInput({
      session_id: sid,
      context_window: {}
    }));
    assert.ok(!fs.existsSync(bp), 'Bridge file must NOT be written when remaining_percentage is absent');
  });

  test('no context bar when context_window is null', () => {
    const sid = testSessionId('no-ctx-null');
    const result = runHook(makeInput({
      session_id: sid,
      context_window: null
    }));
    assert.equal(result.exitCode, 0);
    const clean = stripAnsi(result.stdout);
    assert.ok(!clean.includes('%'), 'Should not contain percentage when context_window is null');
  });
});

// ---------------------------------------------------------------------------
// 8. Missing model.display_name defaults to 'Claude'
// ---------------------------------------------------------------------------
describe('wf-statusline default model name', () => {
  test('defaults to Claude when model.display_name is missing', () => {
    const sid = testSessionId('def-model');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      model: {}
    }));
    const clean = stripAnsi(result.stdout);
    assert.ok(clean.includes('Claude'), 'Should default to Claude when display_name missing');
  });

  test('defaults to Claude when model is null', () => {
    const sid = testSessionId('def-model-null');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      model: null
    }));
    const clean = stripAnsi(result.stdout);
    assert.ok(clean.includes('Claude'), 'Should default to Claude when model is null');
  });
});

// ---------------------------------------------------------------------------
// 9. Missing workspace.current_dir defaults to cwd
// ---------------------------------------------------------------------------
describe('wf-statusline default workspace directory', () => {
  test('defaults to cwd basename when workspace.current_dir is missing', () => {
    const sid = testSessionId('def-dir');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      workspace: {}
    }));
    const clean = stripAnsi(result.stdout);
    const expected = path.basename(process.cwd());
    assert.ok(clean.includes(expected), `Should contain cwd basename "${expected}" when dir missing`);
  });

  test('defaults to cwd basename when workspace is null', () => {
    const sid = testSessionId('def-dir-null');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      workspace: null
    }));
    const clean = stripAnsi(result.stdout);
    const expected = path.basename(process.cwd());
    assert.ok(clean.includes(expected), `Should contain cwd basename "${expected}" when workspace is null`);
  });
});

// ---------------------------------------------------------------------------
// 10. Malformed JSON exits gracefully
// ---------------------------------------------------------------------------
describe('wf-statusline malformed input', () => {
  test('malformed JSON exits with code 0 and no output', () => {
    const result = runHook('this-is-not-json{{{');
    assert.equal(result.exitCode, 0, 'Must exit 0 on malformed JSON');
    assert.equal(result.stdout, '', 'Must produce no output on malformed JSON');
  });

  test('empty string input exits with code 0 and no output', () => {
    const result = runHook('');
    assert.equal(result.exitCode, 0, 'Must exit 0 on empty input');
    assert.equal(result.stdout, '', 'Must produce no output on empty input');
  });

  test('partial JSON exits with code 0 and no output', () => {
    const result = runHook('{"model":');
    assert.equal(result.exitCode, 0, 'Must exit 0 on partial JSON');
    assert.equal(result.stdout, '', 'Must produce no output on partial JSON');
  });
});

// ---------------------------------------------------------------------------
// 11. Task display from todo files
// ---------------------------------------------------------------------------
describe('wf-statusline task display', () => {
  const todoSessionId = testSessionId('task-display');
  let todosDir;
  let todoFilePath;

  test('shows active task from todo file when present', () => {
    trackBridge(todoSessionId);

    // Set up a temporary CLAUDE_CONFIG_DIR with a todos directory
    const tmpConfig = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-cfg-'));
    todosDir = path.join(tmpConfig, 'todos');
    fs.mkdirSync(todosDir, { recursive: true });

    // Write a todo file matching the session pattern
    todoFilePath = path.join(todosDir, `${todoSessionId}-agent-main.json`);
    const todos = [
      { status: 'completed', content: 'Setup project', activeForm: 'Setup' },
      { status: 'in_progress', content: 'Implement auth', activeForm: 'Implementing auth' },
      { status: 'pending', content: 'Write tests', activeForm: 'Tests' }
    ];
    fs.writeFileSync(todoFilePath, JSON.stringify(todos));

    const input = makeInput({
      session_id: todoSessionId,
      context_window: { remaining_percentage: 75 }
    });

    try {
      const stdout = execFileSync('node', [HOOK_PATH], {
        input,
        encoding: 'utf8',
        timeout: 5000,
        env: { ...process.env, CLAUDE_CONFIG_DIR: tmpConfig }
      });
      const clean = stripAnsi(stdout);
      assert.ok(clean.includes('Implementing auth'), `Should show active task, got: ${clean}`);
    } finally {
      // Cleanup
      try { fs.unlinkSync(todoFilePath); } catch (_) {}
      try { fs.rmdirSync(todosDir); } catch (_) {}
      try { fs.rmdirSync(tmpConfig); } catch (_) {}
    }
  });

  test('no task segment when no todo files exist', () => {
    const sid = testSessionId('task-none');
    trackBridge(sid);

    const tmpConfig = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-cfg-'));
    const noTodosDir = path.join(tmpConfig, 'todos');
    // Intentionally do NOT create the todos directory

    const input = makeInput({ session_id: sid });
    try {
      const stdout = execFileSync('node', [HOOK_PATH], {
        input,
        encoding: 'utf8',
        timeout: 5000,
        env: { ...process.env, CLAUDE_CONFIG_DIR: tmpConfig }
      });
      const clean = stripAnsi(stdout);
      // Count pipe separators: without task should have 2 (WF | model | dir)
      // With task would have 3 (WF | model | task | dir)
      const pipes = clean.split('\u2502').length - 1;
      assert.ok(pipes <= 3, `Should have at most 3 separators without task, got ${pipes}`);
    } finally {
      try { fs.rmdirSync(tmpConfig); } catch (_) {}
    }
  });

  test('no task segment when todo file has no in_progress items', () => {
    const sid = testSessionId('task-done');
    trackBridge(sid);

    const tmpConfig = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-cfg-'));
    const dir = path.join(tmpConfig, 'todos');
    fs.mkdirSync(dir, { recursive: true });

    const fp = path.join(dir, `${sid}-agent-main.json`);
    const todos = [
      { status: 'completed', content: 'All done', activeForm: 'Done' }
    ];
    fs.writeFileSync(fp, JSON.stringify(todos));

    const input = makeInput({ session_id: sid });
    try {
      const stdout = execFileSync('node', [HOOK_PATH], {
        input,
        encoding: 'utf8',
        timeout: 5000,
        env: { ...process.env, CLAUDE_CONFIG_DIR: tmpConfig }
      });
      const clean = stripAnsi(stdout);
      assert.ok(!clean.includes('Done'), 'Should not show completed task as active');
    } finally {
      try { fs.unlinkSync(fp); } catch (_) {}
      try { fs.rmdirSync(dir); } catch (_) {}
      try { fs.rmdirSync(tmpConfig); } catch (_) {}
    }
  });
});

// ---------------------------------------------------------------------------
// 12. Output structure integration
// ---------------------------------------------------------------------------
describe('wf-statusline output structure', () => {
  test('raw output contains ANSI reset codes', () => {
    const sid = testSessionId('ansi-reset');
    trackBridge(sid);
    const result = runHook(makeInput({ session_id: sid }));
    assert.ok(result.stdout.includes('\x1b[0m'), 'Output should contain ANSI reset codes');
  });

  test('WF prefix is rendered in cyan (\\x1b[36m)', () => {
    const sid = testSessionId('wf-cyan');
    trackBridge(sid);
    const result = runHook(makeInput({ session_id: sid }));
    assert.ok(result.stdout.includes('\x1b[36mWF\x1b[0m'), 'WF should be cyan');
  });

  test('model name is rendered dim (\\x1b[2m)', () => {
    const sid = testSessionId('model-dim');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      model: { display_name: 'Haiku 3.5' }
    }));
    assert.ok(result.stdout.includes('\x1b[2mHaiku 3.5\x1b[0m'), 'Model should be dim');
  });

  test('directory name is rendered dim', () => {
    const sid = testSessionId('dir-dim');
    trackBridge(sid);
    const result = runHook(makeInput({
      session_id: sid,
      workspace: { current_dir: '/usr/local/my-app' }
    }));
    assert.ok(result.stdout.includes('\x1b[2mmy-app\x1b[0m'), 'Directory should be dim');
  });
});
