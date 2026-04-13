---
name: wf:code-review
description: 代码审查 -- 审查阶段变更文件，自动修复问题
argument-hint: "<phase> [--depth quick|standard|deep] [--files file1,file2]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - Agent
---
<objective>
审查指定阶段的代码变更，发现问题后自动修复。

产出:
- `<phaseDir>/REVIEW.md` -- 结构化审查报告
</objective>

<execution_context>
@$HOME/.claude/wf/workflows/code-review.md
@$HOME/.claude/wf/references/agent-contracts.md
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
按照 @$HOME/.claude/wf/workflows/code-review.md 端到端执行。
</process>
