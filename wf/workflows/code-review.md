# Code Review Workflow

审查阶段变更文件的代码质量，自动修复发现的问题，最多迭代 3 轮。

<purpose>
审查指定阶段的源代码变更，发现 bug、安全漏洞、质量和性能问题。
发现问题后自动委托 wf-executor 修复，再重新审查，最多 3 轮迭代（per D-06）。

产出文件：
- `<phaseDir>/REVIEW.md` -- 结构化审查报告

> **参考:** Agent 合同定义见 `wf/references/agent-contracts.md`
</purpose>

<process>

<step name="initialize">
## 1. 初始化

解析 `$ARGUMENTS`：
- 第一个位置参数 = 阶段编号（必须）
- `--depth quick|standard|deep` = 审查深度覆盖
- `--files file1,file2,...` = 手动指定文件列表

```bash
# 获取阶段信息
PHASE_JSON=$(node "$HOME/.claude/wf/bin/wf-tools.cjs" init phase-op <phase>)
```

从 `PHASE_JSON` 提取 `phase_dir`、`padded_phase`。

**加载配置:**

```bash
CONFIG_JSON=$(node "$HOME/.claude/wf/bin/wf-tools.cjs" config)
```

提取关键配置项：
- `workflow.code_review` -- 是否启用代码审查（布尔值）
- `workflow.code_review_depth` -- 默认审查深度（默认 `standard`）
- `workflow.code_review_auto_fix` -- 是否自动修复（默认 `true`）
- `workflow.code_review_max_iterations` -- 最大迭代轮数（默认 `3`）
- `agents.models.reviewer` -- reviewer agent 模型（默认 `sonnet`）

**深度确定优先级:**
1. `--depth` 命令行参数（最高优先级）
2. `config.workflow.code_review_depth`（配置值）
3. `standard`（硬编码默认值）

**深度值验证（T-06-07 mitigation）:** 验证 depth 属于 `['quick', 'standard', 'deep']`，无效值拒绝并报错退出。
</step>

<step name="check_config_gate">
## 2. 配置门禁

如果 `config.workflow.code_review === false`：

```
⚠️ 代码审查已在 config.json 中禁用 (workflow.code_review = false)
▶ 若要启用: wf-tools config-set workflow.code_review true
```

退出工作流，不执行审查。
</step>

<step name="compute_file_scope">
## 3. 计算文件范围

```bash
# 使用 review.cjs 计算文件范围（三级回退策略）
SCOPE_JSON=$(node "$HOME/.claude/wf/bin/wf-tools.cjs" review scope <phase> [--files f1,f2,...])
```

从 `SCOPE_JSON` 提取 `files` 数组和 `tier`。

**文件范围验证（T-06-08 mitigation）:** 文件路径验证委托给 review.cjs 的 `computeFileScope`，该函数已内置路径遍历防护（T-06-01）。

如果 `files` 为空：

```
⚠️ 未找到需要审查的源文件
  tier: {tier}
  阶段目录: {phase_dir}

▶ 建议: 使用 --files 参数手动指定文件列表
```

退出工作流。

如果 `files` 非空，显示范围信息：

```
┌─ 审查范围 ─────────────────────────────────┐
│ 阶段: Phase {N}                            │
│ 文件数: {files.length}                     │
│ 来源: {tier}                               │
│ 深度: {depth}                              │
└───────────────────────────────────────────┘
```
</step>

<step name="review_fix_chain">
## 4. 审查-修复链（核心循环）

使用 Skill() 链式调用实现 review -> fix -> re-review 迭代（per D-04, D-06）。

**初始化变量:**
- `iteration = 0`
- `max_iterations = config.workflow.code_review_max_iterations`（默认 3）
- `review_path = <phaseDir>/REVIEW.md`

**循环（最多 max_iterations 轮）:**

```
LOOP while iteration < max_iterations:
  iteration++
  
  ── Step A: 审查 ──────────────────────────
  
  Skill(wf-reviewer, {
    phase: <phase>,
    files: <files>,
    review_path: <review_path>,
    depth: <depth>,
    config: <config>
  })
  
  ── Step B: 解析审查结果 ──────────────────
  
  REVIEW_JSON=$(node "$HOME/.claude/wf/bin/wf-tools.cjs" review parse <review_path>)
  
  从 REVIEW_JSON 提取: status, findings.total, findings.critical, findings.high
  
  ── Step C: 检查是否需要继续 ──────────────
  
  IF status === 'clean' OR findings.total === 0:
    显示 "✅ 审查通过，未发现问题"
    BREAK
  
  IF status === 'error':
    显示 "❌ 审查出错，请检查日志"
    BREAK
  
  ── Step D: 自动修复（可选）──────────────
  
  IF config.workflow.code_review_auto_fix === false:
    显示 "⚠️ 自动修复已禁用，发现 {findings.total} 个问题"
    BREAK
  
  显示修复进度:
    "🔄 迭代 {iteration}/{max_iterations}: 发现 {findings.total} 个问题，尝试自动修复..."
  
  从 REVIEW.md 正文提取 findings 列表，为每个 finding 构造修复指令。
  
  委托 wf-executor 执行修复:
  
  Skill(wf-executor, {
    task: "修复 REVIEW.md 中的 {findings.total} 个代码审查问题",
    findings: <从 REVIEW.md 提取的 finding 列表>,
    files: <涉及的文件列表>,
    commit_prefix: "fix(phase-{N})"
  })
  
  ── Step E: 返回循环顶部，进行 re-review ──
  
END LOOP
```

如果循环因达到 max_iterations 而退出（仍有未解决问题）：

```
⚠️ 已达最大迭代次数 ({max_iterations})
  剩余问题: {findings.total}
  - Critical: {findings.critical}
  - High: {findings.high}
  - Medium: {findings.medium}
  - Low: {findings.low}

▶ 详见: {review_path}
```
</step>

<step name="present_results">
## 5. 展示结果

使用 ui-brand.md 格式展示最终审查摘要：

**审查通过时:**

```
╔══════════════════════════════════════════╗
║  WF · 代码审查完成                       ║
╚══════════════════════════════════════════╝

  阶段: Phase {N}
  文件数: {files_reviewed}
  深度: {depth}
  结果: ✅ 通过

  迭代: {iteration} 轮
  修复: {fixed_count} 个问题

▶ 报告: {review_path}
```

**有剩余问题时:**

```
╔══════════════════════════════════════════╗
║  WF · 代码审查完成                       ║
╚══════════════════════════════════════════╝

  阶段: Phase {N}
  文件数: {files_reviewed}
  深度: {depth}
  结果: ⚠️ 有剩余问题

  迭代: {iteration}/{max_iterations} 轮
  已修复: {fixed_count} 个
  剩余: {remaining_count} 个

  剩余问题:
    - CR-03 [high] 未处理的空值 (example.cjs:L15)
    - CR-07 [medium] 函数过长 (utils.cjs:L80-L180)

▶ 报告: {review_path}
```
</step>

<step name="commit_review">
## 6. 提交审查报告

```bash
git add <review_path>
git commit -m "docs(phase-{N}): code review - {status_summary}"
```

状态摘要格式：
- `clean` -> "代码审查通过"
- `issues_found` + 全部修复 -> "代码审查通过（已修复 N 个问题）"
- `issues_found` + 有剩余 -> "代码审查完成（剩余 N 个问题）"
</step>

</process>

<success_criteria>
- [ ] 文件范围正确计算（三级回退策略）
- [ ] wf-reviewer agent 成功执行审查
- [ ] REVIEW.md 包含结构化的 YAML frontmatter
- [ ] 自动修复链正确迭代（最多 3 轮）
- [ ] 修复委托给 wf-executor（per D-13）
- [ ] 最终结果清晰展示
- [ ] REVIEW.md 已提交到 git
</success_criteria>
