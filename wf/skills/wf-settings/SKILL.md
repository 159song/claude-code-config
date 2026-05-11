---
description: View or modify WF workflow configuration (.planning/config.json). Only invoke explicitly via /wf-settings [set key value]; configuration changes are sensitive operations that must not auto-trigger.
disable-model-invocation: true
argument-hint: "[set key value]"
allowed-tools: Read Bash AskUserQuestion
---

# /wf-settings

@$HOME/.claude/wf/workflows/settings.md
@$HOME/.claude/wf/references/ui-brand.md
@$HOME/.claude/wf/references/config-precedence.md

$ARGUMENTS

按 workflow 端到端执行：
- 无参数 → 显示交互式配置菜单
- `set <key> <value>` → 通过 `wf-tools settings set` CLI 修改对应字段

## 特别说明

配置项影响所有后续工作流行为（门禁开关、并行度、安全策略等），AI 不应"顺手"修改。`disable-model-invocation: true` 强制用户显式发起。

复杂或默认合理的字段（auto 模式、门禁策略）修改前应先向用户确认。
