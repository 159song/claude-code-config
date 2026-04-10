'use strict';

// lib/roadmap.cjs — WF 路线图分析模块
// 解析 ROADMAP.md，支持 H2 和 H3 格式的阶段头（修复 Pitfall 2）

const path = require('path');
const fs = require('fs');
const utils = require('./utils.cjs');

// 同时匹配 ## Phase N: 和 ### Phase N: 格式（H2 和 H3），支持小数点阶段号
const PHASE_PATTERN = /^#{2,3}\s+Phase\s+(\d[\d.]*?):\s*(.+)$/gm;

/**
 * 分析路线图文件，返回所有阶段信息
 * @param {string} cwd - 项目根目录
 * @returns {object} 路线图分析结果
 */
function roadmapAnalyze(cwd) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const content = utils.readFile(roadmapPath);
  if (!content) {
    utils.error('错误: ROADMAP.md 不存在');
    process.exit(1);
  }

  const phases = [];
  // 重置 lastIndex 防止全局 regex 状态残留
  PHASE_PATTERN.lastIndex = 0;
  let match;

  while ((match = PHASE_PATTERN.exec(content)) !== null) {
    const numStr = match[1];
    const num = parseFloat(numStr);
    const name = match[2].trim();

    // 支持两种目录命名约定（Pitfall 3）
    const planningDir = path.join(cwd, '.planning');
    let phaseDir = null;

    // 1. 先查 phases/NN-slug/ (GSD 风格)
    const phasesRoot = path.join(planningDir, 'phases');
    if (fs.existsSync(phasesRoot)) {
      const entries = fs.readdirSync(phasesRoot);
      const matching = entries.find(e => new RegExp(`^0*${Math.floor(num)}-`).test(e));
      if (matching) {
        phaseDir = path.join(phasesRoot, matching);
      }
    }

    // 2. 再查 phase-N/ (WF 风格)
    if (!phaseDir) {
      const wfStyle = path.join(planningDir, `phase-${Math.floor(num)}`);
      if (fs.existsSync(wfStyle)) {
        phaseDir = wfStyle;
      }
    }

    let hasContext = false;
    let hasPlans = false;
    let hasSummary = false;
    let hasVerification = false;
    let verificationPassed = false;

    if (phaseDir && fs.existsSync(phaseDir)) {
      const files = fs.readdirSync(phaseDir);
      hasContext = files.some(f => f.toUpperCase().includes('CONTEXT'));
      hasPlans = files.some(f => f.toUpperCase().includes('PLAN'));
      hasSummary = files.some(f => f.toUpperCase().includes('SUMMARY'));
      hasVerification = files.some(f => f.toUpperCase().includes('VERIFICATION'));

      // 读取 VERIFICATION.md 内容判断实际 PASS/FAIL 状态（不只是文件存在）
      if (hasVerification) {
        const verFile = files.find(f => f.toUpperCase().includes('VERIFICATION'));
        const verContent = utils.readFile(path.join(phaseDir, verFile));
        verificationPassed = verContent ? /\bPASS\b/i.test(verContent) : false;
      }
    }

    let status = 'pending';
    if (verificationPassed) status = 'verified';
    else if (hasSummary) status = 'executed';
    else if (hasPlans) status = 'planned';
    else if (hasContext) status = 'discussed';

    phases.push({ num, name, status, hasContext, hasPlans, hasSummary, hasVerification });
  }

  const result = {
    total_phases: phases.length,
    phases,
    current_phase: phases.find(p => p.status !== 'verified')?.num || null,
    completed_phases: phases.filter(p => p.status === 'verified').length,
  };

  return result;
}

/**
 * 命令分发入口
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - 子命令参数
 */
function run(cwd, args) {
  const sub = args[0];
  if (sub === 'analyze') {
    const result = roadmapAnalyze(cwd);
    utils.output(result);
  } else {
    utils.error('用法: wf-tools roadmap analyze');
    process.exit(1);
  }
}

module.exports = { roadmapAnalyze, run };
