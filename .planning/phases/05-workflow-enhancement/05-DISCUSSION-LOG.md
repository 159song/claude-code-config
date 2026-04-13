# Phase 5: Workflow Enhancement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 05-workflow-enhancement
**Areas discussed:** 自治工作流重写, 阶段动态操作, 配置管理, Prompt Guard 优化

---

## 自治工作流重写 (WF-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Skill() 链式调用 | 复用 Phase 4 模式，每个阶段通过 Skill() 顺序调用 | ✓ |
| 内联逻辑 | autonomous.md 内部直接编排每个步骤 | |
| 你来决定 | Claude 根据代码库现状选择 | |

**User's choice:** Skill() 链式调用
**Notes:** 复用 discuss-phase --auto 和 auto_advance 已有机制

| Option | Description | Selected |
|--------|-------------|----------|
| 单次重试+暂停 | 失败时自动重试一次，仍失败则暂停报告 | ✓ |
| 跳过+继续 | 标记失败阶段，跳到下一阶段继续 | |
| 立即停止 | 任何失败立即终止整个流程 | |

**User's choice:** 单次重试+暂停

| Option | Description | Selected |
|--------|-------------|----------|
| 全自动 --auto | 灰色地带用推荐默认值自动处理 | ✓ |
| 批量确认 | 生成决策表后要求用户一次性确认 | |
| 始终交互 | discuss 阶段始终采用完整交互模式 | |

**User's choice:** 全自动 --auto
**Notes:** 用户可通过 --interactive 回退

---

## 阶段动态操作 (WF-02)

| Option | Description | Selected |
|--------|-------------|----------|
| 十进制编号 | 插入用十进制（如 2.5），不重命名现有目录 | ✓ |
| 全部重编号 | 插入后所有后续目录物理重命名 | |
| 你来决定 | Claude 根据风险评估选择 | |

**User's choice:** 十进制编号
**Notes:** ROADMAP 已支持此模式，安全且不影响 git 历史

| Option | Description | Selected |
|--------|-------------|----------|
| 仅标记 ROADMAP | 只从 ROADMAP 移除条目，保留磁盘目录 | |
| 移动到归档 | 将目录移到 .planning/archive/ | |
| 物理删除 | 彻底删除阶段目录和所有文件 | |

**User's choice:** 标记 ROADMAP 后移动归档
**Notes:** 用户选择组合方案：先从 ROADMAP 标记移除，然后将目录移动到归档

---

## 配置管理 (WF-03)

| Option | Description | Selected |
|--------|-------------|----------|
| AskUserQuestion 菜单 | 交互式菜单浏览和修改配置 | ✓ |
| 纯 CLI get/set | /wf-settings show + set key value | ✓ |
| 你来决定 | Claude 根据使用场景选择 | |

**User's choice:** 两种方式都支持
**Notes:** 无参数时 AskUserQuestion 交互，也支持 `set key value` 直接操作

| Option | Description | Selected |
|--------|-------------|----------|
| 工作流行为类 | 暴露 mode, granularity, parallelization 等 | ✓ |
| 全部配置 | 暴露所有 key 包括内部状态 | |
| 你来决定 | Claude 决定可见范围 | |

**User's choice:** 工作流行为类

---

## Prompt Guard 优化 (WF-04/WF-05)

| Option | Description | Selected |
|--------|-------------|----------|
| 负向前瞻 + 白名单 | regex 加负向前瞻 + 文件后缀白名单 | ✓ |
| 纯白名单 | 维护合法内容模式白名单 | |
| 你来决定 | Claude 根据误报场景分析设计 | |

**User's choice:** 负向前瞻 + 白名单

| Option | Description | Selected |
|--------|-------------|----------|
| 实用主义 | 每个文档 50-150 行，聚焦实际使用 | ✓ |
| 全面覆盖 | 每个文档 200+ 行，完整参考 | |
| 你来决定 | Claude 根据用途决定深度 | |

**User's choice:** 实用主义

---

## Claude's Discretion

- autonomous.md 内部进度展示格式
- 阶段操作命令的具体 CLI 参数设计
- settings 交互菜单分组和展示顺序
- prompt guard 具体负向前瞻模式
- 3 个参考文档的内容组织

## Deferred Ideas

None
