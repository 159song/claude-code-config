---
name: wf:pause
description: 暂停当前工作，保存进度检查点到 HANDOFF.json
allowed-tools:
  - Read
  - Bash
  - Glob
---
<objective>
暂停当前工作流执行，生成 HANDOFF.json 和 .continue-here.md，便于跨会话恢复。
</objective>

<execution_context>
@$HOME/.claude/wf/workflows/session.md
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<process>
按照 @$HOME/.claude/wf/workflows/session.md 中的 "暂停流程" 执行。
</process>
