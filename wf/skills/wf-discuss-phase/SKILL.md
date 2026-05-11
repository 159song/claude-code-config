---
description: Discuss design decisions and gray areas for a specific WF phase, producing CONTEXT.md. Only invoke explicitly via /wf-discuss-phase N; requires phase number and involves interactive decision-making that must not auto-trigger.
disable-model-invocation: true
argument-hint: "<phase-number> [--auto] [--chain] [--batch]"
allowed-tools: Read Write Bash Glob Grep Task AskUserQuestion
---

# /wf-discuss-phase

@$HOME/.claude/wf/workflows/discuss-phase.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/agent-contracts.md

阶段: $ARGUMENTS

按 workflow 端到端执行：识别灰色地带 → 展示选项 → 记录决策 → 产出 CONTEXT.md（含 `## Decisions` 与 `## Discussion Log` 两段，P2 合并后单文件）。

可用 flag：
- `--auto` — 自动模式，AI 自行决策不中断
- `--chain` — 完成后自动调用 `/wf-plan-phase`
- `--batch` — 批量处理模式，减少交互

完成后建议运行 `/wf-plan-phase N`。

保留所有工作流门禁（决策记录、审批、提交）。
