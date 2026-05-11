---
description: Review source code changes in a WF phase for bugs, security, quality, and performance issues. Auto-iterates up to 3 rounds with fix-executor. Use when the user asks to review code changes, check a phase for bugs, audit security of new changes, or validate code quality before shipping.
argument-hint: "<phase> [--depth quick|standard|deep] [--files file1,file2]"
context: fork
agent: general-purpose
allowed-tools: Read Write Edit Bash Glob Grep Task Agent
---

# /wf-code-review

@$HOME/.claude/wf/workflows/code-review.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/agent-contracts.md

$ARGUMENTS

在 forked subagent context 中执行代码审查，避免污染主 session。

按 workflow 端到端执行：
1. 计算审查范围（三级回退：--files → SUMMARY.md key_files → git diff）
2. 委托 wf-reviewer agent 按 4 维度审查（Bugs / Security / Quality / Performance）
3. 产出 REVIEW.md，含结构化 findings + CR-P{N}-NN 稳定 ID
4. 若有 findings 且 `code_review_auto_fix: true`：委托 wf-executor 自动修复
5. 修复后重新审查，最多 3 轮迭代

## Don't use when

- 没有代码改动（git diff 为空且无 --files 指定）
- 用户只想看某个 phase 已有的 REVIEW.md（读文件即可）
- 审查 WF 外部代码（此 skill 依赖 WF 的 phase/SUMMARY 结构）
