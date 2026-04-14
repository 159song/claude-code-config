#!/usr/bin/env node
'use strict';

// wf-e2e.test.cjs — End-to-end workflow simulation test
// Tests the full lifecycle of WF operations working together via CLI calls

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const CLI_PATH = path.join(PROJECT_ROOT, 'wf/bin/wf-tools.cjs');

// Helper: run wf-tools CLI with --cwd pointing to temp project
function runCli(tmpDir, args) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [CLI_PATH, '--cwd', tmpDir, ...args],
      { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 10000 }
    );
    return { stdout, stderr: '', status: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      status: err.status || 1,
    };
  }
}

// Helper: parse JSON stdout, fail with context on parse error
function parseOutput(result, label) {
  assert.equal(result.status, 0, `${label}: expected exit 0, got ${result.status}. stderr: ${result.stderr}`);
  try {
    return JSON.parse(result.stdout);
  } catch (e) {
    assert.fail(`${label}: failed to parse JSON output. stdout: ${result.stdout.slice(0, 200)}`);
  }
}

// ============================================================
// Full lifecycle E2E test
// ============================================================

test('E2E: full project lifecycle via wf-tools CLI', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-e2e-'));

  try {
    // ---- Step 1: init new-project on empty dir ----
    // .planning does not exist yet; init new-project should still return info
    const initResult = runCli(tmpDir, ['init', 'new-project']);
    const initData = parseOutput(initResult, 'step 1: init new-project');
    assert.equal(initData.planning_dir, '.planning');
    // No files created yet by init (it only reads)
    assert.equal(initData.has_project, false);
    assert.equal(initData.has_config, false);
    assert.equal(initData.has_roadmap, false);

    // ---- Step 2: Manually create STATE.md ----
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    const stateMd = `---
status: initialized
last_updated: "2024-01-01T00:00:00.000Z"
last_activity: 2024-01-01
milestone: v1.0
progress:
  current_phase: 0
  total_phases: 1
  percent: 0
---

# Project State
`;
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), stateMd);

    // ---- Step 3: Create ROADMAP.md ----
    const roadmapMd = `# Roadmap

## Phase 1: Setup

**Goal:** Bootstrap the project structure

## Progress

None yet.
`;
    fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), roadmapMd);

    // ---- Step 4: Create config.json ----
    const configJson = { mode: 'manual', workflow: { research: false } };
    fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify(configJson, null, 2));

    // ---- Step 5: state set status discussing ----
    const setResult = runCli(tmpDir, ['state', 'set', 'status', 'discussing']);
    assert.equal(setResult.status, 0);

    // ---- Step 6: state get status -> verify returns "discussing" ----
    const getResult = runCli(tmpDir, ['state', 'get', 'status']);
    const getData = parseOutput(getResult, 'step 6: state get status');
    assert.equal(getData.value, 'discussing');

    // ---- Step 7: Create phase directory structure ----
    const phaseDir = path.join(planningDir, 'phases', '01-setup');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, 'CONTEXT.md'), '# Phase 1 Context\n\nProject bootstrap.\n');

    // ---- Step 8: init phase-op 1 -> verify phase_found=true ----
    const phaseOpResult = runCli(tmpDir, ['init', 'phase-op', '1']);
    const phaseOpData = parseOutput(phaseOpResult, 'step 8: init phase-op 1');
    assert.equal(phaseOpData.phase_found, true);
    assert.equal(phaseOpData.has_context, true);
    assert.equal(phaseOpData.planning_exists, true);

    // ---- Step 9: phase info 1 -> verify phase info returned ----
    const phaseInfoResult = runCli(tmpDir, ['phase', 'info', '1']);
    const phaseInfoData = parseOutput(phaseInfoResult, 'step 9: phase info 1');
    assert.equal(phaseInfoData.phase_found, true);
    assert.equal(phaseInfoData.exists, true);
    assert.equal(phaseInfoData.has_context, true);

    // ---- Step 10: Add PLAN.md to phase dir ----
    fs.writeFileSync(path.join(phaseDir, 'PLAN.md'), '# Plan\n\n## Tasks\n\n- [ ] Task 1\n');

    // ---- Step 11: progress -> verify progress percentage > 0 ----
    const progressResult1 = runCli(tmpDir, ['progress']);
    const progressData1 = parseOutput(progressResult1, 'step 11: progress (with CONTEXT + PLAN)');
    assert.ok(progressData1.phases.length > 0, 'should have at least one phase');
    const phase1Progress = progressData1.phases.find(p => p.phase === 1);
    assert.ok(phase1Progress, 'should find phase 1 in progress');
    // CONTEXT (25%) + PLAN (25%) = 50%
    assert.ok(phase1Progress.progress > 0, 'phase 1 progress should be > 0');

    // ---- Step 12: state patch -> verify batch update ----
    const patchResult = runCli(tmpDir, ['state', 'patch', '--status', 'executing', '--last_activity', 'execute-phase']);
    const patchData = parseOutput(patchResult, 'step 12: state patch');
    assert.equal(patchData.success, true);
    assert.ok(patchData.updated.includes('status'));
    assert.ok(patchData.updated.includes('last_activity'));

    // Verify the patch took effect
    const verifyPatchResult = runCli(tmpDir, ['state', 'get', 'status']);
    const verifyPatchData = parseOutput(verifyPatchResult, 'step 12 verify: state get status');
    assert.equal(verifyPatchData.value, 'executing');

    // ---- Step 13: Add SUMMARY.md to phase dir ----
    fs.writeFileSync(path.join(phaseDir, 'SUMMARY.md'), '# Summary\n\nPhase 1 completed successfully.\n');

    // ---- Step 14: Add VERIFICATION.md with PASS content ----
    fs.writeFileSync(path.join(phaseDir, 'VERIFICATION.md'), '# Verification\n\nResult: PASS\n\nAll checks passed.\n');

    // ---- Step 15: progress -> verify progress = 100% for phase 1 ----
    const progressResult2 = runCli(tmpDir, ['progress']);
    const progressData2 = parseOutput(progressResult2, 'step 15: progress (full phase)');
    const phase1Final = progressData2.phases.find(p => p.phase === 1);
    assert.ok(phase1Final, 'should find phase 1');
    // CONTEXT + PLAN + SUMMARY + VERIFICATION(PASS) = 100%
    assert.equal(phase1Final.progress, 100);

    // ---- Step 16: validate health -> verify health check passes ----
    const validateResult = runCli(tmpDir, ['validate', 'health']);
    const validateData = parseOutput(validateResult, 'step 16: validate health');
    assert.equal(validateData.valid, true);
    assert.deepEqual(validateData.issues, []);

    // ---- Step 17: session pause -> verify HANDOFF.json created ----
    const pauseResult = runCli(tmpDir, ['session', 'pause', '--phase', '1', '--step', 'execute']);
    const pauseData = parseOutput(pauseResult, 'step 17: session pause');
    assert.equal(pauseData.success, true);
    assert.ok(fs.existsSync(path.join(planningDir, 'HANDOFF.json')), 'HANDOFF.json should exist');
    assert.ok(fs.existsSync(path.join(tmpDir, '.continue-here.md')), '.continue-here.md should exist');

    // ---- Step 18: session status -> verify handoff info ----
    const statusResult = runCli(tmpDir, ['session', 'status']);
    const statusData = parseOutput(statusResult, 'step 18: session status');
    assert.equal(statusData.has_handoff, true);
    assert.equal(statusData.handoff.phase, 1);
    assert.equal(statusData.handoff.step, 'execute');

    // ---- Step 19: session resume -> verify handoff deleted ----
    const resumeResult = runCli(tmpDir, ['session', 'resume']);
    const resumeData = parseOutput(resumeResult, 'step 19: session resume');
    assert.equal(resumeData.success, true);
    assert.equal(resumeData.cleaned, true);
    assert.ok(!fs.existsSync(path.join(planningDir, 'HANDOFF.json')), 'HANDOFF.json should be deleted');
    assert.ok(!fs.existsSync(path.join(tmpDir, '.continue-here.md')), '.continue-here.md should be deleted');

    // ---- Step 20: config set mode autonomous -> verify config saved ----
    const configSetResult = runCli(tmpDir, ['config', 'set', 'mode', 'autonomous']);
    const configSetData = parseOutput(configSetResult, 'step 20: config set mode');
    assert.equal(configSetData.success, true);
    assert.equal(configSetData.key, 'mode');
    assert.equal(configSetData.value, 'autonomous');

    // ---- Step 21: config get mode -> verify returns "autonomous" ----
    const configGetResult = runCli(tmpDir, ['config', 'get', 'mode']);
    const configGetData = parseOutput(configGetResult, 'step 21: config get mode');
    assert.equal(configGetData.key, 'mode');
    assert.equal(configGetData.value, 'autonomous');
    // Project config was set, so it should not be the default
    assert.equal(configGetData.is_default, false);

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ============================================================
// Supplemental E2E: state begin-phase and advance-plan flow
// ============================================================

test('E2E: state begin-phase and advance-plan lifecycle', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-e2e-advance-'));

  try {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    const stateMd = `---
status: planning
last_updated: "2024-01-01T00:00:00.000Z"
last_activity: 2024-01-01
milestone: v1.0
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 4
  completed_plans: 0
  percent: 0
---

# Project State
`;
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), stateMd);

    // Begin phase 1
    const beginResult = runCli(tmpDir, ['state', 'begin-phase', '--phase', '1']);
    const beginData = parseOutput(beginResult, 'begin-phase 1');
    assert.equal(beginData.success, true);
    assert.equal(beginData.phase, 1);

    // Verify status changed to executing
    const stateResult = runCli(tmpDir, ['state', 'get', 'status']);
    const stateData = parseOutput(stateResult, 'verify begin-phase status');
    assert.equal(stateData.value, 'executing');

    // Advance plan 1
    const adv1Result = runCli(tmpDir, ['state', 'advance-plan', '--phase', '1', '--plan', '1']);
    const adv1Data = parseOutput(adv1Result, 'advance-plan 1');
    assert.equal(adv1Data.success, true);
    assert.equal(adv1Data.progress.completed_plans, 1);
    assert.equal(adv1Data.progress.percent, 25);

    // Advance plan 2
    const adv2Result = runCli(tmpDir, ['state', 'advance-plan', '--phase', '1', '--plan', '2']);
    const adv2Data = parseOutput(adv2Result, 'advance-plan 2');
    assert.equal(adv2Data.success, true);
    assert.equal(adv2Data.progress.completed_plans, 2);
    assert.equal(adv2Data.progress.percent, 50);

    // Read full state JSON to verify consistency
    const fullStateResult = runCli(tmpDir, ['state', 'json']);
    const fullState = parseOutput(fullStateResult, 'full state json');
    assert.equal(fullState.status, 'executing');
    assert.equal(fullState.progress.completed_plans, 2);
    assert.equal(fullState.progress.total_plans, 4);

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ============================================================
// Supplemental E2E: validate health with repair flow
// ============================================================

test('E2E: validate health detects and repairs broken STATE.md', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-e2e-repair-'));

  try {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    // Write a STATE.md missing required keys
    const brokenState = `---
status: executing
---

# Project State
`;
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), brokenState);

    // Health check should report issues
    const healthResult = runCli(tmpDir, ['validate', 'health']);
    const healthData = parseOutput(healthResult, 'validate health (broken)');
    assert.equal(healthData.valid, false);
    assert.ok(healthData.issues.length > 0, 'should report missing keys');
    assert.ok(healthData.issues.some(i => i.includes('last_updated')), 'should report missing last_updated');

    // Repair
    const repairResult = runCli(tmpDir, ['validate', 'health', '--repair']);
    const repairData = parseOutput(repairResult, 'validate health --repair');
    assert.ok(repairData.repaired.length > 0, 'should have repaired items');

    // Re-check should pass
    const recheckResult = runCli(tmpDir, ['validate', 'health']);
    const recheckData = parseOutput(recheckResult, 'validate health (after repair)');
    assert.equal(recheckData.valid, true);
    assert.deepEqual(recheckData.issues, []);

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ============================================================
// Supplemental E2E: settings alias consistency
// ============================================================

test('E2E: settings and config aliases produce identical results', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-e2e-alias-'));

  try {
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'config.json'), '{}');

    // Set via config
    const setResult = runCli(tmpDir, ['config', 'set', 'mode', 'auto']);
    assert.equal(setResult.status, 0);

    // Get via settings alias
    const getResult = runCli(tmpDir, ['settings', 'get', 'mode']);
    const getData = parseOutput(getResult, 'settings get mode');
    assert.equal(getData.value, 'auto');
    assert.equal(getData.is_default, false);

    // Get schema via both
    const configSchema = runCli(tmpDir, ['config', 'schema']);
    const settingsSchema = runCli(tmpDir, ['settings', 'schema']);
    assert.equal(configSchema.status, 0);
    assert.equal(settingsSchema.status, 0);
    assert.equal(configSchema.stdout, settingsSchema.stdout);

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
