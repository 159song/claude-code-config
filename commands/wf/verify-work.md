---
name: wf:verify-work
description: 对话式用户验收测试
argument-hint: "[--smoke]"
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
对话式 UAT。用户用自然语言描述问题或确认通过，系统追踪并自动修复。

产出:
- `.planning/UAT.md` — 验收测试状态
</objective>

<execution_context>
@{{WF_ROOT}}/wf/workflows/verify-work.md
@{{WF_ROOT}}/wf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
按照 @{{WF_ROOT}}/wf/workflows/verify-work.md 端到端执行。
</process>
