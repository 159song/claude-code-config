# WF Flag Cheatsheet

> 9 个 workflow × 16 个 flag 的统一心智表。配合 `ARCHITECTURE.md` 使用。

## 一图看懂

| Flag | 归属 workflow | 解决什么问题 | 可组合 | 互斥 | 典型用法 |
|---|---|---|---|---|---|
| `--auto` | new-project, discuss-phase | 无人值守，默认推荐选项 | `--chain` `--batch` | – | `/wf-new-project --auto` |
| `--chain` | discuss-phase, plan-phase, execute-phase | 完成后自动调用下一 step | `--auto` `--skip-research` | – | `/wf-plan-phase 2 --chain` |
| `--batch` | discuss-phase | 把决策点汇总成一张表，一次确认 | `--auto` | – | `/wf-discuss-phase 1 --auto --batch` |
| `--skip-research` | plan-phase | 跳过调研，直接规划 | `--chain` | – | 已有类似 PLAN 模板 |
| `--wave N` | execute-phase | 只执行指定 wave | – | `--interactive` | 分批执行或配额紧时 |
| `--interactive` | execute-phase, autonomous | 每 task/step 暂停确认 | – | `--wave` | 半自动模式 |
| `--smoke` | verify-work | 冷启动跑冒烟后再对话 | – | – | autonomous 调用默认加 |
| `--from N` | autonomous | 从阶段 N 开始 | `--to` `--interactive` | `--only` | 断点续跑 |
| `--to N` | autonomous | 执行到阶段 N 停止 | `--from` `--interactive` | `--only` | 限定范围 |
| `--only N` | autonomous | 只执行阶段 N | `--interactive` | `--from` `--to` | 单阶段自动 |
| `--summary` | status | 渲染当前/指定 phase 的任务级 diff 摘要 | – | `--auto-advance` | `/wf-status --summary` 或 `--summary 2` |
| `--auto-advance` | status | 识别到"下一步"意图时自动推进 | – | `--summary` | `/wf-status --auto-advance` |
| `--full` | quick | 研究 + 规划 + 执行 + 验证 | – | `--spec` `--validate` `--discuss` `--research` | 复杂小任务 |
| `--validate` | quick | 执行后验证 | – | `--full` `--spec` | 改完立即确认 |
| `--discuss` | quick | 先讨论再执行 | `--research` | `--full` `--spec` | 决策前 |
| `--research` | quick | 先研究再执行 | `--discuss` | `--full` `--spec` | 需要调研时 |
| `--spec` | quick | 走 propose → validate → apply → archive 短链 | – | `--full` `--validate` `--discuss` `--research` | 有 spec 的增量变更 |

## 按目的分组

### 🚀 降低交互（无人值守）
- `--auto`：自动选默认推荐（new-project / discuss-phase）
- `--batch`：决策批量汇总（discuss-phase）
- `--smoke`：跳过对话式 UAT（verify-work）

### 🔗 流程链式
- `--chain`：完成自动跳下一 step（discuss / plan / execute）
- `autonomous` 自身循环替代 verify-work 的 --chain

### 🎯 范围限定
- `--wave N`：只执行一个 wave（execute-phase）
- `--from N / --to N / --only N`：限定阶段范围（autonomous）

### ⏸ 增加控制
- `--interactive`：每 task/step 暂停确认（execute-phase, autonomous）
- `--skip-research`：跳过调研（plan-phase）

### 🏃 短链路
- `--full`：quick 走完整流水线（反常规）
- `--spec`：quick 走规格级短链（propose → apply）

## 常见组合

| 场景 | 组合 |
|---|---|
| 新项目一把梭 | `/wf-new-project --auto` + `/wf-autonomous` |
| 阶段内手动推进 | `/wf-discuss-phase N --chain` → 触发 plan + execute + verify |
| 只跑一个阶段验证 | `/wf-autonomous --only N` |
| 断点续跑从 3 开始 | `/wf-autonomous --from 3` |
| 分批执行大阶段 | `/wf-execute-phase N --wave 1` → 人工检查 → `--wave 2` |
| Spec 小变更 | `/wf-quick "add field X" --spec` |
| 规划但不研究 | `/wf-plan-phase 2 --skip-research --chain` |

## 互斥与优先级说明

1. **`--full` 与 `--spec` / `--validate` / `--discuss` / `--research` 互斥**（quick）
2. **`--only N` 与 `--from/--to` 互斥**（autonomous）
3. **`--wave` 与 `--interactive` 互斥**（execute-phase）
4. `autonomous` 模式下调用 `verify-work` 时**强制加 `--smoke`**，禁止对话循环
5. `autonomous` 未传 `--interactive` 时，discuss-phase 自动 `--auto --batch`
6. **（P1）`autonomous` 调 `plan-phase` 默认附加 `--skip-research`**，由 `config.workflow.research_in_autonomous=true` 取消
7. **（P1）`autonomous` Phase 1 冷启动**（PROJECT.md < 1h、无 CONTEXT.md、未传 `--interactive`）跳过 discuss-phase，由 `config.workflow.phase1_cold_start_window_sec` 调窗
8. **（P1）`autonomous` 调 `verify-work --smoke`** 在 10 分钟内命中 VERIFICATION.md PASS 时跳过 build/test，由 `config.workflow.verification_reuse_window_sec` 调窗

## 无 flag 约定

以下 workflow 无可调 flag（设计即默认）：
- `/wf-do`（纯路由）
- `/wf-pause` / `/wf-resume`（无参数）
- `/wf-complete-milestone` / `/wf-new-milestone` / `/wf-archive-change`（原子动作）
- `/wf-propose` / `/wf-apply-change` / `/wf-validate-spec`（change 生命周期）

## 如何新增 flag

1. 先问：这个 flag 解决的问题在表里**已有 flag 能覆盖吗**？能则复用
2. 若新增，必须：
   - 在本 cheatsheet 添加一行
   - 在对应 workflow 的 `<flags>` 块声明
   - 在 `ARCHITECTURE.md` 的变更日志记录
3. 避免：给同一 workflow 加第 3 个 flag 时要警觉——考虑拆分 workflow 而非堆 flag
