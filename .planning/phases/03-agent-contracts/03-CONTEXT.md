# Phase 3: Agent Contracts - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

每个 agent 有明确的输入输出合同、完成标记和 context 预算规则，工作流可靠检测 agent 完成并正确交接。

Requirements: AGENT-01, AGENT-02, AGENT-03, AGENT-04

</domain>

<decisions>
## Implementation Decisions

### 完成标记格式
- **D-01:** 所有 5 个 agent 在完成时返回结构化 JSON 完成标记，格式为 `{ status: 'complete'|'partial'|'failed', artifacts: [...], summary: '...' }`
- **D-02:** 字段采用最小集设计：status（状态）、artifacts（产出文件路径数组）、summary（简短文本摘要）。不需要 tasks_done/tasks_total 等详细字段
- **D-03:** 工作流 orchestrator 解析 JSON 中的 status 字段来判断 agent 成功/失败/部分完成，据此自动路由

### Context 预算感知
- **D-04:** Executor agent 在每个任务间隙读取 statusline hook 已有的 `/tmp/claude-ctx-{session_id}.json` 指标文件，检测 context 使用率
- **D-05:** 达到 70% context 使用时，executor 立即保存进度：生成 partial SUMMARY.md（已完成任务标记 done，未完成标记 pending）+ 在完成标记 JSON 中返回 `status: 'partial'`
- **D-06:** 恢复机制：下次启动 executor 时读取 partial SUMMARY.md，从未完成任务继续执行

### 交接合同设计
- **D-07:** 在每个 agent 的 .md 文件中增加 `<input_contract>` 和 `<output_contract>` 结构化区块，定义必需/可选字段
- **D-08:** 工作流在构造 agent prompt 时按合同填充字段，确保 agent 收到完整的结构化输入
- **D-09:** Agent 失败时（返回 status:'failed'），orchestrator 自动重试一次（带上错误信息），再次失败则记录错误并报告给用户，不无限重试

### 原生 API 字段使用
- **D-10:** 仅 executor agent 使用 `isolation: "worktree"`（已有行为保持不变），其他 agent 只读文件或写 .planning/ 目录，不需要隔离
- **D-11:** Model 字段通过 config.json 配置驱动，为每个 agent 类型定义默认模型（如 executor: 'sonnet', researcher: 'haiku'），工作流在调用时从配置读取
- **D-12:** Agent 指令 frontmatter 中增加 model 配置键名（不硬编码模型名），运行时从 config.json 解析实际值

### Claude's Discretion
- 完成标记 JSON 中是否需要额外的 metadata 字段（如 duration, context_used）
- 每个 agent 的具体 input_contract/output_contract 字段定义
- config.json 中 agent model 配置的具体 key 命名和默认值
- agent-contracts.md 参考文档的具体组织结构（需求 AGENT-04 要求此文档存在）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Agent 文件（需增加合同区块）
- `agents/wf-executor.md` -- 执行器 agent，需增加 input/output contract 和 context 预算逻辑
- `agents/wf-planner.md` -- 计划器 agent，需增加 input/output contract
- `agents/wf-verifier.md` -- 验证器 agent，需增加 input/output contract
- `agents/wf-researcher.md` -- 研究员 agent，需增加 input/output contract
- `agents/wf-roadmapper.md` -- 路线图 agent，需增加 input/output contract

### 工作流文件（需更新 agent 调用方式）
- `wf/workflows/execute-phase.md` -- Executor 调用点，需按合同格式化 prompt 并解析完成标记
- `wf/workflows/plan-phase.md` -- Planner/Researcher 调用点
- `wf/workflows/new-project.md` -- Researcher/Roadmapper 调用点
- `wf/workflows/quick.md` -- Researcher/Executor 调用点
- `wf/workflows/discuss-phase.md` -- Researcher 调用点

### Context 监控基础设施
- `hooks/wf-context-monitor.js` -- 现有 context 警告 hook，executor 需复用其指标文件路径
- `hooks/wf-statusline.js` -- 写入 `/tmp/claude-ctx-{session_id}.json` 的 statusline hook

### 配置文件
- `wf/templates/config.json` -- 需增加 agent model 配置项
- `.planning/config.json` -- 项目级配置

### 参考文档（需新建）
- `wf/references/agent-contracts.md` -- 需求 AGENT-04 要求的统一合同参考文档

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hooks/wf-statusline.js` -- 已将 context 指标写入 /tmp/claude-ctx-{session_id}.json，executor 可直接读取
- `hooks/wf-context-monitor.js` -- 已有 WARNING_THRESHOLD=35% 和 CRITICAL_THRESHOLD=25% 的检测逻辑，可参考实现 70% 阈值
- `wf/bin/lib/config.cjs` -- 已有 loadConfig 函数和 CONFIG_DEFAULTS，agent model 配置可直接扩展
- `wf/bin/wf-tools.cjs` -- 纯路由器，新的 agent 相关 CLI 命令可挂载到此

### Established Patterns
- Agent 通过 `Agent({ subagent_type: "wf-xxx", prompt: "...", isolation: "worktree" })` 调用
- 工作流使用 Skill() 调用其他命令（Phase 2 建立的 CLI 体系）
- CommonJS modules with module.exports, Node.js standard library only
- 配置通过 config.json 管理，CLI 通过 `config-get`/`config-set` 读写

### Integration Points
- 5 个 agent .md 文件需要增加 contract 区块
- 6 个工作流 .md 文件需要更新 Agent() 调用的 prompt 构造和返回值解析
- config.json 需要增加 agents.models 配置节
- 可能需要在 wf-tools.cjs 中增加 agent-related 子命令（如读取 agent 配置）

</code_context>

<specifics>
## Specific Ideas

- 完成标记 JSON 格式对齐 Phase 1/2 建立的 JSON 输出模式（通过 stdout 输出结构化数据）
- Context 预算检测复用现有 statusline hook 的指标文件，不引入新的基础设施
- Agent .md 内嵌合同的方式与 GSD 的 agent 指令风格保持一致

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 03-agent-contracts*
*Context gathered: 2026-04-10*
