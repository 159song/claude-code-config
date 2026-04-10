# Roadmap: WF Workflow System Optimization

## Overview

WF 的优化路径从底层向上推进：先夯实 CLI 工具基础（每个后续改进都依赖它），再建立状态安全机制防止数据腐坏，然后规范 agent 交接合同实现可靠的自动化，接着补全会话管理让工作可中断可恢复，再增强工作流覆盖关键场景，最后补齐质量工具形成完整闭环。每个阶段交付一个独立可验证的能力提升。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: CLI Foundation** - 模块化 wf-tools.cjs 并实现复合初始化命令，消除 context 浪费
- [x] **Phase 2: State Safety** - 所有状态变更通过 CLI 命令完成，杜绝直接文件修改导致的腐坏
- [ ] **Phase 3: Agent Contracts** - 定义 agent 完成标记、交接模式和 context 预算，实现可靠自动化
- [ ] **Phase 4: Session Management** - 支持工作暂停、恢复和智能续接，让长任务可中断
- [ ] **Phase 5: Workflow Enhancement** - 增强工作流健壮性，补齐阶段管理和配置能力
- [ ] **Phase 6: Quality Tools** - 代码审查和里程碑生命周期管理，形成完整工作闭环

## Phase Details

### Phase 1: CLI Foundation
**Goal**: 工作流通过单次 CLI 调用获取所有所需上下文，wf-tools.cjs 从单文件进化为模块化架构
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. 运行 wf-tools.cjs init 返回包含项目状态、路线图位置、配置的完整 JSON，工作流无需额外读文件
  2. wf-tools.cjs 代码拆分为 router + lib/ 目录下至少 8 个独立模块，每个模块可单独测试
  3. 所有 4 个 hook 路径与 settings.json 一致并正常触发（可通过 hook 日志验证）
  4. 命令文件中不再包含 `{{WF_ROOT}}` 占位符，全部替换为运行时可解析的真实路径
  5. wf-tools.cjs 支持 --cwd 参数和自动 findProjectRoot，在任意子目录下均可正确执行
**Plans:** 3 plans
Plans:
- [x] 01-01-PLAN.md — Modularize wf-tools.cjs into router + 7 lib/ modules with findProjectRoot
- [x] 01-02-PLAN.md — Implement compound init command with sub-modes
- [x] 01-03-PLAN.md — Fix hook paths in settings.json and replace all {{WF_ROOT}} placeholders

### Phase 2: State Safety
**Goal**: 所有对 STATE.md 和 ROADMAP.md 的变更都通过 CLI 命令完成，消除直接文件修改造成的格式腐坏和并行冲突
**Depends on**: Phase 1
**Requirements**: STATE-01, STATE-02, STATE-03, STATE-04, STATE-05, STATE-06
**Success Criteria** (what must be TRUE):
  1. 工作流中不存在对 STATE.md 的直接 Write/Edit 调用，全部通过 wf-tools.cjs state 子命令完成
  2. roadmap 状态检测基于验证文件内容（PASS/FAIL 标记），而非仅检查文件是否存在
  3. 运行 wf-tools.cjs validate --repair 可检测并自动修复 STATE.md 格式异常
  4. YAML frontmatter 支持 get/set/merge/validate 四种操作，可通过 CLI 直接读写
  5. 阶段转换（begin-phase, advance-plan）通过 CLI 命令原子执行，自动更新进度和状态
**Plans:** 4 plans
Plans:
- [x] 02-01-PLAN.md — Fix nested YAML parsing and implement frontmatter CRUD (get/set/merge/patch/validate)
- [x] 02-02-PLAN.md — Create validate.cjs module for health check and auto-repair
- [x] 02-03-PLAN.md — Implement phase transition commands and fix content-based verification
- [x] 02-04-PLAN.md — Migrate workflow files from direct STATE.md writes to CLI commands

### Phase 3: Agent Contracts
**Goal**: 每个 agent 有明确的输入输出合同、完成标记和 context 预算规则，工作流可靠检测 agent 完成并正确交接
**Depends on**: Phase 2
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04
**Success Criteria** (what must be TRUE):
  1. 5 个 agent 各自有定义好的完成标记（structured JSON），工作流据此判断 agent 是否成功完成
  2. executor agent 在 context 消耗达 70% 时自动保存进度并安全停止，可通过恢复机制继续
  3. agent 指令中使用 Claude Code 原生 API 字段（memory, isolation, effort），而非自定义替代方案
  4. agent-contracts.md 参考文档存在且定义了每个 agent 类型的输入格式、输出格式和错误处理规则
**Plans**: TBD

### Phase 4: Session Management
**Goal**: 用户可以随时暂停工作、跨会话恢复上下文、并让系统自动推进到下一步，长任务不再被迫一次完成
**Depends on**: Phase 2, Phase 3
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04
**Success Criteria** (what must be TRUE):
  1. 运行 /wf-pause 生成 HANDOFF.json 和 .continue-here.md，包含完整的当前进度和恢复指令
  2. 运行 /wf-resume 从 HANDOFF.json 恢复上下文，自动路由到中断点继续执行
  3. 运行 /wf-next 自动检测项目当前状态（未规划/未执行/未验证）并推进到下一逻辑步骤
  4. session-state hook 输出结构化 JSON（而非原始 markdown），工作流可直接解析使用
**Plans**: TBD

### Phase 5: Workflow Enhancement
**Goal**: 工作流覆盖更多实际场景（自治执行、阶段动态调整、配置管理），减少卡顿和误报
**Depends on**: Phase 1, Phase 2, Phase 3
**Requirements**: WF-01, WF-02, WF-03, WF-04, WF-05, WF-06
**Success Criteria** (what must be TRUE):
  1. autonomous.md 包含具体可执行的实现（Skill() 调用模式、错误恢复逻辑），而非抽象描述
  2. 用户可通过命令动态添加、插入、删除阶段，系统自动处理编号重排
  3. /wf-settings 提供交互式配置查看和修改（granularity, mode, parallelization 等）
  4. 参考文档套件完整：agent-contracts, anti-patterns, context-budget, continuation-format 全部存在且内容充实
  5. prompt guard 支持负向前瞻模式，误报率显著降低（用户不再频繁收到不相关警告）
**Plans**: TBD

### Phase 6: Quality Tools
**Goal**: 用户拥有代码审查工作流和里程碑管理能力，形成从编写到审查到发布的完整闭环
**Depends on**: Phase 5
**Requirements**: QUAL-01, QUAL-02
**Success Criteria** (what must be TRUE):
  1. 运行 code-review 命令启动审查，review-fix 自动应用修复建议，形成审查-修复链
  2. 里程碑支持完整生命周期：new-milestone 创建、complete-milestone 收尾归档、archive 历史保存
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. CLI Foundation | 3/3 | Complete | 2026-04-10 |
| 2. State Safety | 4/4 | Complete | 2026-04-10 |
| 3. Agent Contracts | 0/? | Not started | - |
| 4. Session Management | 0/? | Not started | - |
| 5. Workflow Enhancement | 0/? | Not started | - |
| 6. Quality Tools | 0/? | Not started | - |
