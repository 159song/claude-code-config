---
name: wf:execute-phase
description: 执行指定阶段的所有计划，支持 wave 级并行
argument-hint: "<phase-number> [--wave N] [--interactive] [--chain]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
使用 wave 级并行执行阶段的所有计划。

orchestrator 保持轻量：发现计划 → 分析依赖 → 分波 → 派发 agent → 收集结果。
每个 sub-agent 独立加载完整执行上下文。

产出:
- `.planning/phase-{N}/SUMMARY-*.md` — 执行摘要
- `.planning/phase-{N}/VERIFICATION.md` — 验证结果
</objective>

<execution_context>
@$HOME/.claude/wf/workflows/execute-phase.md
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<context>
阶段: $ARGUMENTS

可用 flag（仅在 $ARGUMENTS 中出现时激活）：
- `--wave N` — 只执行指定 wave
- `--interactive` — 逐任务内联执行
- `--chain` — 完成后自动验证
</context>

<process>
按照 @$HOME/.claude/wf/workflows/execute-phase.md 端到端执行。
保留所有工作流门禁（wave 执行、检查点、验证、状态更新）。
</process>
