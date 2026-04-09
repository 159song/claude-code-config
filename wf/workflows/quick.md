<purpose>
快速任务模式。适用于阶段体系之外的临时任务：
bug 修复、小功能、配置调整、文档更新等。

完整管道: 规划 → 执行 → 验证（简化版）
产出文件存放在 `.planning/quick/` 目录。
</purpose>

<flags>
- `--full` — 完整模式。研究 + 规划 + 执行 + 验证。
- `--validate` — 执行后进行验证。
- `--discuss` — 先讨论再执行。
- `--research` — 先研究再执行。
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

<step name="research" condition="--research 或 --full">
## 2. 研究（可选）

快速研究相关上下文：

```javascript
Agent({
  subagent_type: "wf-researcher",
  prompt: "快速研究: {{task_description}}. 只需关键信息，不超过 200 字。"
})
```
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
Agent({
  subagent_type: "wf-executor",
  prompt: `
    执行快速任务:
    {{plan}}
    
    规则:
    - 每完成一个改动立即 commit
    - 保持改动最小化
    - 不要引入不必要的重构
  `
})
```
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
