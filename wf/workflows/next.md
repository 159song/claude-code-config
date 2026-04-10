# Auto-Advance Workflow

自动检测项目状态并推进到下一步。/wf-next 的核心价值是"自动检测"（per D-12），用户明确知道目标时应直接调用具体命令。

## 执行流程

### Step 1: 检查项目是否存在

读取 .planning/ 目录是否存在。如果不存在：

> 没有检测到项目。运行 `/wf-new-project` 初始化。

终止流程。

### Step 2: 检查是否有未恢复的暂停检查点

检查 `.planning/HANDOFF.json` 是否存在：

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" session status
```

如果 `has_handoff` 为 true：

> 检测到暂停检查点，建议先运行 `/wf-resume` 恢复中断的工作。

显示检查点摘要后终止。优先恢复而非推进新步骤。

### Step 3: 分析路线图确定当前阶段

运行路线图分析：

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" roadmap analyze
```

从结果中提取 `current_phase`（第一个非 verified 的阶段，per D-11）。

如果所有阶段都是 verified（`current_phase` 为 null）：

> 所有阶段已完成！里程碑可以收尾。运行 `/wf-progress` 查看详情。

终止流程。

### Step 4: 检测当前阶段的步骤状态（per D-09）

使用 init phase-op 获取阶段详情：

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" init phase-op <current_phase>
```

根据返回字段判断下一步骤（per D-09 完整生命周期链）：

| 条件 | 下一步 | 路由命令 |
|------|--------|----------|
| `has_context` = false | discuss | `/wf-discuss-phase <N>` |
| `has_plans` = false | plan | `/wf-plan-phase <N>` |
| 存在 PLAN 但无 SUMMARY | execute | `/wf-execute-phase <N>` |
| 存在 SUMMARY 但 `has_verification` = false | verify | `/wf-verify-work` |
| `has_verification` = true 但未通过 | verify (重新) | `/wf-verify-work` |

判断"存在 SUMMARY"的方法：读取阶段目录文件列表，检查是否有包含 "SUMMARY" 的文件名。

判断"验证未通过"：读取 VERIFICATION 文件内容，检查是否包含 "FAIL"。

### Step 5: 显示检测结果并自动执行（per D-10）

向用户显示检测到的状态：

> **自动推进:** 阶段 {N} ({phase_name})
> **检测步骤:** {next_step}
> **执行命令:** {route_command}

然后直接调用对应的 Skill()（per D-10 薄包装，复用现有工作流）：

- discuss: `Skill(discuss-phase, { phase: N })`
- plan: `Skill(plan-phase, { phase: N })`
- execute: `Skill(execute-phase, { phase: N })`
- verify: `Skill(verify-work)`

不等待用户确认，直接执行（per D-12 不支持 flag 覆盖检测）。

## 边界情况

- **无 ROADMAP.md**: 提示 "没有路线图，运行 `/wf-new-project` 创建项目。"
- **ROADMAP.md 存在但无阶段**: 提示 "路线图为空，运行 `/wf-new-project` 定义需求和阶段。"
- **多个未完成阶段**: 选择编号最小的（per D-11），roadmap analyze 的 `current_phase` 已实现此逻辑。

## 安全约束

路由目标限定为 4 个已知值（discuss/plan/execute/verify），不执行任意命令。（T-04-10 mitigation）
