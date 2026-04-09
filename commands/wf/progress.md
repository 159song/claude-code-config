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
@{{WF_ROOT}}/wf/workflows/progress.md
@{{WF_ROOT}}/wf/references/ui-brand.md
</execution_context>

<process>
按照 @{{WF_ROOT}}/wf/workflows/progress.md 端到端执行。
</process>
