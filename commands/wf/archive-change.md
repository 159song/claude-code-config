---
name: wf:archive-change
description: 把 change 的 delta 合并进主干 specs/ 并移动到 archive/YYYY-MM-DD-<id>/
argument-hint: "<change-id> [--dry-run]"
allowed-tools:
  - Read
  - Bash
---
<objective>
完成 change 生命周期的最后一步：delta 合并 + 归档。
合并算法：ADDED 追加、MODIFIED 整块替换、REMOVED 删除、RENAMED 改名（可选替换 body）。
fail-fast：目标不存在 / ADDED 重名 / RENAMED 冲突时拒绝归档，不动主 spec。
</objective>

<execution_context>
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
1. 强烈建议先 `wf-tools change archive <id> --dry-run` 预览合并结果
2. 用户确认后 `wf-tools change archive <id>`
3. 输出展示：合并进了哪些 capability、新建了哪些 capability、archive 目录路径
4. 若返回 `ok: false`：列出 issues，引导修 delta 后重试
</process>
