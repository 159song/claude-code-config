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
//   WARNING  (剩余 <= 30%): 建议确保 CONTINUATION.md 检查点已写入
//   CRITICAL (剩余 <= 15%): auto-compact 即将触发，确认检查点已就绪
// 防抖: 同级别警告间隔 >= 60 秒，级别升级立即触发

const fs = require('fs');
const os = require('os');
const path = require('path');

const WARNING_THRESHOLD = 30;   // 30% remaining = 70% used
const CRITICAL_THRESHOLD = 15;  // 15% remaining = 85% used
const STALE_SECONDS = 60;
const DEBOUNCE_SECONDS = 60;    // same-level warnings at most once per 60 seconds

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 15000);
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

    // 时间防抖: 同级别警告至少间隔 DEBOUNCE_SECONDS 秒
    const warnPath = path.join(tmpDir, `claude-ctx-${sessionId}-warned.json`);
    let warnData = { lastWarnTime: 0, lastLevel: null };

    if (fs.existsSync(warnPath)) {
      try {
        warnData = JSON.parse(fs.readFileSync(warnPath, 'utf8'));
      } catch (e) {}
    }

    const nowMs = Date.now();
    const isCritical = remaining <= CRITICAL_THRESHOLD;
    const currentLevel = isCritical ? 'critical' : 'warning';
    const severityEscalated = currentLevel === 'critical' && warnData.lastLevel === 'warning';
    const elapsed = (nowMs - (warnData.lastWarnTime || 0)) / 1000;

    if (warnData.lastWarnTime && elapsed < DEBOUNCE_SECONDS && !severityEscalated) {
      process.exit(0);
    }

    warnData.lastWarnTime = nowMs;
    warnData.lastLevel = currentLevel;
    fs.writeFileSync(warnPath, JSON.stringify(warnData));

    const isWfActive = fs.existsSync(path.join(cwd, '.planning', 'STATE.md'));

    // 检测 CONTINUATION.md 存在（autonomous 模式检查点）
    const hasContinuation = fs.existsSync(path.join(cwd, '.planning', 'CONTINUATION.md'));

    let message;
    if (isCritical) {
      message = isWfActive
        ? `CONTEXT 严重不足: 使用率 ${usedPct}%，剩余 ${remaining}%。` +
          (hasContinuation
            ? 'CONTINUATION.md 检查点已存在，auto-compact 将自动触发并恢复。继续当前任务，完成后 auto-compact 会压缩 context。'
            : 'Context 即将耗尽。确保 CONTINUATION.md 检查点已写入，然后继续执行。auto-compact 会自动处理 context 压缩。')
        : `CONTEXT 严重不足: 使用率 ${usedPct}%，剩余 ${remaining}%。` +
          'Context 即将耗尽。通知用户并询问如何继续。';
    } else {
      message = isWfActive
        ? `CONTEXT 警告: 使用率 ${usedPct}%，剩余 ${remaining}%。` +
          (hasContinuation
            ? 'CONTINUATION.md 检查点已就绪。可安全继续，auto-compact 会在需要时自动压缩。'
            : '建议尽快写入 CONTINUATION.md 检查点，确保 auto-compact 后能恢复。')
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
