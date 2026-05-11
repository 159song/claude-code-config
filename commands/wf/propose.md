---
name: wf:propose
description: 把 idea 转化为可审阅可 diff 的 change 包（proposal + tasks + specs delta）
argument-hint: "<idea> | <change-id> \"<idea>\""
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
产出 .planning/changes/<id>/ 变更提议包：proposal.md + tasks.md + specs/<cap>/spec.md delta。
规格级别的一等公民工件，独立于 phase 生命周期。
</objective>

<execution_context>
@$HOME/.claude/wf/workflows/propose.md
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
按照 @$HOME/.claude/wf/workflows/propose.md 端到端执行。
</process>
