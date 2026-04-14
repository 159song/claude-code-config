# Autonomous Workflow

全自动模式。对所有剩余阶段执行 讨论 -> 规划 -> 执行 -> 验证 流水线。
利用 CONTINUATION.md 检查点 + auto-compact 实现跨 context 无缝恢复。
只在需要用户判断时暂停（阻塞问题、验证二次失败）。

## Flags

- `--from N` -- 从阶段 N 开始（而非第一个未完成阶段）
- `--to N` -- 执行到阶段 N 后停止
- `--only N` -- 只执行阶段 N
- `--interactive` -- 讨论阶段使用交互模式（逐个决策），其余阶段仍为自动

---

## Step 1: Parse Flags and Discover Phases

解析 `$ARGUMENTS` 中的标志：

```bash
# 获取路线图分析结果
ROADMAP_JSON=$(node "$HOME/.claude/wf/bin/wf-tools.cjs" roadmap analyze)
```

从 `ROADMAP_JSON` 提取所有阶段列表和 `current_phase`（第一个非 verified 阶段）。

**确定执行范围:**

- 默认: 从 `current_phase` 到最后一个阶段
- `--from N`: 起始阶段 = N（parseInt 验证，拒绝 NaN 或负数）
- `--to N`: 结束阶段 = N（含，parseInt 验证）
- `--only N`: 起始 = 结束 = N（parseInt 验证）

**输入验证（T-05-01 mitigation）:** 对 --from/--to/--only 的值执行 parseInt，若结果为 NaN 或 <= 0，立即报错退出，不执行任何阶段。

### 1.1 Recovery Detection (CONTINUATION.md)

在解析 flags 之后、进入主循环之前，检查是否存在 CONTINUATION.md（来自 auto-compact 恢复）：

```bash
CONTINUATION=$(cat .planning/CONTINUATION.md 2>/dev/null)
```

如果存在 CONTINUATION.md：

1. 解析其 frontmatter 中的 `phase`、`step`、`flags`、`remaining_phases`
2. 用 CONTINUATION 的值覆盖 flags 解析结果（恢复到上次检查点位置）
3. 显示恢复横幅：

```
╔══════════════════════════════════════════╗
║  WF · 从检查点恢复                       ║
╚══════════════════════════════════════════╝

  恢复位置: Phase {N} / {step}
  剩余阶段: {remaining_phases}
  上次结果: {last_result}

▶ 继续执行...
```

4. 跳转到对应阶段的对应步骤继续执行（例如 step=execute 则跳过 discuss 和 plan）

如果不存在 CONTINUATION.md，显示正常执行横幅：

```
╔══════════════════════════════════════════╗
║  WF · 自主模式                           ║
╚══════════════════════════════════════════╝

执行范围: Phase {from} -> Phase {to}
阶段列表:
  ⬜ Phase {N}: {name}
  ⬜ Phase {N+1}: {name}
  ...
```

---

## Step 2: Phase Loop

对执行范围内的每个阶段 N，按顺序执行以下子步骤。

### 2.1 Context Budget Checkpoint

每个阶段开始前，写入 CONTINUATION.md 检查点并检查 context 预算：

**写入检查点:**

```markdown
---
phase: {N}
step: begin
flags: "{原始 flags}"
remaining_phases: [{N}, {N+1}, ..., {to}]
last_result: null
timestamp: {ISO timestamp}
---

# WF Autonomous Continuation

自主模式正在执行。当前位于 Phase {N} 开始处。
如果从 auto-compact 恢复，运行 `/wf-autonomous` 即可自动从此位置继续。
```

**预算检查:**

```bash
STATE_JSON=$(node "$HOME/.claude/wf/bin/wf-tools.cjs" state json)
```

读取 context 指标（从 `/tmp/claude-ctx-{session_id}.json` 或 session metrics）：

- **used_pct < 70%**: 正常继续
- **used_pct 70-85%**: 记录警告但继续执行（auto-compact 会在阈值时自动压缩）
- **used_pct > 85%**: 更新 CONTINUATION.md 后继续（auto-compact 即将触发，检查点确保恢复）

> **设计理念:** 不再硬停。CONTINUATION.md 检查点 + CLAUDE.md 中的 compact instructions 确保 auto-compact 后能无缝恢复。唯一停止条件是验证二次失败或阻塞问题。

### 2.2 Discuss Phase

**写入检查点:**

更新 CONTINUATION.md：`step: discuss`

**Skill() 目标硬编码为已知值（T-05-02 mitigation）:**

默认模式（无 --interactive 标志）：

```
Skill(discuss-phase, { phase: N, flags: "--auto --batch" })
```

如果 `--interactive` 标志存在：

```
Skill(discuss-phase, { phase: N })
```

讨论完成后自动继续，不等待用户确认。

### 2.3 Plan Phase

**写入检查点:**

更新 CONTINUATION.md：`step: plan`

```
Skill(plan-phase, { phase: N })
```

计划质量门禁由 plan-phase 工作流内部处理（最多 3 次修订循环，参见 gates.md）。完成后自动继续。

### 2.4 Execute Phase

**写入检查点:**

更新 CONTINUATION.md：`step: execute`

```
Skill(execute-phase, { phase: N })
```

执行阶段内部处理 wave 级并行和逐任务 commit。

> **Sub-agent 隔离:** execute-phase 中每个计划由独立的 wf-executor sub-agent 在 worktree 中执行，
> 不消耗主 session 的 context。这是 context 预算最友好的步骤。

### 2.5 Verify and Gap Closure

**写入检查点:**

更新 CONTINUATION.md：`step: verify`

```
Skill(verify-work, { flags: "--smoke" })
```

> **Smoke-only 模式:** 自主执行时默认使用 `--smoke` 标志，只运行自动化冒烟测试 + 代码审查，
> 不进入对话式 UAT 循环。这避免了在自动模式下等待用户交互。

检查验证结果。如果验证通过（无 FAIL），跳转到 2.6。

**如果验证失败（D-02 gap closure 规则）：**

1. 显示 "Phase N 验证失败，尝试 gap closure..."
2. 分析验证报告中的 FAIL 项，生成修复计划
3. 执行修复任务
4. 再次验证：`Skill(verify-work, { flags: "--smoke" })`
5. 如果仍然失败：
   - 暂停自主执行，显示失败详情
   - 保存状态：
     ```bash
     node "$HOME/.claude/wf/bin/wf-tools.cjs" session pause \
       --phase <N> --plan 0 --step verify \
       --stopped_at "Verification failed after gap closure"
     ```
   - 更新 CONTINUATION.md：`last_result: FAIL`
   - 提示: "验证仍未通过。运行 `/wf-autonomous --from N` 在修复后继续。"
   - **停止循环。不跳过到下一阶段。**（D-02: cross-phase failure = retry then pause, never skip）

Gap closure 限制：每个阶段最多 1 次自动重试（T-05-03 mitigation），避免无限循环。

### 2.6 Advance to Next Phase

更新 CONTINUATION.md：`last_result: PASS`，移除当前阶段从 `remaining_phases`。

显示阶段完成横幅：

```
✅ Phase {N} 完成 ████████████████ 100%
   任务: {completed}/{total}
   验证: PASS

▶ 推进到 Phase {N+1}...
```

如果存在下一个阶段，推进状态：

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" state begin-phase --phase <N+1>
```

---

## Step 3: Completion

所有阶段执行完成后，删除 CONTINUATION.md（不再需要恢复点）：

```bash
rm -f .planning/CONTINUATION.md
```

显示汇总：

```
╔══════════════════════════════════════════╗
║  WF · 所有阶段执行完成                   ║
╚══════════════════════════════════════════╝

  Phase 1: ✅ {name}
  Phase 2: ✅ {name}
  Phase 3: ✅ {name}
  ...

  总任务: {total_tasks}
  总验证: {total_verifications} PASS

▶ 建议: /wf-verify-work 进行最终验收
```

---

## CONTINUATION.md Checkpoint Format

每次写入/更新检查点时使用以下格式：

```markdown
---
phase: {N}
step: begin|discuss|plan|execute|verify
flags: "{原始 --from/--to/--only/--interactive flags}"
remaining_phases: [{N}, {N+1}, ..., {to}]
last_result: null|PASS|FAIL
timestamp: {ISO 8601 timestamp}
---

# WF Autonomous Continuation

自主模式正在执行 Phase {N} 的 {step} 步骤。

## 恢复指令

1. 读取此文件获取当前位置
2. 跳转到 Phase {N} 的 {step} 步骤继续执行
3. 如果 step 不是 begin，跳过该阶段已完成的步骤
4. remaining_phases 中的阶段是尚未完成的阶段

## 上下文

- 当前阶段产出文件在 `.planning/phases/{NN}-*/`
- 项目状态在 `.planning/STATE.md`
- 配置在 `.planning/config.json`
```

> **写入方式:** 直接 Write `.planning/CONTINUATION.md`。这是唯一允许直接 Write 的 .planning 文件
> （因为它是临时检查点，不是持久状态）。

---

## Error Handling

| 场景 | 处理 |
|------|------|
| 单个任务失败 | 记录在 SUMMARY.md，继续该计划的其他任务 |
| 整个计划失败 | 暂停当前阶段，显示错误，等待用户 |
| 验证失败 | 单次 gap closure 重试，仍失败则暂停（不跳阶段） |
| Context auto-compact | CONTINUATION.md 已写入，auto-compact 后自动恢复 |
| 阻塞问题 | 暂停，更新 CONTINUATION.md，提示用户 |

## Safety Constraints

- **Skill() 目标白名单:** 只允许 `discuss-phase`, `plan-phase`, `execute-phase`, `verify-work`（T-05-02）
- **输入验证:** --from/--to/--only 值必须为正整数（T-05-01）
- **重试限制:** gap closure 每阶段最多 1 次（T-05-03, D-02）
- **状态更新:** 全部通过 `wf-tools` CLI 命令，禁止直接 Write/Edit STATE.md
- **CONTINUATION.md:** 唯一例外 -- 允许直接 Write（临时检查点，完成后自动删除）
