# Settings Workflow

查看和修改 WF 工作流配置。支持交互式菜单和直接 CLI 两种模式。

## Step 1: 检测模式

检查 $ARGUMENTS 是否包含 "set" 关键字：

- 包含 "set": 跳到 Step 3（直接 CLI 模式）
- 无参数或其他: 执行 Step 2（交互式菜单模式）

## Step 2: 交互式菜单模式

### 2.1 获取 schema 和当前配置

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" settings schema
```

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" settings
```

### 2.2 按类别分组展示

将配置项按以下类别分组显示当前值：

| 类别 | 包含的键 |
|------|----------|
| 基本设置 | mode, granularity |
| 工作流行为 | workflow.research, workflow.plan_check, workflow.verifier, workflow.auto_advance, workflow.security_enforcement, workflow.discuss_mode, workflow.node_repair, workflow.node_repair_budget |
| 并行化 | parallelization.enabled, parallelization.plan_level, parallelization.max_concurrent_agents, parallelization.min_plans_for_parallel |
| 门禁 | gates.confirm_project, gates.confirm_phases, gates.confirm_roadmap, gates.confirm_plan, gates.confirm_transition |
| 安全 | safety.always_confirm_destructive, safety.always_confirm_external_services |
| Hook | hooks.context_warnings |
| Agent 模型 | agents.models.executor, agents.models.planner, agents.models.verifier, agents.models.researcher, agents.models.roadmapper |
| 规划 | planning.commit_docs |

用表格格式展示每个键的当前值和默认值。

**注意:** 不展示以 `_` 开头的内部键。schema 接口已自动过滤这些键。

### 2.3 询问用户选择

使用 AskUserQuestion 询问用户要修改哪个设置：

> 输入要修改的配置键名（如 `mode`），或输入 `done` 退出。

### 2.4 修改设置

当用户选择一个键后：

1. 显示该键的当前值和类型
2. 使用 AskUserQuestion 询问新值
3. 执行修改：

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" settings set <key> <value>
```

4. 显示修改结果
5. 回到 Step 2.3 继续（循环直到用户输入 `done`）

## Step 3: 直接 CLI 模式

从 $ARGUMENTS 中解析 `set <key> <value>` 参数。

执行修改：

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" settings set <key> <value>
```

显示结果。如果 key 不在 schema 中，CLI 会返回 `success: false` 并附带错误信息。

## 约束

- 只暴露 CONFIG_DEFAULTS 中定义的键（通过 schema 接口）
- 以 `_` 开头的内部状态键不显示、不可修改
- 所有写入操作仅修改 `.planning/config.json`，不修改 `wf/templates/config.json`
- 项目 config.json 中存在但不在 schema 中的未知键会被保留但不展示
