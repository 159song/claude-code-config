# Phase 6: Quality Tools - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

代码审查工作流和里程碑生命周期管理，形成从编写到审查到发布的完整闭环。

Requirements: QUAL-01, QUAL-02

</domain>

<decisions>
## Implementation Decisions

### 代码审查触发与范围 (QUAL-01)
- **D-01:** Code review 集成到 verify-work 工作流中，验证时自动包含代码质量审查。同时保留独立的 `/wf-code-review {phase}` 命令供精确审查使用
- **D-02:** 审查文件范围优先从阶段 SUMMARY.md 的 key_files 提取变更文件列表，git diff 作为回退方案。支持 `--files` 参数手动覆盖
- **D-03:** 审查深度通过 config.json 配置（quick/standard/deep），`--depth` 参数可覆盖。默认 standard

### 审查-修复自动链 (QUAL-01)
- **D-04:** code-review 完成后自动链接到 fix 流程，不需要用户额外操作。审查和修复是一个连贯流程
- **D-05:** 所有发现的问题全部自动修复，不区分严重级别。修复失败的问题在报告中标记
- **D-06:** 审查-修复迭代最多 3 轮（review → fix → re-review），3 轮后仍有问题则报告剩余问题并停止

### 里程碑生命周期 (QUAL-02)
- **D-07:** complete-milestone 执行完整归档：ROADMAP.md + REQUIREMENTS.md + 所有阶段 artifacts 复制到 `.planning/milestones/vX.Y/` 目录，保留完整历史
- **D-08:** 新里程碑启动时阶段编号默认重置为 1（Phase 1 开始），每个里程碑独立编号
- **D-09:** complete-milestone 归档完成后自动启动 new-milestone 流程，无需用户手动触发
- **D-10:** new-milestone 复用现有 researcher + roadmapper agent 流程（与 new-project 相同：收集目标 → 研究 → 需求 → 路线图）

### Agent 设计
- **D-11:** 新建 `wf-reviewer.md` 专用代码审查 agent，遵循 Phase 3 建立的 agent 合同规范（input_contract/output_contract/JSON 完成标记/config 驱动模型）
- **D-12:** wf-reviewer 执行全面审查：bugs、安全漏洞、代码质量、性能问题，通过 `--depth` 控制深度
- **D-13:** 修复逻辑复用 wf-executor agent（已有 isolation/worktree 能力），不新建 fixer agent。审查工作流构造修复任务列表后委托 executor 执行

### Claude's Discretion
- REVIEW.md 的具体输出格式和严重级别定义
- verify-work 中代码审查步骤的具体插入位置和条件判断
- complete-milestone 归档时的目录组织结构细节
- new-milestone 与 complete-milestone 之间的状态传递方式
- wf-reviewer agent 的具体 prompt 设计和检查项列表

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### GSD 参考实现（模式参考，不照搬）
- `~/.claude/get-shit-done/workflows/code-review.md` — GSD 代码审查工作流，file scope 逻辑和 config gate 可参考
- `~/.claude/get-shit-done/workflows/code-review-fix.md` — GSD 审查修复工作流，迭代循环和 agent 调用模式可参考
- `~/.claude/get-shit-done/workflows/complete-milestone.md` — GSD 里程碑完成工作流，归档策略和 PROJECT.md 演进逻辑可参考
- `~/.claude/get-shit-done/workflows/new-milestone.md` — GSD 新里程碑工作流，上下文加载和 agent 复用模式可参考

### WF 现有基础设施（需扩展或集成）
- `wf/workflows/verify-work.md` — 需集成 code-review 步骤
- `wf/workflows/execute-phase.md` — executor agent 调用模式参考，修复复用此流程
- `wf/bin/wf-tools.cjs` — CLI 路由器，需挂载新子命令
- `wf/bin/lib/config.cjs` — 配置模块，需增加审查深度等配置项
- `wf/bin/lib/roadmap.cjs` — ROADMAP 操作模块，里程碑归档可能需要扩展

### Agent 合同参考
- `wf/references/agent-contracts.md` — Phase 3 建立的 agent 合同规范，wf-reviewer 必须遵循
- `agents/wf-executor.md` — 修复复用此 agent，需了解其 input/output contract
- `agents/wf-verifier.md` — 验证 agent 参考，code-review 与验证的职责边界

### 配置和模板
- `wf/templates/config.json` — 需增加 code_review 相关配置项
- `.planning/config.json` — 项目级配置

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `wf/workflows/verify-work.md` — 验证工作流，code-review 集成到此处
- `wf/workflows/execute-phase.md` — executor 调用模式和 worktree 隔离，修复直接复用
- `wf/bin/lib/config.cjs` — 配置管理，loadConfig/CONFIG_DEFAULTS 可扩展
- `wf/references/agent-contracts.md` — agent 合同模板，wf-reviewer 照此格式
- `agents/wf-researcher.md` + `agents/wf-roadmapper.md` — new-milestone 直接复用这两个 agent

### Established Patterns
- Skill() 链式调用避免深层 Task 嵌套（Phase 4/5 建立）
- CLI router + lib/ 模块架构（Phase 1 建立）
- 所有状态变更通过 CLI 命令（Phase 2 建立）
- Agent 完成标记 JSON + config.json 驱动模型选择（Phase 3 建立）
- SUMMARY.md key_files 跟踪阶段产出文件（execute-phase 建立）

### Integration Points
- `verify-work.md` 需增加 code-review 步骤（在 UAT 之前或之后）
- `wf-tools.cjs` 需增加 `code-review` 和 `milestone` 子命令
- `settings.json` 可能需要新命令的 hook 绑定
- `commands/wf/` 需增加 code-review.md、complete-milestone.md、new-milestone.md 命令文件
- `wf/workflows/` 需增加对应工作流文件
- `agents/` 需增加 wf-reviewer.md

</code_context>

<specifics>
## Specific Ideas

- code-review 的 verify-work 集成应作为可选步骤（config gate 控制），不强制所有验证都包含代码审查
- 审查-修复自动链对齐 Phase 5 的 Skill() 链式执行模式，review → fix 通过 Skill() 调用而非 Task 嵌套
- complete-milestone 归档后清理 ROADMAP.md（只保留一行里程碑摘要），保持 ROADMAP 恒定大小
- new-milestone 流程中复用 researcher agent 时，传入上一个里程碑的 PROJECT.md 作为上下文

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-quality-tools*
*Context gathered: 2026-04-13*
