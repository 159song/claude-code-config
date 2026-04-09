#!/usr/bin/env node
// wf-context-monitor.js — PostToolUse hook
// 监控 context window 使用率，在剩余不足时注入警告。
//
// 工作原理:
// 1. statusline hook 将 context 指标写入 /tmp/claude-ctx-{session_id}.json
// 2. 本 hook 在每次工具调用后读取这些指标
// 3. 当剩余 context 低于阈值时，注入警告信息
//
// 阈值:
//   WARNING  (剩余 <= 35%): 建议收尾当前任务
//   CRITICAL (剩余 <= 25%): 建议立即保存状态

const fs = require('fs');
const os = require('os');
const path = require('path');

const WARNING_THRESHOLD = 35;
const CRITICAL_THRESHOLD = 25;
const STALE_SECONDS = 60;
const DEBOUNCE_CALLS = 5;

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 10000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const sessionId = data.session_id;

    if (!sessionId) process.exit(0);
    if (/[/\\]|\.\./.test(sessionId)) process.exit(0);

    // 检查是否禁用了 context 警告
    const cwd = data.cwd || process.cwd();
    const configPath = path.join(cwd, '.planning', 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.hooks?.context_warnings === false) process.exit(0);
      } catch (e) {}
    }

    const tmpDir = os.tmpdir();
    const metricsPath = path.join(tmpDir, `claude-ctx-${sessionId}.json`);

    if (!fs.existsSync(metricsPath)) process.exit(0);

    const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    const now = Math.floor(Date.now() / 1000);

    if (metrics.timestamp && (now - metrics.timestamp) > STALE_SECONDS) process.exit(0);

    const remaining = metrics.remaining_percentage;
    const usedPct = metrics.used_pct;

    if (remaining > WARNING_THRESHOLD) process.exit(0);

    // 防抖
    const warnPath = path.join(tmpDir, `claude-ctx-${sessionId}-warned.json`);
    let warnData = { callsSinceWarn: 0, lastLevel: null };
    let firstWarn = true;

    if (fs.existsSync(warnPath)) {
      try {
        warnData = JSON.parse(fs.readFileSync(warnPath, 'utf8'));
        firstWarn = false;
      } catch (e) {}
    }

    warnData.callsSinceWarn = (warnData.callsSinceWarn || 0) + 1;

    const isCritical = remaining <= CRITICAL_THRESHOLD;
    const currentLevel = isCritical ? 'critical' : 'warning';
    const severityEscalated = currentLevel === 'critical' && warnData.lastLevel === 'warning';

    if (!firstWarn && warnData.callsSinceWarn < DEBOUNCE_CALLS && !severityEscalated) {
      fs.writeFileSync(warnPath, JSON.stringify(warnData));
      process.exit(0);
    }

    warnData.callsSinceWarn = 0;
    warnData.lastLevel = currentLevel;
    fs.writeFileSync(warnPath, JSON.stringify(warnData));

    const isWfActive = fs.existsSync(path.join(cwd, '.planning', 'STATE.md'));

    let message;
    if (isCritical) {
      message = isWfActive
        ? `CONTEXT 严重不足: 使用率 ${usedPct}%，剩余 ${remaining}%。` +
          'Context 即将耗尽。不要开始新的复杂工作。' +
          '通知用户 context 不足，建议保存当前状态后在新会话中继续。'
        : `CONTEXT 严重不足: 使用率 ${usedPct}%，剩余 ${remaining}%。` +
          'Context 即将耗尽。通知用户并询问如何继续。';
    } else {
      message = isWfActive
        ? `CONTEXT 警告: 使用率 ${usedPct}%，剩余 ${remaining}%。` +
          '避免开始新的复杂工作。如果不在计划步骤之间，通知用户准备暂停。'
        : `CONTEXT 警告: 使用率 ${usedPct}%，剩余 ${remaining}%。` +
          '注意 context 有限，避免不必要的探索。';
    }

    const output = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: message
      }
    };

    process.stdout.write(JSON.stringify(output));
  } catch (e) {
    process.exit(0);
  }
});
