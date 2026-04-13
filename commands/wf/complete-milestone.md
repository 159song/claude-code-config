---
name: wf:complete-milestone
description: 完成里程碑 -- 归档所有工件，标记版本，准备下一个里程碑
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
完成当前里程碑：验证就绪状态，归档所有规划工件，创建 Git 标签，
重置项目状态，可选自动启动新里程碑流程。

产出:
- `.planning/milestones/<version>/` -- 完整归档
- 更新后的 `.planning/PROJECT.md` -- 里程碑完成记录
- 重置后的 `.planning/STATE.md` -- 新里程碑初始状态
- Git tag `<version>` -- 版本标签
</objective>

<execution_context>
@$HOME/.claude/wf/workflows/complete-milestone.md
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
按照 @$HOME/.claude/wf/workflows/complete-milestone.md 端到端执行。
</process>
