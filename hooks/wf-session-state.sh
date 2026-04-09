#!/bin/bash
# wf-session-state.sh — SessionStart hook: 注入项目状态提醒
# 每次会话启动时输出 STATE.md 摘要，帮助 agent 快速了解当前状态。

echo '## 项目状态提醒'
echo ''

if [ -f .planning/STATE.md ]; then
  echo 'STATE.md 存在 — 检查当前阶段和阻塞项。'
  head -20 .planning/STATE.md
else
  echo '没有检测到 .planning/ 目录 — 建议运行 /wf-new-project 初始化项目。'
fi

echo ''

if [ -f .planning/config.json ]; then
  MODE=$(grep -o '"mode"[[:space:]]*:[[:space:]]*"[^"]*"' .planning/config.json 2>/dev/null || echo '"mode": "unknown"')
  echo "配置: $MODE"
fi

exit 0
