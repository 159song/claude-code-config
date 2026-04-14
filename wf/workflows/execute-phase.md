<purpose>
执行指定阶段的所有计划。使用 wave 级并行执行：
同一 wave 内的计划可并行执行（通过 worktree 隔离），wave 之间串行。

每个计划由 `wf-executor` sub-agent 执行。
orchestrator 保持轻量：发现计划 → 分析依赖 → 分波 → 派发 agent → 收集结果。

产出文件：
- `.planning/phase-{N}/SUMMARY-*.md` — 每个计划的执行摘要
- `.planning/phase-{N}/VERIFICATION.md` — 阶段验证结果

> **参考:** Agent 合同定义见 `wf/references/agent-contracts.md`
</purpose>

<flags>
- `--wave N` — 只执行指定 wave，用于分批执行或配额管理。
- `--interactive` — 交互模式。逐个任务内联执行，每个任务间有检查点。
- `--chain` — 链式模式。完成后自动调用 `/wf-verify-work`。
</flags>

<process>

<step name="load_plans">
## 1. 加载计划

读取 `.planning/phase-{N}/` 下的所有 PLAN*.md 文件。

如果没有计划文件，提示先运行 `/wf-plan-phase N`。

解析每个计划的 frontmatter：
- `wave` — 所属波次
- `depends_on` — 依赖的其他计划
- `files_modified` — 涉及的文件列表

按 wave 排序，生成执行顺序。
</step>

<step name="wave_execution">
## 2. 波次执行

对每个 wave：

### 并行模式（默认）

同一 wave 内的计划并行执行，每个计划启动一个独立的 `wf-executor` sub-agent：

> **Sub-agent 隔离:** 每个 executor agent 运行在独立的 worktree 中，拥有独立的 context window。
> 这意味着执行阶段是 context 消耗最友好的步骤 -- 主 session 只需要派发和收集结果，
> 不需要加载实际的代码文件。这是自主模式能跨多阶段运行的关键设计。

### 恢复检测

检查是否存在 partial SUMMARY.md（来自之前因 context 预算暂停的执行）：

1. 扫描 `.planning/phase-{N}/` 下以 `SUMMARY` 开头且包含 `PARTIAL` 标记的文件
2. 如果存在，将其路径作为 `resume_from` 传递给 executor input contract
3. Executor 将跳过已完成的任务，从恢复点继续

### Agent 调用

```javascript
// 从 config 读取 executor 模型
// MODEL = config.agents.models.executor || "sonnet"

Agent({
  subagent_type: "wf-executor",
  model: MODEL,
  isolation: "worktree",  // Git worktree 隔离
  prompt: `
    执行计划 Phase {N}。

    ## Input (per contract)
    - phase: {N}
    - plan_path: .planning/phase-{N}/{plan_file}
    - context_md: .planning/phase-{N}/CONTEXT.md
    - session_id: {SESSION_ID}
    ${resumePath ? `- resume_from: ${resumePath}` : ''}

    严格按计划执行每个任务，每完成一个任务立即 git commit。
    遇到偏差按偏差规则处理。
    完成后生成 SUMMARY.md 并输出 JSON 完成标记。
  `
})
```

### 完成标记解析

Executor 返回后，从其输出中提取最后一个 JSON 代码块作为完成标记：

| Status | 处理 |
|--------|------|
| `"complete"` | 计划执行成功，继续下一步 |
| `"partial"` | 记录部分完成状态。检查 SUMMARY.md 中的恢复点，通知用户可通过 `--wave` 参数从恢复点继续 |
| `"failed"` | 重试一次：在新 prompt 中附带失败的 summary 信息。重试仍失败则记录错误到 SUMMARY.md 并报告用户 |

**重试规则：** 最多重试 1 次。重试 prompt 包含原始任务描述 + 上次失败的 summary。第二次失败后停止，不无限重试。

**并行条件：**
- `config.parallelization.enabled === true`
- wave 内计划数 >= `config.parallelization.min_plans_for_parallel`
- 计划之间无文件冲突

不满足条件时回退为串行执行。

### 交互模式（`--interactive`）

逐个任务内联执行，每个任务后展示检查点：

```
┌─ 任务 3/12 完成 ──────────────────────────┐
│ ✅ Task 1.3: 创建数据模型                  │
│    文件: src/models/user.ts               │
│    验证: 类型检查通过                      │
│                                           │
│ ▶ 继续下一任务? [Y/n/跳过/中止]            │
└───────────────────────────────────────────┘
```
</step>

<step name="wave_merge">
## 3. Wave 合并

并行执行的 worktree 结果合并回主分支：

1. 检查文件冲突
2. 无冲突 → 自动合并
3. 有冲突 → 展示冲突文件，请求用户决策

合并后验证：
- 构建是否通过（如果有构建命令）
- 测试是否通过（如果有测试命令）
- 无回归问题
</step>

<step name="post_wave_check">
## 4. 波次间检查

每个 wave 完成后：

1. **回归门禁:** 运行现有测试，确保无回归
2. **Schema 漂移检查:** 检查数据库/API schema 是否有未提交的变更
3. **进度更新:** 通过 CLI 更新进度
```bash
wf-tools state advance-plan --phase {N} --plan {M}
```

```
Wave 2/3 完成 ████████████░░░░ 67%
  ✅ 测试通过: 42/42
  ✅ 无 schema 漂移
  ▶ 继续 Wave 3...
```
</step>

<step name="verify_phase">
## 5. 阶段验证

所有 wave 完成后，启动 `wf-verifier` agent：

```javascript
// MODEL = config.agents.models.verifier || "sonnet"

Agent({
  subagent_type: "wf-verifier",
  model: MODEL,
  prompt: `
    验证阶段 {N} 的目标是否达成。

    ## Input (per contract)
    - phase: {N}
    - goal: {{goal}}
    - requirements: {{requirement_ids}}
    - plan_paths: [{{plan_file_paths}}]
    - summary_paths: [{{summary_file_paths}}]
    - context_md: .planning/phase-{N}/CONTEXT.md

    使用 4 级验证模型: exists → substantive → wired → data-flowing
    完成后输出 JSON 完成标记。
  `
})
```

### 验证完成标记解析

Verifier 返回后，从其输出中提取最后一个 JSON 代码块作为完成标记：

| Status | 处理 |
|--------|------|
| `"complete"` | 验证通过，继续完成阶段 |
| `"partial"` | 部分验证通过，记录未通过项，生成 gap closure 计划 |
| `"failed"` | 重试一次：附带失败详情重新调用 verifier。重试仍失败则报告用户 |

**重试规则：** 最多重试 1 次。第二次失败后停止，不无限重试。

验证结果写入 `.planning/phase-{N}/VERIFICATION.md`。

如果验证发现问题：
- 自动生成 gap closure 计划
- 执行 gap closure
- 重新验证（最多 1 次）
</step>

<step name="complete_phase">
## 6. 完成阶段

通过 CLI 完成阶段转换：
```bash
# 标记当前阶段完成并推进到下一阶段
wf-tools state begin-phase --phase {N+1}
```

> **重要:** 禁止直接 Write/Edit STATE.md。所有状态变更必须通过 `wf-tools state` 子命令完成。

提交到 git：
```bash
git add .planning/
git commit -m "chore(phase-{N}): complete execution — verified"
```

```
╔══════════════════════════════════════════╗
║  WF · 阶段 {N} 执行完成                  ║
╚══════════════════════════════════════════╝

  任务: {{completed}}/{{total}}
  验证: {{verification_status}}
  耗时: {{duration}}

▶ 下一步: /wf-discuss-phase {N+1}
```

如果 `--chain` 模式，自动调用 `/wf-verify-work`。
</step>

</process>

<deviation_rules>
## 执行偏差规则

Agent 在执行过程中遇到计划外情况时的处理规则：

1. **Bug 修复:** 执行过程中发现的 bug，直接修复并记录。不需要请示。
2. **关键缺失:** 计划遗漏了明显必要的功能（如缺少错误处理），直接补充。
3. **阻塞问题:** 外部依赖不可用等阻塞，尝试替代方案。如果无法绕过，暂停并报告。
4. **架构变更:** 需要修改计划中未提到的架构级代码，**必须暂停请示**。
</deviation_rules>

<success_criteria>
- [ ] 所有 wave 执行完成
- [ ] 每个计划有对应的 SUMMARY.md
- [ ] 4 级验证通过（或 gap closure 后通过）
- [ ] 无测试回归
- [ ] STATE.md 通过 CLI 命令正确更新（`wf-tools state json` 验证）
- [ ] 所有变更已提交到 git
</success_criteria>
