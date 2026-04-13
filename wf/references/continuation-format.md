# 会话续接格式

## 概述

WF 工作流支持跨会话续接。当 context 不足或用户主动暂停时，系统将当前状态持久化到文件，新会话可以从断点恢复。续接机制由两个文件协同工作：机器可读的 `HANDOFF.json` 和人类可读的 `.continue-here.md`。

## HANDOFF.json 格式

存储位置：`.planning/HANDOFF.json`

HANDOFF.json 使用最小字段集（恰好 7 个字段），避免字段膨胀：

```json
{
  "phase": 3,
  "plan": 2,
  "step": "execute",
  "stopped_at": "Task 2 of 3 completed, paused due to context budget",
  "resume_command": "/wf-resume",
  "git_branch": "main",
  "timestamp": "2026-04-10T08:30:00.000Z"
}
```

### 字段说明

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| phase | number | 是 | 当前阶段编号（正整数） |
| plan | number\|null | 否 | 当前计划编号（无计划时为 null） |
| step | string | 是 | 工作流步骤（白名单限制） |
| stopped_at | string | 否 | 人类可读的暂停描述 |
| resume_command | string | 是 | 恢复命令（固定为 `/wf-resume`） |
| git_branch | string | 是 | 暂停时的 git 分支名 |
| timestamp | string | 是 | ISO 8601 格式时间戳 |

**不要添加额外字段**（如 `context_used`、`duration`、`tasks_done`）。额外信息记录在 STATE.md 中。

## .continue-here.md 格式

存储位置：项目根目录 `.continue-here.md`

人类可读的续接提示文件，新会话启动时 Claude 会自动发现并读取：

```markdown
# Continue Here

**Paused:** 2026-04-10T08:30:00.000Z
**Phase:** 3
**Step:** execute
**Status:** Task 2 of 3 completed, paused due to context budget

## Resume

\`\`\`
/wf-resume
\`\`\`
```

此文件由 `session.cjs` 的 `generateContinueHere()` 函数自动生成，无需手动编辑。

## 恢复流程

当用户在新会话中执行 `/wf-resume` 时：

1. **读取 HANDOFF.json** — 通过 `wf-tools session resume` 命令读取并解析
2. **验证字段** — 检查 `step` 在白名单内、`phase` 为正整数
3. **验证 git 分支** — 确认当前分支与 `git_branch` 一致（不一致时警告）
4. **路由到对应步骤** — 根据 `step` 值路由：
   - `discuss` → 继续讨论阶段
   - `plan` → 继续规划阶段
   - `execute` → 从 `plan` 编号处继续执行
   - `verify` → 继续验证阶段
5. **清理文件** — 恢复成功后删除 `.planning/HANDOFF.json` 和 `.continue-here.md`

## 自治模式续接

自治模式（`/wf-autonomous`）在以下情况自动生成 HANDOFF：

- **Context 不足:** 剩余 < 25% 时暂停并保存
- **阶段完成:** 当前阶段验证通过，但 context 不足以开始下一阶段
- **执行失败:** Gap closure 后仍然失败，保存状态等待用户介入

恢复时使用 `--from N` 参数指定起始阶段：

```bash
/wf-autonomous --from 3
```

系统会读取 HANDOFF.json 确认阶段一致性，然后从指定阶段继续。

## 安全约束

### Step 白名单

`step` 字段仅接受以下值：

- `discuss` — 讨论阶段
- `plan` — 规划阶段
- `execute` — 执行阶段
- `verify` — 验证阶段

不在白名单内的值会被 `session.cjs` 拒绝，防止恢复到无效状态。

### Phase 验证

`phase` 必须是正整数。非整数值（如字符串、浮点数、负数）会被拒绝。

### Handoff 文件清理

恢复成功后，HANDOFF.json 和 .continue-here.md **必须被删除**。残留的 handoff 文件会导致后续会话误认为存在未完成的恢复，触发不必要的恢复流程。

`wf-tools session resume` 命令在输出 handoff 内容后自动执行清理。不要手动读取后忘记清理。

## 创建和消费

| 操作 | 命令 / 函数 |
|------|-------------|
| 创建暂停点 | `wf-tools session pause --phase N --step S` |
| 读取并清理 | `wf-tools session resume` |
| 检查状态（不清理） | `wf-tools session status` |
| 程序化创建 | `session.cjs::createHandoff(cwd, options)` |
| 程序化读取 | `session.cjs::readHandoff(cwd)` |
| 程序化清理 | `session.cjs::deleteHandoff(cwd)` |
