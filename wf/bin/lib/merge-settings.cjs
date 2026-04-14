#!/usr/bin/env node
// merge-settings.cjs — 智能合并 WF settings.json 到目标 settings.json
//
// 用法: node merge-settings.cjs <source> <target>
//   source: WF 的 settings.json 路径
//   target: 用户现有的 settings.json 路径（可不存在）
//
// 输出: 合并后的 JSON 到 stdout
// 退出码: 0=成功, 1=错误

'use strict';

const fs = require('fs');
const path = require('path');

// --- 核心合并逻辑 ---

/**
 * 在 hook 数组中查找包含指定关键字的条目
 * WF hooks 的特征: command 字符串包含 "wf-" 前缀
 */
function findHookIndex(hookArray, keyword) {
  if (!Array.isArray(hookArray)) return -1;
  return hookArray.findIndex(entry => {
    const cmd = entry.command || (entry.hooks && entry.hooks[0] && entry.hooks[0].command) || '';
    return cmd.includes(keyword);
  });
}

/**
 * 合并单个 hook 事件类型的数组
 * 策略: WF 条目按关键字匹配更新，非 WF 条目保留不动
 */
function mergeHookArray(sourceArr, targetArr) {
  if (!Array.isArray(sourceArr)) return targetArr || [];
  if (!Array.isArray(targetArr)) return [...sourceArr];

  const result = [...targetArr];

  for (const srcEntry of sourceArr) {
    const cmd = srcEntry.command || (srcEntry.hooks && srcEntry.hooks[0] && srcEntry.hooks[0].command) || '';
    // 提取 wf-xxx 标识符用于匹配
    const match = cmd.match(/wf-[\w-]+/);
    if (!match) {
      // 非 WF 条目, 直接追加
      result.push(srcEntry);
      continue;
    }

    const keyword = match[0];
    const existingIdx = findHookIndex(result, keyword);
    if (existingIdx >= 0) {
      // 更新已有的 WF hook
      result[existingIdx] = srcEntry;
    } else {
      // 追加新的 WF hook
      result.push(srcEntry);
    }
  }

  return result;
}

/**
 * 合并 hooks 对象 (SessionStart, PostToolUse, PreToolUse, Stop)
 */
function mergeHooks(sourceHooks, targetHooks) {
  if (!sourceHooks) return targetHooks || {};
  if (!targetHooks) return { ...sourceHooks };

  const result = { ...targetHooks };
  for (const eventType of Object.keys(sourceHooks)) {
    result[eventType] = mergeHookArray(sourceHooks[eventType], targetHooks[eventType]);
  }
  return result;
}

/**
 * 合并 permissions 对象 (allow, deny, ask)
 * 策略: 取并集, 不重复
 */
function mergePermissions(sourcePerm, targetPerm) {
  if (!sourcePerm) return targetPerm || {};
  if (!targetPerm) return { ...sourcePerm };

  const result = { ...targetPerm };
  for (const key of ['allow', 'deny', 'ask']) {
    if (!Array.isArray(sourcePerm[key])) continue;
    const existing = new Set(result[key] || []);
    const merged = [...(result[key] || [])];
    for (const entry of sourcePerm[key]) {
      if (!existing.has(entry)) {
        merged.push(entry);
        existing.add(entry);
      }
    }
    result[key] = merged;
  }
  return result;
}

/**
 * 合并 env 对象
 * 策略: source 提供默认值, target 的已有值优先
 */
function mergeEnv(sourceEnv, targetEnv) {
  if (!sourceEnv) return targetEnv || {};
  if (!targetEnv) return { ...sourceEnv };
  return { ...sourceEnv, ...targetEnv };
}

/**
 * 合并 statusLine
 * 策略: 仅当 target 无 statusLine 或 target 的 statusLine 包含 "wf-" 时才覆盖
 */
function mergeStatusLine(sourceStatus, targetStatus) {
  if (!sourceStatus) return targetStatus;
  if (!targetStatus) return sourceStatus;

  // target 已有非 WF 的 statusLine, 保留用户的
  const targetCmd = targetStatus.command || '';
  if (targetCmd && !targetCmd.includes('wf-')) {
    return targetStatus;
  }

  // target 是 WF statusLine 或空, 更新
  return sourceStatus;
}

/**
 * 主合并函数
 */
function mergeSettings(source, target) {
  const result = { ...target };

  // 1. hooks: 智能合并
  result.hooks = mergeHooks(source.hooks, target.hooks);

  // 2. statusLine: 条件覆盖
  result.statusLine = mergeStatusLine(source.statusLine, target.statusLine);

  // 3. permissions: 并集
  result.permissions = mergePermissions(source.permissions, target.permissions);

  // 4. env: source 为默认, target 优先
  result.env = mergeEnv(source.env, target.env);

  // 5. 其他顶层字段: source 提供缺失的, target 已有的保留
  for (const key of Object.keys(source)) {
    if (['hooks', 'statusLine', 'permissions', 'env'].includes(key)) continue;
    if (!(key in result)) {
      result[key] = source[key];
    }
  }

  return result;
}

// --- CLI 入口 ---

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1 || args.length > 2) {
    process.stderr.write('用法: node merge-settings.cjs <source> [target]\n');
    process.stderr.write('  source: WF settings.json\n');
    process.stderr.write('  target: 现有 settings.json (可选, 不存在则视为空)\n');
    process.exit(1);
  }

  const sourcePath = path.resolve(args[0]);
  const targetPath = args[1] ? path.resolve(args[1]) : null;

  // 读取 source (必须存在)
  let source;
  try {
    source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  } catch (e) {
    process.stderr.write(`错误: 无法读取 source: ${sourcePath}\n${e.message}\n`);
    process.exit(1);
  }

  // 读取 target (可不存在)
  let target = {};
  if (targetPath) {
    try {
      target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    } catch (e) {
      // target 不存在或无效, 视为空对象
      target = {};
    }
  }

  const merged = mergeSettings(source, target);
  process.stdout.write(JSON.stringify(merged, null, 2) + '\n');
}

// 导出供测试使用
module.exports = { mergeSettings, mergeHookArray, mergeHooks, mergePermissions, mergeEnv, mergeStatusLine };

// 仅在直接执行时运行 CLI
if (require.main === module) {
  main();
}
