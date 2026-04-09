<purpose>
全自动模式。对所有剩余阶段执行 讨论 → 规划 → 执行 流水线。
只在需要用户判断时暂停（灰色地带确认、阻塞问题、验证请求）。

这是 WF 系统的默认推荐入口。用户确认需求和路线图后，
系统自动推进每个阶段直到完成。
</purpose>

<flags>
- `--from N` — 从阶段 N 开始（而非第一个未完成阶段）。
- `--to N` — 执行到阶段 N 后停止。
- `--only N` — 只执行阶段 N。
- `--interactive` — 讨论阶段使用交互模式（逐个决策），规划和执行使用自动模式。
</flags>

<process>

<step name="discover_phases">
## 1. 发现待执行阶段

读取 `.planning/ROADMAP.md` 和 `.planning/STATE.md`：

```bash
# 获取阶段列表
cat .planning/ROADMAP.md
cat .planning/STATE.md
```

确定执行范围：
- 默认: 从第一个未完成阶段到最后一个阶段
- `--from N`: 从阶段 N 开始
- `--to N`: 到阶段 N 结束
- `--only N`: 只执行阶段 N

```
╔══════════════════════════════════════════╗
║  WF · 自主模式                           ║
╚══════════════════════════════════════════╝

执行范围: Phase {from} → Phase {to}
阶段列表:
  ⬜ Phase {N}: {{name}}
  ⬜ Phase {N+1}: {{name}}
  ...
```
</step>

<step name="phase_loop">
## 2. 阶段循环

对每个待执行阶段，按顺序执行：

### 2.1 讨论阶段

调用 discuss-phase 工作流，使用 `--auto --batch` 模式：

```
所有灰色地带自动分析，生成推荐方案表：

| # | 决策点 | 推荐 | 原因 |
|---|--------|------|------|
| 1 | ... | ... | ... |

确认以上 {N} 个决策？ [Y/n/逐个审查]
```

- 用户确认 → 继续
- 用户要求逐个审查 → 切换到交互模式讨论
- 如果 `--interactive`，直接使用交互模式

### 2.2 规划阶段

调用 plan-phase 工作流，包含：
- 实现研究（如果开启）
- 计划生成
- 质量检查（最多 3 次修订）
- 安全门禁（如果开启）

规划完成后自动继续，不暂停确认。

### 2.3 执行阶段

调用 execute-phase 工作流：
- wave 级并行执行
- 每个 wave 后自动检查
- 验证阶段目标

### 2.4 阶段完成

```
✅ Phase {N} 完成 ████████████████ 100%
   任务: {completed}/{total}
   验证: PASS

▶ 推进到 Phase {N+1}...
```

更新 STATE.md，继续下一阶段。
</step>

<step name="gap_closure">
## 3. Gap 修复

如果验证发现问题，自动进行一次 gap closure：

1. 分析验证失败项
2. 生成修复计划
3. 执行修复
4. 重新验证

如果第二次验证仍有问题 → 暂停，展示问题列表，请求用户决策。
最多 1 次自动重试，避免无限循环。
</step>

<step name="complete">
## 4. 全部完成

所有阶段执行完成后：

```
╔══════════════════════════════════════════╗
║  WF · 所有阶段执行完成                   ║
╚══════════════════════════════════════════╝

  Phase 1: ✅ {{name}}
  Phase 2: ✅ {{name}}
  Phase 3: ✅ {{name}}
  ...

  总任务: {{total_tasks}}
  总验证: {{total_verifications}} PASS

▶ 建议: /wf-verify-work 进行最终验收
```
</step>

</process>

<error_handling>
## 错误处理

1. **单个任务失败:** 记录错误，跳过该任务，继续执行。在阶段摘要中标记失败任务。
2. **整个计划失败:** 暂停当前阶段，展示错误信息，等待用户决策。
3. **验证失败:** 自动 gap closure（1 次）。如果仍然失败，暂停等待用户。
4. **Context 耗尽:** 保存当前状态到 STATE.md，提示用户在新会话中运行 `/wf-autonomous --from {current_phase}`。
</error_handling>

<success_criteria>
- [ ] 所有指定阶段执行完成
- [ ] 每个阶段的验证通过
- [ ] STATE.md 正确反映最终状态
- [ ] 所有变更已提交到 git
- [ ] 失败项已清晰报告
</success_criteria>
