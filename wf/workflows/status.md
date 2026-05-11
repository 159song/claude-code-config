<purpose>
WF 状态总览 + 下一步推荐（合并原 progress + next 两个 workflow）。

两种调用意图：
- 用户问"现在怎么样 / 进度"→ 只展示，不自动推进
- 用户问"下一步 / 继续"→ 展示 + 自动推进到下一步
</purpose>

<process>

<step name="detect_intent">
## 0. 识别用户意图

解析触发本 workflow 的用户输入，判断是"查询模式"还是"推进模式"：

| 信号词 | 模式 |
|---|---|
| 进度 / status / 现在怎么样 / 多少了 / how far | **查询**（只展示） |
| 下一步 / next / 继续 / continue / 接下来做什么 | **推进**（展示 + 自动执行下一步） |
| 参数 `--auto-advance` | 强制 **推进** |
| 参数 `--no-advance` 或无参数默认 | **查询** |

歧义时默认走"查询"，并在结尾提示"如需自动推进请追加 `/wf-status --auto-advance` 或说'下一步'"。
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

<step name="route_or_recommend">
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
- [ ] 意图识别正确（查询 vs 推进）
- [ ] 推进模式下目标限定为 4 个已知值（discuss/plan/execute/verify），不执行任意命令（T-04-10 mitigation）
- [ ] 查询模式下不自动执行任何 Skill
</success_criteria>

<notes>
本 workflow 合并自原 `progress.md`（查询）+ `next.md`（推进），消除 wf-progress / wf-next skill 的自动触发冲突。
</notes>
