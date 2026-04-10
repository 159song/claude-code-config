'use strict';

// lib/utils.cjs — WF 工作流工具函数
// 叶子模块：不依赖任何本地模块
// 提供文件 I/O、项目根目录发现、JSON 输出等基础功能

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * 读取文件内容，失败时返回 null
 * @param {string} filePath - 文件绝对路径
 * @returns {string|null}
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * 读取 JSON 文件并解析，失败时返回 null
 * @param {string} filePath - JSON 文件路径
 * @returns {object|null}
 */
function readJson(filePath) {
  const content = readFile(filePath);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * 写入文件，自动创建父目录
 * @param {string} filePath - 目标文件路径
 * @param {string} content - 文件内容
 */
function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * 确保 .planning 目录存在
 * @param {string} cwd - 项目根目录
 */
function ensurePlanningDir(cwd) {
  const planningDir = path.join(cwd || process.cwd(), '.planning');
  if (!fs.existsSync(planningDir)) {
    fs.mkdirSync(planningDir, { recursive: true });
  }
}

/**
 * 从 startDir 向上遍历，查找包含 .planning/ 的目录
 * 到达 $HOME 时停止遍历，未找到时返回 startDir 作为 fallback（D-11）
 * @param {string} startDir - 起始目录
 * @returns {string} 项目根目录路径
 */
function findProjectRoot(startDir) {
  const resolved = path.resolve(startDir);
  const root = path.parse(resolved).root;
  const homedir = os.homedir();

  // 如果起始目录本身含 .planning/，直接返回
  if (fs.existsSync(path.join(resolved, '.planning'))) {
    return resolved;
  }

  let dir = resolved;
  while (dir !== root) {
    const parent = path.dirname(dir);
    if (parent === dir) break;
    if (parent === homedir) break; // 不超过 $HOME 边界（D-11）

    const parentPlanning = path.join(parent, '.planning');
    if (fs.existsSync(parentPlanning) && fs.statSync(parentPlanning).isDirectory()) {
      return parent;
    }
    dir = parent;
  }

  // Fallback：返回原始起始目录（新项目友好，D-11）
  return resolved;
}

/**
 * 阻塞式 JSON 输出到 stdout（fd 1）
 * 超过 50KB 时写入临时文件并输出 @file: 前缀（防止 stdout 缓冲区溢出）
 * @param {object} result - 要输出的对象
 */
function output(result) {
  const json = JSON.stringify(result, null, 2);
  if (json.length > 50000) {
    const tmpPath = path.join(os.tmpdir(), `wf-${Date.now()}.json`);
    fs.writeFileSync(tmpPath, json, 'utf-8');
    fs.writeSync(1, '@file:' + tmpPath);
  } else {
    // fs.writeSync 是阻塞写入，防止 process.stdout.write + process.exit 竞争
    fs.writeSync(1, json);
  }
}

/**
 * 写入错误消息到 stderr（fd 2）
 * @param {string} message - 错误消息
 */
function error(message) {
  fs.writeSync(2, message + '\n');
}

module.exports = { readFile, readJson, writeFile, ensurePlanningDir, findProjectRoot, output, error };
