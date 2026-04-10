'use strict';

// lib/init.cjs — WF 复合初始化模块
// 单次 CLI 调用返回完整的工作流上下文（INFRA-05 / D-07, D-08, D-09）
// 依赖: utils.cjs, config.cjs, phase.cjs

const fs = require('fs');
const path = require('path');
const utils = require('./utils.cjs');
const configLib = require('./config.cjs');
const phaseLib = require('./phase.cjs');

// 有效的子命令白名单（T-02-03：拒绝未知子命令）
const VALID_MODES = ['phase-op', 'new-project', 'execute-phase', 'plan-phase', 'discuss-phase', 'quick'];

/**
 * initPhaseOp — 供 plan-phase、execute-phase、discuss-phase、verify-work 工作流使用
 * 返回完整的阶段上下文（D-08）
 * @param {string} cwd - 项目根目录
 * @param {string} phaseNumStr - 阶段编号字符串（T-02-01：必须为数字）
 * @returns {object}
 */
function initPhaseOp(cwd, phaseNumStr) {
  // T-02-01: 验证 phaseNumStr 为数字，防止目录遍历攻击
  const num = parseInt(phaseNumStr, 10);
  const config = configLib.loadConfig(cwd);
  const projectRoot = utils.findProjectRoot(cwd);

  const planningDir = path.join(cwd, '.planning');
  const planningExists = fs.existsSync(planningDir);
  const roadmapExists = fs.existsSync(path.join(planningDir, 'ROADMAP.md'));

  // 无效阶段编号：直接返回 not-found 结构
  if (isNaN(num)) {
    return {
      commit_docs: config.planning && config.planning.commit_docs !== undefined
        ? config.planning.commit_docs : true,
      response_language: config.response_language || null,
      phase_found: false,
      phase_dir: null,
      phase_number: null,
      phase_name: null,
      phase_slug: null,
      padded_phase: null,
      has_context: false,
      has_research: false,
      has_plans: false,
      plan_count: 0,
      has_verification: false,
      roadmap_exists: roadmapExists,
      planning_exists: planningExists,
      project_root: projectRoot,
    };
  }

  const info = phaseLib.findPhaseDir(cwd, num);

  if (!info) {
    return {
      commit_docs: config.planning && config.planning.commit_docs !== undefined
        ? config.planning.commit_docs : true,
      response_language: config.response_language || null,
      phase_found: false,
      phase_dir: null,
      phase_number: null,
      phase_name: null,
      phase_slug: null,
      padded_phase: null,
      has_context: false,
      has_research: false,
      has_plans: false,
      plan_count: 0,
      has_verification: false,
      roadmap_exists: roadmapExists,
      planning_exists: planningExists,
      project_root: projectRoot,
    };
  }

  // 构建相对路径的 phase_dir（D-08 规范中为相对路径）
  const phaseDir = path.relative(cwd, info.directory);
  const paddedPhase = String(info.phase_number).padStart(2, '0');

  return {
    commit_docs: config.planning && config.planning.commit_docs !== undefined
      ? config.planning.commit_docs : true,
    response_language: config.response_language || null,
    phase_found: true,
    phase_dir: phaseDir,
    phase_number: paddedPhase,
    phase_name: info.phase_name,
    phase_slug: info.phase_slug,
    padded_phase: paddedPhase,
    has_context: info.has_context,
    has_research: info.has_research,
    has_plans: info.has_plans,
    plan_count: info.plans ? info.plans.length : 0,
    has_verification: info.has_verification,
    roadmap_exists: roadmapExists,
    planning_exists: planningExists,
    project_root: projectRoot,
  };
}

/**
 * initNewProject — 供 new-project 工作流使用
 * 返回项目文件存在状态
 * @param {string} cwd - 项目根目录
 * @returns {object}
 */
function initNewProject(cwd) {
  const config = configLib.loadConfig(cwd);
  const projectRoot = utils.findProjectRoot(cwd);
  const planningDir = path.join(cwd, '.planning');

  return {
    planning_dir: '.planning',
    has_project: fs.existsSync(path.join(planningDir, 'PROJECT.md')),
    has_config: fs.existsSync(path.join(planningDir, 'config.json')),
    has_roadmap: fs.existsSync(path.join(planningDir, 'ROADMAP.md')),
    has_requirements: fs.existsSync(path.join(planningDir, 'REQUIREMENTS.md')),
    response_language: config.response_language || null,
    project_root: projectRoot,
  };
}

/**
 * initQuick — 供 quick 工作流使用
 * 返回最小上下文
 * @param {string} cwd - 项目根目录
 * @returns {object}
 */
function initQuick(cwd) {
  const config = configLib.loadConfig(cwd);
  const projectRoot = utils.findProjectRoot(cwd);
  const planningDir = path.join(cwd, '.planning');

  return {
    config,
    project_root: projectRoot,
    planning_exists: fs.existsSync(planningDir),
    has_roadmap: fs.existsSync(path.join(planningDir, 'ROADMAP.md')),
    response_language: config.response_language || null,
  };
}

/**
 * run — 子命令分发器
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - 子命令参数数组
 */
function run(cwd, args) {
  const subMode = args[0];

  // T-02-03: 白名单校验，拒绝未知子命令
  if (!VALID_MODES.includes(subMode)) {
    utils.error(`init: 未知子命令 '${subMode || ''}'。有效命令: ${VALID_MODES.join(', ')}`);
    process.exit(1);
  }

  switch (subMode) {
    case 'phase-op':
    case 'execute-phase':
    case 'plan-phase':
    case 'discuss-phase':
      utils.output(initPhaseOp(cwd, args[1]));
      break;
    case 'new-project':
      utils.output(initNewProject(cwd));
      break;
    case 'quick':
      utils.output(initQuick(cwd));
      break;
  }
}

module.exports = { run, initPhaseOp, initNewProject, initQuick };
