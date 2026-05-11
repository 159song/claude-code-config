---
description: Handle a quick task outside the phase pipeline - bug fix, small feature, config tweak, doc update. Use when the user asks for a quick fix, one-off change, or explicitly says "just", "simply", "小改动", "帮我改一下".
argument-hint: "<task description> [--full] [--validate] [--discuss] [--research] [--spec]"
allowed-tools: Read Write Edit Glob Grep Bash Task AskUserQuestion
---

# /wf-quick

@$HOME/.claude/wf/workflows/quick.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/agent-contracts.md

$ARGUMENTS

按 workflow 端到端执行：理解任务 → 可选研究/讨论 → 规划+执行 → 可选验证。

## Flag 速览

- `--full` 完整管道（研究+规划+执行+验证）
- `--validate` 执行后跑验证
- `--discuss` 先讨论实现方案
- `--research` 先做快速技术研究
- `--spec` 走 propose→validate→apply→archive 规格级短链路（需 `spec.enabled=true`）

## Don't use when

- 任务复杂度属于 medium/large 且涉及多文件/多模块 —— 应走正式 phase 流程
- 不可逆操作（如删除数据、发布、迁移） —— 应显式走相应命令
- 用户已在某个 phase 中 —— 应走 phase 执行路径而非 quick
