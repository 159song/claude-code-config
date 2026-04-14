#!/usr/bin/env node
// wf-session-state.test.cjs — Comprehensive TDD tests for session-state hook
// Uses Node.js built-in test runner (node:test + node:assert/strict)
// Strategy: Override HOME env so the hook finds utils.cjs in a temp location,
//           then build .planning/ fixtures to exercise every code path.

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const HOOK_PATH = path.join(__dirname, 'wf-session-state.js');
const REPO_UTILS = path.join(__dirname, '..', 'wf', 'bin', 'lib', 'utils.cjs');

// Shared temp directory for test fixtures
let tmpBase;
let fakeHome;
let fakeUtilsDir;
let projectDir;

/**
 * Run the session-state hook as a subprocess with given JSON input.
 * HOME is overridden so the hook resolves utils.cjs from our temp tree.
 * @param {object} inputObj - JSON input (session_id, cwd, etc.)
 * @param {object} [envOverrides] - Extra env vars
 * @returns {{ exitCode: number, stdout: string, stderr: string }}
 */
function runHook(inputObj, envOverrides) {
  const input = JSON.stringify(inputObj);
  const env = {
    ...process.env,
    HOME: fakeHome,
    ...envOverrides
  };

  try {
    const stdout = execFileSync('node', [HOOK_PATH], {
      input,
      encoding: 'utf8',
      timeout: 10000,
      env
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status || 1,
      stdout: err.stdout || '',
      stderr: err.stderr || ''
    };
  }
}

/**
 * Create a STATE.md file with YAML frontmatter in the project's .planning/ directory
 * @param {object} frontmatter - Key-value pairs for YAML frontmatter
 * @param {string} [body] - Markdown body after frontmatter
 */
function writeStateMd(frontmatter, body) {
  const planningDir = path.join(projectDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  let yaml = '---\n';
  for (const [key, val] of Object.entries(frontmatter)) {
    if (val !== null && typeof val === 'object') {
      yaml += `${key}:\n`;
      for (const [subKey, subVal] of Object.entries(val)) {
        yaml += `  ${subKey}: ${subVal}\n`;
      }
    } else {
      yaml += `${key}: ${val}\n`;
    }
  }
  yaml += '---\n';
  if (body) yaml += body;

  fs.writeFileSync(path.join(planningDir, 'STATE.md'), yaml, 'utf8');
}

/**
 * Create a phase directory with specified artifact files
 * @param {number} phaseNum - Phase number (will be zero-padded)
 * @param {string} phaseName - Phase name suffix
 * @param {string[]} artifactFiles - Array of filenames to create inside the phase dir
 */
function createPhaseDir(phaseNum, phaseName, artifactFiles) {
  const padded = String(phaseNum).padStart(2, '0');
  const phaseDir = path.join(projectDir, '.planning', 'phases', `${padded}-${phaseName}`);
  fs.mkdirSync(phaseDir, { recursive: true });
  for (const file of artifactFiles) {
    fs.writeFileSync(path.join(phaseDir, file), '# placeholder', 'utf8');
  }
}

// ── Setup & Teardown ────────────────────────────────────────────────────

before(() => {
  tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-session-state-test-'));

  // Create fake HOME with utils.cjs at expected path
  fakeHome = path.join(tmpBase, 'fakehome');
  fakeUtilsDir = path.join(fakeHome, '.claude', 'wf', 'bin', 'lib');
  fs.mkdirSync(fakeUtilsDir, { recursive: true });
  fs.copyFileSync(REPO_UTILS, path.join(fakeUtilsDir, 'utils.cjs'));

  // Create project directory (cwd for the hook)
  projectDir = path.join(tmpBase, 'project');
  fs.mkdirSync(projectDir, { recursive: true });
});

after(() => {
  // Clean up temp directory and any bridge files we created
  fs.rmSync(tmpBase, { recursive: true, force: true });

  // Clean up any bridge files in /tmp/ created during tests
  const tmpDir = os.tmpdir();
  try {
    const files = fs.readdirSync(tmpDir);
    for (const f of files) {
      if (f.startsWith('wf-session-test-') && f.endsWith('.json')) {
        fs.unlinkSync(path.join(tmpDir, f));
      }
    }
  } catch (e) { /* ignore */ }
});

// ── 1. Silent exit: no session_id ────────────────────────────────────────

describe('wf-session-state: missing/empty session_id', () => {
  test('exits 0 with no output when session_id is empty string', () => {
    const result = runHook({ session_id: '', cwd: projectDir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should produce no output for empty session_id');
  });

  test('exits 0 with no output when session_id is missing', () => {
    const result = runHook({ cwd: projectDir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should produce no output when session_id is absent');
  });

  test('exits 0 with no output when session_id is null', () => {
    const result = runHook({ session_id: null, cwd: projectDir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should produce no output when session_id is null');
  });
});

// ── 2. Silent exit: path traversal in session_id ─────────────────────────

describe('wf-session-state: session_id path traversal validation', () => {
  test('rejects session_id containing "../"', () => {
    const result = runHook({ session_id: '../etc/passwd', cwd: projectDir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should reject path traversal with ../');
  });

  test('rejects session_id containing forward slash', () => {
    const result = runHook({ session_id: 'foo/bar', cwd: projectDir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should reject forward slash in session_id');
  });

  test('rejects session_id containing backslash', () => {
    const result = runHook({ session_id: 'foo\\bar', cwd: projectDir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should reject backslash in session_id');
  });

  test('rejects session_id containing ".."', () => {
    const result = runHook({ session_id: 'abc..def', cwd: projectDir });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, '', 'Should reject ".." anywhere in session_id');
  });

  test('accepts clean alphanumeric session_id', () => {
    // This will proceed past validation but may exit due to no .planning/STATE.md
    const result = runHook({ session_id: 'abc123-xyz', cwd: projectDir });
    assert.equal(result.exitCode, 0);
    // Output depends on .planning/ existence — just confirm it didn't crash
  });
});

// ── 3. Graceful exit: no .planning/ directory ────────────────────────────

describe('wf-session-state: no .planning directory', () => {
  test('outputs suggestion to run /wf-new-project when no .planning/ exists', () => {
    // Use a cwd with no .planning dir
    const emptyDir = path.join(tmpBase, 'empty-project');
    fs.mkdirSync(emptyDir, { recursive: true });

    const result = runHook({ session_id: 'test-no-planning', cwd: emptyDir });
    assert.equal(result.exitCode, 0);
    assert.ok(
      result.stdout.includes('wf-new-project') || result.stdout.includes('项目状态提醒'),
      'Should suggest initializing project or show status reminder'
    );
  });
});

// ── 4. Graceful exit: STATE.md is missing ────────────────────────────────

describe('wf-session-state: .planning exists but STATE.md missing', () => {
  test('outputs suggestion when .planning/ exists but STATE.md does not', () => {
    const noStateDir = path.join(tmpBase, 'no-state-project');
    fs.mkdirSync(path.join(noStateDir, '.planning'), { recursive: true });

    const result = runHook({ session_id: 'test-no-state', cwd: noStateDir });
    assert.equal(result.exitCode, 0);
    assert.ok(
      result.stdout.includes('wf-new-project'),
      'Should suggest running /wf-new-project when STATE.md is missing'
    );
  });
});

// ── 5. Human-readable Chinese summary when STATE.md exists ──────────────

describe('wf-session-state: human-readable output', () => {
  test('includes Chinese summary header', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 2, percent: 45 }
    });

    const result = runHook({ session_id: 'test-summary', cwd: projectDir });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('## 项目状态提醒'), 'Should include Chinese status header');
    assert.ok(result.stdout.includes('阶段 2'), 'Should include phase number');
    assert.ok(result.stdout.includes('45%'), 'Should include progress percentage');
    assert.ok(result.stdout.includes('executing'), 'Should include status');
  });

  test('shows phase as "?" when phase number is missing', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'planning'
    });

    const result = runHook({ session_id: 'test-no-phase', cwd: projectDir });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('阶段 ?'), 'Should show "?" for missing phase');
  });
});

// ── 6. hookSpecificOutput with sessionState ─────────────────────────────

describe('wf-session-state: hookSpecificOutput structure', () => {
  test('output contains hookSpecificOutput JSON with SessionStart event', () => {
    writeStateMd({
      milestone: 'MVP',
      status: 'executing',
      progress: { current_phase: 1, percent: 20 }
    });

    const result = runHook({ session_id: 'test-hook-output', cwd: projectDir });
    assert.equal(result.exitCode, 0);

    // The output is human-readable text followed by JSON on the same stdout
    // Extract the JSON portion
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    assert.ok(jsonMatch, 'Output should contain hookSpecificOutput JSON');

    const hookOutput = JSON.parse(jsonMatch[1]);
    assert.equal(hookOutput.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.ok(hookOutput.hookSpecificOutput.additionalContext, 'Should have additionalContext');

    const sessionState = JSON.parse(hookOutput.hookSpecificOutput.additionalContext);
    assert.ok(sessionState, 'additionalContext should be valid JSON');
  });
});

// ── 7. sessionState has correct fields ──────────────────────────────────

describe('wf-session-state: sessionState field completeness', () => {
  test('sessionState contains all expected fields with correct values', () => {
    writeStateMd({
      milestone: 'Release-2.0',
      status: 'executing',
      progress: { current_phase: 3, percent: 67 }
    });

    const result = runHook({ session_id: 'test-fields', cwd: projectDir });
    assert.equal(result.exitCode, 0);

    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    assert.ok(jsonMatch, 'Should contain hookSpecificOutput JSON');

    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    // Verify all required fields exist
    assert.ok('milestone' in sessionState, 'Should have milestone field');
    assert.ok('phase' in sessionState, 'Should have phase field');
    assert.ok('step' in sessionState, 'Should have step field');
    assert.ok('status' in sessionState, 'Should have status field');
    assert.ok('progress_pct' in sessionState, 'Should have progress_pct field');
    assert.ok('has_handoff' in sessionState, 'Should have has_handoff field');
    assert.ok('resume_hint' in sessionState, 'Should have resume_hint field');
    assert.ok('has_continuation' in sessionState, 'Should have has_continuation field');

    // Verify values
    assert.equal(sessionState.milestone, 'Release-2.0');
    assert.equal(sessionState.phase, 3);
    assert.equal(sessionState.status, 'executing');
    assert.equal(sessionState.progress_pct, 67);
    assert.equal(sessionState.has_handoff, false);
    assert.equal(sessionState.resume_hint, null);
    assert.equal(sessionState.has_continuation, false);
  });

  test('sessionState defaults: null milestone, 0 progress, unknown status when absent', () => {
    writeStateMd({
      progress: { current_phase: 1, percent: 0 }
    });

    const result = runHook({ session_id: 'test-defaults', cwd: projectDir });
    assert.equal(result.exitCode, 0);

    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.milestone, null, 'Missing milestone should be null');
    assert.equal(sessionState.status, 'unknown', 'Missing status should be "unknown"');
  });
});

// ── 8. HANDOFF.json detection ───────────────────────────────────────────

describe('wf-session-state: HANDOFF.json detection', () => {
  test('has_handoff=true and resume_hint populated when HANDOFF.json exists', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'paused',
      progress: { current_phase: 2, percent: 50 }
    });

    // Create HANDOFF.json
    const handoffPath = path.join(projectDir, '.planning', 'HANDOFF.json');
    fs.writeFileSync(handoffPath, JSON.stringify({
      resume_command: '/wf-execute-phase 2 --wave 3',
      reason: 'Context budget low'
    }), 'utf8');

    const result = runHook({ session_id: 'test-handoff', cwd: projectDir });
    assert.equal(result.exitCode, 0);

    // Should mention handoff in human-readable output
    assert.ok(result.stdout.includes('wf-resume'), 'Should mention /wf-resume for handoff');

    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.has_handoff, true, 'has_handoff should be true');
    assert.equal(sessionState.resume_hint, '/wf-execute-phase 2 --wave 3', 'resume_hint should match HANDOFF.json');

    // Clean up handoff file for subsequent tests
    fs.unlinkSync(handoffPath);
  });

  test('has_handoff=true but resume_hint null when HANDOFF.json lacks resume_command', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'paused',
      progress: { current_phase: 1, percent: 10 }
    });

    const handoffPath = path.join(projectDir, '.planning', 'HANDOFF.json');
    fs.writeFileSync(handoffPath, JSON.stringify({
      reason: 'Manual pause'
    }), 'utf8');

    const result = runHook({ session_id: 'test-handoff-no-resume', cwd: projectDir });
    assert.equal(result.exitCode, 0);

    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.has_handoff, true, 'has_handoff should be true');
    assert.equal(sessionState.resume_hint, null, 'resume_hint should be null without resume_command');

    fs.unlinkSync(handoffPath);
  });

  test('has_handoff=false when no HANDOFF.json', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 1, percent: 30 }
    });

    // Ensure no HANDOFF.json
    const handoffPath = path.join(projectDir, '.planning', 'HANDOFF.json');
    if (fs.existsSync(handoffPath)) fs.unlinkSync(handoffPath);

    const result = runHook({ session_id: 'test-no-handoff', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.has_handoff, false, 'has_handoff should be false');
    assert.equal(sessionState.resume_hint, null, 'resume_hint should be null');
  });
});

// ── 9. CONTINUATION.md detection ────────────────────────────────────────

describe('wf-session-state: CONTINUATION.md detection', () => {
  test('has_continuation=true with phase/step extracted from frontmatter', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 3, percent: 60 }
    });

    const contPath = path.join(projectDir, '.planning', 'CONTINUATION.md');
    fs.writeFileSync(contPath, [
      '---',
      'phase: 3',
      'step: execute',
      'wave: 2',
      '---',
      '# Continuation checkpoint',
      'Resume from wave 2 of phase 3.'
    ].join('\n'), 'utf8');

    const result = runHook({ session_id: 'test-continuation', cwd: projectDir });
    assert.equal(result.exitCode, 0);

    // Human-readable output should mention checkpoint
    assert.ok(result.stdout.includes('检测到自主模式检查点'), 'Should mention checkpoint in Chinese');
    assert.ok(result.stdout.includes('Phase 3'), 'Should mention phase number');
    assert.ok(result.stdout.includes('execute'), 'Should mention step');

    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.has_continuation, true, 'has_continuation should be true');
    assert.equal(sessionState.continuation_phase, 3, 'continuation_phase should be 3');
    assert.equal(sessionState.continuation_step, 'execute', 'continuation_step should be "execute"');

    fs.unlinkSync(contPath);
  });

  test('has_continuation=false when no CONTINUATION.md', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 1, percent: 10 }
    });

    // Ensure no CONTINUATION.md
    const contPath = path.join(projectDir, '.planning', 'CONTINUATION.md');
    if (fs.existsSync(contPath)) fs.unlinkSync(contPath);

    const result = runHook({ session_id: 'test-no-continuation', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.has_continuation, false, 'has_continuation should be false');
    assert.equal(sessionState.continuation_phase, null);
    assert.equal(sessionState.continuation_step, null);
  });

  test('CONTINUATION.md without frontmatter yields null phase/step', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 1, percent: 10 }
    });

    const contPath = path.join(projectDir, '.planning', 'CONTINUATION.md');
    fs.writeFileSync(contPath, '# No frontmatter here\nJust a plain markdown file.\n', 'utf8');

    const result = runHook({ session_id: 'test-cont-no-fm', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.has_continuation, true, 'has_continuation should be true (file exists)');
    assert.equal(sessionState.continuation_phase, null, 'phase should be null without frontmatter');
    assert.equal(sessionState.continuation_step, null, 'step should be null without frontmatter');

    fs.unlinkSync(contPath);
  });
});

// ── 10. Bridge file written to /tmp/ ─────────────────────────────────────

describe('wf-session-state: bridge file', () => {
  test('writes bridge file to /tmp/wf-session-{sessionId}.json', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 1, percent: 25 }
    });

    const sessionId = 'test-bridge-' + Date.now();
    const bridgePath = path.join(os.tmpdir(), `wf-session-${sessionId}.json`);

    // Ensure bridge file does not exist before test
    if (fs.existsSync(bridgePath)) fs.unlinkSync(bridgePath);

    runHook({ session_id: sessionId, cwd: projectDir });

    assert.ok(fs.existsSync(bridgePath), 'Bridge file should be created in /tmp/');

    const bridgeData = JSON.parse(fs.readFileSync(bridgePath, 'utf8'));
    assert.equal(bridgeData.milestone, 'v1.0', 'Bridge file should contain milestone');
    assert.equal(bridgeData.phase, 1, 'Bridge file should contain phase');
    assert.equal(bridgeData.status, 'executing', 'Bridge file should contain status');
    assert.equal(bridgeData.progress_pct, 25, 'Bridge file should contain progress_pct');

    // Clean up
    fs.unlinkSync(bridgePath);
  });

  test('bridge file sessionState matches stdout sessionState', () => {
    writeStateMd({
      milestone: 'consistency-check',
      status: 'planning',
      progress: { current_phase: 2, percent: 40 }
    });

    const sessionId = 'test-bridge-match-' + Date.now();
    const bridgePath = path.join(os.tmpdir(), `wf-session-${sessionId}.json`);

    const result = runHook({ session_id: sessionId, cwd: projectDir });

    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const stdoutState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );
    const bridgeState = JSON.parse(fs.readFileSync(bridgePath, 'utf8'));

    assert.deepEqual(bridgeState, stdoutState, 'Bridge file and stdout sessionState should be identical');

    fs.unlinkSync(bridgePath);
  });
});

// ── 11. detectStep behavior via phase artifacts ─────────────────────────

describe('wf-session-state: detectStep via phase artifacts', () => {
  test('step is "discuss" when no phases directory exists', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 1, percent: 5 }
    });

    // Ensure no phases dir
    const phasesDir = path.join(projectDir, '.planning', 'phases');
    if (fs.existsSync(phasesDir)) fs.rmSync(phasesDir, { recursive: true, force: true });

    const result = runHook({ session_id: 'test-step-no-phases', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.step, 'discuss', 'No phases dir should result in "discuss" step');
  });

  test('step is "discuss" when phase dir has no recognized artifacts', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 1, percent: 5 }
    });

    // Remove old phases dir, create empty phase dir
    const phasesDir = path.join(projectDir, '.planning', 'phases');
    if (fs.existsSync(phasesDir)) fs.rmSync(phasesDir, { recursive: true, force: true });
    createPhaseDir(1, 'foundation', ['README.md']);

    const result = runHook({ session_id: 'test-step-empty-phase', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.step, 'discuss', 'Empty phase dir should result in "discuss" step');
  });

  test('step is "plan" when CONTEXT file exists', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 2, percent: 15 }
    });

    const phasesDir = path.join(projectDir, '.planning', 'phases');
    if (fs.existsSync(phasesDir)) fs.rmSync(phasesDir, { recursive: true, force: true });
    createPhaseDir(2, 'api-layer', ['CONTEXT.md']);

    const result = runHook({ session_id: 'test-step-context', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.step, 'plan', 'CONTEXT artifact should result in "plan" step');
  });

  test('step is "execute" when PLAN file exists (N-N-PLAN pattern)', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 3, percent: 40 }
    });

    const phasesDir = path.join(projectDir, '.planning', 'phases');
    if (fs.existsSync(phasesDir)) fs.rmSync(phasesDir, { recursive: true, force: true });
    createPhaseDir(3, 'frontend', ['CONTEXT.md', '3-1-PLAN.md', '3-2-PLAN.md']);

    const result = runHook({ session_id: 'test-step-plan', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.step, 'execute', 'PLAN artifacts should result in "execute" step');
  });

  test('step is "verify" when SUMMARY file exists', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 4, percent: 80 }
    });

    const phasesDir = path.join(projectDir, '.planning', 'phases');
    if (fs.existsSync(phasesDir)) fs.rmSync(phasesDir, { recursive: true, force: true });
    createPhaseDir(4, 'testing', ['CONTEXT.md', '4-1-PLAN.md', 'SUMMARY.md']);

    const result = runHook({ session_id: 'test-step-summary', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.step, 'verify', 'SUMMARY artifact should result in "verify" step');
  });

  test('step is "done" when VERIFICATION file exists', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 5, percent: 100 }
    });

    const phasesDir = path.join(projectDir, '.planning', 'phases');
    if (fs.existsSync(phasesDir)) fs.rmSync(phasesDir, { recursive: true, force: true });
    createPhaseDir(5, 'deploy', ['CONTEXT.md', '5-1-PLAN.md', 'SUMMARY.md', 'VERIFICATION.md']);

    const result = runHook({ session_id: 'test-step-verification', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.step, 'done', 'VERIFICATION artifact should result in "done" step');
  });

  test('step is "unknown" when phase number is missing from STATE.md', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'planning'
      // No progress.current_phase
    });

    const result = runHook({ session_id: 'test-step-unknown', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.step, 'unknown', 'Missing phase number should result in "unknown" step');
  });

  test('step is "discuss" when phases dir exists but phase number has no matching dir', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 99, percent: 0 }
    });

    const phasesDir = path.join(projectDir, '.planning', 'phases');
    if (fs.existsSync(phasesDir)) fs.rmSync(phasesDir, { recursive: true, force: true });
    // Create phase 1 dir but look for phase 99
    createPhaseDir(1, 'foundation', ['CONTEXT.md']);

    const result = runHook({ session_id: 'test-step-no-match', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.step, 'discuss', 'Unmatched phase number should fall back to "discuss"');
  });
});

// ── 12. Malformed JSON input ─────────────────────────────────────────────

describe('wf-session-state: malformed input', () => {
  test('exits 0 with no output on completely invalid JSON', () => {
    const env = { ...process.env, HOME: fakeHome };
    try {
      const stdout = execFileSync('node', [HOOK_PATH], {
        input: 'this is not json at all {{{',
        encoding: 'utf8',
        timeout: 10000,
        env
      });
      // If we reach here, it exited 0 with possible empty output
      assert.equal(typeof stdout, 'string');
    } catch (err) {
      assert.equal(err.status, 0, 'Should exit 0 on malformed JSON');
    }
  });

  test('exits 0 on empty input', () => {
    const env = { ...process.env, HOME: fakeHome };
    try {
      const stdout = execFileSync('node', [HOOK_PATH], {
        input: '',
        encoding: 'utf8',
        timeout: 10000,
        env
      });
      assert.equal(typeof stdout, 'string');
    } catch (err) {
      assert.equal(err.status, 0, 'Should exit 0 on empty input');
    }
  });

  test('exits 0 on partial JSON', () => {
    const env = { ...process.env, HOME: fakeHome };
    try {
      const stdout = execFileSync('node', [HOOK_PATH], {
        input: '{"session_id": "abc',
        encoding: 'utf8',
        timeout: 10000,
        env
      });
      assert.equal(typeof stdout, 'string');
    } catch (err) {
      assert.equal(err.status, 0, 'Should exit 0 on partial JSON');
    }
  });
});

// ── 13. parseFm behavior (tested through hook output) ───────────────────

describe('wf-session-state: parseFm/parseVal behavior via output', () => {
  test('parses integer values correctly', () => {
    writeStateMd({
      milestone: 'v2',
      status: 'executing',
      progress: { current_phase: 7, percent: 88 }
    });

    const result = runHook({ session_id: 'test-parse-int', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.phase, 7, 'Integer phase should parse as number');
    assert.equal(sessionState.progress_pct, 88, 'Integer percent should parse as number');
  });

  test('parses boolean values correctly (status as string)', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'true',
      progress: { current_phase: 1, percent: 0 }
    });

    const result = runHook({ session_id: 'test-parse-bool', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    // 'true' is parsed by parseVal as boolean true
    assert.equal(sessionState.status, true, 'String "true" should be parsed as boolean by parseVal');
  });

  test('parses quoted strings correctly', () => {
    // Write STATE.md manually to include quoted strings in YAML
    const planningDir = path.join(projectDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), [
      '---',
      'milestone: "Phase Alpha"',
      'status: "in-progress"',
      'progress:',
      '  current_phase: 1',
      '  percent: 50',
      '---',
      '# Body'
    ].join('\n'), 'utf8');

    const result = runHook({ session_id: 'test-parse-quoted', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.milestone, 'Phase Alpha', 'Quoted string should have quotes stripped');
    assert.equal(sessionState.status, 'in-progress', 'Quoted status should have quotes stripped');
  });

  test('handles null/empty frontmatter values gracefully', () => {
    const planningDir = path.join(projectDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), [
      '---',
      'milestone: null',
      'status: ~',
      'progress:',
      '  current_phase: 1',
      '  percent: 0',
      '---',
      '# Body'
    ].join('\n'), 'utf8');

    const result = runHook({ session_id: 'test-parse-null', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.milestone, null, '"null" string should parse as null');
    // status falls back to 'unknown' when value is null due to || 'unknown'
    assert.equal(sessionState.status, 'unknown', '"~" should parse as null, fallback to "unknown"');
  });

  test('handles float percent values', () => {
    const planningDir = path.join(projectDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), [
      '---',
      'milestone: v1',
      'status: executing',
      'progress:',
      '  current_phase: 2',
      '  percent: 33.5',
      '---',
      ''
    ].join('\n'), 'utf8');

    const result = runHook({ session_id: 'test-parse-float', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.progress_pct, 33.5, 'Float percent should parse correctly');
  });
});

// ── 14. config.json mode display ────────────────────────────────────────

describe('wf-session-state: config.json mode in output', () => {
  test('includes config mode in human-readable output when config.json exists', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 1, percent: 10 }
    });

    const configPath = path.join(projectDir, '.planning', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ mode: 'autonomous' }), 'utf8');

    const result = runHook({ session_id: 'test-config-mode', cwd: projectDir });
    assert.ok(result.stdout.includes('mode=autonomous'), 'Should include config mode in output');

    fs.unlinkSync(configPath);
  });

  test('omits config line when config.json is absent', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'executing',
      progress: { current_phase: 1, percent: 10 }
    });

    const configPath = path.join(projectDir, '.planning', 'config.json');
    if (fs.existsSync(configPath)) fs.unlinkSync(configPath);

    const result = runHook({ session_id: 'test-no-config', cwd: projectDir });
    assert.ok(!result.stdout.includes('配置: mode='), 'Should not include config line when config.json missing');
  });
});

// ── 15. Edge cases and robustness ───────────────────────────────────────

describe('wf-session-state: edge cases', () => {
  test('hook always exits 0 regardless of internal errors', () => {
    // Provide a valid session_id but point to a non-existent cwd
    const result = runHook({
      session_id: 'test-bad-cwd',
      cwd: '/nonexistent/path/that/does/not/exist'
    });
    assert.equal(result.exitCode, 0, 'Should always exit 0 even with bad cwd');
  });

  test('STATE.md with no frontmatter delimiters produces default state', () => {
    const planningDir = path.join(projectDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), '# Just a heading\nNo frontmatter here.\n', 'utf8');

    const result = runHook({ session_id: 'test-no-frontmatter', cwd: projectDir });
    assert.equal(result.exitCode, 0);

    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.milestone, null, 'No frontmatter should yield null milestone');
    assert.equal(sessionState.phase, null, 'No frontmatter should yield null phase');
    assert.equal(sessionState.status, 'unknown', 'No frontmatter should yield "unknown" status');
    assert.equal(sessionState.progress_pct, 0, 'No frontmatter should yield 0 progress');
  });

  test('STATE.md with unclosed frontmatter (no closing ---) produces default state', () => {
    const planningDir = path.join(projectDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), '---\nmilestone: v1\nstatus: broken\n# No closing ---\n', 'utf8');

    const result = runHook({ session_id: 'test-unclosed-fm', cwd: projectDir });
    assert.equal(result.exitCode, 0);

    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    // Unclosed frontmatter means parseFm returns empty frontmatter
    assert.equal(sessionState.milestone, null, 'Unclosed frontmatter should yield null milestone');
    assert.equal(sessionState.status, 'unknown', 'Unclosed frontmatter should yield "unknown" status');
  });

  test('handles both HANDOFF.json and CONTINUATION.md simultaneously', () => {
    writeStateMd({
      milestone: 'v1.0',
      status: 'paused',
      progress: { current_phase: 2, percent: 50 }
    });

    const handoffPath = path.join(projectDir, '.planning', 'HANDOFF.json');
    fs.writeFileSync(handoffPath, JSON.stringify({
      resume_command: '/wf-execute-phase 2'
    }), 'utf8');

    const contPath = path.join(projectDir, '.planning', 'CONTINUATION.md');
    fs.writeFileSync(contPath, [
      '---',
      'phase: 2',
      'step: execute',
      '---',
      '# Checkpoint'
    ].join('\n'), 'utf8');

    const result = runHook({ session_id: 'test-both-checkpoints', cwd: projectDir });
    const jsonMatch = result.stdout.match(/(\{[\s\S]*"hookSpecificOutput"[\s\S]*\})$/);
    const sessionState = JSON.parse(
      JSON.parse(jsonMatch[1]).hookSpecificOutput.additionalContext
    );

    assert.equal(sessionState.has_handoff, true, 'Should detect HANDOFF.json');
    assert.equal(sessionState.has_continuation, true, 'Should detect CONTINUATION.md');
    assert.equal(sessionState.resume_hint, '/wf-execute-phase 2');
    assert.equal(sessionState.continuation_phase, 2);
    assert.equal(sessionState.continuation_step, 'execute');

    // When both exist, CONTINUATION takes priority in human-readable output
    assert.ok(
      result.stdout.includes('检测到自主模式检查点'),
      'CONTINUATION should take priority in display when both exist'
    );

    fs.unlinkSync(handoffPath);
    fs.unlinkSync(contPath);
  });
});

// ── 16. utils.cjs unavailable (graceful degradation) ────────────────────

describe('wf-session-state: graceful degradation without utils.cjs', () => {
  test('exits 0 silently when utils.cjs cannot be loaded', () => {
    // Use a HOME that has no .claude/wf/bin/lib/utils.cjs
    const emptyHome = path.join(tmpBase, 'empty-home');
    fs.mkdirSync(emptyHome, { recursive: true });

    const result = runHook(
      { session_id: 'test-no-utils', cwd: projectDir },
      { HOME: emptyHome }
    );
    assert.equal(result.exitCode, 0, 'Should exit 0 when utils.cjs is unavailable');
    assert.equal(result.stdout, '', 'Should produce no output when utils.cjs is unavailable');
  });
});
