'use strict';

// lib/state.cjs — WF 状态管理模块
// 读写 .planning/STATE.md，支持 YAML frontmatter（主）和 bullet-list（兼容）解析

const path = require('path');
const utils = require('./utils.cjs');

const { parseFrontmatter, serializeFrontmatter, parseYamlValue, formatYamlValue } = require('./frontmatter.cjs');

// Key name validation pattern (防止注入，T-02-01/T-02-03)
const VALID_KEY_PATTERN = /^[\w][\w_]*$/;

/**
 * 解析 STATE.md，以 YAML frontmatter 为主，bullet-list 为兼容 fallback
 * @param {string} cwd - 项目根目录
 * @returns {object} 状态对象
 */
function parseStateMd(cwd) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const content = utils.readFile(statePath);
  if (!content) return {};

  const { frontmatter, body } = parseFrontmatter(content);

  // 解析 bullet-list 格式：- **key:** value（向后兼容）
  const bulletState = {};
  for (const line of body.split('\n')) {
    const match = line.match(/^-\s+\*\*(.+?):\*\*\s+(.+)$/);
    if (match) {
      const key = match[1].toLowerCase().replace(/\s+/g, '_');
      bulletState[key] = match[2].trim();
    }
  }

  // frontmatter 优先，bullet 作为补充
  return Object.assign({}, bulletState, frontmatter);
}

/**
 * 读取状态中的指定 key 并输出（支持 dotted key 如 progress.total_phases）
 * @param {string} cwd - 项目根目录
 * @param {string} key - 状态 key（支持 parent.child 格式）
 */
function stateGet(cwd, key) {
  const state = parseStateMd(cwd);

  // 支持 dotted key（最多 2 级，T-02-03）
  if (key && key.includes('.')) {
    const dotIdx = key.indexOf('.');
    const parentKey = key.slice(0, dotIdx);
    const childKey = key.slice(dotIdx + 1);
    // 验证键名格式
    if (!VALID_KEY_PATTERN.test(parentKey) || !VALID_KEY_PATTERN.test(childKey)) {
      utils.output({ value: null });
      return;
    }
    const parent = state[parentKey];
    if (parent && typeof parent === 'object' && parent[childKey] !== undefined) {
      utils.output({ value: parent[childKey] });
    } else {
      utils.output({ value: null });
    }
    return;
  }

  const value = state[key] !== undefined ? state[key] : state[key.replace(/-/g, '_')];
  if (value !== undefined && value !== null) {
    utils.output({ value });
  } else {
    utils.output({ value: null });
  }
}

/**
 * 设置状态中的指定 key（支持 dotted key，使用 serializeFrontmatter 回写）
 * @param {string} cwd - 项目根目录
 * @param {string} key - 状态 key（支持 parent.child 格式）
 * @param {string} value - 新值
 */
function stateSet(cwd, key, value) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = utils.readFile(statePath);

  if (!content) {
    // 创建新 STATE.md with frontmatter
    content = `---\n${key}: ${value}\n---\n\n# Project State\n`;
    utils.writeFile(statePath, content);
    return;
  }

  const { frontmatter, body } = parseFrontmatter(content);

  // 支持 dotted key（最多 2 级，T-02-03）
  if (key && key.includes('.')) {
    const dotIdx = key.indexOf('.');
    const parentKey = key.slice(0, dotIdx);
    const childKey = key.slice(dotIdx + 1);
    // 验证键名格式
    if (!VALID_KEY_PATTERN.test(parentKey) || !VALID_KEY_PATTERN.test(childKey)) {
      utils.error('无效的键名格式');
      process.exit(1);
    }
    if (typeof frontmatter[parentKey] !== 'object' || frontmatter[parentKey] === null) {
      frontmatter[parentKey] = {};
    }
    frontmatter[parentKey][childKey] = parseYamlValue(value);
  } else {
    frontmatter[key] = parseYamlValue(value);
  }

  // 使用 serializeFrontmatter 重新序列化
  const newFm = serializeFrontmatter(frontmatter);
  content = `---\n${newFm}\n---\n${body}`;
  utils.writeFile(statePath, content);
}

/**
 * 输出完整状态 JSON
 * @param {string} cwd - 项目根目录
 */
function stateJson(cwd) {
  const state = parseStateMd(cwd);
  utils.output(state);
}

/**
 * 批量更新 frontmatter 键值对
 * 用法: wf-tools state patch --key1 val1 --key2 val2
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - --key value 参数对
 */
function statePatch(cwd, args) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const content = utils.readFile(statePath);
  if (!content) {
    utils.error('STATE.md 不存在');
    process.exit(1);
  }

  const { frontmatter, body } = parseFrontmatter(content);
  const updated = [];

  // 解析 --key value 参数对 (T-02-01: 验证键名格式)
  let i = 0;
  while (i < args.length) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      const key = args[i].slice(2);
      if (!VALID_KEY_PATTERN.test(key)) {
        utils.error(`无效的键名: ${key}`);
        process.exit(1);
      }
      const value = parseYamlValue(args[i + 1]);
      frontmatter[key] = value;
      updated.push(key);
      i += 2;
    } else {
      i++;
    }
  }

  if (updated.length === 0) {
    utils.error('用法: wf-tools state patch --key1 val1 --key2 val2');
    process.exit(1);
  }

  // 重新序列化并写回
  const newFm = serializeFrontmatter(frontmatter);
  const newContent = `---\n${newFm}\n---\n${body}`;
  utils.writeFile(statePath, newContent);
  utils.output({ success: true, updated });
}

/**
 * 深度合并 JSON 到 frontmatter
 * 用法: wf-tools state merge '{"key":"value"}'
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - [jsonString]
 */
function stateMerge(cwd, args) {
  let patch;
  try {
    patch = JSON.parse(args[0]);
  } catch {
    utils.error('无效 JSON');
    process.exit(1);
  }

  // T-02-02: 只接受普通对象，不接受数组
  if (Array.isArray(patch) || typeof patch !== 'object' || patch === null) {
    utils.error('合并数据必须是 JSON 对象');
    process.exit(1);
  }

  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const content = utils.readFile(statePath);
  if (!content) {
    utils.error('STATE.md 不存在');
    process.exit(1);
  }

  const { frontmatter, body } = parseFrontmatter(content);

  // 一级深度合并：如果双方都是非 null 对象，递归合并子键；否则覆盖
  for (const key of Object.keys(patch)) {
    const patchVal = patch[key];
    const existingVal = frontmatter[key];
    if (patchVal !== null && typeof patchVal === 'object' && !Array.isArray(patchVal) &&
        existingVal !== null && typeof existingVal === 'object' && !Array.isArray(existingVal)) {
      // 合并子键
      for (const subKey of Object.keys(patchVal)) {
        existingVal[subKey] = patchVal[subKey];
      }
    } else {
      frontmatter[key] = patchVal;
    }
  }

  // 重新序列化并写回
  const newFm = serializeFrontmatter(frontmatter);
  const newContent = `---\n${newFm}\n---\n${body}`;
  utils.writeFile(statePath, newContent);
  utils.output({ success: true, merged: Object.keys(patch) });
}

/**
 * 验证 STATE.md 的 frontmatter 结构
 * @param {string} cwd - 项目根目录
 */
function stateValidate(cwd) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const content = utils.readFile(statePath);
  const issues = [];

  if (!content) {
    utils.output({ valid: false, issues: ['STATE.md 不存在'] });
    return;
  }

  // 检查 frontmatter 是否存在
  if (!content.startsWith('---\n')) {
    issues.push('missing frontmatter opener (---)');
  }

  // 检查 frontmatter 是否正确关闭
  if (content.startsWith('---\n') && content.indexOf('\n---\n', 4) === -1) {
    issues.push('missing frontmatter closer (---)');
  }

  // 检查必需的键
  if (issues.length === 0) {
    const { frontmatter } = parseFrontmatter(content);
    const requiredKeys = ['status', 'last_updated', 'last_activity'];
    for (const key of requiredKeys) {
      if (frontmatter[key] === undefined || frontmatter[key] === null) {
        issues.push(`missing required key: ${key}`);
      }
    }
  }

  utils.output({ valid: issues.length === 0, issues });
}

/**
 * 从参数数组中解析 --flag value 对
 * @param {string[]} args - 参数数组
 * @param {string} flag - 标志名（不含 --）
 * @returns {string|null} 标志值，未找到时返回 null
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
 * 开始阶段：原子设置 status、stopped_at、timestamps（STATE-06）
 * 用法: wf-tools state begin-phase --phase <N>
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - 参数数组
 */
function stateBeginPhase(cwd, args) {
  const phaseArg = parseFlag(args, 'phase');
  const phaseNum = phaseArg ? parseInt(phaseArg, 10) : NaN;

  if (!phaseArg || isNaN(phaseNum)) {
    utils.error('用法: wf-tools state begin-phase --phase <N>');
    process.exit(1);
  }

  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const content = utils.readFile(statePath);
  if (!content) {
    utils.error('STATE.md 不存在');
    process.exit(1);
  }

  const { frontmatter, body } = parseFrontmatter(content);

  // 原子设置多个字段
  frontmatter.status = 'executing';
  frontmatter.stopped_at = 'Phase ' + phaseNum + ' started';
  frontmatter.last_updated = new Date().toISOString();
  frontmatter.last_activity = new Date().toISOString().slice(0, 10);

  const newFm = serializeFrontmatter(frontmatter);
  utils.writeFile(statePath, `---\n${newFm}\n---\n${body}`);
  utils.output({ success: true, phase: phaseNum });
}

/**
 * 推进计划：增加 completed_plans 并重算 percent（STATE-06）
 * 用法: wf-tools state advance-plan --phase <N> --plan <M>
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - 参数数组
 */
function stateAdvancePlan(cwd, args) {
  const phaseArg = parseFlag(args, 'phase');
  const planArg = parseFlag(args, 'plan');
  const phaseNum = phaseArg ? parseInt(phaseArg, 10) : NaN;
  const planNum = planArg ? parseInt(planArg, 10) : NaN;

  if (!phaseArg || isNaN(phaseNum) || !planArg || isNaN(planNum)) {
    utils.error('用法: wf-tools state advance-plan --phase <N> --plan <M>');
    process.exit(1);
  }

  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const content = utils.readFile(statePath);
  if (!content) {
    utils.error('STATE.md 不存在');
    process.exit(1);
  }

  const { frontmatter, body } = parseFrontmatter(content);

  // 确保 progress 是对象
  if (!frontmatter.progress || typeof frontmatter.progress !== 'object') {
    frontmatter.progress = {};
  }

  // 增加 completed_plans 并重算 percent
  frontmatter.progress.completed_plans = (frontmatter.progress.completed_plans || 0) + 1;
  const total = frontmatter.progress.total_plans || 1;
  frontmatter.progress.percent = Math.round((frontmatter.progress.completed_plans / total) * 100);

  // 设置时间戳
  frontmatter.last_updated = new Date().toISOString();
  frontmatter.last_activity = new Date().toISOString().slice(0, 10);

  const newFm = serializeFrontmatter(frontmatter);
  utils.writeFile(statePath, `---\n${newFm}\n---\n${body}`);
  utils.output({ success: true, phase: phaseNum, plan: planNum, progress: frontmatter.progress });
}

/**
 * 命令分发入口
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - 子命令参数
 */
function run(cwd, args) {
  const sub = args[0];
  if (sub === 'get') {
    stateGet(cwd, args[1]);
  } else if (sub === 'set') {
    stateSet(cwd, args[1], args.slice(2).join(' '));
  } else if (sub === 'json') {
    stateJson(cwd);
  } else if (sub === 'patch') {
    statePatch(cwd, args.slice(1));
  } else if (sub === 'merge') {
    stateMerge(cwd, args.slice(1));
  } else if (sub === 'validate') {
    stateValidate(cwd);
  } else if (sub === 'begin-phase') {
    stateBeginPhase(cwd, args.slice(1));
  } else if (sub === 'advance-plan') {
    stateAdvancePlan(cwd, args.slice(1));
  } else {
    utils.error('用法: wf-tools state [get|set|json|patch|merge|validate|begin-phase|advance-plan]');
    process.exit(1);
  }
}

module.exports = { parseFrontmatter, serializeFrontmatter, parseYamlValue, parseStateMd, stateGet, stateSet, stateJson, statePatch, stateMerge, stateValidate, stateBeginPhase, stateAdvancePlan, run };
