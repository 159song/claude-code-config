---
description: Route natural-language user intent to the correct WF command. Invoke only when the user explicitly runs /wf-do "<description>" — this is a top-level dispatcher and must never auto-trigger off ambient context (it would shadow other skills and risk routing recursion).
argument-hint: "<描述你想做什么>"
allowed-tools: Read Bash AskUserQuestion
---

# /wf-do

@$HOME/.claude/wf/workflows/do.md
@$HOME/.claude/wf/references/ui-brand.md

$ARGUMENTS

按 workflow 端到端执行：解析自然语言输入 → 匹配最合适的 WF skill/command → 转发调用。

## 特别说明

这是**意图路由器**（dispatcher），本身不执行工作，只负责把"帮我..."、"下一步..."、"保存进度"这类自然语言映射到具体 WF 命令。

**触发纪律**：此 skill 是 dispatch 源头，AI 不得自动触发——只有用户显式 `/wf-do "..."` 时才执行；否则会和被路由的目标 skill 形成冲突或递归（wf-do 触发 wf-do）。
