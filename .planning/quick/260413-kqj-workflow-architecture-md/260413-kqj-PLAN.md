---
phase: quick-260413-kqj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ARCHITECTURE.md
autonomous: true
must_haves:
  truths:
    - "目录结构反映实际的 15 个 workflows、16 个 commands、6 个 agents、7 个 references、bin/lib/ 子目录"
    - "整体执行流程图部分完全保留不变"
    - "新增的 workflows/commands/agents/references 在文档中有对应描述"
    - "hooks 部分反映 SessionStart 迁移到 .js 和 PostToolUse 新增 MultiEdit"
  artifacts:
    - path: "ARCHITECTURE.md"
      provides: "Updated architecture documentation"
---

<objective>
更新 ./ARCHITECTURE.md 的目录结构和组件描述，反映代码库的最新状态。

Purpose: ARCHITECTURE.md 中记录的 9 个 workflows、9 个 commands、5 个 agents、3 个 references 已过时，实际代码库已扩展到 15 个 workflows、16 个 commands、6 个 agents、7 个 references。需要同步文档。
Output: 更新后的 ARCHITECTURE.md
</objective>

<context>
@./ARCHITECTURE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: 更新 ARCHITECTURE.md 目录结构和组件描述</name>
  <files>ARCHITECTURE.md</files>
  <action>
读取当前 ARCHITECTURE.md，执行以下精确更新：

**A. 目录结构 section（第一个代码块）— 全面更新：**

1. `wf/bin/` 条目更新：
   - 原: `wf/bin/wf-tools.cjs`
   - 改为: `wf/bin/wf-tools.cjs` + `wf/bin/lib/` 子目录，列出关键模块文件：
     ```
     ├── bin/
     │   ├── wf-tools.cjs             # CLI 入口（命令分发）
     │   └── lib/                     # 模块化功能库
     │       ├── config.cjs           # 配置管理（读取/写入/schema）
     │       ├── git.cjs              # Git 操作封装
     │       ├── init.cjs             # 初始化和阶段信息
     │       ├── milestone.cjs        # 里程碑归档和重置
     │       ├── phase.cjs            # 阶段状态检测
     │       ├── progress.cjs         # 进度计算
     │       ├── review.cjs           # 代码审查文件范围计算
     │       ├── roadmap.cjs          # 路线图分析
     │       ├── session.cjs          # 会话暂停/恢复
     │       ├── state.cjs            # STATE.md 读写
     │       ├── utils.cjs            # 通用工具函数
     │       ├── validate.cjs         # 输入验证
     │       └── *.test.cjs           # 单元测试文件
     ```

2. `wf/workflows/` 条目更新（9 -> 15）：
   - 保留原有 9 个
   - 新增 6 个：
     ```
     │   ├── code-review.md              # 代码审查 — 审查+自动修复迭代链
     │   ├── complete-milestone.md       # 完成里程碑 — 归档/标签/重置
     │   ├── new-milestone.md            # 新里程碑 — 目标收集/研究/需求/路线图
     │   ├── next.md                     # 自动推进 — 检测状态/路由下一步
     │   ├── session.md                  # 会话管理 — 暂停/恢复检查点
     │   └── settings.md                 # 配置管理 — 交互式/CLI 配置修改
     ```

3. `wf/references/` 条目更新（3 -> 7）：
   - 保留原有 3 个
   - 新增 4 个：
     ```
     │   ├── agent-contracts.md          # Agent 合同定义（输入/输出/完成标记）
     │   ├── anti-patterns.md            # 工作流反模式（避免的常见错误）
     │   ├── context-budget.md           # 上下文预算管理策略
     │   └── continuation-format.md      # 会话续接格式（HANDOFF.json 规范）
     ```

4. `commands/wf/` 条目更新（9 -> 16）：
   - 保留原有 9 个
   - 新增 7 个：
     ```
     ├── code-review.md               # /wf-code-review <phase> [--depth] [--files]
     ├── complete-milestone.md         # /wf-complete-milestone [version]
     ├── new-milestone.md              # /wf-new-milestone [version]
     ├── next.md                       # /wf-next
     ├── pause.md                      # /wf-pause
     ├── resume.md                     # /wf-resume
     └── settings.md                   # /wf-settings [set key value]
     ```

5. `agents/` 条目更新（5 -> 6）：
   - 保留原有 5 个
   - 新增 1 个：
     ```
     └── wf-reviewer.md                # 代码审查器 — 逐文件审查/4 维度分析/REVIEW.md
     ```

6. `hooks/` 条目更新：
   - SessionStart: 将 `wf-session-state.sh` 改为 `wf-session-state.js`（已迁移到 Node.js）
   - 保留 `wf-session-state.sh` 但标注为遗留/备用
   - 新增 `wf-prompt-guard.test.cjs` 测试文件条目
   - PostToolUse matcher 注释更新：从 `Bash|Edit|Write|Agent|Task` 改为 `Bash|Edit|Write|MultiEdit|Agent|Task`

7. 计数更新：
   - "9 个核心工作流" -> "15 个核心工作流"
   - "9 个命令入口" -> "16 个命令入口"
   - "5 个核心 sub-agent" -> "6 个核心 sub-agent"
   - "4 个 Claude Code hooks" -> "5 个 Claude Code hooks"（或保持 4 个但标注 SessionStart 已迁移）

**B. 整体执行流程图 section — 完全保留不变（从 "## 整体执行流程图" 到文件末尾的代码块）。**

不修改流程图中的任何内容，包括：命令路由表、阶段流程图、Hooks 运行时机图、Agent 调度关系图等。这些在流程图代码块内的内容全部保留原样。

**C. 在流程图之后（文件末尾），新增一个补充说明 section：**

```markdown
---

## 补充说明

> 以下内容记录整体执行流程图中未覆盖的新增组件。流程图反映核心生命周期，
> 下方记录扩展功能。

### 新增工作流（v1.0 后扩展）

| 工作流 | 命令 | 用途 |
|--------|------|------|
| code-review.md | /wf-code-review | 审查阶段代码变更，自动修复迭代（最多 3 轮） |
| complete-milestone.md | /wf-complete-milestone | 里程碑归档：验证就绪 → 归档 → Git 标签 → 重置状态 |
| new-milestone.md | /wf-new-milestone | 新里程碑初始化：收集目标 → 研究 → 需求 → 路线图 |
| next.md | /wf-next | 自动检测项目状态，路由到下一个需要执行的步骤 |
| session.md | /wf-pause, /wf-resume | 会话暂停/恢复：HANDOFF.json 检查点管理 |
| settings.md | /wf-settings | 交互式或 CLI 方式查看/修改工作流配置 |

### 新增 Agent

| Agent | 调用方 | 用途 |
|-------|--------|------|
| wf-reviewer | /wf-code-review | 4 维度代码审查（bugs/security/quality/performance），生成 REVIEW.md |

### 新增参考文档

| 文档 | 用途 |
|------|------|
| agent-contracts.md | 所有 agent 的输入/输出合同和完成标记格式 |
| anti-patterns.md | 工作流常见反模式和规避策略 |
| context-budget.md | Context window 预算管理策略 |
| continuation-format.md | HANDOFF.json 和 .continue-here.md 续接格式规范 |

### Hooks 变更

- **SessionStart**: 从 `wf-session-state.sh`（Bash）迁移到 `wf-session-state.js`（Node.js）
- **PostToolUse**: matcher 新增 `MultiEdit`（完整: `Bash|Edit|Write|MultiEdit|Agent|Task`）
- **测试**: 新增 `wf-prompt-guard.test.cjs` 单元测试

### wf-tools CLI 模块化

`wf/bin/wf-tools.cjs` 的功能已拆分到 `wf/bin/lib/` 子目录下的独立模块：

| 模块 | 职责 |
|------|------|
| config.cjs | 配置读取、写入、schema 查询 |
| git.cjs | Git 操作封装 |
| init.cjs | 项目/阶段初始化信息 |
| milestone.cjs | 里程碑归档 (archive) 和重置 (reset) |
| phase.cjs | 阶段状态检测 |
| progress.cjs | 进度百分比计算 |
| review.cjs | 代码审查文件范围计算（三级回退策略） |
| roadmap.cjs | 路线图分析（阶段状态/当前阶段推断） |
| session.cjs | 会话暂停/恢复（HANDOFF.json 管理） |
| state.cjs | STATE.md 读写（YAML frontmatter 解析） |
| utils.cjs | 通用工具函数 |
| validate.cjs | 输入验证（路径/参数） |
```
  </action>
  <verify>
    <automated>grep -c "15 个核心工作流" ARCHITECTURE.md && grep -c "16 个命令入口" ARCHITECTURE.md && grep -c "6 个核心" ARCHITECTURE.md && grep -c "wf-reviewer" ARCHITECTURE.md && grep -c "code-review.md" ARCHITECTURE.md && grep -c "整体执行流程图" ARCHITECTURE.md && grep -c "wf-session-state.js" ARCHITECTURE.md && grep -c "MultiEdit" ARCHITECTURE.md && grep -c "agent-contracts.md" ARCHITECTURE.md && grep -c "lib/" ARCHITECTURE.md</automated>
  </verify>
  <done>
    - 目录结构中列出全部 15 个 workflows、16 个 commands、6 个 agents、7 个 references
    - bin/lib/ 子目录结构已列出
    - hooks 部分反映 SessionStart .js 迁移和 MultiEdit 新增
    - 整体执行流程图完全保留不变
    - 新增补充说明 section 描述流程图未覆盖的扩展组件
  </done>
</task>

</tasks>

<verification>
1. 整体执行流程图从 "## 整体执行流程图" 到最后一个 ``` 完全未改动
2. 目录结构中组件计数与实际文件系统一致
3. 所有新增组件（6 workflows + 7 commands + 1 agent + 4 references）均有文档描述
</verification>

<success_criteria>
- ARCHITECTURE.md 目录结构与实际代码库完全对齐
- 整体执行流程图 section 内容完全未变
- 新增组件在补充说明中有清晰的描述
</success_criteria>

<output>
After completion, create `.planning/quick/260413-kqj-workflow-architecture-md/260413-kqj-SUMMARY.md`
</output>
