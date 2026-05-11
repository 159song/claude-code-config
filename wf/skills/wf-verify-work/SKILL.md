---
description: Run conversational UAT verification on completed WF work. Use when user asks to verify implementation, confirm a phase is truly done end-to-end, run acceptance tests, or check if functionality works as expected. Often triggered after execute-phase completes.
argument-hint: "[--smoke]"
allowed-tools: Read Write Edit Glob Grep Bash Task AskUserQuestion
---

# /wf-verify-work

@$HOME/.claude/wf/workflows/verify-work.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/agent-contracts.md

$ARGUMENTS

按 workflow 端到端执行：对话式 UAT → 自动识别差距 → 可选修复 → 必要时代码审查。

## Don't use when

- 用户尚未完成 phase 执行（应先 `/wf-execute-phase`）
- 用户问的是**单元测试**写法或运行（归 test runner / code quality）
- 用户只想看已有 VERIFICATION.md 内容（读文件即可，不用跑整个 verify-work）
