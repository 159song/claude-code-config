'use strict';

// lib/config.cjs — WF 配置加载模块
// 加载并合并 .planning/config.json 与默认配置

const path = require('path');
const utils = require('./utils.cjs');

/**
 * 配置默认值（对应 wf/templates/config.json 结构）
 */
const CONFIG_DEFAULTS = {
  mode: 'auto',
  granularity: 'standard',
  workflow: {
    research: true,
    plan_check: true,
    verifier: true,
    auto_advance: true,
    security_enforcement: true,
    discuss_mode: 'auto',
    node_repair: true,
    node_repair_budget: 2,
  },
  planning: {
    commit_docs: true,
  },
  parallelization: {
    enabled: true,
    plan_level: true,
    max_concurrent_agents: 3,
    min_plans_for_parallel: 2,
  },
  gates: {
    confirm_project: true,
    confirm_phases: true,
    confirm_roadmap: true,
    confirm_plan: false,
    confirm_transition: false,
  },
  safety: {
    always_confirm_destructive: true,
    always_confirm_external_services: true,
  },
  hooks: {
    context_warnings: true,
  },
  agents: {
    models: {
      executor: 'sonnet',
      planner: 'sonnet',
      verifier: 'sonnet',
      researcher: 'haiku',
      roadmapper: 'haiku',
    },
  },
};

/**
 * 深度合并两个对象（右值优先）
 * @param {object} base - 基础对象
 * @param {object} override - 覆盖对象
 * @returns {object}
 */
function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base;
  const result = Object.assign({}, base);
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      base[key] !== null &&
      typeof base[key] === 'object'
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

/**
 * 加载项目配置，与默认值深度合并
 * @param {string} cwd - 项目根目录
 * @returns {object} 合并后的配置对象
 */
function loadConfig(cwd) {
  const projectRoot = cwd || process.cwd();
  const configPath = path.join(projectRoot, '.planning', 'config.json');
  const projectConfig = utils.readJson(configPath) || {};
  return deepMerge(CONFIG_DEFAULTS, projectConfig);
}

/**
 * 输出当前配置
 * @param {string} cwd - 项目根目录
 */
function run(cwd) {
  const cfg = loadConfig(cwd);
  utils.output(cfg);
}

module.exports = { loadConfig, CONFIG_DEFAULTS, run };
