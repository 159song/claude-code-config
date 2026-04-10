---
name: wf:next
description: 自动检测项目状态并推进到下一逻辑步骤
allowed-tools:
  - Read
  - Bash
  - Glob
  - Agent
  - Task
---
<objective>
检测项目当前状态（哪个阶段、哪个步骤），自动路由到下一个需要执行的工作流命令。
</objective>

<execution_context>
@$HOME/.claude/wf/workflows/next.md
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<process>
按照 @$HOME/.claude/wf/workflows/next.md 端到端执行。
</process>
