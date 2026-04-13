'use strict';

// lib/review.cjs — WF 代码审查工具模块
// 提供文件范围计算、REVIEW.md 解析功能
// 供 wf-tools review 命令和 wf-reviewer agent 使用

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const utils = require('./utils.cjs');
const { findPhaseDir } = require('./phase.cjs');

// 排除模式：非源代码文件
const EXCLUDE_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.avif',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.lock', '.map',
]);

const EXCLUDE_PREFIXES = ['.env'];
const EXCLUDE_DIRS = ['node_modules/', '.planning/'];
const EXCLUDE_FILENAMES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']);

// 有效审查状态值（T-06-04）
const VALID_REVIEW_STATUSES = new Set(['clean', 'issues_found', 'error']);

/**
 * 计算文件审查范围（三级回退策略）
 * Tier 1: --files 手动指定
 * Tier 2: SUMMARY.md key_files
 * Tier 3: git diff
 * @param {string} cwd - 项目根目录
 * @param {string|null} phaseDir - 阶段目录路径（null 时自动查找）
 * @param {string} paddedPhase - 阶段编号（如 '01'）
 * @param {string[]|null} filesOverride - 手动指定的文件列表
 * @returns {{ files: string[], tier: string }}
 */
function computeFileScope(cwd, phaseDir, paddedPhase, filesOverride) {
  // Tier 1: --files 手动指定
  if (filesOverride && filesOverride.length > 0) {
    const validated = [];
    for (const f of filesOverride) {
      const resolved = path.resolve(cwd, f);
      // 路径遍历防护（T-06-01）：确保解析后的路径在 cwd 内
      if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
        continue; // 拒绝遍历路径
      }
      if (fs.existsSync(resolved)) {
        validated.push(f);
      }
    }
    return { files: validated, tier: '--files' };
  }

  // Tier 2: 从 SUMMARY.md 提取 key_files
  if (phaseDir) {
    const summaryFiles = extractKeyFilesFromSummaries(phaseDir);
    const filtered = filterReviewFiles(cwd, summaryFiles);
    if (filtered.length > 0) {
      return { files: filtered, tier: 'SUMMARY.md' };
    }
  }

  // Tier 3: git diff
  const diffFiles = getGitDiffFiles(cwd, paddedPhase);
  const filtered = filterReviewFiles(cwd, diffFiles);
  if (filtered.length > 0) {
    return { files: filtered, tier: 'git diff' };
  }

  return { files: [], tier: 'empty' };
}

/**
 * 从阶段目录中所有 SUMMARY.md 提取 key_files
 * 支持 `## 变更文件` 和 `key_files:` 两种格式
 * @param {string} phaseDir - 阶段目录路径
 * @returns {string[]} 去重的相对路径数组
 */
function extractKeyFilesFromSummaries(phaseDir) {
  const files = new Set();

  let entries;
  try {
    entries = fs.readdirSync(phaseDir);
  } catch {
    return [];
  }

  const summaryFiles = entries.filter(e => e.endsWith('-SUMMARY.md'));

  for (const sf of summaryFiles) {
    const content = fs.readFileSync(path.join(phaseDir, sf), 'utf8');
    const lines = content.split('\n');

    let inKeySection = false;
    for (const line of lines) {
      // 检测 key_files 区段开始
      if (/^## 变更文件/.test(line) || /^key_files:/i.test(line) || /^key-files:/i.test(line)) {
        inKeySection = true;
        continue;
      }

      // 其他 H2 标题结束当前区段
      if (inKeySection && /^## /.test(line) && !/^## 变更文件/.test(line)) {
        inKeySection = false;
        continue;
      }

      // 提取 backtick 包裹的路径：- `path/to/file`
      if (inKeySection) {
        const match = line.match(/^-\s+`([^`]+)`/);
        if (match) {
          files.add(match[1]);
        }
      }
    }
  }

  return Array.from(files);
}

/**
 * 通过 git diff 获取最近变更的文件列表
 * 使用 execFileSync 防止 shell 注入（T-06-02）
 * @param {string} cwd - 项目根目录
 * @param {string} paddedPhase - 阶段编号（仅用于日志，不注入命令）
 * @returns {string[]} 文件相对路径数组
 */
function getGitDiffFiles(cwd, paddedPhase) {
  try {
    const output = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD~20..HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const files = output.trim().split('\n').filter(Boolean);
    // 验证文件仍存在于磁盘
    return files.filter(f => fs.existsSync(path.join(cwd, f)));
  } catch {
    return [];
  }
}

/**
 * 过滤非源代码文件
 * 排除：.planning/ 下的 .md、.env*、二进制文件、node_modules/ 等（T-06-03）
 * @param {string} cwd - 项目根目录
 * @param {string[]} files - 文件相对路径数组
 * @returns {string[]} 过滤后的文件数组
 */
function filterReviewFiles(cwd, files) {
  return files.filter(f => {
    const ext = path.extname(f).toLowerCase();
    const basename = path.basename(f);

    // 排除二进制和非源码扩展名
    if (EXCLUDE_EXTENSIONS.has(ext)) return false;

    // 排除 .env 前缀文件
    if (EXCLUDE_PREFIXES.some(p => basename.startsWith(p))) return false;

    // 排除特定目录
    if (EXCLUDE_DIRS.some(d => f.startsWith(d) || f.includes('/' + d))) return false;

    // 排除特定文件名
    if (EXCLUDE_FILENAMES.has(basename)) return false;

    return true;
  });
}

/**
 * 解析 REVIEW.md 的 YAML frontmatter
 * 使用正则手动解析，避免引入 YAML 库
 * @param {string} filePath - REVIEW.md 文件路径
 * @returns {object|null} 解析后的结构，或 null（文件不存在/格式错误）
 */
function parseReviewFrontmatter(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }

  // 提取 frontmatter（两个 --- 之间的内容）
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return null;

  const fm = fmMatch[1];
  const lines = fm.split('\n');

  const result = {
    status: null,
    depth: null,
    phase: null,
    files_reviewed: null,
    findings: { critical: 0, high: 0, medium: 0, low: 0, total: 0 },
    iteration: null,
  };

  let inFindings = false;

  for (const line of lines) {
    // 顶层键
    const topMatch = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
    if (topMatch) {
      const [, key, val] = topMatch;
      inFindings = false;

      switch (key) {
        case 'status': {
          const cleaned = val.trim().replace(/^['"]|['"]$/g, '');
          // 验证状态值合法性（T-06-04）
          result.status = VALID_REVIEW_STATUSES.has(cleaned) ? cleaned : null;
          break;
        }
        case 'depth':
          result.depth = val.trim().replace(/^['"]|['"]$/g, '');
          break;
        case 'phase':
          result.phase = parseInt(val.trim(), 10) || null;
          break;
        case 'files_reviewed':
          result.files_reviewed = parseInt(val.trim(), 10) || null;
          break;
        case 'iteration':
          result.iteration = parseInt(val.trim(), 10) || null;
          break;
        default:
          break;
      }
      continue;
    }

    // findings: 区段开始（无值的键）
    if (/^findings:\s*$/.test(line)) {
      inFindings = true;
      continue;
    }

    // findings 子键
    if (inFindings) {
      const subMatch = line.match(/^\s+(\w+)\s*:\s*(\d+)/);
      if (subMatch) {
        const [, subKey, subVal] = subMatch;
        if (subKey in result.findings) {
          result.findings[subKey] = parseInt(subVal, 10);
        }
      }
    }
  }

  // 至少要有 status 才算有效解析
  if (result.status === null) return null;

  return result;
}

/**
 * 命令分发入口
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - 子命令参数
 */
function run(cwd, args) {
  const sub = (args || [])[0];

  if (sub === 'scope') {
    const phaseNum = args[1];
    if (!phaseNum) {
      utils.error('用法: wf-tools review scope <phase> [--files f1,f2,...]');
      process.exit(1);
    }

    // 解析 --files 参数
    let filesOverride = null;
    const filesIdx = args.indexOf('--files');
    if (filesIdx !== -1 && args[filesIdx + 1]) {
      filesOverride = args[filesIdx + 1].split(',');
    }

    // 查找阶段目录
    const phaseInfo = findPhaseDir(cwd, parseInt(phaseNum, 10));
    const phaseDir = phaseInfo ? phaseInfo.directory : null;
    const paddedPhase = String(phaseNum).padStart(2, '0');

    const result = computeFileScope(cwd, phaseDir, paddedPhase, filesOverride);
    utils.output(result);
  } else if (sub === 'parse') {
    const reviewPath = args[1];
    if (!reviewPath) {
      utils.error('用法: wf-tools review parse <review_md_path>');
      process.exit(1);
    }

    const result = parseReviewFrontmatter(reviewPath);
    if (result) {
      utils.output(result);
    } else {
      utils.output({ error: 'Failed to parse review frontmatter', path: reviewPath });
    }
  } else {
    utils.error('用法: wf-tools review <scope|parse>');
    process.exit(1);
  }
}

module.exports = {
  computeFileScope,
  extractKeyFilesFromSummaries,
  getGitDiffFiles,
  filterReviewFiles,
  parseReviewFrontmatter,
  run,
};
