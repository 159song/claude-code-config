# Agent Contracts Reference

> 定义 WF 系统中所有 agent 类型的合同摘要索引。工作流在调用 Agent() 前应参考此文档了解完成标记格式，各 agent 的详细输入/输出合同见对应 agent 文件。

> 工作流文件中的 Agent() / Skill() 记号是伪代码，描述 Claude 应如何调用 sub-agent，非可执行 JavaScript。

## Agent 摘要

| Agent | 用途 | 详细合同 |
|-------|------|----------|
| wf-executor | 按 PLAN.md 逐个执行任务，每个任务 git commit，生成 SUMMARY.md | `@agents/wf-executor.md` |
| wf-planner | 为指定阶段生成可执行计划（任务分解、wave 分组、依赖分析） | `@agents/wf-planner.md` |
| wf-verifier | 4 级验证模型验证阶段目标是否达成，生成 VERIFICATION.md | `@agents/wf-verifier.md` |
| wf-researcher | 技术调研、实现方案研究和领域知识收集 | `@agents/wf-researcher.md` |
| wf-roadmapper | 基于项目上下文和需求文档生成阶段路线图 | `@agents/wf-roadmapper.md` |
| wf-reviewer | 代码审查和质量检查 | `@agents/wf-reviewer.md` |

## 完成标记格式（Single Source of Truth）

所有 agent 在完成时返回结构化 JSON 完成标记。工作流 orchestrator 解析 `status` 字段来判断成功/失败/部分完成，据此自动路由。

```json
{
  "status": "complete|partial|failed",
  "artifacts": [".planning/phase-{N}/SUMMARY.md"],
  "summary": "Brief description of what was done"
}
```

字段说明：
- `status` -- 三值枚举：`"complete"`（全部完成）、`"partial"`（部分完成，可恢复）、`"failed"`（失败）
- `artifacts` -- 字符串数组，列出产出文件路径（相对于项目根目录）
- `summary` -- 简短文本摘要

**注意:** 不要添加额外字段（如 `duration`、`context_used`、`tasks_done`）。保持最小 3 字段集。

**解析规则:** 工作流应从 agent 输出中提取最后一个 JSON 代码块，验证 `status` 是 `"complete"`/`"partial"`/`"failed"` 之一。如果无法解析，默认视为 `"failed"`。

## Agent 模型配置

Agent frontmatter 使用 `model: inherit`，实际模型从 `config.json` 的 `agents.models` 配置节读取。

```json
{
  "agents": {
    "models": {
      "executor": "sonnet",
      "planner": "sonnet",
      "verifier": "sonnet",
      "researcher": "haiku",
      "roadmapper": "haiku"
    }
  }
}
```

**模型校验:** 工作流在传入 model 值前，应验证其属于允许列表 `["sonnet", "opus", "haiku", "inherit"]`。无效值回退到 `"sonnet"`。
