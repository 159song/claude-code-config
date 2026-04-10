# Requirements: WF Workflow System Optimization

**Defined:** 2026-04-10
**Core Value:** 让 Claude Code 在任何项目中都能按照结构化工作流高效推进，同时保持低 context 消耗和高可靠性。

## v1 Requirements

Requirements for optimization milestone. Each maps to roadmap phases.

### Infrastructure (基础设施)

- [ ] **INFRA-01**: Hook 路径与 settings.json 一致，所有 4 个 hook 正常触发
- [ ] **INFRA-02**: 命令文件中的 `{{WF_ROOT}}` 替换为可解析的真实路径
- [ ] **INFRA-03**: wf-tools.cjs 支持项目根目录解析（--cwd + findProjectRoot）
- [ ] **INFRA-04**: wf-tools.cjs 拆分为 router + lib/ 模块架构（≥8 个模块）
- [ ] **INFRA-05**: 复合 init 命令（单次 CLI 调用返回工作流所需全部上下文 JSON）

### State Management (状态管理)

- [ ] **STATE-01**: 所有 STATE.md 写入通过 CLI 命令完成，禁止直接 Write/Edit
- [ ] **STATE-02**: roadmap 状态检测读取文件内容（PASS/FAIL），而非仅看文件存在
- [ ] **STATE-03**: 健康检查命令 validate/health，支持 --repair 自修复
- [ ] **STATE-04**: YAML frontmatter CRUD 操作（get/set/merge/validate）
- [ ] **STATE-05**: 批量状态更新命令（state patch --field1 val1 --field2 val2）
- [ ] **STATE-06**: 阶段转换命令（state begin-phase, state advance-plan）

### Agent System (代理系统)

- [ ] **AGENT-01**: 定义所有 5 个 agent 的完成标记和交接模式
- [ ] **AGENT-02**: executor agent 添加 context 预算感知（70% 保存进度并停止）
- [ ] **AGENT-03**: agent 使用原生 Claude Code API（memory, isolation, effort 前缀字段）
- [ ] **AGENT-04**: agent-contracts.md 参考文档定义每个 agent 类型的输入/输出合同

### Session Management (会话管理)

- [ ] **SESS-01**: /wf-pause 写入 HANDOFF.json + .continue-here.md
- [ ] **SESS-02**: /wf-resume 从 HANDOFF.json 恢复上下文并智能路由
- [ ] **SESS-03**: /wf-next 自动检测项目状态并推进到下一逻辑步骤
- [ ] **SESS-04**: session-state hook 输出结构化 JSON 而非原始 markdown

### Workflow Enhancement (工作流增强)

- [ ] **WF-01**: autonomous.md 重写为具体可执行实现（含 Skill() 调用和错误恢复）
- [ ] **WF-02**: 阶段操作命令 add-phase, insert-phase, remove-phase（支持重编号）
- [ ] **WF-03**: /wf-settings 交互式配置管理
- [ ] **WF-04**: 参考文档套件：agent-contracts, anti-patterns, context-budget, continuation-format
- [ ] **WF-05**: prompt guard 扩展负向前瞻，减少误报
- [ ] **WF-06**: git commit 支持 --files 选择性暂存

### Quality Tools (质量工具)

- [ ] **QUAL-01**: 代码审查工作流（code-review + review-fix 自动链）
- [ ] **QUAL-02**: 里程碑生命周期（new-milestone, complete-milestone, archive）

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Debug & Intelligence

- **DEBUG-01**: 结构化调试工作流（/wf-debug，支持检查点和会话续接）
- **INTEL-01**: 代码库智能系统（stack.json, api-map.json 等）
- **INTEL-02**: 代码库映射（map-codebase for brownfield projects）

### Advanced Workflows

- **ADV-01**: 交付工作流（/wf-ship，从执行到 PR 创建）
- **ADV-02**: 测试生成工作流
- **ADV-03**: 文档生成工作流
- **ADV-04**: 工作流并行（workstreams）

### Polish

- **UX-01**: 用户画像分析
- **UX-02**: 项目统计命令
- **UX-03**: 撤销命令（安全 git revert）
- **UX-04**: 导入命令（从 PRD 导入）

## Out of Scope

| Feature | Reason |
|---------|--------|
| GUI/Web 界面 | 保持 CLI 形态，不引入维护负担 |
| 多用户协作 | Claude Code 是单用户工具 |
| 插件/扩展系统 | WF 核心功能尚在稳定中，过早抽象 |
| AI 模型市场 | 固定 3-4 个 profile 即可 |
| 自动合并 PR | 需要人工审查环节 |
| 文件监听 | PostToolUse hook 已覆盖 |
| GSD 的 80+ 领域技能 | 用户按需添加，不随系统分发 |
| 实时社区功能 | 不属于工作流工具范畴 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| STATE-01 | Phase 2 | Pending |
| STATE-02 | Phase 2 | Pending |
| STATE-03 | Phase 2 | Pending |
| STATE-04 | Phase 2 | Pending |
| STATE-05 | Phase 2 | Pending |
| STATE-06 | Phase 2 | Pending |
| AGENT-01 | Phase 3 | Pending |
| AGENT-02 | Phase 3 | Pending |
| AGENT-03 | Phase 3 | Pending |
| AGENT-04 | Phase 3 | Pending |
| SESS-01 | Phase 4 | Pending |
| SESS-02 | Phase 4 | Pending |
| SESS-03 | Phase 4 | Pending |
| SESS-04 | Phase 4 | Pending |
| WF-01 | Phase 5 | Pending |
| WF-02 | Phase 5 | Pending |
| WF-03 | Phase 5 | Pending |
| WF-04 | Phase 5 | Pending |
| WF-05 | Phase 5 | Pending |
| WF-06 | Phase 5 | Pending |
| QUAL-01 | Phase 6 | Pending |
| QUAL-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after roadmap creation*
