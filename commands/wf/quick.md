---
name: wf:quick
description: 快速任务 — 适用于 bug 修复、小功能、配置调整
argument-hint: "<task description> [--full] [--validate] [--discuss] [--research]"
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
快速完成阶段体系外的临时任务。
完整管道: 规划 → 执行 → 验证（简化版）。
</objective>

<execution_context>
@{{WF_ROOT}}/wf/workflows/quick.md
@{{WF_ROOT}}/wf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
按照 @{{WF_ROOT}}/wf/workflows/quick.md 端到端执行。
</process>
