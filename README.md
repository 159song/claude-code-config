# WF — Claude Code 结构化工作流系统

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14-brightgreen.svg)](https://nodejs.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-hooks%20%7C%20agents%20%7C%20commands-7C3AED.svg)](https://claude.ai/code)
[![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)](VERSION)

---

## 安装

**一行远程安装**（推荐）：

```bash
# 项目级（默认）—— 装到当前项目的 .claude/
curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/install.sh | bash

# 用户级 —— 装到 $HOME/.claude/（全局可用）
curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/install.sh | bash -s -- --user

# 预览不写入
curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/install.sh | bash -s -- --dry-run
```

**本地 clone 后安装**：

```bash
git clone https://github.com/159song/claude-code-config.git
cd claude-code-config
./install.sh              # 项目级（默认）
./install.sh --user       # 用户级
./install.sh --dry-run    # 预览
./install.sh --uninstall  # 卸载
```

| Flag | 作用 |
|---|---|
| `--project` (默认) | 装到 `$(pwd)/.claude/`，作用于**当前项目** |
| `--user` | 装到 `$HOME/.claude/`，作用于**所有项目** |
| `--force` | 跳过版本检查，强制覆盖 |
| `--dry-run` | 打印计划但不写入任何文件 |
| `--uninstall` | 按当前 scope 卸载（保留用户自定义 settings 部分） |
| `--ref <branch>` | 远程安装时指定分支/tag（默认 `main`） |

---

## 升级

不需要 `git clone`，curl 一行即可拉最新代码并覆盖现有安装：

```bash
# 升级用户级（~/.claude/）
curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/wf/bin/upgrade.sh | bash

# 升级当前项目（cd 到目标项目根目录后执行）
cd /path/to/your/project
curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/wf/bin/upgrade.sh | bash -s -- --project

# 预览不写盘
curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/wf/bin/upgrade.sh | bash -s -- --dry-run

# 指定分支或 tag
curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/wf/bin/upgrade.sh | WF_REF=v1.1.0 bash
```

> 同一台机器同时有用户级和项目级安装时，两者要分别升级（用户级跑一次默认命令，每个项目目录里再跑一次 `--project`）。

---

## 验证

在 Claude Code 中打开任意项目，状态栏应显示：

```
WF │ opus │ idle │ ████████████████ 100%
```

---

## 开始一个项目

```
/wf-new-project
```

回答 5 个问题，WF 生成需求文档与分阶段路线图。然后：

```
/wf-autonomous
```

WF 自动链式执行每个阶段：讨论 → 规划 → 执行 → 验证。

---

## 命令参考

### 阶段流水线

| 命令 | 用途 |
|------|------|
| `/wf-discuss-phase N` | 识别歧义，记录决策 → `CONTEXT.md` |
| `/wf-plan-phase N` | 生成带质量门禁的任务分解 → `PLAN.md` |
| `/wf-execute-phase N` | 基于 Wave 的并行执行 → `SUMMARY.md` |
| `/wf-verify-work` | UAT + 4 级验证 → `VERIFICATION.md` |

### 自动化

| 命令 | 用途 |
|------|------|
| `/wf-autonomous` | 端到端执行所有剩余阶段（主入口） |
| `/wf-do "<描述>"` | 自然语言意图 → 最佳匹配命令 |
| `/wf-status --auto-advance` | 智能状态检测 → 自动路由到正确步骤 |
| `/wf-quick "<描述>"` | 阶段体系外的快速任务 |

### 项目生命周期

| 命令 | 用途 |
|------|------|
| `/wf-new-project` | 初始化项目（5 个问题 → 研究 → 需求 → 路线图） |
| `/wf-new-milestone` | 开始新里程碑，重置阶段 |
| `/wf-complete-milestone` | 归档到 `milestones/`，创建 git tag，重置状态 |

### 会话管理

| 命令 | 用途 |
|------|------|
| `/wf-pause` | 保存检查点（`HANDOFF.json`） |
| `/wf-resume` | 从检查点恢复 + 自动路由 |
| `/wf-status` | 进度面板 + 智能路由建议（"下一步"触发词下自动推进） |

### 工具

| 命令 | 用途 |
|------|------|
| `/wf-code-review <phase>` | 代码质量审查，带迭代修复循环 |
| `/wf-settings` | 查看/修改工作流配置 |

### 规格空间（Phase A）

把需求以"按 capability 拆分的 spec"形式组织在 `.planning/specs/<capability>/spec.md`。默认关闭，通过 `config.spec.enabled = true` 启用。

```bash
wf-tools spec list                   # 列出所有 capability
wf-tools spec show <capability>      # 查看某 capability 的结构化 spec
wf-tools spec validate [--all]       # 校验 Purpose/Requirement/Scenario 结构与 WHEN/THEN 完整性
```

启用后：
- `wf-roadmapper` 在生成 ROADMAP.md 时同步生成初始 `specs/<capability>/spec.md`
- `wf-verifier` 在 `spec.verifier_use_scenarios = true` 时追加基于 scenario 的反推验证

### 变更提议（Phase B）

`.planning/changes/<id>/` 承载独立的变更提议包，含 `proposal.md / tasks.md / specs/<cap>/spec.md delta`，归档时合并进主干 `specs/`。

Delta 语法（二级标题）：
- `## ADDED Requirements` — 新增 requirement（追加）
- `## MODIFIED Requirements` — 整块替换已存在的 requirement
- `## REMOVED Requirements` — 按 header 删除
- `## RENAMED Requirements` — 改名，body 可选替换

| 命令 | 用途 |
|------|------|
| `/wf-propose <idea>` | 委托 `wf-proposer` 产出完整 change 包 |
| `/wf-validate-spec <change-id\|--all>` | 校验 delta 语法 + 与主 spec 的语义一致性 |
| `/wf-apply-change <id>` | 基于 `tasks.md` 让 `wf-executor` 实现代码 |
| `/wf-archive-change <id> [--dry-run]` | delta 合并进 `specs/`，原目录移动到 `changes/archive/YYYY-MM-DD-<id>/` |

CLI 对应：`wf-tools change list/show/validate/archive`。Archive 采用 fail-fast：目标不存在、ADDED 重名、RENAMED 冲突均拒绝写入主 spec。

### 深度整合（Phase C）

- `/wf-new-project` 在 `spec.enabled = true` 时同步生成初始 `specs/<capability>/spec.md`
- `/wf-new-milestone` reset 时**保留** specs/ 和活跃 changes/（规格跨里程碑存活）
- `/wf-complete-milestone` 的归档同时捕获 `specs/`（主干快照）和 `changes/archive/`（历史变更），存在活跃 change 时以 warning 提示
- `/wf-quick --spec <任务>` 走规格级短链路：propose → validate → apply → archive，绕过 PLAN.md
- `wf-prompt-guard` 自动覆盖 `specs/` 和 `changes/`（路径前缀匹配 `.planning/`）

### 进阶能力（Phase D）

| 能力 | 命令 |
|---|---|
| 变更可视化预览 | `wf-tools change diff <id> [--json]` 展示 apply 前后主 spec 的行级 unified diff |
| 稳定 requirement ID | 在 requirement body 加 `<!-- req-id: STABLE-ID -->`；MODIFIED/REMOVED/RENAMED 按 id 优先匹配；RENAMED 支持 `- From: @id:<id>` |
| 反向追踪 | `wf-tools spec coverage <FR-N\|requirement\|capability\|id>` 扫 REQUIREMENTS/specs/phase/changes/git log，返回结构化 traces |

### Skill 触发策略

| 触发策略 | skill 数量 | 代表 | 行为 |
|---|---|---|---|
| 广义自动触发 | 12 | `wf-status` / `wf-quick` / `wf-git-conventions` / `wf-code-review` / `wf-verify-work` / `wf-propose` / `wf-apply-change` / `wf-validate-spec` / `wf-troubleshooting` / `wf-anti-patterns` / `wf-4-level-verification` / `wf-next` | Claude 读 description 语义匹配后主动调用 |
| 文案约束触发 | 12 | `wf-new-project` / `wf-discuss-phase` / `wf-plan-phase` / `wf-execute-phase` / `wf-autonomous` / `wf-complete-milestone` / `wf-archive-change` / `wf-new-milestone` / `wf-do` / `wf-pause` / `wf-resume` / `wf-settings` | description 中声明"Invoke only when user explicitly runs /wf-... or dispatcher routes"——AI 自律 + 允许 `wf-do` / `wf-autonomous` 通过 `Skill()` 路由调用 |
| `user-invocable: false` | 2 | `wf-gates` / `wf-worktree-lifecycle` | 后台知识，Claude 决策时参考，不出现在 `/` 菜单 |

`wf-code-review` 用 `context: fork + agent: general-purpose`，在 forked subagent 中执行审查，保护主 session context。

> 设计取舍：第二组未使用 `disable-model-invocation: true` 硬开关——此开关会让 `wf-do` / `wf-autonomous` dispatcher 通过 `Skill()` 转发时被运行时拒绝（"cannot be used with Skill tool due to disable-model-invocation"），破坏端到端自动化链路。改为文案约束后，AI 在 description 自律下不会自动触发，dispatcher 链路保持畅通。

---

## 配置

工作流行为由各项目中的 `.planning/config.json` 控制：

```json
{
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_plan": false,
    "confirm_transition": false
  },
  "milestone": {
    "auto_archive_on_complete": false,
    "auto_new_milestone": false
  },
  "parallelization": {
    "enabled": true
  },
  "security_enforcement": false
}
```

#### 里程碑自动化

| 配置项 | 默认 | 说明 |
|--------|------|------|
| `milestone.auto_archive_on_complete` | `false` | autonomous 模式完成所有阶段后，自动执行 `/wf-complete-milestone` |
| `milestone.auto_new_milestone` | `false` | 里程碑归档完成后，跳过确认直接启动 `/wf-new-milestone` |

两者均开启时实现全自动链路：执行完所有阶段 → 归档里程碑 → 创建新里程碑。

通过命令管理：

```
/wf-settings set gates.confirm_plan true
```

或交互式操作：

```
/wf-settings
```

---

## Settings 合并策略

安装器绝不会覆盖你现有的 `settings.json`，使用智能合并：

| 区域 | 策略 |
|------|------|
| `hooks` | 按 `wf-` 前缀匹配；WF Hook 更新，你的自定义 Hook 保留 |
| `statusLine` | 仅当是 WF statusLine 时才替换 |
| `permissions` | 取并集（去重） |
| `env` | 源提供默认值；你的值如已设置则优先 |
| 其他 | 你的配置保留；WF 填补空缺 |

---

## Git 规范

commit 格式、scope、worktree、push 等约定见 [`wf/references/git-conventions.md`](wf/references/git-conventions.md)。

---

## 更新历史

完整版本历史见 [CHANGELOG.md](CHANGELOG.md)。

---

## 许可证

[Apache License 2.0](LICENSE)
