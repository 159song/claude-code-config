'use strict';

// lib/phase.cjs — WF 阶段信息模块
// 支持 phases/NN-slug/ (GSD 风格) 和 phase-N/ (WF 风格) 两种目录命名约定（修复 Pitfall 3）

const path = require('path');
const fs = require('fs');
const utils = require('./utils.cjs');

/**
 * 查找阶段目录，支持双命名约定
 * @param {string} cwd - 项目根目录
 * @param {number} phaseNum - 阶段编号
 * @returns {object|null} 阶段目录信息，未找到时返回 null
 */
function findPhaseDir(cwd, phaseNum) {
  const num = parseFloat(phaseNum);
  if (isNaN(num)) return null;

  const planningDir = path.join(cwd, '.planning');

  // Decimal phase numbers (e.g., 2.5) — inserted phases
  if (num !== Math.floor(num)) {
    // Scan phases/ directory for entries matching the exact decimal (e.g., 02.5-slug)
    const phasesRoot = path.join(planningDir, 'phases');
    if (fs.existsSync(phasesRoot)) {
      const entries = fs.readdirSync(phasesRoot);
      const decimalPattern = /^0*(\d+(?:\.\d+)?)-/;
      const matching = entries.find(e => {
        const m = e.match(decimalPattern);
        return m && parseFloat(m[1]) === num;
      });
      if (matching) {
        const phaseDir = path.join(phasesRoot, matching);
        return buildPhaseDirInfo(phaseDir, num, matching);
      }
    }

    // Check WF-style phase-2.5/ directory
    const wfStyleDecimal = path.join(planningDir, `phase-${num}`);
    if (fs.existsSync(wfStyleDecimal)) {
      return buildPhaseDirInfo(wfStyleDecimal, num, `phase-${num}`);
    }

    // Decimal phase not found — do not fall through to integer logic
    return null;
  }

  // Integer phase numbers — existing logic
  // 1. 先查 phases/NN-slug/ (GSD 风格)
  const phasesRoot = path.join(planningDir, 'phases');
  if (fs.existsSync(phasesRoot)) {
    const entries = fs.readdirSync(phasesRoot);
    // 匹配 ^0*N- 模式（例如 01-cli-foundation 匹配 phase 1）
    const matching = entries.find(e => new RegExp(`^0*${num}-`).test(e));
    if (matching) {
      const phaseDir = path.join(phasesRoot, matching);
      return buildPhaseDirInfo(phaseDir, num, matching);
    }
  }

  // 2. 再查 phase-N/ (WF 风格)
  const wfStyle = path.join(planningDir, `phase-${num}`);
  if (fs.existsSync(wfStyle)) {
    return buildPhaseDirInfo(wfStyle, num, `phase-${num}`);
  }

  return null;
}

/**
 * 构建阶段目录信息对象
 * @param {string} phaseDir - 阶段目录绝对路径
 * @param {number} num - 阶段编号
 * @param {string} dirName - 目录名称
 * @returns {object}
 */
function buildPhaseDirInfo(phaseDir, num, dirName) {
  // 解析 slug（去掉数字前缀）
  const slugMatch = dirName.match(/^\d+-(.+)$/);
  const phase_slug = slugMatch ? slugMatch[1] : dirName;

  // 读取目录中的文件
  let files = [];
  try {
    files = fs.readdirSync(phaseDir);
  } catch {
    // 目录无法读取
  }

  // 文件检测：不论前缀，匹配文件名包含特定词的文件
  const hasContext = files.some(f => f.toUpperCase().includes('CONTEXT'));
  const hasResearch = files.some(f => f.toUpperCase().includes('RESEARCH'));
  const hasVerification = files.some(f => f.toUpperCase().includes('VERIFICATION'));

  // PLAN 文件（排除 SUMMARY）
  const planFiles = files.filter(f => f.toUpperCase().includes('PLAN') && !f.toUpperCase().includes('SUMMARY'));
  const summaryFiles = files.filter(f => f.toUpperCase().includes('SUMMARY'));
  const hasPlans = planFiles.length > 0;

  // 尝试从文件名或 CONTEXT.md 推断阶段名称
  let phase_name = phase_slug.replace(/-/g, ' ');

  return {
    directory: phaseDir,
    phase_number: num,
    phase_name,
    phase_slug,
    has_context: hasContext,
    has_research: hasResearch,
    has_plans: hasPlans,
    plans: planFiles,
    summaries: summaryFiles,
    has_verification: hasVerification,
  };
}

/**
 * 获取阶段详细信息
 * @param {string} cwd - 项目根目录
 * @param {number|string} phaseNum - 阶段编号
 */
function phaseInfo(cwd, phaseNum) {
  const num = parseFloat(phaseNum);
  if (isNaN(num)) {
    utils.error(`无效的阶段编号: ${phaseNum}`);
    process.exit(1);
  }

  const info = findPhaseDir(cwd, num);

  if (!info) {
    const result = {
      phase: num,
      phase_found: false,
      exists: false,
      directory: null,
    };
    utils.output(result);
    return;
  }

  // 从 ROADMAP.md 获取阶段目标
  let goal = null;
  const roadmapContent = utils.readFile(path.join(cwd, '.planning', 'ROADMAP.md'));
  if (roadmapContent) {
    const pattern = new RegExp(
      `#{2,3}\\s+Phase\\s+${num}:\\s*(.+?)\\n[\\s\\S]*?\\*\\*目标:\\*\\*\\s*(.+?)\\n`,
      'm'
    );
    const rmMatch = roadmapContent.match(pattern);
    if (rmMatch) {
      info.phase_name = rmMatch[1].trim();
      goal = rmMatch[2].trim();
    }
  }

  utils.output(Object.assign({ phase_found: true, exists: true, goal }, info));
}

/**
 * 命令分发入口
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - 子命令参数
 */
function run(cwd, args) {
  const sub = args[0];
  if (sub === 'info') {
    phaseInfo(cwd, args[1]);
  } else {
    utils.error('用法: wf-tools phase info <N>');
    process.exit(1);
  }
}

module.exports = { findPhaseDir, phaseInfo, run };
