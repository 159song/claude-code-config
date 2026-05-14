'use strict';

// lib/progress.cjs - WF 进度计算模块
// 基于 ROADMAP.md 和各阶段目录状态计算整体进度

const path = require('path');
const fs = require('fs');
const utils = require('./utils.cjs');
const phase = require('./phase.cjs');
const { PHASE_PATTERN } = require('./roadmap.cjs');

/**
 * 计算整体进度
 * @param {string} cwd - 项目根目录
 * @returns {object} 进度结果
 */
function calculateProgress(cwd) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const roadmap = utils.readFile(roadmapPath);
  if (!roadmap) {
    return { progress: 0, phases: [] };
  }

  // 使用修复后的 #{2,3} 正则模式
  PHASE_PATTERN.lastIndex = 0;
  const phaseNums = [];
  let match;
  while ((match = PHASE_PATTERN.exec(roadmap)) !== null) {
    if (match.index === PHASE_PATTERN.lastIndex) PHASE_PATTERN.lastIndex++;
    phaseNums.push(parseFloat(match[1]));
  }

  const phases = phaseNums.map(num => {
    // 使用 findPhaseDir 支持双命名约定（Pitfall 3 修复）
    const phaseInfo = phase.findPhaseDir(cwd, Math.floor(num));
    let steps = 0;
    const total = 4;

    if (phaseInfo) {
      if (phaseInfo.has_context) steps++;
      if (phaseInfo.has_plans) steps++;
      if (phaseInfo.summaries && phaseInfo.summaries.length > 0) steps++;
      // Content-based verification: only count if VERIFICATION.md contains PASS (STATE-02)
      if (phaseInfo.has_verification) {
        const verFiles = fs.readdirSync(phaseInfo.directory);
        const verFile = verFiles.find(f => f.toUpperCase().includes('VERIFICATION'));
        if (verFile) {
          const verContent = utils.readFile(path.join(phaseInfo.directory, verFile));
          if (verContent && /\bPASS\b/i.test(verContent)) {
            steps++;
          }
        }
      }
    }

    return { phase: num, progress: Math.round((steps / total) * 100) };
  });

  const overall = phases.length > 0
    ? Math.round(phases.reduce((sum, p) => sum + p.progress, 0) / phases.length)
    : 0;

  return { progress: overall, phases };
}

/**
 * 命令入口：计算并输出进度
 * @param {string} cwd - 项目根目录
 */
function run(cwd) {
  const result = calculateProgress(cwd);
  utils.output(result);
}

module.exports = { calculateProgress, run };
