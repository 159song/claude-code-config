---
description: Show WF project state and optionally advance to next step. Use when the user asks about project status, progress, current phase, what's done/remaining, "how far along", "下一步", "继续", "接下来做什么", or "现在怎么样". Replaces wf-progress (query-only) and wf-next (auto-advance) — intent is detected from the user's wording.
allowed-tools: Read Bash Glob Agent Task
---

# /wf-status

@$HOME/.claude/wf/workflows/status.md
@$HOME/.claude/wf/references/ui-brand.md

按 workflow 端到端执行：识别意图 → 显示进度 → （可选）自动推进到下一步。

## 模式

| 用户说… | 触发模式 | 行为 |
|---|---|---|
| "进度 / status / 现在怎么样" | **查询** | 只展示进度 + 下一步推荐（不执行） |
| "下一步 / next / 继续 / 接下来" | **推进** | 展示 + 自动调用下一步 Skill() |
| `--auto-advance` | **推进** | 强制推进 |
| `--no-advance` 或无明显意图 | **查询** | 只展示 |

## Don't use when

- 用户在问某个**具体功能**的实现进度（应转到代码搜索或具体 phase 的 SUMMARY）
- 不在 WF 项目中（无 `.planning/` 目录）—— 此时应提示用户先 `/wf-new-project`
- 用户明确想跳过推荐路径（显式 `/wf-xxx`）
