'use strict';

// lib/milestone.cjs — WF 里程碑管理模块
// 提供里程碑归档和阶段重置功能
// 供 wf-tools milestone 命令使用

const fs = require('fs');
const path = require('path');
const utils = require('./utils.cjs');

// 版本格式验证（T-06-05）：只允许 vN.N 格式
const VERSION_PATTERN = /^v\d+\.\d+$/;

/**
 * 递归复制目录
 * @param {string} src - 源目录
 * @param {string} dest - 目标目录
 * @returns {number} 复制的文件数
 */
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  let count = 0;
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count += 1;
    }
  }

  return count;
}

/**
 * 归档当前里程碑：复制 ROADMAP、REQUIREMENTS、STATE、phases 到 milestones/<version>/
 * @param {string} cwd - 项目根目录
 * @param {string} version - 版本号（如 'v1.0'）
 * @returns {{ success: boolean, archive_dir?: string, files_copied?: number, warnings?: string[], error?: string }}
 */
function archiveMilestone(cwd, version) {
  // 版本格式验证（T-06-05）
  if (!VERSION_PATTERN.test(version)) {
    return { success: false, error: `Invalid version format: ${version}. Expected vN.N (e.g., v1.0)` };
  }

  const planningDir = path.join(cwd, '.planning');
  const archiveDir = path.join(planningDir, 'milestones', version);
  const warnings = [];
  let filesCopied = 0;

  // 检查 ROADMAP.md 存在（必需）
  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    return { success: false, error: 'ROADMAP.md not found' };
  }

  // 创建归档目录
  fs.mkdirSync(archiveDir, { recursive: true });

  // 复制 ROADMAP.md
  fs.copyFileSync(roadmapPath, path.join(archiveDir, `${version}-ROADMAP.md`));
  filesCopied += 1;

  // 复制 REQUIREMENTS.md（可选，缺失时警告）
  const reqPath = path.join(planningDir, 'REQUIREMENTS.md');
  if (fs.existsSync(reqPath)) {
    fs.copyFileSync(reqPath, path.join(archiveDir, `${version}-REQUIREMENTS.md`));
    filesCopied += 1;
  } else {
    warnings.push('REQUIREMENTS.md not found, skipped');
  }

  // 复制 STATE.md（可选，静默跳过）
  const statePath = path.join(planningDir, 'STATE.md');
  if (fs.existsSync(statePath)) {
    fs.copyFileSync(statePath, path.join(archiveDir, `${version}-STATE.md`));
    filesCopied += 1;
  }

  // 复制 phases/ 目录
  const phasesDir = path.join(planningDir, 'phases');
  if (fs.existsSync(phasesDir)) {
    const archivePhasesDir = path.join(archiveDir, 'phases');
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const srcPhaseDir = path.join(phasesDir, entry.name);
        const destPhaseDir = path.join(archivePhasesDir, entry.name);
        filesCopied += copyDirRecursive(srcPhaseDir, destPhaseDir);
      }
    }
  }

  // 复制 specs/ 目录（Phase A 规格空间的历史快照）
  const specsDir = path.join(planningDir, 'specs');
  if (fs.existsSync(specsDir)) {
    filesCopied += copyDirRecursive(specsDir, path.join(archiveDir, 'specs'));
  }

  // 复制 changes/archive/ 目录（Phase B 已归档变更的历史，不含活跃 changes/）
  const changesArchiveDir = path.join(planningDir, 'changes', 'archive');
  if (fs.existsSync(changesArchiveDir)) {
    filesCopied += copyDirRecursive(changesArchiveDir, path.join(archiveDir, 'changes-archive'));
  }

  // 告警：存在活跃（未归档）changes/<id>/ 时，提醒里程碑完成前最好先 apply/archive
  const changesDir = path.join(planningDir, 'changes');
  if (fs.existsSync(changesDir)) {
    const activeChanges = fs.readdirSync(changesDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== 'archive')
      .map(e => e.name);
    if (activeChanges.length > 0) {
      warnings.push(`active (unarchived) changes present: ${activeChanges.join(', ')} — consider archiving them before milestone completion`);
    }
  }

  return {
    success: true,
    archive_dir: archiveDir,
    files_copied: filesCopied,
    warnings,
  };
}

/**
 * 重置项目以准备新里程碑：清空 phases、删除 REQUIREMENTS.md 和 ROADMAP.md
 * 保留：PROJECT.md、STATE.md、config.json、milestones/
 * @param {string} cwd - 项目根目录
 * @returns {{ success: boolean, removed_dirs: string[], removed_files: string[] }}
 */
function resetForNewMilestone(cwd) {
  const planningDir = path.join(cwd, '.planning');
  const removedDirs = [];
  const removedFiles = [];

  // 清空 phases/ 目录中的所有子目录
  const phasesDir = path.join(planningDir, 'phases');
  if (fs.existsSync(phasesDir)) {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(phasesDir, entry.name);
      if (entry.isDirectory()) {
        fs.rmSync(entryPath, { recursive: true, force: true });
        removedDirs.push(entry.name);
      } else {
        fs.unlinkSync(entryPath);
        removedFiles.push(entry.name);
      }
    }
  }

  // 删除 REQUIREMENTS.md
  const reqPath = path.join(planningDir, 'REQUIREMENTS.md');
  if (fs.existsSync(reqPath)) {
    fs.unlinkSync(reqPath);
    removedFiles.push('REQUIREMENTS.md');
  }

  // 删除 ROADMAP.md
  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  if (fs.existsSync(roadmapPath)) {
    fs.unlinkSync(roadmapPath);
    removedFiles.push('ROADMAP.md');
  }

  // 保留: PROJECT.md, STATE.md, config.json, milestones/

  return {
    success: true,
    removed_dirs: removedDirs,
    removed_files: removedFiles,
  };
}

/**
 * 命令分发入口
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - 子命令参数
 */
function run(cwd, args) {
  const sub = (args || [])[0];

  if (sub === 'archive') {
    const version = args[1];
    if (!version) {
      utils.error('用法: wf-tools milestone archive <version>');
      process.exit(1);
    }
    const result = archiveMilestone(cwd, version);
    utils.output(result);
  } else if (sub === 'reset') {
    const result = resetForNewMilestone(cwd);
    utils.output(result);
  } else {
    utils.error('用法: wf-tools milestone <archive|reset>');
    process.exit(1);
  }
}

module.exports = { archiveMilestone, resetForNewMilestone, run };
