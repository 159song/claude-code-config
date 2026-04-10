# Phase 3: Agent Contracts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 03-agent-contracts
**Areas discussed:** 完成标记格式, Context 预算策略, 交接合同设计, 原生 API 字段使用

---

## 完成标记格式

| Option | Description | Selected |
|--------|-------------|----------|
| 结构化 JSON 返回 | Agent 最后返回固定格式 JSON：{ status, artifacts, summary }。工作流可解析并自动路由。 | ✓ |
| Markdown 标记 + 文件存在 | 保持现状，在文件开头加 frontmatter 标记 status/tasks_done。 | |
| CLI 命令报告 | Agent 完成后调用 wf-tools.cjs agent-complete --status ... 记录状态。 | |

**User's choice:** 结构化 JSON 返回
**Notes:** 无额外说明

| Option | Description | Selected |
|--------|-------------|----------|
| 最小集 | status + artifacts + summary。简单高效。 | ✓ |
| 详细集 | status + artifacts + tasks_done/tasks_total + deviations + duration + error_detail。信息更全但实现复杂。 | |
| 你决定 | 让 Claude 根据每个 agent 类型决定字段。 | |

**User's choice:** 最小集
**Notes:** 无额外说明

---

## Context 预算策略

| Option | Description | Selected |
|--------|-------------|----------|
| statusline 指标文件 | 复用 statusline hook 的 /tmp/claude-ctx-{session_id}.json。Agent 在任务间隙读取，70% 时触发保存+停止。 | ✓ |
| 任务计数估算 | 根据计划中任务数量预估 context 预算。简单但不精确。 | |
| Orchestrator 外部监控 | 让 orchestrator 在每个任务后检查 context 指标决定是否终止 agent。 | |

**User's choice:** statusline 指标文件
**Notes:** 无额外说明

| Option | Description | Selected |
|--------|-------------|----------|
| SUMMARY.md + checkpoint | 生成 partial SUMMARY.md（done/pending 标记）+ 返回 status:'partial'。恢复时从 pending 任务继续。 | ✓ |
| 独立 checkpoint 文件 | 写入 CHECKPOINT.json。SUMMARY.md 只在全部完成后生成。 | |
| 你决定 | 让 Claude 根据实现复杂度选择。 | |

**User's choice:** SUMMARY.md + checkpoint
**Notes:** 无额外说明

---

## 交接合同设计

| Option | Description | Selected |
|--------|-------------|----------|
| Agent 文件内嵌合同 | 在 agent .md 中增加 `<input_contract>` 和 `<output_contract>` 区块。所有合同定义集中在 agent 文件里。 | ✓ |
| 独立 agent-contracts.md | 创建统一参考文档，agent 文件保持现状。 | |
| 两者都有 | Agent 文件内嵌合同 + 生成参考文档索引。冗余但最完整。 | |

**User's choice:** Agent 文件内嵌合同
**Notes:** 无额外说明

| Option | Description | Selected |
|--------|-------------|----------|
| 重试一次 + 报告 | Agent 返回 failed 时自动重试一次，再失败则记录并报告用户。 | ✓ |
| 立即报告 | 失败就停止整个 wave，报告用户。最安全但可能因小问题卡住。 | |
| 你决定 | 根据 agent 类型和失败原因分别处理。 | |

**User's choice:** 重试一次 + 报告
**Notes:** 无额外说明

---

## 原生 API 字段使用

| Option | Description | Selected |
|--------|-------------|----------|
| 仅 executor | 只有 executor 修改代码文件，需要 worktree 隔离。其他 agent 只读或写 .planning/。 | ✓ |
| Executor + Verifier | Verifier 也可能运行测试命令，加 worktree 更安全。 | |
| 你决定 | 根据每个 agent 实际行为决定。 | |

**User's choice:** 仅 executor
**Notes:** 无额外说明

| Option | Description | Selected |
|--------|-------------|----------|
| 配置驱动 | config.json 为每个 agent 类型配置默认模型。运行时读取配置值。用户可按需调整。 | ✓ |
| 硬编码在 agent 文件 | frontmatter 中固定 model 字段。简单明确但修改需改文件。 | |
| 继承父会话 | 不指定 model，继承当前会话模型。最简单但无法为不同 agent 优化。 | |

**User's choice:** 配置驱动
**Notes:** 无额外说明

---

## Claude's Discretion

- 完成标记 JSON 中是否需要额外 metadata 字段
- 每个 agent 的具体 input_contract/output_contract 字段定义
- config.json 中 agent model 配置的具体 key 命名和默认值
- agent-contracts.md 参考文档的组织结构

## Deferred Ideas

None — discussion stayed within phase scope
