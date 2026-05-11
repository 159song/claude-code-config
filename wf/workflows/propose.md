# 工作流：变更提议（Propose Change）

> 用途：把"我要改什么"一次性转化为可审阅、可 diff、可 apply 的 change 包
> 输入：用户的自然语言 idea + 现有 `.planning/specs/` 主干规格
> 产出：`.planning/changes/<change-id>/{proposal.md, tasks.md, specs/<cap>/spec.md, design.md?}`

## 前置条件

- `.planning/` 已初始化（存在 PROJECT.md）
- `.planning/config.json` 的 `spec.enabled = true`（Phase A 的规格空间已启用）
  若未启用，提示用户先 `/wf-settings set spec.enabled true`

## 步骤

### Step 1：解析输入

用户调用形式：`/wf-propose <idea>` 或 `/wf-propose <change-id> "<idea>"`

- 若只给了 idea，由当前 orchestrator 推断一个 kebab-case 的 `change_id`
  （推荐前缀：`add-` / `migrate-` / `refactor-` / `remove-` / `fix-`）
- 校验 `change_id` 匹配 `^[a-z][a-z0-9-]*$` 且不是 `archive`
- 若 `.planning/changes/<change_id>/` 已存在，提示冲突，要求换名

### Step 2：读取 specs 快照

```bash
node $HOME/.claude/wf/bin/wf-tools.cjs spec list --json
```

对结果中每个 capability，若与 idea 相关，`wf-tools spec show <cap>` 读结构化内容。
把快照作为 `specs_snapshot` 参数传给 proposer。

### Step 3：委托 `wf-proposer`

调用 Agent：

```
Agent({
  subagent_type: "wf-proposer",
  description: "Propose change: <change-id>",
  prompt: "<idea>\n\nchange_id: <change-id>\nspecs_snapshot: <list>\nconfig: <json>"
})
```

proposer 返回 completion marker（标准 JSON，见 agent-contracts.md）。

### Step 4：自动 validate

```bash
node $HOME/.claude/wf/bin/wf-tools.cjs change validate <change-id>
```

- 若 `valid: true`：展示 change 摘要（proposal 首 5 行 + 每个 delta 的 added/modified/removed/renamed 计数）
- 若 `valid: false`：把 `issues` 列给用户，引导：
  - 让 proposer 重跑（最多 1 次），或
  - 由用户手改 delta 后再 `/wf-validate-spec <change-id>`

### Step 5：展示 next action

生成摘要表格：

```
下一步选择：
  /wf-apply-change <change-id>      # 基于 tasks.md 让 executor 实现代码
  /wf-archive-change <change-id>    # 直接 archive（delta 合并入主 specs/）
  /wf-validate-spec <change-id>     # 手改后重新校验
```

## 与现有 phase 流程的关系

- change 是**规格层**的变更提议，与**阶段层**的 PLAN/SUMMARY 正交
- 一个 change 的 tasks.md 被 `/wf-apply-change` 转化为实现 —— 可以映射到一个已有 phase，也可以单独执行
- 不要在同一个 change 里混入多个无关变更；拆成多个 change 方便并发审阅

## 反模式

- 把实现代码塞进 delta spec —— delta 描述**行为**，不描述**实现**
- 同一个 requirement 既在 ADDED 又在 MODIFIED（validate 会报 error）
- change_id 用大写/下划线/中文（违反 kebab-case 约定）
- 在 `spec.enabled = false` 时强行运行 propose（规格空间未启用，后续 validate/archive 会失败）
