'use strict';

// lib/validate.cjs -- WF 状态文件健康检查和格式验证模块
// 检测 STATE.md 格式问题并支持自动修复
// 独立模块，不依赖 state.cjs（轻量级检查）

const path = require('path');
const utils = require('./utils.cjs');

// 必需的 frontmatter key
const REQUIRED_KEYS = ['status', 'last_updated', 'last_activity'];

/**
 * 健康检查 STATE.md 的 frontmatter 结构
 * 检测：缺少 opener、缺少 closer、缺少必需 key
 * 支持 --repair 自动修复
 * @param {string} cwd - 项目根目录
 * @param {boolean} repair - 是否自动修复
 * @returns {{ valid: boolean, issues: string[], repaired: string[] }}
 */
function validateHealth(cwd, repair) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = utils.readFile(statePath);

  if (content === null) {
    return { valid: false, issues: ['STATE.md not found'], repaired: [] };
  }

  const issues = [];
  const repaired = [];

  // Rule 1: Frontmatter opener
  if (!content.startsWith('---\n')) {
    issues.push('missing frontmatter opener');
    if (repair) {
      const now = new Date();
      const prefix = '---\n' +
        'status: unknown\n' +
        'last_updated: "' + now.toISOString() + '"\n' +
        'last_activity: ' + now.toISOString().slice(0, 10) + '\n' +
        '---\n';
      content = prefix + content;
      repaired.push('added frontmatter wrapper');
    }
  }

  // Rule 2: Frontmatter closer (only check if opener exists or was repaired)
  if (content.startsWith('---\n')) {
    const closerIdx = content.indexOf('\n---\n', 4);
    if (closerIdx === -1) {
      issues.push('missing frontmatter closer');
      if (repair) {
        // 在最后一个 YAML-like 行之后插入 closer
        const lines = content.split('\n');
        let lastYamlLine = -1;
        for (let i = 1; i < lines.length; i++) {
          if (/^[\w][\w_]*:\s/.test(lines[i]) || /^\s+[\w][\w_]*:\s/.test(lines[i])) {
            lastYamlLine = i;
          }
        }
        if (lastYamlLine > 0) {
          lines.splice(lastYamlLine + 1, 0, '---');
          content = lines.join('\n');
        } else {
          // Fallback: 在 opener 之后直接关闭
          content = content.slice(0, 4) + '---\n' + content.slice(4);
        }
        repaired.push('added frontmatter closer');
      }
    }
  }

  // Rule 3: Required keys (only check if opener + closer are confirmed/repaired)
  if (content.startsWith('---\n') && content.indexOf('\n---\n', 4) !== -1) {
    const endIdx = content.indexOf('\n---\n', 4);
    const yamlBlock = content.slice(4, endIdx);

    for (const key of REQUIRED_KEYS) {
      const keyPattern = new RegExp('^' + key + ':\\s', 'm');
      if (!keyPattern.test(yamlBlock)) {
        issues.push('missing required key: ' + key);
        if (repair) {
          // 在 closing --- 之前添加缺失的 key
          let defaultValue;
          const now = new Date();
          if (key === 'status') {
            defaultValue = 'unknown';
          } else if (key === 'last_updated') {
            defaultValue = '"' + now.toISOString() + '"';
          } else if (key === 'last_activity') {
            defaultValue = now.toISOString().slice(0, 10);
          }
          // 在 closing --- 行前插入新 key
          const insertPos = content.indexOf('\n---\n', 4);
          content = content.slice(0, insertPos) + '\n' + key + ': ' + defaultValue + content.slice(insertPos);
          repaired.push('added missing key: ' + key);
        }
      }
    }
  }

  // 写回修复后的内容
  if (repair && repaired.length > 0) {
    utils.writeFile(statePath, content);
  }

  return { valid: issues.length === 0, issues, repaired };
}

/**
 * 格式验证：检查 frontmatter 结构正确性
 * 检测：重复 key
 * @param {string} cwd - 项目根目录
 * @returns {{ valid: boolean, issues: string[] }}
 */
function validateFormat(cwd) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const content = utils.readFile(statePath);

  if (!content || !content.startsWith('---\n')) {
    return { valid: false, issues: ['no frontmatter found'] };
  }

  const endIdx = content.indexOf('\n---\n', 4);
  if (endIdx === -1) {
    return { valid: false, issues: ['no frontmatter found'] };
  }

  const yamlBlock = content.slice(4, endIdx);
  const issues = [];

  // 重复 key 检查（只检查顶层 key）
  const seenKeys = {};
  for (const line of yamlBlock.split('\n')) {
    if (!line || /^\s/.test(line)) continue; // 跳过空行和缩进行（子 key）
    const match = line.match(/^([\w][\w_]*):\s*/);
    if (match) {
      const key = match[1];
      if (seenKeys[key]) {
        issues.push('duplicate key: ' + key);
      }
      seenKeys[key] = true;
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * 命令分发入口
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - 子命令参数
 */
function run(cwd, args) {
  const sub = args[0];
  if (sub === 'health') {
    const hasRepair = args.includes('--repair');
    const result = validateHealth(cwd, hasRepair);
    utils.output(result);
  } else if (sub === 'format') {
    const result = validateFormat(cwd);
    utils.output(result);
  } else {
    utils.error('用法: wf-tools validate [health|format] [--repair]');
    process.exit(1);
  }
}

module.exports = { validateHealth, validateFormat, run };
