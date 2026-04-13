<purpose>
初始化新里程碑。在前一个里程碑完成（或首次启动）后，收集目标，
运行领域研究，生成需求文档和路线图。复用现有 researcher + roadmapper agent 流程。

产出文件：
- `.planning/REQUIREMENTS.md` -- 新里程碑需求文档
- `.planning/ROADMAP.md` -- 新里程碑阶段路线图
- 更新后的 `.planning/STATE.md` -- 新里程碑状态
- `.planning/RESEARCH-SUMMARY.md` -- 研究摘要（临时，供 roadmapper 消费）

> **参考:** Agent 合同定义见 `wf/references/agent-contracts.md`
</purpose>

<flags>
- `[version]` -- 可选，直接指定版本号（如 `v1.1`）。不指定时交互式确认。
</flags>

<process>

<step name="load_context">
## 1. 加载前一里程碑上下文

读取项目上下文（跨里程碑保留）：

```bash
cat .planning/PROJECT.md
```

检查前一里程碑归档：

```bash
ls .planning/milestones/ 2>/dev/null
```

如果存在归档目录，找到最近的版本号，读取该版本的 ROADMAP 作为参考：

```bash
# 例如: .planning/milestones/v1.0/v1.0-ROADMAP.md
cat .planning/milestones/{{prev_version}}/{{prev_version}}-ROADMAP.md
```

加载配置：

```bash
CONFIG_JSON=$(node "$HOME/.claude/wf/bin/wf-tools.cjs" config)
```

从配置中提取 agent 模型设置：
- `researcher_model`: `config.agents.models.researcher || "haiku"`
- `roadmapper_model`: `config.agents.models.roadmapper || "haiku"`
</step>

<step name="gather_goals">
## 2. 收集新里程碑目标

**如果有前一里程碑归档：**

展示前一里程碑摘要：

```
╔══════════════════════════════════════════╗
║  WF · 新里程碑                           ║
╚══════════════════════════════════════════╝

前一里程碑: {{prev_version}}
已完成阶段: {{phase_count}} 个
已完成需求: {{req_count}} 个

┌─ 已交付功能 ──────────────────────────────┐
│ • {{功能1}}                                │
│ • {{功能2}}                                │
│ • {{功能3}}                                │
└───────────────────────────────────────────┘
```

**收集新目标：**

询问用户：

> 新里程碑的目标是什么？描述你想在下一个版本中实现的主要功能和改进。

收集以下信息：
- **里程碑版本:** 默认从前一版本递增（v1.0 → v1.1 或 v2.0 为大版本）
  - 如果 `$ARGUMENTS` 包含版本号，使用该版本
  - 否则建议递增版本并让用户确认
  - 验证版本格式匹配 `v\d+\.\d+`
- **里程碑名称:** 简短名称（1-3 个词，如 "安全加固"、"性能优化"）
- **高层目标:** 3-5 个要点（用户自由描述）

确认收集结果：

```
┌─ 里程碑确认 ──────────────────────────────┐
│ 版本: {{version}}                          │
│ 名称: {{name}}                             │
│                                            │
│ 目标:                                      │
│ 1. {{goal_1}}                              │
│ 2. {{goal_2}}                              │
│ 3. {{goal_3}}                              │
└───────────────────────────────────────────┘
```

用户确认后继续。
</step>

<step name="research">
## 3. 运行领域研究（复用 wf-researcher agent, per D-10）

遵循与 `new-project.md` 相同的研究模式，但聚焦于**新功能领域**而非整个项目。

```
🚀 启动研究 agent...
   聚焦: 新里程碑目标领域
```

为每个主要目标领域启动 `Agent()` 调用，使用 `subagent_type: "wf-researcher"`：

```javascript
// MODEL = config.agents.models.researcher || "haiku"

// 为每个新目标领域启动研究 agent
Agent({ subagent_type: "wf-researcher", model: MODEL, prompt: `
  ## Input (per contract)
  - topic: "{{goal_area}}: 实现方案和最佳实践"
  - tech_stack: {{tech_stack_from_project_md}}
  - project_context: "{{project_description}}。前一里程碑已完成: {{prev_milestone_summary}}"
  - decisions: "{{user_constraints}}"
  完成后输出 JSON 完成标记。
` })
```

**效率原则：** 只研究**新增领域**，不重复研究前一里程碑已覆盖的内容。

### 完成标记解析

每个 Researcher 返回后，提取 JSON 完成标记：
- `"complete"` → 研究成功，汇总结果
- `"partial"` → 使用已有结果
- `"failed"` → 重试一次，仍失败则跳过该方向

研究结果汇总到 `.planning/RESEARCH-SUMMARY.md`（临时文件，供 roadmapper 消费）。

显示研究摘要：

```
┌─ 研究完成 ────────────────────────────────┐
│ ✅ 研究方向: {{research_count}} 个         │
│ 📝 关键发现: {{key_findings}}              │
│ 📄 摘要: .planning/RESEARCH-SUMMARY.md     │
└───────────────────────────────────────────┘
```
</step>

<step name="generate_requirements">
## 4. 生成 REQUIREMENTS.md

基于用户目标和研究结果生成新的需求文档。

**需求分类：**
- **FR-N:** 功能需求（带优先级: P0/P1/P2）
- **NFR-N:** 非功能需求（性能/安全/可用性）

**需求格式：**

```markdown
# 需求文档

## 里程碑: {{version}} {{name}}

### 功能需求

- [ ] **FR-01**: {{需求描述}} (P0)
- [ ] **FR-02**: {{需求描述}} (P1)

### 非功能需求

- [ ] **NFR-01**: {{需求描述}}

### 未来需求（延迟到后续里程碑）

- {{deferred_1}}
- {{deferred_2}}

### 超出范围

- {{out_of_scope_1}} -- 原因: {{reason}}

## 追溯矩阵

| 需求 ID | 阶段 | 状态 |
|---------|------|------|
| FR-01   | -    | 待分配 |
```

验收标准规则：
- 每个 FR 必须有至少 1 个可验证的验收标准
- 使用 checkbox 格式: `- [ ] 用户可以...`
- 标准必须具体、可测试，不能含糊

写入 `.planning/REQUIREMENTS.md`。

展示需求摘要让用户确认：

```
┌─ 需求概览 ────────────────────────────────┐
│ 功能需求: {{fr_count}} 个                  │
│ 非功能需求: {{nfr_count}} 个               │
│ 延迟需求: {{deferred_count}} 个            │
│ 超出范围: {{oos_count}} 个                 │
└───────────────────────────────────────────┘
```

等待用户确认或调整。
</step>

<step name="generate_roadmap">
## 5. 生成 ROADMAP.md（复用 wf-roadmapper agent, per D-10）

使用 `Agent()` 启动 `subagent_type: "wf-roadmapper"` 生成路线图：

```javascript
// MODEL = config.agents.models.roadmapper || "haiku"

Agent({
  subagent_type: "wf-roadmapper",
  model: MODEL,
  prompt: `
    ## Input (per contract)
    - project_md: .planning/PROJECT.md
    - requirements_md: .planning/REQUIREMENTS.md
    ${researchSummary ? `- research_summary: .planning/RESEARCH-SUMMARY.md` : ''}

    重要: 阶段编号从 1 开始（每个里程碑独立编号, per D-08）。

    生成阶段路线图。完成后输出 JSON 完成标记。
  `
})
```

### 完成标记解析

Roadmapper 返回后，提取 JSON 完成标记：
- `"complete"` → 路线图生成成功
- `"failed"` → 重试一次，仍失败则报告用户

**阶段编号规则（per D-08）：**
- 新里程碑的阶段编号**从 1 开始**
- 每个里程碑独立编号，不继承前一里程碑的编号

Roadmapper 产出 `.planning/ROADMAP.md`。

展示路线图摘要：

```
┌─ 路线图概览 ──────────────────────────────┐
│ 阶段数: {{phase_count}} 个                 │
│ 需求覆盖: {{coverage}}%                    │
│                                            │
│ Phase 1: {{name_1}} ({{req_count_1}} 需求) │
│ Phase 2: {{name_2}} ({{req_count_2}} 需求) │
│ ...                                        │
└───────────────────────────────────────────┘
```

等待用户确认路线图。
</step>

<step name="update_state">
## 6. 更新 STATE.md

通过 wf-tools CLI 更新项目状态：

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" state set \
  --milestone "{{version}}" \
  --status "planning" \
  --stopped_at "New milestone {{version}} initialized"
```

重置进度计数器：
- `total_phases`: 从新 ROADMAP.md 读取阶段数
- `completed_phases`: 0
- `total_plans`: 0
- `completed_plans`: 0
- `percent`: 0
</step>

<step name="present_result">
## 7. 展示新里程碑摘要

```
╔══════════════════════════════════════════╗
║  WF · 新里程碑初始化完成                 ║
╚══════════════════════════════════════════╝

版本: {{version}} {{name}}
目标: {{goal_count}} 个
需求: {{req_count}} 个
阶段: {{phase_count}} 个

┌─ 产出文件 ────────────────────────────────┐
│ 📄 .planning/REQUIREMENTS.md              │
│ 📄 .planning/ROADMAP.md                   │
│ 📄 .planning/STATE.md                     │
└───────────────────────────────────────────┘

┌─ 下一步 ──────────────────────────────────┐
│ ▶ /wf-discuss-phase 1  开始讨论第一阶段    │
│   /wf-autonomous        全自动执行所有阶段  │
└───────────────────────────────────────────┘
```
</step>

<step name="commit">
## 8. 提交规划工件

```bash
git add .planning/REQUIREMENTS.md .planning/ROADMAP.md .planning/STATE.md
git commit -m "docs: initialize milestone {{version}}"
```

如果 `.planning/RESEARCH-SUMMARY.md` 存在，一并提交：

```bash
git add .planning/RESEARCH-SUMMARY.md
```
</step>

</process>

<safety_constraints>
- **版本格式验证:** 版本号必须匹配 `/^v\d+\.\d+$/`
- **阶段编号重置:** 新里程碑阶段编号从 1 开始（per D-08）
- **Agent 复用:** researcher 和 roadmapper 使用与 new-project.md 相同的调用模式（per D-10）
- **状态变更通过 CLI:** 所有 STATE.md 变更通过 `wf-tools state` 命令（Phase 2 约束）
- **前一里程碑上下文:** 传入前一里程碑 PROJECT.md 作为研究上下文，避免重复研究
- **模型配置校验:** 从 config.json 读取 agent 模型，校验属于 ["sonnet", "opus", "haiku", "inherit"] 允许列表
</safety_constraints>

<success_criteria>
- [ ] 前一里程碑上下文已加载（PROJECT.md + milestones/ 归档）
- [ ] 用户目标已收集（版本号、名称、3-5 个目标）
- [ ] 研究已通过 wf-researcher agent 执行（聚焦新领域）
- [ ] REQUIREMENTS.md 已生成并经用户确认
- [ ] ROADMAP.md 已通过 wf-roadmapper agent 生成
- [ ] 阶段编号从 1 开始（per D-08）
- [ ] STATE.md 已更新为新里程碑状态
- [ ] 所有工件已提交到 git
- [ ] 用户知道下一步: /wf-discuss-phase 1
</success_criteria>
