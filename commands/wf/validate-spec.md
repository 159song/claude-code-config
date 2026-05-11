---
name: wf:validate-spec
description: 校验主干 specs/ 或某个 change 的结构（Purpose/Requirement/Scenario/delta 语法）
argument-hint: "[<change-id>] | [--all]"
allowed-tools:
  - Read
  - Bash
---
<objective>
机器可校验的规格健康检查。对 specs/ 主干跑结构校验，或对某个 changes/<id>/ 跑 delta 合法性 + 与主干的语义一致性检查。
</objective>

<execution_context>
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
1. 若 `$ARGUMENTS` 包含 `--all` 或为空 -> 跑 `wf-tools spec validate --all`
2. 若 `$ARGUMENTS` 是一个 change-id（kebab-case，存在 `.planning/changes/<id>/` 目录）-> 跑 `wf-tools change validate <id>`
3. 否则视为 capability 名，跑 `wf-tools spec validate <cap>`
4. 展示 JSON 中的 issues 列表；有 error 时用 ✗，warn 用 ⚠。
</process>
