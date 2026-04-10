# Phase 4: Session Management - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

用户可以随时暂停工作、跨会话恢复上下文、并让系统自动推进到下一步，长任务不再被迫一次完成。

Requirements: SESS-01, SESS-02, SESS-03, SESS-04

</domain>

<decisions>
## Implementation Decisions

### Handoff Persistence (SESS-01)
- **D-01:** HANDOFF.json 存储在 `.planning/HANDOFF.json`，与其他状态文件同目录，git tracked 保证跨机器一致
- **D-02:** HANDOFF.json 采用最小集字段：`{ phase, plan, step, stopped_at, resume_command, git_branch, timestamp }` — 足够恢复，不膨胀
- **D-03:** .continue-here.md 放在项目根目录，内容为人类可读摘要 + 复制粘贴的 `/wf-resume` 命令，便于发现（与 GSD 位置一致）
- **D-04:** /wf-pause 仅保存阶段级检查点（phase + plan progress），不保存 agent 内部状态 — Phase 3 的 partial SUMMARY 已处理 agent 中断场景

### Resume & Smart Routing (SESS-02)
- **D-05:** /wf-resume 通过解析 HANDOFF.json 的 `step` 字段（discuss/plan/execute/verify）确定恢复点，直接路由到对应 Skill() 调用
- **D-06:** 恢复前检查 HANDOFF.json 的 `git_branch` 与当前分支是否一致，不一致则警告但不阻止（用户可能故意切换分支）
- **D-07:** 恢复时显示摘要后自动执行推荐操作，减少交互步骤
- **D-08:** HANDOFF.json 不设过期时间 — 记录的是状态快照，时间不影响恢复逻辑。但在摘要中显示暂停时间供参考

### Auto-Advance Logic (SESS-03)
- **D-09:** /wf-next 检测完整的阶段生命周期链：无 context → discuss, 无 plan → plan, 无 summary → execute, 无 verification → verify
- **D-10:** /wf-next 是薄包装：检测状态后调用对应 Skill()（discuss-phase / plan-phase / execute-phase / verify-work），复用现有工作流
- **D-11:** 多个未完成阶段时选择编号最小的未完成阶段，与 roadmap 顺序执行模型一致
- **D-12:** 不支持 flag 覆盖检测 — /wf-next 的核心价值是"自动检测"，用户明确知道目标时直接调用具体命令

### Session Hook Output (SESS-04)
- **D-13:** session-state hook 输出结构化 JSON 字段：`{ milestone, phase, step, status, progress_pct, has_handoff, resume_hint }`
- **D-14:** 从 bash 重写为 Node.js（`wf-session-state.js`），与其他 3 个 hook 保持一致，可复用 lib/ 模块
- **D-15:** JSON 同时输出到 stdout（Claude 会话注入）+ 写入临时文件（供其他 hook 和 /wf-resume 消费），与 statusline hook 的双输出模式一致
- **D-16:** 保留人类可读的中文摘要作为 stdout 输出的一部分，JSON 附加在底部，向后兼容现有会话体验

### Claude's Discretion
- HANDOFF.json 中是否需要额外的 metadata 字段（如 context_used, active_plans 列表）
- /wf-resume 显示摘要的具体格式和措辞
- /wf-next 检测逻辑的具体实现（直接读文件 vs 调用 init phase-op）
- session-state hook 临时文件的命名格式和清理策略

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 现有会话基础设施
- `hooks/wf-session-state.sh` -- 当前 bash 版 SessionStart hook，需重写为 Node.js
- `hooks/wf-statusline.js` -- StatusLine hook，双输出模式（stdout + /tmp/ 文件）的参考实现
- `hooks/wf-context-monitor.js` -- PostToolUse hook，读取 statusline 临时文件的消费者模式参考

### CLI 模块（需扩展）
- `wf/bin/lib/state.cjs` -- STATE.md 读写模块，/wf-pause 和 /wf-resume 的状态持久化基础
- `wf/bin/lib/init.cjs` -- 复合初始化模块，/wf-next 的状态检测基础（initPhaseOp 返回 has_context, has_plans 等）
- `wf/bin/lib/phase.cjs` -- 阶段目录发现模块，findPhaseDir 用于定位阶段产物
- `wf/bin/wf-tools.cjs` -- 路由器，需挂载新的 session 相关子命令

### 命令文件（需新建）
- `commands/wf/pause.md` -- /wf-pause 命令定义（待创建）
- `commands/wf/resume.md` -- /wf-resume 命令定义（待创建）
- `commands/wf/next.md` -- /wf-next 命令定义（待创建）

### 工作流配置
- `settings.json` -- Hook 绑定配置，SessionStart hook 路径需从 .sh 更新为 .js
- `.planning/config.json` -- 项目级配置

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `state.cjs` — parseFrontmatter/stateGet/stateSet/stateJson 函数，可直接用于 HANDOFF.json 生成时读取当前状态
- `init.cjs` — initPhaseOp() 返回 has_context/has_plans/has_verification，完美匹配 /wf-next 的检测需求
- `phase.cjs` — findPhaseDir() 定位阶段目录，用于检查各步骤产物是否存在
- `statusline hook` — 双输出模式（stdout + /tmp/ 临时文件）是 session-state hook 重写的模板

### Established Patterns
- CLI 路由器 + lib/ 模块架构（Phase 1 建立）
- 所有状态变更通过 CLI 命令（Phase 2 建立）
- JSON 结构化输出通过 `utils.output()` 函数
- CommonJS modules, Node.js standard library only
- Hook 脚本静默失败，exit 0 保证不中断系统

### Integration Points
- settings.json 的 SessionStart hook 路径需从 `wf-session-state.sh` 变更为 `wf-session-state.js`
- /wf-pause 需要新的 lib/session.cjs 模块（或扩展 state.cjs）来处理 HANDOFF.json
- /wf-resume 需要读取 HANDOFF.json + 调用 Skill() 路由到对应工作流
- /wf-next 需要调用 roadmap analyze + init phase-op 获取状态

</code_context>

<specifics>
## Specific Ideas

- HANDOFF.json 字段设计参考 Phase 3 agent contracts 的最小集原则 — 够用即可，不过度序列化
- .continue-here.md 的人类可读格式参考 GSD 的同名文件
- session-state hook 的 Node.js 重写可直接 require('lib/state.cjs') 和 require('lib/init.cjs')
- /wf-next 的状态检测链（context → plan → execute → verify）与 autonomous.md 的阶段执行流保持一致

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 04-session-management*
*Context gathered: 2026-04-10*
