---
description: Route to the next WF step based on current state. Use when the user asks "what's next", "continue", "下一步", or when they've finished one WF step and need guidance on which workflow to run next.
allowed-tools: Read Bash Glob Agent Task
---

# /wf-next

@$HOME/.claude/wf/workflows/next.md
@$HOME/.claude/wf/references/ui-brand.md

按 workflow 端到端执行：检测当前状态 → 路由到合适的下一步 workflow。

## Don't use when

- 用户问的是技术方案选择（应由 wf-plan-phase / discuss-phase 处理）
- 用户明确想跳过推荐路径（显式 `/wf-xxx`）
