# Autonomous Workflow

全自动模式。对所有剩余阶段执行 讨论 -> 规划 -> 执行 -> 验证 流水线。
只在需要用户判断时暂停（阻塞问题、验证失败、context 不足）。

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

显示执行横幅：

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

### 2.1 Context Budget Check

每个阶段开始前检查 context 预算：

```bash
STATE_JSON=$(node "$HOME/.claude/wf/bin/wf-tools.cjs" state json)
```

如果 wf-context-monitor 已记录 remaining < 40%（从 session metrics 或 hook warning 判断），暂停自主执行：

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" session pause \
  --phase <N> --plan 0 --step discuss \
  --stopped_at "Context budget low, pausing autonomous"
```

显示消息后停止循环：

> Context 预算不足。在新会话中运行 `/wf-autonomous --from N` 继续。

### 2.2 Discuss Phase

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

```
Skill(plan-phase, { phase: N })
```

计划质量门禁由 plan-phase 工作流内部处理（最多 3 次修订循环，参见 gates.md）。完成后自动继续。

### 2.4 Execute Phase

```
Skill(execute-phase, { phase: N })
```

执行阶段内部处理 wave 级并行和逐任务 commit。

### 2.5 Verify and Gap Closure

```
Skill(verify-work)
```

检查验证结果。如果验证通过（无 FAIL），跳转到 2.6。

**如果验证失败（D-02 gap closure 规则）：**

1. 显示 "Phase N 验证失败，尝试 gap closure..."
2. 分析验证报告中的 FAIL 项，生成修复计划
3. 执行修复任务
4. 再次验证：`Skill(verify-work)`
5. 如果仍然失败：
   - 暂停自主执行，显示失败详情
   - 保存状态：
     ```bash
     node "$HOME/.claude/wf/bin/wf-tools.cjs" session pause \
       --phase <N> --plan 0 --step verify \
       --stopped_at "Verification failed after gap closure"
     ```
   - 提示: "验证仍未通过。运行 `/wf-autonomous --from N` 在修复后继续。"
   - **停止循环。不跳过到下一阶段。**（D-02: cross-phase failure = retry then pause, never skip）

Gap closure 限制：每个阶段最多 1 次自动重试（T-05-03 mitigation），避免无限循环。

### 2.6 Advance to Next Phase

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

所有阶段执行完成后，显示汇总：

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

## Error Handling

| 场景 | 处理 |
|------|------|
| 单个任务失败 | 记录在 SUMMARY.md，继续该计划的其他任务 |
| 整个计划失败 | 暂停当前阶段，显示错误，等待用户 |
| 验证失败 | 单次 gap closure 重试，仍失败则暂停（不跳阶段） |
| Context 耗尽 | 通过 CLI 保存状态，提示新会话恢复 |

Context 耗尽时的状态保存：

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" session pause \
  --phase <N> --plan <P> --step <S> \
  --stopped_at "Context exhausted at Phase {N}"
```

## Safety Constraints

- **Skill() 目标白名单:** 只允许 `discuss-phase`, `plan-phase`, `execute-phase`, `verify-work`（T-05-02）
- **输入验证:** --from/--to/--only 值必须为正整数（T-05-01）
- **重试限制:** gap closure 每阶段最多 1 次（T-05-03, D-02）
- **状态更新:** 全部通过 `wf-tools` CLI 命令，禁止直接 Write/Edit STATE.md
