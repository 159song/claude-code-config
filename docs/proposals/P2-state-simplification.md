# P2 提案：State 文件精简（重新定调版）

- **Change ID**: `P2-state-simplification`
- **Status**: Draft（已根据审计重新定调）
- **依赖**: P0 + P1 已合并
- **日期**: 2026-05-11
- **预计影响**: 新 phase 减少一个 state 文件；清理一份从未生效的孤儿模板；避免未来新人基于错误模板误解 ROADMAP 结构

## Why

诊断报告（`wf-spicy-pudding.md`）P2 建议三项 state 精简。并行审计后事实与原诊断有两处偏差：

| 原诊断假设 | 审计事实 | 最终决策 |
|---|---|---|
| DISCUSSION-LOG 很少被下游读取 | ✅ 确认零代码引用，下游只读 CONTEXT.md | **执行合并** |
| ROADMAP.md 有 status 列与 STATE.md 双写 | ❌ 实际 ROADMAP 没有 status 列，只有 `wf/templates/roadmap.md` 孤儿模板带假占位符 | **改写为清理孤儿模板** |
| HANDOFF.json + CONTINUATION.md 是两套重复机制 | ❌ 两者承担正交生命周期（事件型 vs 状态型），合并会引入并发风险 | **取消** |

## What Changes

### 1. DISCUSSION-LOG.md 合并进 CONTEXT.md 附录

**改动**：discuss-phase 产出单一 CONTEXT.md，含 `## Decisions`（原内容）+ `## Discussion Log`（原 DISCUSSION-LOG 内容作为折叠附录）。

**边界**：
- 仅对**新 phase** 生效；已归档的历史 phase 保留独立 DISCUSSION-LOG.md 不迁移
- 下游 workflow 无需改（本来就只读 CONTEXT.md）
- hook 状态机无影响（本来就不看 DISCUSSION-LOG）

**改动文件**：
- `wf/workflows/discuss-phase.md` — 3 处（line 7 / 170 / 196）
- `wf/skills/wf-discuss-phase/SKILL.md` — line 16（同步文案）
- 文档同步：`ARCHITECTURE.md`、`CLAUDE.md:201`、`docs/wf-architecture.md`、`docs/workflow-diagram.md:74`

### 2. 清理 `wf/templates/roadmap.md` 孤儿模板

**改动**：该模板文件被 `install.sh` 安装到用户 `$HOME/.claude/wf/templates/` 但**从未被任何代码引用**（`{{phase_rows}}` / `{{phase_details}}` 占位符从未被替换）。实际 ROADMAP 由 `agents/wf-roadmapper.md:76-80` 的 agent 指令生成，格式不含 status 列。

两个可选路径：
- **A. 删除整个模板**：从 `wf/templates/roadmap.md` + `wf/bin/install.sh:384` cp 清单
- **B. 保留并修正**：把"状态"列删掉，加顶部注释"实际 ROADMAP 由 wf-roadmapper agent 生成，本模板仅供人类参考。status 由磁盘反推，不在此表维护"

**推荐 B**（保留作为人类可读参考，但去除误导内容）。成本 5 分钟，风险零，零行为影响。

### 3. HANDOFF.json + CONTINUATION.md 合并 — **取消**

保持现状。审计结论：合并会引入并发覆写风险，manual pause 可能被 autonomous 覆写。两种生命周期（事件型 vs 状态型）分开最清晰。

若未来真想进一步规整，建议路径（非本提案范围）：CONTINUATION 也纳入 CLI 封装（`wf-tools session checkpoint-auto`），消除 LLM 直写裸 Markdown 的 schema 风险。

## Capabilities

### Modified Capabilities

- `wf-discuss-phase`: 产出合并为单文件 CONTEXT.md
- `wf/templates/roadmap.md`: 与 agent 实际生成格式对齐

### 无 New / Removed

## Impact

| 文件 | 动作 | 说明 |
|---|---|---|
| `wf/workflows/discuss-phase.md` | Edit | 3 处：产出说明 + 保存段落 + checklist |
| `wf/skills/wf-discuss-phase/SKILL.md` | Edit | frontmatter 或正文提及 DISCUSSION-LOG 处 |
| `wf/templates/roadmap.md` | Edit | 改表头 + 加顶部注释 |
| `ARCHITECTURE.md` | Edit | 目录示意图 3 处 DISCUSSION-LOG 提及 |
| `CLAUDE.md` | Edit | line 201 文件清单 |
| `docs/wf-architecture.md` | Edit | 3 处 |
| `docs/workflow-diagram.md` | Edit | line 74 |
| `docs/proposals/P2-state-simplification.md` | Create | 本文件 |

**不改**：agent / hook / CLI lib / settings.json / 其他 workflow / HANDOFF + CONTINUATION 相关任何文件。

## 风险与回滚

- **风险**（DISCUSSION-LOG 合并）：CONTEXT.md 体积增长。通常几 KB，对 context-monitor 阈值无实际影响。下游 workflow 本就只读 CONTEXT，信息完整性不变。
- **风险**（roadmap 模板）：纯装饰改动，无功能影响。
- **回滚**：两项改动独立，git revert 单 commit 即可恢复。

## 验证

1. **新项目端到端**：新建测试目录 → `/wf-new-project --auto` → `/wf-discuss-phase 1 --auto` → 确认 `.planning/phases/01-*/` 下只有 CONTEXT.md（无 DISCUSSION-LOG.md），且 CONTEXT.md 含 `## Discussion Log` 章节
2. **下游 workflow 回归**：继续跑 `/wf-plan-phase 1` → 确认无"DISCUSSION-LOG.md 不存在"类错误
3. **历史 phase 保留**：若有既存 phase 目录带 DISCUSSION-LOG.md，不应被删除或报错
4. **文档同步一致性**：grep `DISCUSSION-LOG` 应只剩历史注记或迁移说明

## 执行顺序（建议 commit 粒度）

1. `feat(discuss-phase): DISCUSSION-LOG 合并进 CONTEXT.md 附录` — 核心改动
2. `refactor(templates): 修正 roadmap 孤儿模板与实际生成格式对齐` — 独立低风险改动
3. `docs: 同步 P2 state 精简（ARCHITECTURE / CLAUDE / docs）` — 文档同步
