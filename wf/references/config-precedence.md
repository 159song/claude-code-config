# 配置优先级

## 概述

WF 系统有多层配置来源。当同一设置在多处定义时，按以下优先级从高到低生效：

## 优先级顺序

```
1. CLI 参数 (--from, --interactive 等)     ← 最高
2. .planning/config.json (项目级配置)
3. settings.json (全局 Claude Code 配置)
4. wf/templates/config.json (默认模板值)   ← 最低
```

### 1. CLI 参数

命令行标志在调用时传入，优先级最高。

| 来源 | 示例 |
|------|------|
| `/wf-autonomous --from 3 --to 5` | 覆盖 STATE.md 中的 current_phase |
| `/wf-discuss-phase 2 --auto` | 覆盖 config.json 中的 discuss mode |
| `/wf-execute-phase 1 --wave 2` | 指定从特定 wave 开始 |

### 2. .planning/config.json (项目级)

项目初始化时从模板生成，可由 `/wf-settings` 命令修改。

```json
{
  "mode": "guided",
  "gates": {
    "requirements_coverage": true,
    "plan_quality": true,
    "verification": true,
    "security": false
  },
  "parallelization": { "enabled": true, "max_agents": 3 },
  "hooks": { "context_warnings": true }
}
```

### 3. settings.json (全局配置)

项目级位于 `.claude/settings.json`（项目目录内），用户全局级位于 `~/.claude/settings.json`。定义 hook 绑定、权限、环境变量。

影响范围：hook 超时、权限模型、auto-compact 阈值等。

### 4. wf/templates/config.json (默认模板)

安装时的出厂默认值。只在项目未初始化或 .planning/config.json 缺失时兜底。

## 合并规则

- **替换，非合并:** 高优先级的值完整替换低优先级，不做深度合并
- **缺失回退:** 如果高优先级未定义某字段，使用下一层的值
- **CLI 标志一次性:** CLI 参数只在当次命令调用中生效，不持久化

## 常见冲突场景

| 冲突 | 结果 |
|------|------|
| `--from 3` vs config.json `current_phase: 1` | CLI 参数胜出，从 Phase 3 开始 |
| config.json `mode: auto` vs `--interactive` | CLI 参数胜出，使用交互模式 |
| config.json 无 `gates.security` 字段 | 回退到模板默认值 `false` |
| settings.json `context_warnings: true` vs config.json `context_warnings: false` | 项目级 config.json 胜出，禁用警告 |
