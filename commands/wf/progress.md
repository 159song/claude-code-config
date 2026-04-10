---
name: wf:progress
description: 显示项目整体进度和下一步建议
allowed-tools:
  - Read
  - Bash
  - Glob
---
<objective>
显示项目整体进度，智能路由到下一步操作。
</objective>

<execution_context>
@$HOME/.claude/wf/workflows/progress.md
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<process>
按照 @$HOME/.claude/wf/workflows/progress.md 端到端执行。
</process>
