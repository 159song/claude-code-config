---
name: wf:settings
description: 查看和修改工作流配置
argument-hint: "[set key value]"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---
<objective>
查看和修改 WF 工作流配置。无参数时显示交互式配置菜单，支持 set key value 直接修改。
</objective>

<execution_context>
@$HOME/.claude/wf/workflows/settings.md
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
按照 settings.md 工作流执行。根据参数选择交互模式或直接 CLI 模式。
</process>
