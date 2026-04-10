'use strict';

// lib/state.cjs — WF 状态管理模块
// 读写 .planning/STATE.md，支持 YAML frontmatter（主）和 bullet-list（兼容）解析

const path = require('path');
const utils = require('./utils.cjs');

// Key name validation pattern (防止注入，T-02-01/T-02-03)
const VALID_KEY_PATTERN = /^[\w][\w_]*$/;

/**
 * 解析 YAML 值字符串为 JavaScript 类型
 * @param {string} value - 原始值字符串
 * @returns {*} 解析后的值
 */
function parseYamlValue(value) {
  if (value === undefined || value === null) return null;
  value = String(value).trim();
  // 带引号的字符串 -> 去引号
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  // 纯整数
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  // 浮点数
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  // 布尔值
  if (value === 'true') return true;
  if (value === 'false') return false;
  // null
  if (value === 'null' || value === '~') return null;
  // 空字符串
  if (value === '') return null;
  // 裸字符串
  return value;
}

/**
 * 格式化 JavaScript 值为 YAML 字符串
 * @param {*} val - 要序列化的值
 * @returns {string} YAML 格式字符串
 */
function formatYamlValue(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') {
    // 包含特殊 YAML 字符或匹配 ISO 日期模式时加引号
    if (/[:#\[\]{}|>!&*?,]/.test(val) || /^\d{4}-\d{2}/.test(val)) {
      return `"${val}"`;
    }
    return val;
  }
  return String(val);
}

/**
 * 解析 YAML frontmatter（支持 2 级嵌套）
 * 格式：以 ---\n 开头，以 \n---\n 结尾的 YAML 块
 * @param {string} content - 文件内容
 * @returns {{ frontmatter: object, body: string }}
 */
function parseFrontmatter(content) {
  if (!content || !content.startsWith('---\n')) {
    return { frontmatter: {}, body: content || '' };
  }

  const endIdx = content.indexOf('\n---\n', 4);
  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = content.slice(4, endIdx);
  const lines = yamlBlock.split('\n');
  const frontmatter = {};
  let currentParent = null;

  for (const line of lines) {
    // 跳过空行
    if (!line) continue;

    // 缩进行 = currentParent 的子键
    const indentMatch = line.match(/^(\s+)([\w][\w_]*):\s*(.*)$/);
    if (indentMatch && currentParent) {
      if (typeof frontmatter[currentParent] !== 'object' || frontmatter[currentParent] === null) {
        frontmatter[currentParent] = {};
      }
      frontmatter[currentParent][indentMatch[2]] = parseYamlValue(indentMatch[3].trim());
      continue;
    }

    // 顶级键
    const match = line.match(/^([\w][\w_]*):\s*(.*)$/);
    if (match) {
      const value = match[2].trim();
      if (value === '') {
        // 可能是嵌套对象的父键，设为 null，后续缩进行会替换
        frontmatter[match[1]] = null;
        currentParent = match[1];
      } else {
        frontmatter[match[1]] = parseYamlValue(value);
        currentParent = null;
      }
    }
  }

  const body = content.slice(endIdx + 5); // +5 to skip '\n---\n'
  return { frontmatter, body };
}

/**
 * 序列化 frontmatter 对象为 YAML 字符串（支持 2 级嵌套）
 * @param {object} fm - frontmatter 对象
 * @returns {string} YAML 格式字符串（不含 --- 分隔符）
 */
function serializeFrontmatter(fm) {
  const lines = [];
  for (const [key, val] of Object.entries(fm)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const [subKey, subVal] of Object.entries(val)) {
        lines.push(`  ${subKey}: ${formatYamlValue(subVal)}`);
      }
    } else {
      lines.push(`${key}: ${formatYamlValue(val)}`);
    }
  }
  return lines.join('\n');
}

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
  } else {
    utils.error('用法: wf-tools state [get|set|json]');
    process.exit(1);
  }
}

module.exports = { parseFrontmatter, serializeFrontmatter, parseYamlValue, parseStateMd, stateGet, stateSet, stateJson, run };
