# P1 提案：Autonomous 长链路代币优化

- **Change ID**: `P1-autonomous-token-optimization`
- **Status**: Draft（待审）
- **依赖**: P0 已合并（`docs/proposals/P0-skill-consolidation.md`）
- **日期**: 2026-05-11
- **预计影响**: autonomous 长链路代币节省 **20–30%**（保守）；不动架构、不动 skill 触发、不影响手动模式

## Why

诊断报告（`wf-spicy-pudding.md`）在 P1 层识别了 autonomous 长链路的 3 个**可量化浪费**：

| # | 现象 | 文件位置 | 浪费来源 |
|---|---|---|---|
| 1 | autonomous 每个 phase 的 plan-phase 都会跑 research | `autonomous.md:148` 调用 `Skill(plan-phase, { phase: N })` 没传 flag | 每阶段多一次 wf-researcher agent 调用 |
| 2 | autonomous 下 verify-work 会重复执行 build/test | `verify-work.md:36-48` smoke 步骤无视 execute-phase 末尾已跑过的 VERIFICATION.md | 每阶段多跑一次 build + test |
| 3 | Phase 1 刚从 new-project 出来就跑 discuss-phase 走过场 | `discuss-phase.md` 的 identify_gray_areas + codebase_scouting 在空项目上没事可扫 | new-project 已产出决策，讨论不贡献信息 |

这三个都是**"信息已存在但被重新生成"**的场景，最适合由系统层自动规避。用户手动模式不应受影响——只在 autonomous 编排时做智能裁剪。

## What Changes

### 1. autonomous 调用 plan-phase 时强制 `--skip-research`

**现状**：`wf/workflows/autonomous.md:148`

```
Skill(plan-phase, { phase: N })
```

**改为**：

```
// autonomous 默认复用该阶段的既有研究（如有），或跳过研究
// 例外：config.workflow.research_in_autonomous === true 时仍跑研究（默认 false）
Skill(plan-phase, { phase: N, flags: "--skip-research" })
```

**设计理由**：
- new-project 已启动 4 路并行 wf-researcher 产出全局调研；每个 phase 的"实现级研究"在 autonomous 下大多重复全局调研
- 用户显式调 `/wf-plan-phase N` 时仍默认跑 research（不变）
- 留 `config.workflow.research_in_autonomous` 开关给长链路需要深度 research 的项目

**新增配置**：`wf/templates/config.json`
```json
{
  "workflow": {
    "research_in_autonomous": false
  }
}
```

### 2. autonomous 模式下 verify-work 复用 VERIFICATION.md

**现状**：`wf/workflows/verify-work.md:31-68` 的 smoke 步骤总是重新跑 build/test，不管 execute-phase 末尾已产出 VERIFICATION.md。

**改为**：在 smoke 步骤开头加**前置检查**：

```markdown
<step name="smoke_test" condition="--smoke 或首次 UAT 或 autonomous 模式">
## 2. 冒烟测试

### 2.0 复用前置验证（autonomous 优化）

如果 `--smoke` 由 autonomous 调用，先检查 execute-phase 刚产出的 VERIFICATION.md：

```bash
PHASE_DIR=$(node "$HOME/.claude/wf/bin/wf-tools.cjs" phase info --current | jq -r .dir)
VERIFICATION_FILE="${PHASE_DIR}/VERIFICATION.md"

if [[ -f "$VERIFICATION_FILE" ]]; then
  # 读取产出时间戳与内容
  VERIFIED_AT=$(stat -f %m "$VERIFICATION_FILE" 2>/dev/null || stat -c %Y "$VERIFICATION_FILE")
  NOW=$(date +%s)
  AGE=$((NOW - VERIFIED_AT))

  # 条件：< 10 分钟 且 无 FAIL 且 全部 4 级通过
  if [[ $AGE -lt 600 ]] && ! grep -q "FAIL" "$VERIFICATION_FILE" \
     && grep -q "DATA-FLOWING.*PASS" "$VERIFICATION_FILE"; then
    echo "✓ Reusing recent VERIFICATION.md (age: ${AGE}s)"
    # 跳过 build/test，只跑启动检查（curl 确认 dev server 起得来）
    SKIP_BUILD_TEST=true
  fi
fi
```

后续 build/test 步骤：

```bash
if [[ "$SKIP_BUILD_TEST" != "true" ]]; then
  npm run build 2>&1 || echo "BUILD_FAIL"
  npm test 2>&1 || echo "TEST_FAIL"
fi

# 启动检查永远跑（便宜且关键）
npm run dev &
sleep 5
curl -s http://localhost:3000 > /dev/null && echo "SERVER_OK" || echo "SERVER_FAIL"
kill %1 2>/dev/null
```
```

**设计理由**：
- 时间窗口 `< 10 分钟` 保证是同次 autonomous 内产物，不是前一天的陈旧 VERIFICATION
- `grep -q FAIL` + `DATA-FLOWING.*PASS` 双重校验，任何不通过都回退完整 smoke
- 启动检查（curl 一次）仍跑，因为构建产物 ≠ 运行时 OK
- 手动 `/wf-verify-work --smoke`（非 autonomous）不受影响，时间窗口会把 VERIFICATION 排除

**需要配合的修改**：`wf-tools phase info --current` 需要返回当前 phase 目录绝对路径。若 CLI 未实现该参数，改用 grep + STATE.md 读取。

### 3. autonomous 在 Phase 1 且新项目时跳过 discuss

**现状**：`wf/workflows/autonomous.md:122-131` 无条件调用 discuss-phase。

**改为**：在 autonomous 的 discuss step 前加**冷启动检测**：

```markdown
### 2.2 Discuss Phase

**新项目冷启动跳过**（P1 优化）：

如果满足全部条件，跳过 discuss 直接进入 plan：
1. `phase === 1`（最小阶段号）
2. `.planning/PROJECT.md` 存在且 mtime < 1 小时（刚从 new-project 出来）
3. `.planning/phase-1/CONTEXT.md` 不存在（没有既有讨论）

显示："⏭ Phase 1 cold-start: PROJECT.md 刚产出，跳过 discuss（决策已由 new-project 收集）"

然后生成最小 CONTEXT.md 占位（只含指向 PROJECT.md 的引用）：

```markdown
---
phase: 1
auto_generated: true
source: PROJECT.md
---

# Phase 1 Context (Auto-Generated)

本阶段决策来自 new-project 的问答答复，详见 `.planning/PROJECT.md`。
若需补充决策，运行 `/wf-discuss-phase 1 --auto` 重新生成。
```

这样 hook 的 "has CONTEXT.md → step=discuss 已完成" 判定仍成立。

**所有其他情况**走原有逻辑（包括 phase>=2、老项目续跑、用户手动调 discuss-phase）。
```

**设计理由**：
- 条件 1 限定仅 Phase 1（Phase 2+ 的 discuss 有实际价值，不能跳）
- 条件 2 时间窗口限定"刚从 new-project 出来"，避免老项目重启 autonomous 误触
- 条件 3 保留用户主动 pre-discuss 的权利
- 占位 CONTEXT.md 保持 hook 状态机一致（避免 `has_context=false` 触发重跑）
- 用户显式 `/wf-discuss-phase 1` 走原路，不受影响

## Capabilities

### Modified Capabilities

- `wf-autonomous`: plan 阶段加 `--skip-research`；discuss 阶段冷启动跳过；verify 阶段复用 VERIFICATION.md
- `wf-verify-work`: smoke 步骤前置读取 VERIFICATION.md 时间戳
- `config.json`: 新增 `workflow.research_in_autonomous` 开关

### New Capabilities

无（纯优化）

### Removed Capabilities

无

## Impact

| 文件 | 动作 | 说明 |
|---|---|---|
| `wf/workflows/autonomous.md` | Edit | plan-phase 调用加 `--skip-research`；discuss step 加冷启动跳过；doc 更新 |
| `wf/workflows/verify-work.md` | Edit | smoke step 前置加 VERIFICATION.md 复用逻辑 |
| `wf/templates/config.json` | Edit | 新增 `workflow.research_in_autonomous: false` |
| `docs/wf-flags-cheatsheet.md` | Edit | 记录 autonomous 的隐式 flag 强制 |
| `ARCHITECTURE.md` | Edit | 在 P1 优化章节记录三项改动 |
| `docs/proposals/P1-autonomous-token-optimization.md` | Create | 本文件 |
| `wf/bin/lib/phase-info.cjs`（若存在）| 审查 | 确认能返回 phase dir 绝对路径；不行则改用 STATE.md grep |

**不改**：agent 文件、hook、skill frontmatter、CLI 顶层命令、settings.json。

## 风险与回滚

- **风险 1**（--skip-research）：部分项目的 phase 级 research 确实有价值。缓解：`config.workflow.research_in_autonomous: true` 手动开启；诊断显示 autonomous 全程 <20min 的项目几乎不需要 phase 级 research。
- **风险 2**（复用 VERIFICATION.md）：execute-phase 的 VERIFICATION 可能存在"lint 通过但运行时 fail"。缓解：启动检查 `curl` 仍跑，能捕获运行时问题；`grep -q FAIL` 双保险。
- **风险 3**（Phase 1 跳过 discuss）：若用户特意想在 new-project 后做 phase-1 讨论，会被跳过。缓解：冷启动检测的第 3 个条件是"CONTEXT.md 不存在"，用户预先跑 `/wf-discuss-phase 1` 就会被识别保留。
- **风险 4**（占位 CONTEXT.md）：下游 agent 读到空 CONTEXT 可能报错。缓解：占位文件中明确写"决策详见 PROJECT.md"，并在 plan-phase 的 load_context step 加 PROJECT.md fallback 读取（本提案不改 plan-phase，但记录后续若有问题追加一行）。
- **回滚路径**：三项改动彼此独立，可按 commit 独立 revert。

## 验证

1. **构造测试项目** A：新建空目录，跑 `/wf-new-project --auto` → `/wf-autonomous`，观察：
   - Phase 1 discuss step 是否跳过并生成占位 CONTEXT.md
   - 每个 phase 的 plan-phase 日志是否显示 "skipping research"
   - 每个 phase 的 verify-work 是否显示 "Reusing recent VERIFICATION.md"
2. **代币对比**：记录改动前后同一项目 autonomous 完整运行的总 token 消耗（从 session metrics 或 statusline 历史），目标 **-20%**。
3. **手动模式回归**：手动跑 `/wf-plan-phase 2` 不加 flag → 仍跑 research（未受影响）。手动跑 `/wf-verify-work --smoke`（非 autonomous 调用）→ 时间窗口不命中（VERIFICATION 已老），跑完整 smoke。
4. **老项目回归**：在已有 3 个 phase completed 的项目运行 `/wf-autonomous --from 4`，观察 phase 4 的 discuss 是否正常执行（`PROJECT.md` mtime > 1h 条件不命中，不跳过）。
5. **文档同步**：`ARCHITECTURE.md` / `docs/wf-flags-cheatsheet.md` 更新反映三项改动。

## 执行顺序（建议 commit 粒度）

1. `feat(autonomous): 调 plan-phase 时默认附加 --skip-research` — 最小风险，可独立观察
2. `feat(autonomous): Phase 1 冷启动跳过 discuss` — 生成占位 CONTEXT.md 逻辑
3. `feat(verify-work): smoke 模式复用近期 VERIFICATION.md` — 最大节省项
4. `feat(config): 新增 workflow.research_in_autonomous 开关`（与 step 1 同一包或独立）
5. `docs: 同步 ARCHITECTURE.md + flag cheatsheet + P1 提案记录`

每步独立 commit。步骤 1/2 可以并行改（不冲突），步骤 3 涉及不同文件也可独立。
