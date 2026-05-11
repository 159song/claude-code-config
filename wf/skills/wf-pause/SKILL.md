---
description: Pause current WF workflow and save a checkpoint to HANDOFF.json + .continue-here.md for cross-session recovery. Only invoke explicitly via /wf-pause; AI must never decide on its own to pause user's in-flight work.
disable-model-invocation: true
allowed-tools: Read Bash Glob
---

# /wf-pause

@$HOME/.claude/wf/workflows/session.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/continuation-format.md

按 workflow 端到端执行：读取当前 STATE → 生成 HANDOFF.json（7 字段最小集）+ `.continue-here.md` 人类可读续接提示 → 展示恢复指令。

## 特别说明

会话生命周期操作必须由用户显式发起。`disable-model-invocation: true` 防止 AI "觉得任务差不多了"就主动 pause 用户的工作。
