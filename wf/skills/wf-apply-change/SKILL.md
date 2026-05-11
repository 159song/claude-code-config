---
description: Implement a validated WF change proposal by having wf-executor process tasks.md into code changes with atomic commits. Use when user asks to "apply change X", "implement proposal Y", "start coding the change", or after /wf-propose validates successfully.
argument-hint: "<change-id>"
allowed-tools: Read Write Edit Bash Glob Grep Task
---

# /wf-apply-change

@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/agent-contracts.md
@$HOME/.claude/wf/references/git-conventions.md

$ARGUMENTS

把一个已 validate 通过的 change proposal 转化为代码变更。复用 wf-executor：tasks.md 的 checkbox 任务按顺序实现，逐任务 commit。

## 流程

1. 先 `wf-tools change validate <id>`，失败则中止并引导用户修 delta
2. 读 `.planning/changes/<id>/tasks.md`，把每个 `- [ ]` 条目转成 executor 的任务对象
3. 调用 `Agent(subagent_type: "wf-executor")` 顺序执行（也可 wave 分组，如果 tasks.md 按主题分节）
   - **必须在 prompt 中显式声明 `change_id: <id>` 和 `task_source: change`**，
     以便 executor 使用正确的 commit scope：`feat(change-<id>): ...`
   - 分支建议：大变更在 `feature/change-<id>` 独立分支；小变更在当前分支即可
4. executor 每完成一个任务就把 `- [ ]` 改为 `- [x]` 并 commit
5. 全部完成后提示下一步：`/wf-archive-change <id>` 或手工 review

## Don't use when

- change 尚未 validate 通过（先走 `/wf-validate-spec <id>` 或 `/wf-propose`）
- `.planning/changes/<id>/` 不存在
- 用户在问的是"如何应用一个已归档的 change"（已归档 change 不可重新 apply）
