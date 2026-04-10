# Phase 1: CLI Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 01-cli-foundation
**Areas discussed:** 模块拆分策略, 路径解析方案, 复合 init 输出设计, 项目根目录发现

---

## 模块拆分策略

### Q1: 模块拆分按什么维度？

| Option | Description | Selected |
|--------|-------------|----------|
| 按功能域拆分 | lib/state.cjs, lib/roadmap.cjs, lib/phase.cjs 等，每个模块对应一个业务域，主文件只做路由 | ✓ |
| 按命令拆分 | lib/cmd-state.cjs, lib/cmd-roadmap.cjs 等，每个顶层命令一个文件，内部自包含 | |
| 混合方案 | 底层工具按域拆分，顶层命令组合多个域的逻辑时单独建文件 | |

**User's choice:** 按功能域拆分
**Notes:** 选择了预览中展示的 8 模块结构：utils, state, roadmap, phase, progress, git, init, config

### Q2: 拆分后的模块是否应该可以被外部工具复用（exports）？

| Option | Description | Selected |
|--------|-------------|----------|
| 是，每个模块 export | module.exports 导出函数，hook 脚本和未来工具可以 require() 复用 | ✓ |
| 否，保持内部用 | 模块只被 wf-tools.cjs 主文件 require，不对外暴露 API | |

**User's choice:** 是，每个模块 export
**Notes:** 为 Phase 2 (State Safety) 的 CLI 命令打基础

---

## 路径解析方案

### Q1: {{WF_ROOT}} 占位符应该怎么解决？

| Option | Description | Selected |
|--------|-------------|----------|
| $HOME 绝对路径 | 像 GSD 一样用 $HOME/.claude/wf/ 硬编码。简单可靠，@ 引用能直接解析 | ✓ |
| 运行时检测+缓存 | wf-tools.cjs 启动时自动检测安装位置。更灵活但 @ 引用是静态解析的，实际不可行 | |
| 安装脚本替换 | install.sh 用 sed 把 {{WF_ROOT}} 替换为实际路径。单次执行但每次更新需重装 | |

**User's choice:** $HOME 绝对路径
**Notes:** 与 GSD 的 $HOME/.claude/get-shit-done/ 模式一致

### Q2: WF 的安装位置是否固定为 $HOME/.claude/wf/？

| Option | Description | Selected |
|--------|-------------|----------|
| 固定 $HOME/.claude/wf/ | 所有路径确定性最高，不需要检测逻辑 | ✓ |
| 可配置但有默认值 | 默认 $HOME/.claude/wf/，支持通过环境变量或配置文件覆盖 | |

**User's choice:** 固定 $HOME/.claude/wf/
**Notes:** None

---

## 复合 init 输出设计

### Q1: 复合 init 应该支持哪些模式？

| Option | Description | Selected |
|--------|-------------|----------|
| 统一 init + 子模式 | init phase-op N、init new-project、init quick 等，通用基础字段 + 模式特有字段 | ✓ |
| 单一 init 返回全部 | 一个 init 命令返回所有信息，不区分子模式。JSON 会很大 | |

**User's choice:** 统一 init + 子模式
**Notes:** phase-op 模式的字段参考 GSD 的 init phase-op 输出

### Q2: init 输出是否应该包含 response_language 字段？

| Option | Description | Selected |
|--------|-------------|----------|
| 是，包含 response_language | 从配置中读取语言偏好，工作流据此决定交互语言 | ✓ |
| 不需要，固定中文 | 项目约束已明确保持中文 | |

**User's choice:** 是，包含 response_language
**Notes:** 为未来多语言支持留口子

---

## 项目根目录发现

### Q1: findProjectRoot 应该查找什么标记来确定项目根目录？

| Option | Description | Selected |
|--------|-------------|----------|
| 向上查找 .planning/ | 从 cwd 向上遍历，找到第一个包含 .planning/ 的父目录 | ✓ |
| 查找 .planning/ 或 .git | 先找 .planning/，找不到则回退到 .git 根目录 | |
| 只用 --cwd 显式指定 | 不自动查找，必须通过参数指定 | |

**User's choice:** 向上查找 .planning/
**Notes:** .planning/ 是 WF 的唯一标识

### Q2: 找不到项目根目录时的行为？

| Option | Description | Selected |
|--------|-------------|----------|
| 回退到 cwd | 找不到就用当前目录作为项目根，对新项目友好 | ✓ |
| 报错退出 | 找不到就报错，要求用户先初始化或指定 --cwd | |

**User's choice:** 回退到 cwd
**Notes:** None

---

## Claude's Discretion

- 各模块的具体内部 API 签名设计
- 错误处理的具体策略
- init 子模式的具体字段扩展
- findProjectRoot 向上查找的最大层数限制

## Deferred Ideas

None — discussion stayed within phase scope
