# 共享模式参考

> 工作流和 agent 共用的核心模式定义。避免在多个文件中重复描述。

## Wave 执行模型

Wave 是任务分组的执行单元：

- **Wave 内并行:** 同一 wave 内的任务/计划无互相依赖，可通过 worktree 隔离并行执行
- **Wave 间串行:** 后续 wave 依赖前面 wave 的产出，必须按顺序执行
- **文件不冲突:** 同一 wave 内的任务不应修改相同文件
- **原子性:** 每个任务完成后系统应处于可用状态

### 并行条件

满足以下全部条件时启用并行执行，否则回退为串行：

1. `config.parallelization.enabled === true`
2. wave 内计划数 >= `config.parallelization.min_plans_for_parallel`
3. 计划之间无文件冲突

### 恢复检测

检查 `.planning/phase-{N}/` 下是否存在包含 `PARTIAL` 标记的 SUMMARY 文件。
如果存在，将其路径作为 `resume_from` 传递给 executor，跳过已完成任务。

## 完成标记格式

所有 agent 返回统一的 3 字段 JSON 完成标记（status / artifacts / summary）。规范定义见 [agent-contracts.md](./agent-contracts.md#完成标记格式（Single-Source-of-Truth）)。

## Context 预算检查

### 数据源

读取 `/tmp/claude-ctx-{session_id}.json` 中的 `used_pct` 字段。
文件不存在或 timestamp 超过 60 秒（过期数据）时跳过本次检查。

### 阈值与行为

| used_pct | 行为 |
|----------|------|
| < 70% | 正常继续 |
| 70-80% | 继续执行，记录警告 |
| >= 80% | 生成 partial 产出，输出 status `"partial"`，停止 |

### 检查时机

- **Executor:** 在任务之间检查，不在任务中途检查（避免打断原子操作）
- **Autonomous:** 在每个阶段开始前检查，写入 CONTINUATION.md 检查点后继续

## 状态路由

工作流 orchestrator 根据 agent 返回的 `status` 字段决定下一步：

| Status | 路由行为 |
|--------|----------|
| `"complete"` | 继续下一步骤/阶段 |
| `"partial"` | 记录部分状态和恢复点，通知用户可通过 `--wave` 或 `--from` 参数继续 |
| `"failed"` | 带错误信息重试一次；再次失败则停止执行，报告用户 |

### 重试规则

- 最多重试 **1 次**
- 重试 prompt 包含原始任务 + 上次失败的 `summary`
- 第二次失败 = 停止，不允许无限重试循环
- Gap closure 每阶段最多 1 次自动重试
