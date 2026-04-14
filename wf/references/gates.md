# 质量门禁

## 概述

质量门禁是工作流中的强制检查点，确保每个阶段的输出质量达标后才能推进到下一步。
门禁分为 **硬门禁**（必须通过）和 **软门禁**（建议性警告）。

## 硬门禁

### 1. 需求覆盖门禁 (Requirements Coverage Gate)

**触发时机:** plan-phase 完成时
**检查内容:** PLAN.md 中的任务是否覆盖 REQUIREMENTS.md 中的所有需求
**通过条件:** 覆盖率 >= 90%
**失败操作:** 返回 plan-phase 修订计划

### 2. 计划质量门禁 (Plan Quality Gate)

**触发时机:** plan-phase 生成计划后
**检查内容:**
- 每个任务有明确的 `files`、`action`、`verify` 字段
- 任务之间无循环依赖
- wave 分组合理（无跨 wave 依赖）
**通过条件:** 所有检查通过
**失败操作:** 最多 3 次修订循环

### 3. 验证门禁 (Verification Gate)

**触发时机:** execute-phase 完成后
**检查内容:** 4 级验证（exists → substantive → wired → data-flowing）
**通过条件:** 无 FAIL 级别结果
**失败操作:** 生成 gap closure 计划

### 4. 安全门禁 (Security Gate)

**触发时机:** plan-phase（当 `security_enforcement: true`）
**检查内容:** 威胁模型是否覆盖 OWASP Top 10 相关风险
**通过条件:** 高危威胁均有缓解措施
**失败操作:** 补充安全任务到计划中

## 软门禁

### 1. 上下文预算门禁 (Context Budget Gate)

**触发时机:** 任意工具调用后（通过 hook 触发）
**检查内容:** context window 剩余比例
**阈值:**
- WARNING: 剩余 <= 30%
- CRITICAL: 剩余 <= 15%
**操作:** 注入警告信息，建议保存状态

### 2. 工作流追踪门禁 (Workflow Tracking Gate)

**触发时机:** 直接编辑非 `.planning/` 文件时
**检查内容:** 是否在 WF 工作流上下文中
**操作:** 建议使用 `/wf-quick` 或 `/wf-fast`

### 3. Schema 变更门禁 (Schema Drift Gate)

**触发时机:** execute-phase 完成后
**检查内容:** 是否有数据库 schema 或 API 变更未同步
**操作:** 提醒执行迁移或更新文档

## 门禁配置

在 `config.json` 中可以调整门禁行为：

```json
{
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_plan": false,
    "confirm_transition": false
  }
}
```

`false` 表示自动通过（auto 模式默认值），`true` 表示需要用户确认。
