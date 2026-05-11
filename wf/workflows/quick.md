<purpose>
快速任务模式。适用于阶段体系之外的临时任务：
bug 修复、小功能、配置调整、文档更新等。

完整管道: 规划 → 执行 → 验证（简化版）
产出文件存放在 `.planning/quick/` 目录。

> **参考:** Agent 合同定义见 `wf/references/agent-contracts.md`
</purpose>

<flags>
- `--full` — 完整模式。研究 + 规划 + 执行 + 验证。
- `--validate` — 执行后进行验证。
- `--discuss` — 先讨论再执行。
- `--research` — 先研究再执行。
- `--spec` — 规格级短链路。走 propose → validate → apply → archive，绕过 PLAN.md。
  需 `config.spec.enabled = true`。适用于"改变系统已记录的行为契约"的小任务。
</flags>

<process>

<step name="understand_task">
## 1. 理解任务

解析用户输入，确定：
- **任务类型:** bug fix / feature / refactor / docs / config
- **复杂度:** trivial / small / medium
- **涉及范围:** 文件列表预估

```
┌─ 快速任务 ────────────────────────────────┐
│ 类型: bug fix                             │
│ 复杂度: small                             │
│ 范围: src/components/Header.tsx           │
└───────────────────────────────────────────┘
```

如果复杂度评估为 "large"，建议使用正式的阶段流程。
</step>

<step name="spec_shortcut" condition="--spec">
## 1a. 规格级短链路（仅 --spec）

当用户显式使用 `--spec` 或任务明显涉及"系统已记录的行为契约"（如已存在 specs/<cap>/spec.md 里的 requirement 需要扩展/修改/删除）时，走 propose-apply-archive 短链路而非传统 PLAN.md 路径。

### 前置检查

```bash
node $HOME/.claude/wf/bin/wf-tools.cjs config get spec.enabled
```

- 若 `false` 或缺失：告知用户"规格空间未启用"，建议 `/wf-settings set spec.enabled true` 或移除 `--spec`
- 若用户不想启用，回落到 `--full` 或默认路径

### 执行

1. 推断 `change_id`（kebab-case，前缀推荐 `fix-` / `add-` / `refactor-`）
2. 委托 `wf-proposer` 产出 `.planning/changes/<id>/{proposal,tasks,specs/<cap>/spec.md}`
3. `wf-tools change validate <id>` 通过后，委托 `wf-executor` 按 tasks.md 实现代码
4. 实现完成后 `wf-tools change archive <id> --dry-run` 预览，用户确认后真正 archive

### 成功判据

- `wf-tools change validate <id>` → `valid: true`
- 实现代码通过验证（构建/测试）
- `wf-tools change archive <id>` → `ok: true`，主 specs/ 已更新，change 目录已移至 archive/

跳过本文档后续 step（plan_and_execute / verify / complete），走独立的规格短链路收尾。
</step>

<step name="research" condition="--research 或 --full">
## 2. 研究（可选）

快速研究相关上下文：

```javascript
// MODEL = config.agents.models.researcher || "haiku"

Agent({
  subagent_type: "wf-researcher",
  model: MODEL,
  prompt: `
    ## Input (per contract)
    - topic: "{{task_description}}"
    - tech_stack: {{tech_stack}}
    - max_length: 200

    快速研究，只需关键信息。完成后输出 JSON 完成标记。
  `
})
```

### 完成标记解析

Researcher 返回后，提取 JSON 完成标记：
- `"complete"` → 使用研究结果
- `"failed"` → 重试一次，仍失败则跳过研究直接执行
</step>

<step name="discuss" condition="--discuss">
## 3. 讨论（可选）

展示实现方案选项：

```
实现方案:
A) {{方案 A 描述}} — 优点/缺点
B) {{方案 B 描述}} — 优点/缺点

推荐: A
```
</step>

<step name="plan_and_execute">
## 4. 规划并执行

生成简化计划并立即执行：

```markdown
## Quick Task Plan

### Task: {{description}}
- **files:** {{file_list}}
- **action:** {{action}}
- **verify:** {{verification}}
```

启动 `wf-executor` agent 执行：

```javascript
// MODEL = config.agents.models.executor || "sonnet"

Agent({
  subagent_type: "wf-executor",
  model: MODEL,
  prompt: `
    执行快速任务。

    ## Input (per contract)
    - phase: quick
    - plan_path: (inline plan below)
    - context_md: N/A (quick task)
    - session_id: {SESSION_ID}

    {{plan}}

    规则:
    - 每完成一个改动立即 commit
    - 保持改动最小化
    完成后输出 JSON 完成标记。
  `
})
```

### 完成标记解析

Executor 返回后，提取 JSON 完成标记：
- `"complete"` → 任务完成
- `"partial"` → 记录部分完成状态
- `"failed"` → 重试一次，仍失败则报告用户
</step>

<step name="verify" condition="--validate 或 --full">
## 5. 验证（可选）

执行快速验证：
- 构建通过？
- 相关测试通过？
- 改动是否符合预期？

```
┌─ 快速验证 ────────────────────────────────┐
│ ✅ 构建通过                               │
│ ✅ 测试通过 (3/3)                         │
│ ✅ 改动符合预期                           │
└───────────────────────────────────────────┘
```
</step>

<step name="complete">
## 6. 完成

```
✅ 快速任务完成: {{description}}
   文件: {{files_changed}}
   提交: {{commit_hash}}
```
</step>

</process>

<success_criteria>
- [ ] 任务按描述完成
- [ ] 改动已提交到 git
- [ ] 无构建/测试回归（如验证开启）
</success_criteria>
