---
description: Show WF project progress. Use when the user asks about project status, what's done, what's remaining, current phase progress, percentage complete, or "how far along are we".
allowed-tools: Read Bash Glob
---

# /wf-progress

@$HOME/.claude/wf/workflows/progress.md
@$HOME/.claude/wf/references/ui-brand.md

按 workflow 端到端执行，展示整体进度和下一步建议。

## Don't use when

- 用户在问某个**具体功能**的实现进度（应转到代码搜索或具体 phase 的 SUMMARY）
- 不在 WF 项目中（无 `.planning/` 目录）—— 此时应提示用户先 `/wf-new-project`
