'use strict';

// lib/git.cjs - WF Git 操作模块
// 提供 planning 文件的 git 提交功能，支持 --files 参数指定特定文件

const path = require('path');
const { execFileSync } = require('child_process');
const utils = require('./utils.cjs');

/**
 * 提交 planning 文件到 git
 * @param {string} cwd - 项目根目录
 * @param {string} message - 提交消息
 * @param {string[]} [files] - 可选：指定要暂存的文件列表，未提供时暂存 .planning/ 目录
 */
function gitCommitPlanning(cwd, message, files) {
  try {
    if (files && files.length > 0) {
      // 只暂存指定文件（支持 --files 参数）
      execFileSync('git', ['add', '--', ...files], {
        cwd,
        stdio: 'pipe',
      });
    } else {
      // 默认暂存整个 .planning/ 目录
      const planningDir = path.join(cwd, '.planning');
      execFileSync('git', ['add', planningDir], {
        cwd,
        stdio: 'pipe',
      });
    }
    execFileSync('git', ['commit', '-m', message], {
      cwd,
      stdio: 'pipe',
    });
    utils.output({ success: true, message: '提交成功' });
  } catch (e) {
    utils.error(`提交失败: ${e.message}`);
    process.exit(1);
  }
}

/**
 * 命令分发入口
 * 解析 --message 和 --files 参数
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - 子命令参数
 */
function run(cwd, args) {
  // 解析 --message 参数
  let message = null;
  let files = null;
  const remaining = [];

  let i = 0;
  while (i < args.length) {
    if (args[i] === '--message' && args[i + 1]) {
      message = args[i + 1];
      i += 2;
    } else if (args[i] === '--files') {
      // 收集 --files 之后的所有参数
      files = [];
      i++;
      while (i < args.length && !args[i].startsWith('--')) {
        files.push(args[i]);
        i++;
      }
    } else {
      remaining.push(args[i]);
      i++;
    }
  }

  // 如果没有 --message，将剩余参数作为 message
  if (!message && remaining.length > 0) {
    message = remaining.join(' ');
  }

  if (!message) {
    utils.error('用法: wf-tools commit --message <msg> [--files file1 file2...]');
    process.exit(1);
  }

  gitCommitPlanning(cwd, message, files);
}

module.exports = { gitCommitPlanning, run };
