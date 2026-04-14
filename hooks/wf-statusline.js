#!/usr/bin/env node
// wf-statusline.js — Claude Code Statusline
// 显示: 模型 | 当前任务 | 目录 | context 使用率

const fs = require('fs');
const path = require('path');
const os = require('os');

// Pre-cache paths (avoid recalculation per invocation)
const homeDir = os.homedir();
const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(homeDir, '.claude');
const todosDir = path.join(claudeDir, 'todos');

// Atomic file write: write to .tmp then rename (prevents corrupted reads)
function atomicWrite(fp, data) {
  const tmp = fp + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, fp);
}

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 15000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const model = data.model?.display_name || 'Claude';
    const dir = data.workspace?.current_dir || process.cwd();
    const session = data.session_id || '';
    const remaining = data.context_window?.remaining_percentage;

    // Context 使用率显示
    const AUTO_COMPACT_BUFFER_PCT = 16.5;
    let ctx = '';
    if (remaining != null) {
      const usableRemaining = Math.max(0, ((remaining - AUTO_COMPACT_BUFFER_PCT) / (100 - AUTO_COMPACT_BUFFER_PCT)) * 100);
      const used = Math.max(0, Math.min(100, Math.round(100 - usableRemaining)));

      // 写入 bridge 文件供 context-monitor hook 读取
      const sessionSafe = session && /^[a-zA-Z0-9_-]+$/.test(session);
      if (sessionSafe) {
        try {
          const bridgePath = path.join(os.tmpdir(), `claude-ctx-${session}.json`);
          const bridgeData = JSON.stringify({
            session_id: session,
            remaining_percentage: remaining,
            used_pct: used,
            timestamp: Math.floor(Date.now() / 1000)
          });
          // Skip write if data unchanged (avoid unnecessary disk I/O)
          let existing = '';
          try { existing = fs.readFileSync(bridgePath, 'utf8'); } catch {}
          if (bridgeData !== existing) {
            atomicWrite(bridgePath, bridgeData);
          }
        } catch (e) {
          try { fs.writeSync(2, `[wf-statusline] bridge write: ${e.message}\n`); } catch {}
        }
      }

      // 进度条 (10 段)
      const filled = Math.floor(used / 10);
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);

      if (used < 50) {
        ctx = ` \x1b[32m${bar} ${used}%\x1b[0m`;
      } else if (used < 65) {
        ctx = ` \x1b[33m${bar} ${used}%\x1b[0m`;
      } else if (used < 80) {
        ctx = ` \x1b[38;5;208m${bar} ${used}%\x1b[0m`;
      } else {
        ctx = ` \x1b[5;31m💀 ${bar} ${used}%\x1b[0m`;
      }
    }

    // 当前任务 (cached by todosDir mtime to avoid repeated readdirSync + statSync)
    let task = '';
    if (session && fs.existsSync(todosDir)) {
      try {
        let dirMtime;
        try { dirMtime = fs.statSync(todosDir).mtimeMs; } catch (e) { dirMtime = null; }

        if (dirMtime != null) {
          if (!global._wfTodoCache || global._wfTodoCache.dirMtime !== dirMtime || global._wfTodoCache.session !== session) {
            const files = fs.readdirSync(todosDir)
              .filter(f => f.startsWith(session) && f.includes('-agent-') && f.endsWith('.json'))
              .map(f => ({ name: f, mtime: fs.statSync(path.join(todosDir, f)).mtime }))
              .sort((a, b) => b.mtime - a.mtime);

            let cachedTask = '';
            if (files.length > 0) {
              const todos = JSON.parse(fs.readFileSync(path.join(todosDir, files[0].name), 'utf8'));
              const inProgress = todos.find(t => t.status === 'in_progress');
              if (inProgress) cachedTask = inProgress.activeForm || '';
            }
            global._wfTodoCache = { dirMtime, session, task: cachedTask };
          }
          task = global._wfTodoCache.task;
        }
      } catch (e) {}
    }

    // 输出
    const dirname = path.basename(dir);
    if (task) {
      process.stdout.write(`\x1b[36mWF\x1b[0m │ \x1b[2m${model}\x1b[0m │ \x1b[1m${task}\x1b[0m │ \x1b[2m${dirname}\x1b[0m${ctx}`);
    } else {
      process.stdout.write(`\x1b[36mWF\x1b[0m │ \x1b[2m${model}\x1b[0m │ \x1b[2m${dirname}\x1b[0m${ctx}`);
    }
  } catch (e) {
    try { fs.writeSync(2, `[wf-statusline] ${e.message}\n`); } catch {}
  }
});
