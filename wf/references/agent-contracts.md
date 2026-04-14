# Agent Contracts Reference

> 定义 WF 系统中所有 5 个 agent 类型的输入/输出合同、完成标记格式和交互规则。工作流在调用 Agent() 前应参考此文档构造 prompt 和解析结果。

## 通用规则

### 完成标记格式

所有 agent 在完成时返回结构化 JSON 完成标记。工作流 orchestrator 解析此 JSON 中的 `status` 字段来判断 agent 成功/失败/部分完成，据此自动路由。

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

**解析规则:** 工作流应从 agent 输出中提取最后一个 JSON 代码块，验证 `status` 是 `"complete"`/`"partial"`/`"failed"` 之一。如果无法解析，默认视为 `"failed"`。artifact 路径必须在 `.planning/` 或项目根目录下。

### 完成标记行为

任务完成后，输出以下 JSON 完成标记作为**最终输出**。输出完成标记后不再执行任何操作。

状态值：
- `"complete"` -- 所有工作成功完成
- `"partial"` -- 部分完成，剩余工作已保存供后续继续（context 预算不足或阻塞问题）
- `"failed"` -- 无法完成，错误详情在 summary 中

### 工作流路由规则

| Status | Action |
|--------|--------|
| `complete` | 继续下一步骤 |
| `partial` | 记录部分状态，通知用户恢复点 |
| `failed` | 带错误信息重试一次，再次失败则停止 |

### 重试规则

- 最多重试 **1 次**
- 重试 prompt 包含原始任务 + 上次失败摘要（从 `summary` 字段提取）
- 第二次失败 = 停止执行，记录错误报告给用户
- **不允许无限重试循环**

### Agent 模型配置

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

工作流在 Agent() 调用时传入从配置读取的 model 参数：

```javascript
Agent({
  subagent_type: "wf-executor",
  model: config.agents.models.executor,  // resolved at runtime
  prompt: "...",
  isolation: "worktree"
})
```

**模型校验:** 工作流在传入 model 值前，应验证其属于允许列表 `["sonnet", "opus", "haiku", "inherit"]`。无效值回退到 `"sonnet"`。

## Agent 合同详情

### wf-executor

**用途:** 按照 PLAN.md 逐个执行任务，每个任务完成后 git commit，最终生成 SUMMARY.md

**Input Contract:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| phase | Yes | number | Phase number being executed |
| plan_path | Yes | filepath | Path to PLAN.md being executed |
| context_md | Yes | filepath | Path to phase CONTEXT.md |
| session_id | Yes | string | Parent session ID for context metrics file |
| resume_from | No | filepath | Path to partial SUMMARY.md for resume |
| config | No | object | Agent configuration from config.json |

**Output Contract:**

| Artifact | Required | Description |
|----------|----------|-------------|
| SUMMARY.md | Yes | Full or partial execution summary in `.planning/phase-{N}/` |
| git commits | Yes | One atomic commit per completed task |

**Special:**
- **Isolation:** 使用 `isolation: "worktree"` 调用（在 Agent() 调用时指定，不在 frontmatter 中）
- **Context 预算感知:** 每个任务间隙读取 `/tmp/claude-ctx-{session_id}.json`，检查 `used_pct` 字段。当 `used_pct >= 70` 时生成 partial SUMMARY.md 并返回 `status: "partial"`
- **恢复机制:** 支持通过 `resume_from` 传入 partial SUMMARY.md，跳过已完成任务继续执行

### wf-planner

**用途:** 为指定阶段生成可执行计划，包含任务分解、wave 分组和依赖分析

**Input Contract:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| phase | Yes | number | Phase number being planned |
| goal | Yes | string | Phase goal from ROADMAP.md |
| context_md | Yes | filepath | Path to phase CONTEXT.md |
| requirements_md | Yes | filepath | Path to REQUIREMENTS.md |
| research_md | No | filepath | Path to RESEARCH.md if exists |
| roadmap_md | No | filepath | Path to ROADMAP.md |
| config | No | object | Agent configuration from config.json |

**Output Contract:**

| Artifact | Required | Description |
|----------|----------|-------------|
| PLAN.md | Yes | Execution plan file(s) in `.planning/phase-{N}/` (one or multiple PLAN-*.md) |

### wf-verifier

**用途:** 使用 4 级验证模型验证阶段目标是否达成，生成 VERIFICATION.md

**Input Contract:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| phase | Yes | number | Phase number being verified |
| goal | Yes | string | Phase goal from ROADMAP.md |
| requirements | Yes | string | Phase requirement IDs from ROADMAP.md |
| plan_paths | Yes | filepath[] | Paths to all PLAN.md files |
| summary_paths | Yes | filepath[] | Paths to all SUMMARY.md files |
| context_md | No | filepath | Path to phase CONTEXT.md |
| config | No | object | Agent configuration from config.json |

**Output Contract:**

| Artifact | Required | Description |
|----------|----------|-------------|
| VERIFICATION.md | Yes | Verification report in `.planning/phase-{N}/` |

### wf-researcher

**用途:** 通用研究 agent，负责技术调研、实现方案研究和领域知识收集

**Input Contract:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| topic | Yes | string | Research topic or question |
| tech_stack | Yes | string | Project technology stack summary |
| project_context | No | string | Brief project description |
| decisions | No | string | Existing decisions that constrain research |
| max_length | No | number | Max report lines, default 500 |

**Output Contract:**

| Artifact | Required | Description |
|----------|----------|-------------|
| Research report | Yes | Markdown research report, written to caller-specified path or returned as text |

### wf-roadmapper

**用途:** 基于项目上下文和需求文档生成阶段路线图

**Input Contract:**

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| project_md | Yes | filepath | Path to PROJECT.md |
| requirements_md | Yes | filepath | Path to REQUIREMENTS.md |
| research_summary | No | filepath | Path to research SUMMARY.md if exists |
| config | No | object | Agent configuration from config.json |

**Output Contract:**

| Artifact | Required | Description |
|----------|----------|-------------|
| ROADMAP.md | Yes | Project roadmap in `.planning/` |

## 工作流调用示例

### 标准调用模式

```javascript
// 从 config.json 读取 agent model
const agentModel = config.agents?.models?.executor || "sonnet";

// 按合同构造 prompt
const result = Agent({
  subagent_type: "wf-executor",
  model: agentModel,
  isolation: "worktree",
  prompt: `
Input:
- phase: 3
- plan_path: .planning/phases/03-agent-contracts/03-01-PLAN.md
- context_md: .planning/phases/03-agent-contracts/03-CONTEXT.md
- session_id: ${sessionId}

Execute all tasks per plan.
`
});

// 解析完成标记（从输出的最后一个 JSON 代码块提取）
// 验证 status 是 "complete"/"partial"/"failed" 之一
// 如果无法解析 -> 视为 "failed"
```

### 失败重试模式

```javascript
// 第一次调用失败后，带上失败信息重试
const retryResult = Agent({
  subagent_type: "wf-executor",
  model: agentModel,
  isolation: "worktree",
  prompt: `
Input:
- phase: 3
- plan_path: .planning/phases/03-agent-contracts/03-01-PLAN.md
- context_md: .planning/phases/03-agent-contracts/03-CONTEXT.md
- session_id: ${sessionId}

Previous attempt failed:
${previousResult.summary}

Retry execution, addressing the failure above.
`
});

// 如果重试也失败 -> 停止，记录错误，报告给用户
```
