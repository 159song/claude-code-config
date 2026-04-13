# Phase 5: Workflow Enhancement - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

工作流覆盖更多实际场景（自治执行、阶段动态调整、配置管理），减少卡顿和误报。

Requirements: WF-01, WF-02, WF-03, WF-04, WF-05, WF-06

</domain>

<decisions>
## Implementation Decisions

### 自治工作流重写 (WF-01)
- **D-01:** autonomous.md 重写为 Skill() 链式调用模式，复用 Phase 4 建立的工作流路由机制。每个阶段通过 `Skill(discuss-phase --auto)` → `Skill(plan-phase --auto)` → `Skill(execute-phase)` 顺序调用
- **D-02:** 跨阶段失败策略：单次重试（gap closure）+ 暂停。单个阶段失败时自动重试一次，仍失败则暂停整个 autonomous 流程并报告，不跳到下一阶段
- **D-03:** discuss 阶段在 autonomous 模式下使用 `--auto` 全自动处理（灰色地带用推荐默认值）。用户可通过 `--interactive` flag 回退到逐个确认模式

### 阶段动态操作 (WF-02)
- **D-04:** 插入阶段采用十进制编号（如 Phase 2.5），不重命名任何现有目录。ROADMAP 已支持此模式（"Decimal phases appear between their surrounding integers"），安全且不影响 git 历史
- **D-05:** remove-phase 两步操作：先从 ROADMAP 中标记移除阶段条目，然后将磁盘上的阶段目录移动到 `.planning/archive/` 目录保留历史
- **D-06:** add-phase 在 ROADMAP 末尾追加新阶段，使用下一个整数编号。insert-phase 在指定位置插入十进制编号阶段

### 配置管理 (WF-03)
- **D-07:** /wf-settings 支持两种模式：无参数时使用 AskUserQuestion 交互式菜单浏览和修改；`/wf-settings set key value` 支持直接 CLI 操作
- **D-08:** 暴露工作流行为类配置给用户：mode, granularity, parallelization, auto_advance, discuss_mode, research 等。内部状态类配置（如 `_auto_chain_active`）不暴露
- **D-09:** 新建 `commands/wf/settings.md` 命令文件和 `wf/workflows/settings.md` 工作流文件

### Prompt Guard 优化 (WF-05)
- **D-10:** 采用负向前瞻 + 白名单双策略减少误报。每个 regex 增加负向前瞻排除合法场景（如代码块内引用、文档描述），同时支持文件后缀白名单（如 .md 文档类文件降级为 warning）
- **D-11:** 保持现有 advisory（不阻塞）模式，优化只是减少不必要的警告触发

### 参考文档套件 (WF-04)
- **D-12:** 新建 3 个参考文档：`anti-patterns.md`、`context-budget.md`、`continuation-format.md`，放在 `wf/references/` 目录
- **D-13:** 每个文档 50-150 行，实用主义风格：聚焦工作流实际会用到的模式和规则，不追求全面性。agent-contracts.md 已在 Phase 3 创建，保持现有内容

### Git Commit --files (WF-06)
- **D-14:** 此需求已在 Phase 1/2 实现。`git.cjs` 已支持 `--files` 参数选择性暂存，工作流已在使用。标记为已满足，不需要额外工作

### Claude's Discretion
- autonomous.md 内部的进度展示格式和频率
- 阶段操作命令的具体 CLI 参数设计（如 `--after N` vs positional args）
- settings 交互菜单的分组和展示顺序
- prompt guard 具体哪些 regex 需要负向前瞻以及具体前瞻模式
- 3 个参考文档的具体内容组织和章节结构

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 需重写的工作流
- `wf/workflows/autonomous.md` — 当前 161 行伪代码实现，需重写为 Skill() 链式调用
- `commands/wf/autonomous.md` — autonomous 命令入口，flags 定义

### Prompt Guard
- `hooks/wf-prompt-guard.js` — 当前 73 行，13 个 INJECTION_PATTERNS，需增加负向前瞻

### 现有参考文档
- `wf/references/agent-contracts.md` — Phase 3 已创建，不需修改
- `wf/references/gates.md` — 质量门定义
- `wf/references/verification-patterns.md` — 验证模式
- `wf/references/ui-brand.md` — UI 品牌规范

### CLI 基础设施
- `wf/bin/wf-tools.cjs` — 路由器，需挂载新的 phase-ops 和 settings 子命令
- `wf/bin/lib/roadmap.cjs` — ROADMAP 解析模块，add/insert/remove-phase 需扩展
- `wf/bin/lib/config.cjs` — 配置管理模块，/wf-settings 的后端
- `wf/bin/lib/git.cjs` — WF-06 已实现 --files 支持

### 配置
- `wf/templates/config.json` — 配置模板，需记录用户可见配置项
- `.planning/config.json` — 项目级配置

### Phase 4 Skill() 模式参考
- `wf/workflows/session.md` — Skill() 路由模式的参考实现
- `wf/workflows/next.md` — 状态检测 + Skill() 委托的参考实现

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `wf/workflows/session.md` — Skill() 路由和 step-based 分发的模式，autonomous.md 重写可直接参考
- `wf/workflows/next.md` — 状态检测 + Skill() 委托的薄包装模式
- `wf/bin/lib/roadmap.cjs` — 已有阶段解析和状态检测逻辑，phase-ops 可扩展此模块
- `wf/bin/lib/config.cjs` — 已有 `loadConfig()` 和 `CONFIG_DEFAULTS`，settings 命令可直接复用
- `git.cjs` — `--files` 选择性暂存已实现

### Established Patterns
- Skill() 链式调用避免深层 Task 嵌套（Phase 4 discuss-phase auto_advance 建立）
- CLI router + lib/ 模块架构（Phase 1 建立）
- 所有状态变更通过 CLI 命令（Phase 2 建立）
- Agent 完成标记 JSON + config.json 驱动模型选择（Phase 3 建立）
- 十进制阶段编号已在 ROADMAP 格式中预设

### Integration Points
- `wf-tools.cjs` 路由器需增加 `phase-ops` 和 `settings` 子命令入口
- `roadmap.cjs` 需增加 add/insert/remove 阶段的写入能力（目前只有读取）
- `autonomous.md` 需从伪代码重写为真实 Skill() 调用
- `settings.json` 需增加新命令的 hook 绑定（如有需要）
- 3 个新参考文档放入 `wf/references/`

</code_context>

<specifics>
## Specific Ideas

- autonomous.md 的 Skill() 调用链与 discuss-phase 的 `--auto` + `auto_advance` 机制对齐，避免重复实现
- 阶段操作的十进制编号与 ROADMAP 中已有的 "Decimal phases (2.1, 2.2): Urgent insertions" 约定保持一致
- prompt guard 的负向前瞻可参考 GSD 的 `gsd-prompt-guard` 如果存在类似实现
- 参考文档风格对齐现有 `gates.md` 和 `verification-patterns.md` 的实用主义风格

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-workflow-enhancement*
*Context gathered: 2026-04-13*
