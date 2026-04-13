# Phase 6: Quality Tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 06-quality-tools
**Areas discussed:** 审查触发与范围, 审查-修复自动链, 里程碑生命周期, Agent 设计

---

## 审查触发与范围

| Option | Description | Selected |
|--------|-------------|----------|
| 纯手动 | 用户显式运行 /wf-code-review {phase} | |
| 执行后自动提示 | execute-phase 完成后自动提示"是否运行代码审查" | |
| Verify 集成 | 将 code-review 作为 verify-work 工作流的一部分 | ✓ |

**User's choice:** Verify 集成
**Notes:** 代码审查作为验证工作流的一部分自动执行

| Option | Description | Selected |
|--------|-------------|----------|
| SUMMARY 提取 | 从阶段 SUMMARY.md 的 key_files 提取变更文件，git diff 回退 | ✓ |
| Git diff 为主 | 直接用 git diff main..HEAD | |
| 手动 --files | 用户通过 --files 参数明确指定 | |

**User's choice:** SUMMARY 提取

| Option | Description | Selected |
|--------|-------------|----------|
| 两者都有 | verify-work 自动包含审查，同时可单独运行 /wf-code-review | ✓ |
| 仅 verify 集成 | 不提供独立命令 | |
| 仅独立命令 | 不集成到 verify | |

**User's choice:** 两者都有

| Option | Description | Selected |
|--------|-------------|----------|
| Config 驱动 | config.json 设置默认深度（quick/standard/deep），--depth 覆盖 | ✓ |
| 固定 standard | 始终标准深度 | |

**User's choice:** Config 驱动

---

## 审查-修复自动链

| Option | Description | Selected |
|--------|-------------|----------|
| 分级自动 | LOW/MEDIUM 自动，HIGH 提示，CRITICAL 人工 | |
| 全部自动 | 所有可修复问题直接自动处理 | ✓ |
| 全部确认 | 每个修复都需用户确认 | |

**User's choice:** 全部自动

| Option | Description | Selected |
|--------|-------------|----------|
| 最多 3 轮 | 3 轮后报告剩余问题并停止 | ✓ |
| 最多 1 轮 | 只修复一次 | |
| 可配置 | config.json 中设置 max_review_iterations | |

**User's choice:** 最多 3 轮

| Option | Description | Selected |
|--------|-------------|----------|
| --fix 参数 | /wf-code-review --fix 一次性审查+修复 | |
| 独立命令 | /wf-code-review 和 /wf-review-fix 两个独立命令 | |
| 自动链接 | code-review 完成后自动进入 fix | ✓ |

**User's choice:** 自动链接

---

## 里程碑生命周期

| Option | Description | Selected |
|--------|-------------|----------|
| 完整归档 | ROADMAP + REQUIREMENTS + 阶段 artifacts → milestones/vX.Y/ | ✓ |
| 轻量归档 | 只归档 ROADMAP 和 REQUIREMENTS | |
| Git tag 即可 | 打 tag 作为记录，不做文件移动 | |

**User's choice:** 完整归档

| Option | Description | Selected |
|--------|-------------|----------|
| 默认重置为 1 | 每个新里程碑从 Phase 1 开始 | ✓ |
| 继续编号 | 接着上个里程碑最大编号继续 | |
| 用户选择 | 每次询问 | |

**User's choice:** 默认重置为 1

| Option | Description | Selected |
|--------|-------------|----------|
| 提示但不强制 | 归档后提示是否创建下个里程碑 | |
| 自动启动 | 归档后直接进入 new-milestone | ✓ |
| 完全分离 | 归档后结束，手动运行 new-milestone | |

**User's choice:** 自动启动

| Option | Description | Selected |
|--------|-------------|----------|
| 复用 researcher+roadmapper | 与 new-project 相同流程 | ✓ |
| 简化流程 | 跳过研究，直接目标到路线图 | |

**User's choice:** 复用 researcher+roadmapper

---

## Agent 设计

| Option | Description | Selected |
|--------|-------------|----------|
| 新建 wf-reviewer | 创建专用代码审查 agent，遵循 Phase 3 合同 | ✓ |
| 复用 wf-verifier | 扩展现有 verifier | |
| 无 agent | 审查逻辑写在工作流中 | |

**User's choice:** 新建 wf-reviewer

| Option | Description | Selected |
|--------|-------------|----------|
| 复用 wf-executor | 修复复用 executor 的 isolation/worktree 能力 | ✓ |
| 新建 wf-fixer | 创建专用 fixer agent | |
| 工作流直接修复 | 审查工作流自己修复 | |

**User's choice:** 复用 wf-executor

| Option | Description | Selected |
|--------|-------------|----------|
| 全面审查 | bugs + 安全 + 代码质量 + 性能，--depth 控制深度 | ✓ |
| 仅 bugs + 安全 | 只检查正确性和安全 | |
| 用户可配置 | config 中开关每个审查类别 | |

**User's choice:** 全面审查

---

## Claude's Discretion

- REVIEW.md 输出格式和严重级别定义
- verify-work 中审查步骤的插入位置
- complete-milestone 归档目录组织
- new-milestone 状态传递方式
- wf-reviewer 的具体 prompt 和检查项

## Deferred Ideas

None — discussion stayed within phase scope
