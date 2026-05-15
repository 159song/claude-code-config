---
description: Resume an interrupted WF workflow from HANDOFF.json, routing to the stopped point. Invoke only when the user explicitly runs /wf-resume — never auto-resume just because HANDOFF.json exists; the user may have switched tasks or want a different entry point.
allowed-tools: Read Bash Glob Agent Task
---

# /wf-resume

@$HOME/.claude/wf/workflows/session.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/continuation-format.md
@$HOME/.claude/wf/references/agent-contracts.md

按 workflow 端到端执行：读 HANDOFF.json → 校验 7 字段完整性 → 路由到中断点（discuss/plan/execute/verify）→ 继续执行。

## 特别说明

即使 Claude 在会话中看到 `.planning/HANDOFF.json` 存在，也不应该自动 resume——用户可能已切换任务方向，或想从别的阶段重新开始。这条纪律由 description 文案约束，AI 必须显式等到 `/wf-resume` 才执行。
