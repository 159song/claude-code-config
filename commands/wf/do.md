---
name: wf:do
description: 将自然语言路由到最合适的 WF 命令
argument-hint: "<描述你想做什么>"
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---
<objective>
分析自然语言输入，匹配最合适的 WF 命令并调用。
智能调度器——自身不执行工作，只匹配意图并转发。
</objective>

<execution_context>
@{{WF_ROOT}}/wf/workflows/do.md
@{{WF_ROOT}}/wf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
按照 @{{WF_ROOT}}/wf/workflows/do.md 端到端执行。
将用户意图路由到最佳 WF 命令并调用。
</process>
