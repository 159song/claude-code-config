<purpose>
初始化新项目。通过提问收集项目上下文，可选进行领域研究，
然后生成需求文档和路线图。

产出文件：
- `.planning/PROJECT.md` — 项目上下文
- `.planning/config.json` — 工作流配置
- `.planning/REQUIREMENTS.md` — 需求文档
- `.planning/ROADMAP.md` — 阶段路线图
- `.planning/STATE.md` — 项目状态记忆

完成后运行: `/wf-discuss-phase 1` 或 `/wf-autonomous`

> **参考:** Agent 合同定义见 `wf/references/agent-contracts.md`
</purpose>

<flags>
- `--auto` — 自动模式。配置问题结束后，自动完成 研究 → 需求 → 路线图，无需进一步交互。
</flags>

<process>

<step name="gather_context">
## 1. 收集项目上下文

**必须:** 执行此步骤前，先 Read `$HOME/.claude/wf/templates/project.md` 获取项目文档模板格式。不读取则产出格式不一致。

通过结构化提问了解项目：

**必答问题（最多 5 个）：**
1. 项目做什么？（一句话描述）
2. 技术栈偏好？（语言/框架/数据库）
3. 目标用户是谁？
4. 有无现有代码？
5. 首要目标是什么？（MVP/原型/生产级）

**提问规则：**
- 用选择题格式，列出常见选项 + "其他"
- 用户回答后立即进入下一问，不重复确认
- 如果用户通过 `@` 引用了文档，从文档提取答案，跳过已回答的问题
- `--auto` 模式下如果有 `@` 文档引用，尽量从文档推断所有答案

收集完成后生成 `.planning/PROJECT.md`。
</step>

<step name="configure">
## 2. 配置工作流

根据项目信息设置 config.json：

```bash
mkdir -p .planning
```

从模板创建 `config.json`，根据项目类型调整默认值：
- 小项目/原型 → `mode: "auto"`, 门禁全部关闭
- 中型项目 → `mode: "auto"`, 关键门禁开启
- 大型/生产级 → `mode: "interactive"`, 所有门禁开启

如果用户偏好 auto 模式（默认），将 `auto_advance: true`。
</step>

<step name="research" condition="config.workflow.research === true">
## 3. 领域研究（可选）

启动 4 个并行研究 agent：

```
研究方向：
1. 技术栈研究 — 最佳实践、版本兼容性、常见坑
2. 功能参考 — 类似产品的功能模式、用户体验模式
3. 架构研究 — 推荐架构模式、目录结构、数据模型
4. 风险研究 — 常见陷阱、安全风险、性能瓶颈
```

每个方向使用 `Agent()` 启动，`subagent_type: "wf-researcher"`：

```javascript
// MODEL = config.agents.models.researcher || "haiku"

// 并行启动 4 个研究 agent
Agent({ subagent_type: "wf-researcher", model: MODEL, prompt: `
  ## Input (per contract)
  - topic: "技术栈研究: {{tech_stack}}"
  - tech_stack: {{tech_stack}}
  - project_context: {{project_description}}
  完成后输出 JSON 完成标记。
` })
Agent({ subagent_type: "wf-researcher", model: MODEL, prompt: `
  ## Input (per contract)
  - topic: "功能参考: {{project_type}}"
  - tech_stack: {{tech_stack}}
  - project_context: {{project_description}}
  完成后输出 JSON 完成标记。
` })
Agent({ subagent_type: "wf-researcher", model: MODEL, prompt: `
  ## Input (per contract)
  - topic: "架构模式: {{tech_stack}}"
  - tech_stack: {{tech_stack}}
  - project_context: {{project_description}}
  完成后输出 JSON 完成标记。
` })
Agent({ subagent_type: "wf-researcher", model: MODEL, prompt: `
  ## Input (per contract)
  - topic: "风险研究: {{tech_stack}} + {{project_type}}"
  - tech_stack: {{tech_stack}}
  - project_context: {{project_description}}
  完成后输出 JSON 完成标记。
` })
```

### 完成标记解析

每个 Researcher 返回后，提取 JSON 完成标记：
- `"complete"` → 研究成功，汇总结果
- `"partial"` → 使用已有结果
- `"failed"` → 重试一次，仍失败则跳过该方向

研究结果汇总到 `.planning/research/SUMMARY.md`。
</step>

<step name="requirements">
## 4. 生成需求文档

**必须:** 执行此步骤前，先 Read `$HOME/.claude/wf/templates/requirements.md` 获取需求文档模板格式。不读取则产出格式不一致。

基于项目上下文和研究结果，生成 `.planning/REQUIREMENTS.md`：

**需求分类：**
- **FR-N:** 功能需求（带优先级: P0/P1/P2）
- **NFR-N:** 非功能需求（性能/安全/可用性）

**验收标准规则：**
- 每个 FR 必须有至少 1 个可验证的验收标准
- 使用 checkbox 格式：`- [ ] 用户可以...`
- 标准必须具体、可测试，不能含糊

如果 `gates.confirm_project` 为 true，展示需求摘要让用户确认。
</step>

<step name="roadmap">
## 5. 生成路线图

使用 `Agent()` 启动 `subagent_type: "wf-roadmapper"`，生成 `.planning/ROADMAP.md`：

```javascript
// MODEL = config.agents.models.roadmapper || "haiku"

Agent({
  subagent_type: "wf-roadmapper",
  model: MODEL,
  prompt: `
    ## Input (per contract)
    - project_md: .planning/PROJECT.md
    - requirements_md: .planning/REQUIREMENTS.md
    ${researchSummary ? `- research_summary: .planning/research/SUMMARY.md` : ''}

    生成阶段路线图。完成后输出 JSON 完成标记。
  `
})
```

### 完成标记解析

Roadmapper 返回后，提取 JSON 完成标记：
- `"complete"` → 路线图生成成功
- `"failed"` → 重试一次，仍失败则报告用户

**阶段划分规则：**
- 每个阶段聚焦一个可独立交付的功能域
- 阶段之间有明确的依赖关系
- 首个阶段应包含项目基础设施（项目结构、配置、基础依赖）
- 阶段数量: 小项目 2-4 个，中型 4-8 个，大型 6-12 个

**路线图格式：**
```markdown
## Phase 1: {{name}}
**目标:** {{goal}}
**依赖:** 无
**预期产出:** {{deliverables}}
```

如果 `gates.confirm_roadmap` 为 true，展示路线图让用户确认。
</step>

<step name="initialize_state">
## 6. 初始化状态

生成 `.planning/STATE.md`，记录：
- 当前阶段: 1
- 状态: active
- 进度: 0%

> **注意:** STATE.md 初始生成后，后续所有变更必须通过 `wf-tools state` CLI 子命令完成，禁止直接 Write/Edit。

提交所有 `.planning/` 文件到 git：

```bash
git add .planning/
git commit -m "chore(planning): initialize project — {{project_name}}"
```
</step>

<step name="route_next">
## 7. 路由下一步

显示初始化完成摘要（ui-brand 标准横幅: 项目名、阶段数、模式；下一步路由: /wf-discuss-phase 1、/wf-autonomous）。

如果 `--auto` 模式，自动调用 `/wf-autonomous`。
</step>

</process>

<success_criteria>
- [ ] `.planning/PROJECT.md` 包含完整项目上下文
- [ ] `.planning/config.json` 配置正确
- [ ] `.planning/REQUIREMENTS.md` 包含分类需求和验收标准
- [ ] `.planning/ROADMAP.md` 包含合理的阶段划分
- [ ] `.planning/STATE.md` 初始化正确
- [ ] 所有文件已提交到 git
</success_criteria>
