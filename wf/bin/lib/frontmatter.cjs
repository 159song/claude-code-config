'use strict';

// lib/frontmatter.cjs — YAML frontmatter 解析/序列化（共享模块）
// 供 state.cjs 和 hooks/wf-session-state.js 共用，避免重复实现

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
  // JSON array
  if (value.startsWith('[') && value.endsWith(']')) {
    try { return JSON.parse(value); } catch {}
  }
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
  if (Array.isArray(val)) return JSON.stringify(val);
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

module.exports = { parseYamlValue, formatYamlValue, parseFrontmatter, serializeFrontmatter };
