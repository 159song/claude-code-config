---
phase: quick
plan: 260413-jxn
type: execute
wave: 1
depends_on: []
files_modified:
  - ARCHITECTURE.md
autonomous: true
requirements: []
must_haves:
  truths:
    - "根目录 ARCHITECTURE.md 包含完整的 6 层架构描述"
    - "文档反映 6 个阶段执行后的系统当前状态"
    - "文档保留流程图视觉元素同时包含详细模块信息"
  artifacts:
    - path: "ARCHITECTURE.md"
      provides: "WF 系统完整架构文档"
      contains: "系统分层"
  key_links:
    - from: "ARCHITECTURE.md"
      to: ".planning/ARCHITECTURE.md"
      via: "内容同步"
      pattern: "6 层架构.*16 个命令.*15 个工作流.*6 个 agent.*12 个模块.*4 个 hook"
---

<objective>
将根目录 `./ARCHITECTURE.md` 更新为与 `.planning/ARCHITECTURE.md` 一致的最新版本。

Purpose: 根目录的 ARCHITECTURE.md（459 行）仍是旧版流程图格式，缺少 6 层架构详细描述、模块依赖图、完整命令/工作流/agent 清单等信息。`.planning/ARCHITECTURE.md`（496 行）已在上一个 quick task 中创建了完整的架构文档，但根目录版本未同步更新。

Output: 更新后的 `./ARCHITECTURE.md`，包含完整 6 层架构、数据流、设计模式等内容。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@ARCHITECTURE.md
@.planning/ARCHITECTURE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: 用 .planning/ARCHITECTURE.md 的内容替换根目录 ARCHITECTURE.md</name>
  <files>ARCHITECTURE.md</files>
  <action>
读取 `.planning/ARCHITECTURE.md` 的完整内容，将其写入根目录 `./ARCHITECTURE.md`，完全替换旧内容。

新版本包含：
- 系统概述（定位、核心模式、技术栈）
- 6 层架构表格和逐层详解（命令入口层 16 个命令、工作流编排层 15 个工作流、Agent 执行层 6 个 agent、CLI 工具层 12 个模块含依赖图、运行时监控层 4 个 hook、状态与配置层）
- 3 条数据流路径（项目生命周期、会话、质量工具）
- 5 个关键设计模式（Markdown-as-Code、合同驱动 Agent、质量门控、Wave 并行化、渐进式验证）
- 安装结构、参考文档索引、模板索引、测试、错误处理策略

旧版本中的流程图内容（整体执行流程图、hooks 运行时机、.planning 目录演进、agent 调度关系图）有参考价值但已融入新版本的各层描述中，不需要保留。

注意：这是直接替换操作，不是合并。新版本已经是完整的架构文档。
  </action>
  <verify>
    <automated>wc -l ARCHITECTURE.md && head -5 ARCHITECTURE.md && grep -c "系统分层" ARCHITECTURE.md && grep -c "模块依赖图" ARCHITECTURE.md && grep -c "渐进式验证" ARCHITECTURE.md</automated>
  </verify>
  <done>
- ARCHITECTURE.md 行数 >= 490（与 .planning/ARCHITECTURE.md 一致）
- 文档以 "# WF 工作流系统架构" 开头
- 包含 "系统分层" 章节
- 包含 "模块依赖图" 内容
- 包含 "渐进式验证" 设计模式
- diff ARCHITECTURE.md .planning/ARCHITECTURE.md 无差异
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

无 -- 纯文档更新任务，不涉及信任边界。

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| (none) | - | - | accept | 纯文档任务，无安全威胁 |
</threat_model>

<verification>
- `diff ARCHITECTURE.md .planning/ARCHITECTURE.md` 输出为空（两文件完全一致）
- `wc -l ARCHITECTURE.md` >= 490
- `grep "系统分层" ARCHITECTURE.md` 有匹配
</verification>

<success_criteria>
根目录 ARCHITECTURE.md 已更新为最新的 6 层架构文档，内容与 .planning/ARCHITECTURE.md 完全一致。
</success_criteria>

<output>
After completion, create `.planning/quick/260413-jxn-architecture-md/260413-jxn-SUMMARY.md`
</output>
