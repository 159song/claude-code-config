<purpose>
WF 状态总览 + 下一步推荐（合并原 progress + next 两个 workflow）。

两种调用意图：
- 用户问"现在怎么样 / 进度"→ 只展示，不自动推进
- 用户问"下一步 / 继续"→ 展示 + 自动推进到下一步
</purpose>

<process>

<step name="detect_intent">
## 0. 识别用户意图

解析触发本 workflow 的用户输入，判断模式：

| 信号词 / 参数 | 模式 |
|---|---|
| 进度 / status / 现在怎么样 / 多少了 / how far | **查询**（只展示） |
| 下一步 / next / 继续 / continue / 接下来做什么 | **推进**（展示 + 自动执行下一步） |
| 参数 `--auto-advance` | 强制 **推进** |
| 参数 `--summary` 或 `--summary N` | **摘要**（查询 + 当前/指定 phase 的任务 diff） |
| 参数 `--no-advance` 或无参数默认 | **查询** |

**三模式互斥规则**：
- `--auto-advance` 与 `--summary` 互斥；同时出现以 `--auto-advance` 优先
- `--summary` 隐含查询模式，不自动推进
- 歧义时默认走"查询"，并在结尾提示"如需自动推进请追加 `--auto-advance`，如需任务摘要请追加 `--summary`"。
</step>

<step name="read_state">
## 1. 读取状态

读取以下文件：
- `.planning/STATE.md` — 当前状态
- `.planning/ROADMAP.md` — 阶段列表
- `.planning/config.json` — 配置

如果 `.planning/` 不存在：
```
没有检测到 WF 项目。运行 /wf-new-project 开始。
```
终止流程。
</step>

<step name="check_handoff">
## 2. 检查暂停检查点

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" session status
```

如果 `has_handoff=true`：
> 检测到暂停检查点，建议先运行 `/wf-resume` 恢复中断的工作。

**推进模式**：显示后终止（优先恢复而非推进新步骤）。
**查询模式**：继续往下展示进度（把 HANDOFF 作为一行状态展示）。
</step>

<step name="calculate_progress">
## 3. 计算进度

遍历每个阶段目录，检查产出文件：

| 文件 | 代表状态 |
|------|----------|
| CONTEXT.md | 讨论完成 |
| PLAN*.md | 规划完成 |
| SUMMARY*.md | 执行完成 |
| VERIFICATION.md | 验证完成 |

阶段进度 = 已完成步骤 / 总步骤 × 100%
项目进度 = 所有阶段进度的加权平均
</step>

<step name="display">
## 4. 显示进度

```
╔══════════════════════════════════════════╗
║  WF · 项目进度                           ║
╚══════════════════════════════════════════╝

项目: {{project_name}}
模式: {{mode}}
整体: ████████░░░░░░░░ 47%

阶段详情:
  ✅ Phase 1: 项目基础设施        ████████████████ 100%
  ✅ Phase 2: 用户认证系统        ████████████████ 100%
  🔄 Phase 3: 数据管理模块        ████████████░░░░  72%
     → 执行中: Wave 2/3
  ⬜ Phase 4: 前端界面            ░░░░░░░░░░░░░░░░   0%
  ⬜ Phase 5: 集成测试            ░░░░░░░░░░░░░░░░   0%
```
</step>

<step name="render_summary" condition="--summary 模式">
## 4.5 任务摘要（`--summary`）

仅在 `--summary` 模式执行。目标：让用户不用逐文件打开 SUMMARY-*.md 就能了解 phase 做了什么。

### 4.5.1 确定目标 phase

```bash
# --summary N：指定 phase（N 经 parseInt 校验，NaN 或 ≤0 拒绝）
# --summary 无参：取当前 phase
TARGET_PHASE=${SUMMARY_ARG:-$(node "$HOME/.claude/wf/bin/wf-tools.cjs" state get current_phase)}

PADDED=$(printf "%02d" "$TARGET_PHASE")
PHASE_DIR=$(ls -d .planning/phases/${PADDED}-* 2>/dev/null | head -1)
```

若 `PHASE_DIR` 不存在：显示"Phase {N} 尚未开始"并跳过本 step。

### 4.5.2 读取所有 SUMMARY-*.md

```bash
SUMMARIES=$(ls "${PHASE_DIR}"/SUMMARY*.md 2>/dev/null)
```

若无 SUMMARY：显示"Phase {N} 尚未执行（无 SUMMARY.md）"并跳过。

### 4.5.3 解析任务行 + 变更文件

对每个 SUMMARY 文件提取：
- **任务状态表**：匹配 `| Task X.Y | status | note |` 格式
- **变更文件列表**：匹配 `## 变更文件` 段下的 `- path -- 说明` 行
- **提交记录**：匹配 `## 提交记录` 段下的 `- hash commit-msg` 行

### 4.5.4 渲染摘要

```
╔════════════════════════════════════════════════════╗
║  WF · Phase {N} 任务摘要                           ║
╚════════════════════════════════════════════════════╝

Phase {N}: {{phase_name}}
产出: {{plan_count}} 个 PLAN · {{task_count}} 个任务 · {{file_count}} 个文件变更 · {{commit_count}} 个 commit

## Wave 1  ({{w1_tasks}} 个任务, {{w1_files}} 个文件)
  ✓ Task 1.1  {{task_title}}         {{primary_file}}
  ✓ Task 1.2  {{task_title}}         {{primary_file}}
  ✓ Task 1.3  {{task_title}}         {{primary_file}}

## Wave 2  ({{w2_tasks}} 个任务, {{w2_files}} 个文件)
  ✓ Task 2.1  {{task_title}}         {{primary_file}}
  ✓ Task 2.2  {{task_title}}         {{primary_file}}

## 变更文件（全部）
  + src/models/user.ts       新建
  ~ src/routes/auth.ts       修改
  + tests/auth.test.ts       新建

## 最近 5 个 commit
  abc1234  feat(phase-2): create user model
  def5678  feat(phase-2): add auth middleware
  ...

## 偏差
{{如 SUMMARY 含"偏差记录"段，列出；否则"无"}}

## 验证结果
{{若 VERIFICATION.md 存在，摘录 4 级验证结论；否则"未验证"}}
```

**排版规则**：
- 任务行取 SUMMARY 任务表第 1 列（Task 编号）+ PLAN.md 对应任务的 title 作为 `{{task_title}}`；找不到 title 则用 SUMMARY 的备注列
- `{{primary_file}}` 取任务"变更文件"段的第一行；多于 1 个文件时追加 `(+N)`
- 文件状态符号：`+` 新建、`~` 修改、`-` 删除（从 SUMMARY "变更文件"段末尾的"新建/修改/删除"关键词识别）
- 任务状态：`✓` done / `◐` partial / `✗` failed

### 4.5.5 摘要模式的终点

`--summary` 模式显示完摘要后：
- 不执行推荐路由（step 5 跳过）
- 不自动推进（即便同时传了 `--auto-advance`，见 step 0 互斥规则）
- 在摘要末尾提示："查看完整 SUMMARY: `cat ${PHASE_DIR}/SUMMARY*.md`；继续推进: `/wf-status --auto-advance`"

</step>

<step name="route_or_recommend" condition="非 --summary 模式">
## 5. 路由 / 推荐

### 5.1 分析路线图

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" roadmap analyze
```

提取 `current_phase`（第一个非 verified 的阶段，per D-11）。

如果所有阶段都是 verified：
> 🎉 所有阶段已完成！建议 `/wf-complete-milestone` 归档。

### 5.2 检测当前阶段步骤状态

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" init phase-op <current_phase>
```

按 per D-09 规则匹配下一步：

| 条件 | 下一步 | 路由命令 |
|------|--------|----------|
| `has_context` = false | discuss | `/wf-discuss-phase <N>` |
| `has_plans` = false | plan | `/wf-plan-phase <N>` |
| 存在 PLAN 但无 SUMMARY | execute | `/wf-execute-phase <N>` |
| 存在 SUMMARY 但 `has_verification` = false | verify | `/wf-verify-work` |
| `has_verification` = true 但未通过 | verify (重新) | `/wf-verify-work` |

### 5.3 分流

**查询模式**：仅显示推荐：
> ▶ 下一步推荐: `/wf-<step>-phase <N>`（或直接说"继续"触发自动推进）

**推进模式**：显示 + 执行：
> **自动推进:** 阶段 {N} ({phase_name})
> **检测步骤:** {next_step}
> **执行命令:** {route_command}

然后直接调用对应 Skill()（per D-10 薄包装）：
- discuss: `Skill(discuss-phase, { phase: N })`
- plan: `Skill(plan-phase, { phase: N })`
- execute: `Skill(execute-phase, { phase: N })`
- verify: `Skill(verify-work)`

不等待用户确认（per D-12 推进模式下不支持 flag 覆盖检测）。
</step>

<step name="extra_routes">
## 6. 其他路由情况（查询模式额外展示）

**Route D: 全部完成**
```
🎉 所有阶段已完成！
  建议: /wf-complete-milestone
```

**Route E: 暂停中**
```
⏸ 项目暂停于阶段 {N}
  恢复: /wf-resume 或 /wf-autonomous --from {N}
```

**Route F: 有阻塞**
```
⛔ 阶段 {N} 有阻塞项
  详情: {{blocker_description}}
```
</step>

</process>

<success_criteria>
- [ ] 进度计算正确
- [ ] 意图识别正确（查询 vs 推进 vs 摘要）
- [ ] 推进模式下目标限定为 4 个已知值（discuss/plan/execute/verify），不执行任意命令（T-04-10 mitigation）
- [ ] 查询模式下不自动执行任何 Skill
- [ ] 摘要模式下不自动推进（即便同时传 --auto-advance）
- [ ] 摘要模式下 SUMMARY-*.md 不存在时显示提示不报错
- [ ] 摘要模式下 phase 编号 parseInt 拒绝 NaN / ≤0
</success_criteria>

<notes>
本 workflow 合并自原 `progress.md`（查询）+ `next.md`（推进），消除 wf-progress / wf-next skill 的自动触发冲突。
</notes>
