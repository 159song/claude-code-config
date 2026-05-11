---
name: wf:apply-change
description: 基于 changes/<id>/tasks.md 让 wf-executor 实现代码（change 的"执行"阶段）
argument-hint: "<change-id>"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Task
---
<objective>
把一个已 validate 通过的 change proposal 转化为代码变更。
复用 wf-executor：把 tasks.md 的 checkbox 任务按顺序实现，逐任务 commit。
</objective>

<execution_context>
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/agent-contracts.md
@$HOME/.claude/wf/references/git-conventions.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
1. 先 `wf-tools change validate <id>`，失败则中止并引导用户修 delta
2. 读 `.planning/changes/<id>/tasks.md`，把每个 `- [ ]` 条目转成 executor 的任务对象
3. 调用 Agent(subagent_type: "wf-executor") 顺序执行（也可 wave 分组，如果 tasks.md 按主题分节）
   - **必须在 prompt 中显式声明 `change_id: <id>` 和 `task_source: change`**，
     以便 executor 使用正确的 commit scope：`feat(change-<id>): ...`
   - 分支建议：大变更在 `feature/change-<id>` 独立分支；小变更在当前分支即可
4. executor 每完成一个任务就把 `- [ ]` 改为 `- [x]` 并 commit
5. 全部完成后提示下一步：`/wf-archive-change <id>` 或手工 review
</process>
