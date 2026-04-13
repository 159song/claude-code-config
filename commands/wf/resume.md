---
name: wf:resume
description: 从 HANDOFF.json 恢复中断的工作流，智能路由到中断点
allowed-tools:
  - Read
  - Bash
  - Glob
  - Agent
  - Task
---
<objective>
从上次暂停点恢复工作流执行，自动路由到对应的阶段和步骤。
</objective>

<execution_context>
@$HOME/.claude/wf/workflows/session.md
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<process>
按照 @$HOME/.claude/wf/workflows/session.md 中的 "恢复流程" 执行。
</process>
