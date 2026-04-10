'use strict';

// lib/state.cjs — WF 状态管理模块
// 读写 .planning/STATE.md，支持 YAML frontmatter（主）和 bullet-list（兼容）解析

const path = require('path');
const utils = require('./utils.cjs');

/**
 * 解析 YAML frontmatter
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
  const frontmatter = {};

  for (const line of yamlBlock.split('\n')) {
    // 跳过嵌套对象行（以空格开头的缩进行）和空行
    if (!line || /^\s/.test(line)) continue;

    const match = line.match(/^([\w][\w_]*):\s*(.*)$/);
    if (match) {
      let value = match[2].trim();
      // 处理带引号的字符串
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      } else if (/^\d+$/.test(value)) {
        // 纯整数
        value = parseInt(value, 10);
      } else if (/^\d+\.\d+$/.test(value)) {
        // 浮点数
        value = parseFloat(value);
      } else if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else if (value === 'null' || value === '~' || value === '') {
        value = null;
      }
      frontmatter[match[1]] = value;
    }
  }

  const body = content.slice(endIdx + 5); // +5 to skip '\n---\n'
  return { frontmatter, body };
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
 * 读取状态中的指定 key 并输出
 * @param {string} cwd - 项目根目录
 * @param {string} key - 状态 key
 */
function stateGet(cwd, key) {
  const state = parseStateMd(cwd);
  const value = state[key] !== undefined ? state[key] : state[key.replace(/-/g, '_')];
  if (value !== undefined && value !== null) {
    utils.output({ value });
  } else {
    utils.output({ value: null });
  }
}

/**
 * 设置状态中的指定 key（更新 YAML frontmatter）
 * @param {string} cwd - 项目根目录
 * @param {string} key - 状态 key
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

  if (content.startsWith('---\n')) {
    // 更新 frontmatter 中的 key
    const endIdx = content.indexOf('\n---\n', 4);
    if (endIdx !== -1) {
      const yamlBlock = content.slice(4, endIdx);
      const keyPattern = new RegExp(`^(${key}:)\\s*(.*)$`, 'm');
      let newYaml;
      if (keyPattern.test(yamlBlock)) {
        newYaml = yamlBlock.replace(keyPattern, `$1 ${value}`);
      } else {
        newYaml = yamlBlock + `\n${key}: ${value}`;
      }
      content = `---\n${newYaml}\n---\n${content.slice(endIdx + 5)}`;
      utils.writeFile(statePath, content);
      return;
    }
  }

  // Fallback：在文件末尾追加
  content = content + `\n${key}: ${value}\n`;
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

module.exports = { parseFrontmatter, parseStateMd, stateGet, stateSet, stateJson, run };
