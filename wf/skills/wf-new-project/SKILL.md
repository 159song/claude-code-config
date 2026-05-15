---
description: Initialize a new WF project — collects context via questions, optionally researches, generates REQUIREMENTS.md and ROADMAP.md. Invoke only when the user explicitly runs /wf-new-project or when the WF dispatcher (wf-do) routes a clear "new project" intent here — never auto-trigger on ambient signals; this rewrites .planning/.
argument-hint: "[--auto]"
allowed-tools: Read Write Bash Task AskUserQuestion
---

# /wf-new-project

@$HOME/.claude/wf/workflows/new-project.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/agent-contracts.md

$ARGUMENTS

按 workflow 端到端执行：收集项目上下文 → 可选 4 路并行研究 → 生成需求 → 生成路线图 → 初始化状态 → 提交到 git → 路由下一步。

完成后产出：
- `.planning/PROJECT.md` / `REQUIREMENTS.md` / `ROADMAP.md` / `STATE.md` / `config.json`
- 若 `spec.enabled=true`：`.planning/specs/<capability>/spec.md` 骨架

保留所有工作流门禁（验证、审批、提交、路由）。
