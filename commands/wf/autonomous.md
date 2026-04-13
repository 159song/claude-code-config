---
name: wf:autonomous
description: 全自动执行所有剩余阶段 -- 讨论->规划->执行->验证
argument-hint: "[--from N] [--to N] [--only N] [--interactive]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---
<objective>
全自动执行所有剩余阶段。对每个阶段按 Skill() 链执行: 讨论 -> 规划 -> 执行 -> 验证。
只在需要用户判断时暂停（验证失败、context 不足、阻塞问题）。

这是 WF 系统的推荐默认入口。

产出:
- 每个阶段的完整 artifact (CONTEXT, PLAN, SUMMARY, VERIFICATION)
- `.planning/STATE.md` -- 通过 `wf-tools state` CLI 命令更新（禁止直接 Write/Edit）
</objective>

<execution_context>
@$HOME/.claude/wf/workflows/autonomous.md
@$HOME/.claude/wf/references/ui-brand.md
</execution_context>

<context>
$ARGUMENTS
</context>

<process>
按照 @$HOME/.claude/wf/workflows/autonomous.md 中的步骤端到端执行。

核心流程:
1. 解析 flags（--from/--to/--only/--interactive），发现待执行阶段
2. 对每个阶段依次执行 Skill() 链:
   - Skill(discuss-phase) -- 默认 --auto --batch，--interactive 时为交互模式
   - Skill(plan-phase) -- 质量门禁由 plan-phase 内部处理
   - Skill(execute-phase) -- wave 级并行执行
   - Skill(verify-work) -- 验证失败时执行单次 gap closure 重试
3. 每个阶段开始前检查 context 预算，不足时暂停
4. 验证失败后单次 gap closure，仍失败则暂停（不跳阶段）
5. 所有阶段完成后显示汇总，建议 /wf-verify-work 最终验收
</process>
