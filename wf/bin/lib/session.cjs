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

module.exports = { createHandoff, readHandoff, deleteHandoff, generateContinueHere };
