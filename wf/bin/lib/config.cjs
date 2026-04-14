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
    code_review: true,
    code_review_depth: 'standard',
    code_review_auto_fix: true,
    code_review_max_iterations: 3,
    auto_compact: true,
    smoke_only_verify: true,
    continuation_checkpoint: true,
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
  telemetry: {
    enabled: false,
    track_duration: true,
    track_commits: true,
    track_files_changed: true,
  },
  agents: {
    models: {
      executor: 'sonnet',
      planner: 'sonnet',
      verifier: 'sonnet',
      researcher: 'haiku',
      roadmapper: 'haiku',
      reviewer: 'sonnet',
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
    // Arrays are intentionally replaced, not merged (see config-precedence.md)
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
 * 解析配置值字符串为适当的 JS 类型
 * @param {string} value - 原始字符串值
 * @returns {string|boolean|number} 解析后的值
 */
function parseConfigValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}

/**
 * 递归扁平化对象为 {key, type, default} 数组
 * @param {object} obj - 待扁平化的对象
 * @param {string} prefix - 当前键路径前缀
 * @returns {Array<{key: string, type: string, default: *}>}
 */
function flattenSchema(obj, prefix) {
  const result = [];
  for (const k of Object.keys(obj)) {
    if (k.startsWith('_')) continue;
    const fullKey = prefix ? `${prefix}.${k}` : k;
    const val = obj[k];
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      result.push(...flattenSchema(val, fullKey));
    } else {
      result.push({ key: fullKey, type: typeof val, default: val });
    }
  }
  return result;
}

/**
 * 检查 dotted key 是否存在于 CONFIG_DEFAULTS 结构中
 * @param {string} key - 点分隔键路径
 * @returns {boolean}
 */
function isValidSchemaKey(key) {
  const parts = key.split('.');
  let obj = CONFIG_DEFAULTS;
  for (const part of parts) {
    if (obj === null || typeof obj !== 'object' || !(part in obj)) return false;
    obj = obj[part];
  }
  return true;
}

/**
 * 保存单个配置键值到 .planning/config.json
 * @param {string} cwd - 项目根目录
 * @param {string} key - 点分隔键路径 (例如 "workflow.research")
 * @param {string} value - 原始字符串值
 * @returns {{success: boolean, key: string, value: *, error?: string}}
 */
function saveConfig(cwd, key, value) {
  if (!isValidSchemaKey(key)) {
    return { success: false, key, error: `Unknown config key: ${key}` };
  }

  const projectRoot = cwd || process.cwd();
  const configPath = path.join(projectRoot, '.planning', 'config.json');
  const existing = utils.readJson(configPath) || {};
  const parsed = parseConfigValue(value);

  const parts = key.split('.');
  let target = existing;
  for (let i = 0; i < parts.length - 1; i++) {
    if (target[parts[i]] === undefined || target[parts[i]] === null || typeof target[parts[i]] !== 'object') {
      target[parts[i]] = {};
    }
    target = target[parts[i]];
  }
  target[parts[parts.length - 1]] = parsed;

  utils.writeFile(configPath, JSON.stringify(existing, null, 2));
  return { success: true, key, value: parsed };
}

/**
 * 获取配置 schema（扁平化的键/类型/默认值列表）
 * 排除以 "_" 开头的内部键
 * @returns {Array<{key: string, type: string, default: *}>}
 */
function getConfigSchema() {
  return flattenSchema(CONFIG_DEFAULTS, '');
}

/**
 * 获取单个配置键的当前值
 * @param {string} cwd - 项目根目录
 * @param {string} key - 点分隔键路径
 * @returns {{key: string, value: *, is_default: boolean}}
 */
function getConfigValue(cwd, key) {
  const merged = loadConfig(cwd);
  const projectRoot = cwd || process.cwd();
  const configPath = path.join(projectRoot, '.planning', 'config.json');
  const projectConfig = utils.readJson(configPath) || {};

  const parts = key.split('.');
  let mergedVal = merged;
  let projectVal = projectConfig;
  let hasProjectVal = true;

  for (const part of parts) {
    if (mergedVal !== null && typeof mergedVal === 'object') {
      mergedVal = mergedVal[part];
    } else {
      mergedVal = undefined;
    }
    if (hasProjectVal && projectVal !== null && typeof projectVal === 'object' && part in projectVal) {
      projectVal = projectVal[part];
    } else {
      hasProjectVal = false;
    }
  }

  return { key, value: mergedVal, is_default: !hasProjectVal };
}

/**
 * 配置模块入口：输出配置或处理子命令
 * @param {string} cwd - 项目根目录
 * @param {string[]} [args] - 子命令参数
 */
function run(cwd, args) {
  const sub = (args || [])[0];

  if (sub === 'set') {
    const key = args[1];
    const value = args[2];
    if (!key || value === undefined) {
      utils.error('用法: wf-tools settings set <key> <value>');
      process.exit(1);
    }
    const result = saveConfig(cwd, key, value);
    utils.output(result);
  } else if (sub === 'get') {
    const key = args[1];
    if (!key) {
      utils.error('用法: wf-tools settings get <key>');
      process.exit(1);
    }
    const result = getConfigValue(cwd, key);
    utils.output(result);
  } else if (sub === 'schema') {
    const schema = getConfigSchema();
    utils.output(schema);
  } else {
    const cfg = loadConfig(cwd);
    utils.output(cfg);
  }
}

module.exports = { loadConfig, CONFIG_DEFAULTS, deepMerge, run, saveConfig, getConfigSchema, getConfigValue };
