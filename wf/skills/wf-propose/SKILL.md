---
description: Propose a WF change (new requirement, modification, removal, or rename of existing spec). Use when user says "I want to add/change/remove X", "propose a change for Y", or when discussing a behavior change to an already-specified capability. Requires config.spec.enabled=true.
argument-hint: "<idea> | <change-id> \"<idea>\""
allowed-tools: Read Write Edit Glob Grep Bash Task AskUserQuestion
---

# /wf-propose

@$HOME/.claude/wf/workflows/propose.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/agent-contracts.md

$ARGUMENTS

按 workflow 端到端执行：解析 idea → 读 specs 快照 → 委托 wf-proposer → 自动 validate → 展示下一步。

## Don't use when

- `config.spec.enabled=false`（需先 `/wf-settings set spec.enabled true`）
- 用户在做**实现**（代码层面），而非**规格**（行为契约）层面的改动 —— 应走 /wf-quick
- 已有 `changes/<同名 id>/` 存在 —— 提示用户换名或继续现有 change
