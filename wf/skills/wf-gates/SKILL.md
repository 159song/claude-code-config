---
description: WF quality gate thresholds for plan/verification/security/code-review decisions. Claude references these when evaluating requirement coverage ≥90%, plan quality criteria, verification failure handling, security threat mitigation, or deciding whether a phase can be marked complete.
user-invocable: false
---

# WF Quality Gates (Skill)

> 后台知识 skill：用户不直接调用，Claude 在做 plan/verify/security 决策时自动参考。

## 硬门禁速览

| 门禁 | 触发时机 | 通过条件 | 失败处理 |
|---|---|---|---|
| 需求覆盖 | plan-phase 完成 | 覆盖率 ≥ 90% | 返回 plan-phase 修订 |
| 计划质量 | plan-phase 产出 | 字段完整 + 无循环依赖 + wave 合理 | 最多 3 次修订 |
| 验证 | execute-phase 完成 | 无 FAIL | 生成 gap closure |
| 安全 | plan-phase（`security_enforcement: true`） | 高危威胁均有缓解 | 补充任务 |
| 代码审查 | verify-work（`code_review: true`） | 所有 findings 修复或达 max_iterations | 展示剩余问题 |

## 软门禁速览

| 门禁 | 触发 | 行为 |
|---|---|---|
| Context 预算 | 任意工具调用后 | `remaining > 30%` 注入警告 |
| 工作流追踪 | 编辑非 `.planning/` 时 | 建议 `/wf-quick` |
| Schema 漂移 | execute-phase 完成 | 提醒 DB/API 未提交变更 |

## 配置开关（`.planning/config.json`）

- `gates.confirm_project` / `confirm_phases` / `confirm_roadmap` / `confirm_plan` / `confirm_transition`
- `workflow.plan_check` / `security_enforcement` / `code_review` / `auto_compact`

## 权威参考

完整阈值表和失败处理路径见 `$HOME/.claude/wf/references/gates.md`：

@$HOME/.claude/wf/references/gates.md
