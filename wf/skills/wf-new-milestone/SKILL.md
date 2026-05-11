---
description: Initialize a new WF milestone after a previous one is archived - collects goals, optional research, generates new REQUIREMENTS.md and ROADMAP.md. Only invoke explicitly via /wf-new-milestone; this creates a fresh milestone scope and must not auto-trigger.
disable-model-invocation: true
argument-hint: "[version]"
allowed-tools: Read Write Edit Bash Glob Grep Task Agent AskUserQuestion
---

# /wf-new-milestone

@$HOME/.claude/wf/workflows/new-milestone.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/agent-contracts.md

$ARGUMENTS

按 workflow 端到端执行：收集里程碑目标 → 研究（可选）→ 生成新需求 → 生成新路线图 → 更新 STATE.md → 提交到 git。

产出：
- `.planning/REQUIREMENTS.md`（新版本）
- `.planning/ROADMAP.md`（新版本）
- `.planning/STATE.md`（重置为新里程碑初始状态）

复用 wf-researcher / wf-roadmapper sub-agent。保留 specs/ 和活跃 changes/（规格跨里程碑存活，Phase C 规则）。

## 前置条件

应在 `/wf-complete-milestone` 后或首个里程碑完成归档后运行。若当前仍有未归档的 phase，skill 会提示用户先完成归档。
