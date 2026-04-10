<purpose>
为指定阶段生成可执行计划。
经过 研究 → 规划 → 检查 的流程，最多 3 次修订迭代。

产出文件：
- `.planning/phase-{N}/RESEARCH.md` — 实现研究（可选）
- `.planning/phase-{N}/PLAN.md`（或多个 PLAN-*.md）— 执行计划
- `.planning/phase-{N}/THREAT-MODEL.md` — 安全威胁模型（当安全门禁开启时）

> **参考:** Agent 合同定义见 `wf/references/agent-contracts.md`
</purpose>

<flags>
- `--chain` — 链式模式。完成后自动调用 `/wf-execute-phase N`。
- `--skip-research` — 跳过研究步骤，直接进入规划。
</flags>

<process>

<step name="load_context">
## 1. 加载上下文

读取以下文件：
- `.planning/phase-{N}/CONTEXT.md` — 阶段决策
- `.planning/REQUIREMENTS.md` — 需求文档
- `.planning/ROADMAP.md` — 路线图
- `.planning/PROJECT.md` — 项目上下文
- `.planning/config.json` — 配置

如果 CONTEXT.md 不存在，提示先运行 `/wf-discuss-phase N`。
</step>

<step name="research" condition="config.workflow.research && !--skip-research">
## 2. 实现研究

启动 `wf-researcher` agent 研究具体实现方案：

```javascript
// MODEL = config.agents.models.researcher || "haiku"

Agent({
  subagent_type: "wf-researcher",
  model: MODEL,
  prompt: `
    阶段 {N}: {{name}}

    ## Input (per contract)
    - topic: "Phase {N} implementation: {{goal}}"
    - tech_stack: {{tech_stack}}
    - project_context: {{project_description}}
    - decisions: {{decisions_from_context}}

    研究如何实现此阶段的目标。产出:
    1. 推荐的实现方案
    2. 需要的第三方库及版本
    3. 文件结构建议
    4. 潜在的技术风险

    完成后输出 JSON 完成标记。
  `
})
```

### 完成标记解析

Researcher 返回后，从其输出中提取 JSON 完成标记：
- `"complete"` → 研究成功，继续规划
- `"partial"` → 使用已有研究结果继续
- `"failed"` → 重试一次，附带失败信息。仍失败则跳过研究，直接进入规划

结果写入 `.planning/phase-{N}/RESEARCH.md`。
</step>

<step name="plan">
## 3. 生成计划

启动 `wf-planner` agent 生成执行计划：

```javascript
// MODEL = config.agents.models.planner || "sonnet"

Agent({
  subagent_type: "wf-planner",
  model: MODEL,
  prompt: `
    为阶段 {N} 生成执行计划。

    ## Input (per contract)
    - phase: {N}
    - goal: {{goal}}
    - context_md: .planning/phase-{N}/CONTEXT.md
    - requirements_md: .planning/REQUIREMENTS.md
    - research_md: .planning/phase-{N}/RESEARCH.md
    - roadmap_md: .planning/ROADMAP.md

    规则:
    - 锁定的决策不可修改
    - 每个任务必须有: files, action, verify, done
    - 任务按 wave 分组（同 wave 内可并行，wave 之间串行）
    - 计划应在 ~50% context 内完成执行

    完成后输出 JSON 完成标记。
  `
})
```

### 完成标记解析

Planner 返回后，从其输出中提取 JSON 完成标记：
- `"complete"` → 计划生成成功，继续质量检查
- `"partial"` → 计划不完整，记录缺失部分，尝试补充
- `"failed"` → 重试一次，附带失败信息。仍失败则报告用户

**计划格式：**

```markdown
---
phase: {N}
goal: "{{goal}}"
total_tasks: {{count}}
waves: {{wave_count}}
---

# Phase {N} 执行计划

## Wave 1: {{wave_name}}

### Task 1.1: {{task_name}}
- **files:** `src/xxx.ts`, `src/yyy.ts`
- **action:** {{具体操作描述}}
- **verify:** {{验证方法}}
- **done:** {{完成标志}}
```

如果阶段较大，可拆分为多个计划文件：PLAN-A.md, PLAN-B.md 等。
</step>

<step name="check" condition="config.workflow.plan_check">
## 4. 计划质量检查

**检查项：**
1. **需求覆盖:** 计划中的任务是否覆盖阶段相关的所有需求
2. **依赖合理:** wave 之间的依赖关系是否正确
3. **任务完整:** 每个任务是否有完整的 files/action/verify/done
4. **安全覆盖:** 威胁模型中的缓解措施是否有对应任务
5. **目标对齐:** 计划完成后是否能达成阶段目标

如果检查发现问题，返回 step 3 修订，最多 3 次修订循环。

```
┌─ 计划检查 ──────────────────────────────────┐
│ ✅ 需求覆盖: 12/14 (86%)                    │
│ ⚠️ 缺失: FR-5, NFR-2                        │
│ ✅ 依赖合理: 无循环依赖                      │
│ ✅ 任务完整: 18/18                           │
│ ❌ 安全覆盖: 缺少 XSS 防护任务               │
│                                              │
│ 结论: 需修订 — 补充缺失需求和安全任务         │
│ 修订次数: 1/3                                │
└──────────────────────────────────────────────┘
```
</step>

<step name="security_gate" condition="config.workflow.security_enforcement">
## 5. 安全门禁

如果阶段涉及以下领域，必须生成威胁模型：
- 用户输入处理
- 认证/授权
- 数据存储
- 外部 API 调用
- 文件上传

威胁模型写入 `.planning/phase-{N}/THREAT-MODEL.md`。
高危威胁必须有对应的缓解任务在 PLAN.md 中。
</step>

<step name="confirm_and_commit">
## 6. 确认和提交

如果 `gates.confirm_plan` 为 true，展示计划摘要让用户确认。

提交到 git：
```bash
git add .planning/phase-{N}/
git commit -m "docs(phase-{N}): generate execution plan — {{task_count}} tasks in {{wave_count}} waves"
```
</step>

<step name="route_next">
## 7. 路由下一步

```
✅ 阶段 {N} 规划完成

  任务: {{task_count}} 个
  波次: {{wave_count}} 个
  覆盖: {{coverage}}%

▶ 下一步: /wf-execute-phase {N}
```

如果 `--chain` 模式，自动调用 `/wf-execute-phase N`。
</step>

</process>

<success_criteria>
- [ ] PLAN.md 包含完整的任务分解
- [ ] 每个任务有 files/action/verify/done
- [ ] wave 分组合理，无循环依赖
- [ ] 需求覆盖率 >= 90%
- [ ] 安全威胁已评估（如适用）
- [ ] 通过质量检查（或在 3 次修订内通过）
- [ ] 文件已提交到 git
</success_criteria>
