'use strict';

// lib/session.cjs -- WF 会话持久化模块
// 提供 HANDOFF.json 读写和 .continue-here.md 生成（SESS-01 / D-01 ~ D-04）
// 被 /wf-pause、/wf-resume、SessionStart hook 消费

const fs = require('fs');
const path = require('path');
const utils = require('./utils.cjs');

/**
 * 创建 HANDOFF.json 和 .continue-here.md
 * @param {string} cwd - 项目根目录
 * @param {{ phase: number, plan: number, step: string, stopped_at: string }} options
 * @returns {{ success: boolean, handoff_path: string, continue_path: string }}
 */
function createHandoff(cwd, options) {
  const { phase, plan, step, stopped_at } = options;

  // 验证必填字段
  if (phase == null || step == null) {
    throw new Error('createHandoff: phase and step are required');
  }

  // 读取当前 git branch
  let gitBranch = 'unknown';
  try {
    gitBranch = require('child_process')
      .execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, encoding: 'utf8' })
      .trim();
  } catch (e) {
    // git 不可用时使用默认值
  }

  // D-02: HANDOFF.json 最小集字段（恰好 7 个）
  const handoff = {
    phase: phase,
    plan: plan || null,
    step: step,
    stopped_at: stopped_at || '',
    resume_command: '/wf-resume',
    git_branch: gitBranch,
    timestamp: new Date().toISOString()
  };

  // D-01: 写入 .planning/HANDOFF.json
  const handoffPath = path.join(cwd, '.planning', 'HANDOFF.json');
  utils.writeFile(handoffPath, JSON.stringify(handoff, null, 2));

  // D-03: 写入项目根目录 .continue-here.md
  const continuePath = path.join(cwd, '.continue-here.md');
  const continueContent = generateContinueHere(handoff);
  utils.writeFile(continuePath, continueContent);

  return {
    success: true,
    handoff_path: '.planning/HANDOFF.json',
    continue_path: '.continue-here.md'
  };
}

/**
 * 读取并解析 HANDOFF.json
 * @param {string} cwd - 项目根目录
 * @returns {object|null} 解析后的 handoff 对象，不存在或损坏时返回 null
 */
function readHandoff(cwd) {
  const handoffPath = path.join(cwd, '.planning', 'HANDOFF.json');
  return utils.readJson(handoffPath);
}

/**
 * 删除 HANDOFF.json 和 .continue-here.md（恢复成功后清理）
 * @param {string} cwd - 项目根目录
 * @returns {{ success: boolean }}
 */
function deleteHandoff(cwd) {
  const handoffPath = path.join(cwd, '.planning', 'HANDOFF.json');
  const continuePath = path.join(cwd, '.continue-here.md');

  try { fs.unlinkSync(handoffPath); } catch (e) {}
  try { fs.unlinkSync(continuePath); } catch (e) {}

  return { success: true };
}

/**
 * 生成 .continue-here.md 内容（纯函数）
 * @param {object} handoff - D-02 schema 的 handoff 对象
 * @returns {string} Markdown 内容
 */
function generateContinueHere(handoff) {
  const lines = [
    '# Continue Here',
    '',
    `**Paused:** ${handoff.timestamp}`,
    `**Phase:** ${handoff.phase}`,
    `**Step:** ${handoff.step}`,
    `**Status:** ${handoff.stopped_at}`,
    '',
    '## Resume',
    '',
    '```',
    '/wf-resume',
    '```',
    ''
  ];
  return lines.join('\n');
}

// ---- CLI sub-command handlers ----

// 允许的 step 值白名单（T-04-08）
const VALID_STEPS = ['discuss', 'plan', 'execute', 'verify'];

/**
 * 从参数数组中解析 --flag value 对
 * @param {string[]} args - 参数数组
 * @param {string} flag - 标志名（不含 --）
 * @returns {string|null}
 */
function parseFlag(args, flag) {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === `--${flag}` && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return null;
}

/**
 * CLI: wf-tools session pause --phase N --plan M --step S --stopped_at "msg"
 * @param {string} cwd
 * @param {string[]} args
 */
function sessionPause(cwd, args) {
  const phaseRaw = parseFlag(args, 'phase');
  const planRaw = parseFlag(args, 'plan');
  const stepRaw = parseFlag(args, 'step');
  const stoppedAt = parseFlag(args, 'stopped_at') || '';

  // T-04-06: phase 必须是整数
  const phase = phaseRaw ? parseInt(phaseRaw, 10) : NaN;
  if (isNaN(phase)) {
    utils.error('--phase 必须是整数');
    process.exit(1);
  }

  // T-04-08: step 必须在白名单内
  const step = stepRaw || 'discuss';
  if (!VALID_STEPS.includes(step)) {
    utils.error('--step 必须是: ' + VALID_STEPS.join(', '));
    process.exit(1);
  }

  const plan = planRaw ? parseInt(planRaw, 10) : 0;

  try {
    const result = createHandoff(cwd, { phase, plan, step, stopped_at: stoppedAt });
    utils.output(result);
  } catch (e) {
    utils.error(e.message);
    process.exit(1);
  }
}

/**
 * CLI: wf-tools session resume — 读取 HANDOFF.json，输出内容，然后清理
 * @param {string} cwd
 * @param {string[]} args
 */
function sessionResume(cwd, args) {
  const handoff = readHandoff(cwd);
  if (!handoff) {
    utils.output({ success: false, error: 'No HANDOFF.json found' });
    process.exit(1);
  }

  // T-04-05: 验证 step 字段在白名单内
  if (handoff.step && !VALID_STEPS.includes(handoff.step)) {
    utils.output({ success: false, error: 'Invalid step in HANDOFF.json: ' + handoff.step });
    process.exit(1);
  }

  // T-04-06: 验证 phase 是整数
  if (handoff.phase != null && !Number.isInteger(handoff.phase)) {
    utils.output({ success: false, error: 'Invalid phase in HANDOFF.json' });
    process.exit(1);
  }

  deleteHandoff(cwd);
  utils.output({ success: true, handoff: handoff, cleaned: true });
}

/**
 * CLI: wf-tools session status — 检查 HANDOFF.json 状态（不删除）
 * @param {string} cwd
 */
function sessionStatus(cwd) {
  const handoff = readHandoff(cwd);
  utils.output({ has_handoff: handoff !== null, handoff: handoff });
}

/**
 * 命令分发入口
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - 子命令参数
 */
function run(cwd, args) {
  const sub = args[0];
  if (sub === 'pause') {
    sessionPause(cwd, args.slice(1));
  } else if (sub === 'resume') {
    sessionResume(cwd, args.slice(1));
  } else if (sub === 'status') {
    sessionStatus(cwd);
  } else {
    utils.error('用法: wf-tools session [pause|resume|status]');
    process.exit(1);
  }
}

module.exports = { createHandoff, readHandoff, deleteHandoff, generateContinueHere, run };
