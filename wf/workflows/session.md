# Session Management Workflow

管理工作暂停、恢复和检查点。

## 暂停流程

当用户调用 `/wf-pause` 时执行：

### Step 1: 检测当前状态

1. 运行 CLI 获取当前状态：
   ```bash
   node "$HOME/.claude/wf/bin/wf-tools.cjs" state json
   ```
2. 从 STATE.md 读取 `status`, `stopped_at` 等字段。
3. 运行 roadmap analyze 确定当前阶段：
   ```bash
   node "$HOME/.claude/wf/bin/wf-tools.cjs" roadmap analyze
   ```
4. 从 roadmap 结果中找到 `current_phase`（第一个非 verified 阶段）。
5. 运行 init phase-op 检测当前步骤：
   ```bash
   node "$HOME/.claude/wf/bin/wf-tools.cjs" init phase-op <phase_num>
   ```
6. 根据 phase-op 结果推断 step：
   - `has_verification` = true -> step = 'verify'
   - `has_plans` = true 且存在 SUMMARY 文件 -> step = 'execute'
   - `has_plans` = true -> step = 'plan' (规划完成，待执行)
   - `has_context` = true -> step = 'discuss' (讨论完成，待规划)
   - 否则 -> step = 'discuss'

### Step 2: 写入检查点

运行 CLI 保存 HANDOFF.json（per D-01, D-02, D-04）：
```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" session pause \
  --phase <phase_num> \
  --plan <current_plan_or_0> \
  --step <detected_step> \
  --stopped_at "<当前任务描述>"
```

### Step 3: 确认暂停

向用户显示确认信息：
- 显示保存的检查点摘要
- 显示 `.continue-here.md` 位置
- 提示用户可在新会话中运行 `/wf-resume` 恢复

---

## 恢复流程

当用户调用 `/wf-resume` 时执行：

### Step 1: 读取检查点

1. 运行 CLI 检查是否存在 HANDOFF.json：
   ```bash
   node "$HOME/.claude/wf/bin/wf-tools.cjs" session status
   ```
2. 如果 `has_handoff` 为 false，告知用户没有检查点可恢复，建议运行 `/wf-status --auto-advance`。

### Step 2: 分支检查（per D-06）

1. 读取 HANDOFF.json 的 `git_branch` 字段。
2. 获取当前分支：
   ```bash
   git rev-parse --abbrev-ref HEAD
   ```
3. 如果不一致，显示警告但不阻止：
   > 警告: 暂停时在分支 `{saved_branch}`，当前在 `{current_branch}`。继续恢复。

### Step 3: 显示摘要并恢复（per D-07, D-08）

1. 显示恢复摘要：
   - 暂停时间: `{timestamp}`（距今 N 小时/天）
   - 阶段: Phase {phase}
   - 步骤: {step}
   - 状态: {stopped_at}

2. 根据 `step` 字段路由到对应工作流（per D-05）：

   **step 值必须在白名单 `['discuss', 'plan', 'execute', 'verify']` 内（T-04-05）。**
   **phase 值必须为正整数（T-04-06）。**

   - `step = 'discuss'` -> 调用 `Skill(discuss-phase, { phase })`
   - `step = 'plan'` -> 调用 `Skill(plan-phase, { phase })`
   - `step = 'execute'` -> 调用 `Skill(execute-phase, { phase })`
   - `step = 'verify'` -> 调用 `Skill(verify-work)`

3. 自动执行推荐操作，不等待用户确认（per D-07）。

### Step 4: 清理检查点

恢复成功后，运行 CLI 删除 HANDOFF.json 和 .continue-here.md：
```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" session resume
```

这会读取 HANDOFF.json、返回其内容、然后删除两个文件。
