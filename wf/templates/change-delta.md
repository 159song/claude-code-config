# {{capability}} Specification Delta

<!--
这是一个 change 对主干 specs/<capability>/spec.md 的增量。
允许使用以下四个二级标题之一，可组合出现：

  ## ADDED Requirements      — 新增 requirement（archive 时追加到主 spec）
  ## MODIFIED Requirements   — 替换已存在的 requirement（按 header 匹配，整块替换）
  ## REMOVED Requirements    — 删除已存在的 requirement（按 header 匹配）
  ## RENAMED Requirements    — 为已存在的 requirement 改名，可同时替换内容

每个 requirement 遵循与主干 spec.md 相同的结构：
  ### Requirement: <name>
  {{body 用 SHALL/MUST 描述}}
  #### Scenario: <name>
  - **WHEN** ...
  - **THEN** ...
-->

## ADDED Requirements

### Requirement: {{new_requirement_name}}

{{描述。}}

#### Scenario: {{scenario_name}}

- **WHEN** {{触发条件}}
- **THEN** {{期望结果}}

## MODIFIED Requirements

### Requirement: {{existing_requirement_name}}

{{替换后的完整描述。包含重写的 scenarios。}}

#### Scenario: {{scenario_name}}

- **WHEN** {{触发条件}}
- **THEN** {{期望结果}}

## REMOVED Requirements

### Requirement: {{deprecated_requirement_name}}

{{可选：简短说明为什么移除，便于归档后回溯。}}

## RENAMED Requirements

### Requirement: {{new_requirement_name}}

- From: {{old_requirement_name}}

{{可选：若同时修改内容，写在 From 行之后；否则保留原样内容。}}

<!--
Phase D-2：如果 master requirement 已声明稳定 id，RENAMED 可以用
`- From: @id:<stable-id>` 绕开 header 文本匹配，适合连续改名的场景。
例：
  ### Requirement: User Authentication
  - From: @id:AUTH-LOGIN
-->

