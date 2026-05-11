<purpose>
执行指定阶段的所有计划。使用 wave 级并行执行：
同一 wave 内的计划可并行执行（通过 worktree 隔离），wave 之间串行。

每个计划由 `wf-executor` sub-agent 执行。
orchestrator 保持轻量：发现计划 → 分析依赖 → 分波 → 派发 agent → 收集结果。

产出文件：
- `.planning/phase-{N}/SUMMARY-*.md` — 每个计划的执行摘要
- `.planning/phase-{N}/VERIFICATION.md` — 阶段验证结果

> **参考:**
> - Agent 合同定义见 `wf/references/agent-contracts.md`
> - Git 约定（commit scope、worktree 合并策略）见 `wf/references/git-conventions.md`
>   —— commit 必须用 `feat(phase-<N>): ...` 或同类 scope
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

<step name="file_conflict_precheck">
## 1.5 文件冲突预检

在启动并行执行前，检查同一 wave 内的计划是否有文件冲突：

1. 对每个 wave，提取所有计划的 `files_modified` 列表
2. 计算 wave 内每对计划之间的文件交集
3. 如果存在交集 → 冲突计划降级为串行，显示警告（列出冲突文件和降级原因）
4. 无冲突的计划保持并行
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

> 规则见 `wf/references/shared-patterns.md` § 恢复检测。
> 检测到 partial SUMMARY 时，将其路径作为 `resume_from` 传递给 executor。

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

### 渐进式结果收集

当 wave 内有多个并行 agent 时，采用逐个收集策略（而非等待全部完成再统一处理）：

1. **即时处理:** 每个 agent 返回后立即：
   - 解析完成标记（JSON）
   - 读取 worktree 中的 SUMMARY.md（在合并前）
   - 更新进度显示

2. **快速失败:** 如果某个 agent 返回 `"failed"`：
   - 立即启动重试（不等待同 wave 其他 agent 完成）
   - 重试与剩余 agent 并行进行，减少总等待时间

3. **进度反馈:** 每个 agent 完成后刷新进度显示（ui-brand 进度条格式）

4. **Partial 即时记录:** `"partial"` 结果立即写入 `.planning/phase-{N}/`，确保恢复时无需重新执行。

### 完成标记解析

Executor 返回后，按 `shared-patterns.md` § 完成标记格式提取最后一个 JSON 代码块。
状态路由与重试规则见 `shared-patterns.md` § 状态路由、重试规则。

Execute 特殊处理：
- `"partial"` → 通知用户可通过 `--wave` 参数从恢复点继续
- `"failed"` → 重试 prompt 附带上次失败的 summary

**并行条件:** 见 `shared-patterns.md` § 并行条件。不满足时回退串行。

### 交互模式（`--interactive`）

逐个任务内联执行，每个任务后展示检查点（ui-brand 检查点框: 任务状态、文件、验证结果、继续/跳过/中止选项）。
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

显示 wave 进度（ui-brand 进度条: 测试结果、schema 状态）。
</step>

<step name="verify_phase">
## 5. 阶段验证

**必须:** 执行此步骤前，先 Read `$HOME/.claude/wf/references/verification-patterns.md` 获取 4 级验证模型详细定义。不读取则无法正确验证。

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

按 `shared-patterns.md` § 完成标记格式 + 状态路由处理 verifier 返回。验证特殊处理：
- `"partial"` → 生成 gap closure 计划
- `"failed"` → 附带失败详情重试一次（见 § 重试规则）

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

### 阶段指标记录（可选）

当 `config.telemetry.enabled === true` 时，通过 CLI 记录阶段执行指标：

```bash
wf-tools state merge '{"phase_N_metrics":{"duration_sec":245,"commits":8,"files_changed":12,"tasks_completed":5,"tasks_total":5,"timestamp":"2026-04-14T10:00:00Z"}}'
```

指标来源：
- `duration_sec` — 阶段开始到验证通过的秒数
- `commits` — `git log --oneline` 计数（从阶段开始 commit 到最新）
- `files_changed` — `git diff --stat` 中的文件数
- `tasks_completed/total` — 从 SUMMARY.md 汇总

> 指标写入 STATE.md frontmatter，可通过 `wf-tools state get phase_N_metrics` 查询。
> 默认关闭，不影响执行流程。

提交到 git：
```bash
git add .planning/
git commit -m "chore(phase-{N}): complete execution — verified"
```

显示完成横幅（ui-brand 标准横幅: 任务数、验证状态、耗时、下一步路由）。

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
