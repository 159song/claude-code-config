---
description: Validate WF spec/change structure - Purpose/Requirement/Scenario syntax, ADDED/MODIFIED/REMOVED/RENAMED delta semantics, stable ID uniqueness. Use when user asks to validate a spec, check if a change is well-formed, audit spec health, or before /wf-archive-change.
argument-hint: "[<capability-or-change-id>] | [--all]"
allowed-tools: Read Bash
---

# /wf-validate-spec

@$HOME/.claude/wf/references/ui-brand.md

$ARGUMENTS

机器可校验的规格健康检查。

## 路由逻辑

1. 若 `$ARGUMENTS` 包含 `--all` 或为空 → `wf-tools spec validate --all`
2. 若 `$ARGUMENTS` 是 change-id（kebab-case，存在 `.planning/changes/<id>/`）→ `wf-tools change validate <id>`
3. 否则视为 capability 名 → `wf-tools spec validate <cap>`

## 输出呈现

展示 JSON 中的 issues 列表：
- `level: error` → `✗` 前缀
- `level: warn` → `⚠` 前缀
- 空 issues → `✓ 通过`

## Don't use when

- 仅想查看 spec 内容（用 `wf-tools spec show <cap>` 而非 validate）
- 代码层面的验证需求（应走 `wf-4-level-verification` skill）
