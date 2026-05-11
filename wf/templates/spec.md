# {{capability_name}} Specification

## Purpose

{{一句话描述这个 capability 做什么、为什么存在。必须以 SHALL 句式或声明性语言表达系统的目标能力，而不是实现细节。}}

## Requirements

<!--
本节列出该 capability 下的所有需求。每个需求必须：
  1) 有稳定的 header 文本（作为 requirement ID，不要随意改名）
  2) 至少包含一个 Scenario
  3) 用 SHALL / MUST / SHOULD 等 RFC 2119 词汇表述
参考 OpenSpec 的 Requirement/Scenario 模型：
  - specs/<capability>/spec.md 是主干真相
  - changes/<id>/specs/<capability>/spec.md 用 ADDED/MODIFIED/REMOVED/RENAMED Requirements 表达增量
-->

### Requirement: {{requirement_name}}

{{用 SHALL/MUST 句式描述系统必须具备的行为。一到三句话。}}

#### Scenario: {{scenario_name}}

- **WHEN** {{触发条件}}
- **THEN** {{期望结果}}
- **AND** {{附加结果（可选）}}

#### Scenario: {{另一个场景名}}

- **GIVEN** {{前置条件}}
- **WHEN** {{触发条件}}
- **THEN** {{期望结果}}

### Requirement: {{另一个 requirement_name}}

{{描述。}}

#### Scenario: {{scenario_name}}

- **WHEN** {{触发条件}}
- **THEN** {{期望结果}}
