---
description: Merge a completed WF change's delta into master specs/ and move the change folder to archive/YYYY-MM-DD-<id>/. Only invoke explicitly via /wf-archive-change; this is an irreversible merge + archive operation that must not auto-trigger.
disable-model-invocation: true
argument-hint: "<change-id> [--dry-run]"
allowed-tools: Read Bash
---

# /wf-archive-change

@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/git-conventions.md

$ARGUMENTS

完成 change 生命周期的最后一步：delta 合并进主干 specs/ + 移动到 archive/。

## 合并算法（`wf-tools change archive` 内部）

- **ADDED** → 追加到主 spec 的 `## Requirements` 段末
- **MODIFIED** → 按 header/id 匹配，整块替换
- **REMOVED** → 按 header/id 匹配，删除
- **RENAMED** → 改 header，body 可选；支持 `- From: @id:<id>` 稳定 ID 模式
- **fail-fast**：目标不存在 / ADDED 重名 / RENAMED 冲突 → 拒绝归档，不动主 spec

## 流程

1. **强烈建议先** `wf-tools change archive <id> --dry-run` 预览合并结果
2. 用户确认后 `wf-tools change archive <id>`
3. 输出展示：合并进了哪些 capability、新建了哪些 capability、archive 目录路径
4. 若返回 `ok: false`：列出 issues，引导修 delta 后重试

## 后续

Archive 完成后建议用 `chore(spec): archive change <id>` 提交变更（见 wf-git-conventions skill）。
