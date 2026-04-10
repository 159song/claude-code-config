# Phase 1: CLI Foundation - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

模块化 wf-tools.cjs 并实现复合初始化命令，消除 context 浪费。工作流通过单次 CLI 调用获取所有所需上下文，wf-tools.cjs 从单文件进化为模块化架构。所有命令文件中的 `{{WF_ROOT}}` 占位符替换为可解析的真实路径。

</domain>

<decisions>
## Implementation Decisions

### 模块拆分策略
- **D-01:** 按功能域拆分为 `wf/bin/lib/` 下独立模块：utils.cjs, state.cjs, roadmap.cjs, phase.cjs, progress.cjs, git.cjs, init.cjs, config.cjs（≥8 个）
- **D-02:** wf-tools.cjs 主文件精简为纯路由器（~40 行），只做命令分发
- **D-03:** 每个模块通过 `module.exports` 导出函数，供 hook 脚本和未来工具 `require()` 复用

### 路径解析方案
- **D-04:** 用 `$HOME/.claude/wf/` 绝对路径替换所有 `{{WF_ROOT}}` 占位符，与 GSD 的 `$HOME/.claude/get-shit-done/` 模式一致
- **D-05:** WF 安装位置固定为 `$HOME/.claude/wf/`，不支持自定义安装路径
- **D-06:** 全部 9 个命令文件的 `execution_context` 和 `process` 中的 `@{{WF_ROOT}}/...` 替换为 `@$HOME/.claude/wf/...`

### 复合 init 输出设计
- **D-07:** init 支持子模式：`init phase-op N`、`init new-project`、`init quick` 等，每个子模式返回通用基础字段 + 模式特有字段
- **D-08:** phase-op 模式返回字段参考 GSD：phase_found, phase_dir, phase_name, phase_slug, padded_phase, has_context, has_research, has_plans, plan_count, has_verification, roadmap_exists, planning_exists, project_root, commit_docs
- **D-09:** 包含 `response_language` 字段，从配置中读取语言偏好

### 项目根目录发现
- **D-10:** 实现 `findProjectRoot()`：从 cwd 向上遍历目录树，查找包含 `.planning/` 的第一个父目录
- **D-11:** 找不到 `.planning/` 时回退到当前工作目录（cwd），对新项目友好
- **D-12:** 支持 `--cwd <path>` 参数显式覆盖，优先级高于自动检测

### Claude's Discretion
- 各模块的具体内部 API 签名设计
- 错误处理的具体策略（哪些静默失败、哪些抛异常）
- init 子模式的具体字段扩展（在基础字段之上按需增加）
- findProjectRoot 向上查找的最大层数限制

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### CLI 工具核心
- `wf/bin/wf-tools.cjs` — 当前单文件实现（324 行），拆分的源文件
- `wf/templates/config.json` — 工作流配置模板，init 需要读取的默认配置

### 命令文件（需替换路径）
- `commands/wf/*.md` — 全部 9 个命令文件，所有 `{{WF_ROOT}}` 引用需替换

### Hook 文件（路径一致性验证）
- `settings.json` — Hook 绑定配置，定义了 4 个 hook 的路径
- `hooks/wf-context-monitor.js` — PostToolUse hook
- `hooks/wf-prompt-guard.js` — PreToolUse hook
- `hooks/wf-statusline.js` — StatusLine hook
- `hooks/wf-session-state.sh` — SessionStart hook

### 研究报告
- `.planning/research/PITFALLS.md` — 已识别的 `{{WF_ROOT}}` 未替换问题和解决方案分析
- `.planning/codebase/STRUCTURE.md` — 当前目录结构和命名约定
- `.planning/codebase/CONVENTIONS.md` — 代码风格和模块设计约定

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `readFile()`, `readJson()`, `writeFile()`, `ensurePlanningDir()` — 可直接迁移到 lib/utils.cjs
- `parseStateMd()` — STATE.md 的 markdown 解析逻辑，迁移到 lib/state.cjs
- `roadmapAnalyze()` 中的阶段正则解析 — 迁移到 lib/roadmap.cjs

### Established Patterns
- CommonJS `require()` + `module.exports`，无外部依赖
- JSON 输出通过 `process.stdout.write(JSON.stringify(...))`
- 错误时静默退出（hooks）或 `process.exit(1)`（CLI）
- 2 空格缩进，kebab-case 文件名，camelCase 函数名

### Integration Points
- hook 脚本可能需要 `require()` lib/ 模块（如 statusline 读取 state）
- 工作流 markdown 通过 `node wf-tools.cjs <cmd>` 调用 CLI
- settings.json 中的 hook 路径必须与实际文件位置匹配

</code_context>

<specifics>
## Specific Ideas

- 模块化后的结构参考 GSD 的 `gsd-tools.cjs` 设计，但 WF 的模块应该更细粒度（GSD 是单文件）
- `$HOME/.claude/wf/` 路径模式与 GSD 的 `$HOME/.claude/get-shit-done/` 保持一致性

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-cli-foundation*
*Context gathered: 2026-04-10*
