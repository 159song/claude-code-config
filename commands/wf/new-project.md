---
name: wf:new-project
description: 初始化新项目，通过提问收集上下文并生成需求和路线图
argument-hint: "[--auto]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
初始化新项目：提问 → 研究（可选）→ 需求 → 路线图。

产出:
- `.planning/PROJECT.md` — 项目上下文
- `.planning/config.json` — 工作流配置
- `.planning/REQUIREMENTS.md` — 需求文档
- `.planning/ROADMAP.md` — 阶段路线图
- `.planning/STATE.md` — 项目状态

完成后运行 `/wf-discuss-phase 1` 或 `/wf-autonomous`。
</objective>

<execution_context>
@$HOME/.claude/wf/workflows/new-project.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/templates/project.md
@$HOME/.claude/wf/templates/requirements.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
按照 @$HOME/.claude/wf/workflows/new-project.md 端到端执行。
保留所有工作流门禁（验证、审批、提交、路由）。
</process>
