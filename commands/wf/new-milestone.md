---
name: wf:new-milestone
description: 新里程碑 -- 收集目标，研究，生成需求和路线图
argument-hint: "[version]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
  - Agent
  - AskUserQuestion
---
<objective>
初始化新里程碑：收集目标 -> 研究 -> 生成需求 -> 生成路线图。
复用 wf-researcher 和 wf-roadmapper agent。

产出:
- `.planning/REQUIREMENTS.md` -- 新里程碑需求文档
- `.planning/ROADMAP.md` -- 新里程碑路线图
- `.planning/STATE.md` -- 更新后的状态
</objective>

<execution_context>
@$HOME/.claude/wf/workflows/new-milestone.md
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
按照 @$HOME/.claude/wf/workflows/new-milestone.md 端到端执行。
</process>
