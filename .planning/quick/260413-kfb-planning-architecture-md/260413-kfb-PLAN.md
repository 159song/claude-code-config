---
phase: quick-260413-kfb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/ARCHITECTURE.md
autonomous: true
requirements: []
must_haves:
  truths:
    - ".planning/ARCHITECTURE.md contains the '整体执行流程' section with mermaid flowchart"
    - "The section is positioned between '概述' and '系统分层', matching root ARCHITECTURE.md structure"
    - "Content of the inserted section is identical to ./ARCHITECTURE.md lines 14-126"
  artifacts:
    - path: ".planning/ARCHITECTURE.md"
      provides: "Complete architecture doc with execution flow diagram"
      contains: "## 整体执行流程"
  key_links: []
---

<objective>
Sync `.planning/ARCHITECTURE.md` with root `./ARCHITECTURE.md` by inserting the missing "整体执行流程" mermaid flowchart section.

Purpose: The root `./ARCHITECTURE.md` was updated (quick task 260413-k6w) to include an "整体执行流程" section (lines 14-126) between "概述" and "系统分层". The `.planning/` copy was not updated and is now out of sync. This task restores parity.

Output: Updated `.planning/ARCHITECTURE.md` with the flowchart section inserted.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./ARCHITECTURE.md (source of truth — has the flowchart at lines 14-126)
@.planning/ARCHITECTURE.md (target — missing the flowchart section)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Insert "整体执行流程" section into .planning/ARCHITECTURE.md</name>
  <files>.planning/ARCHITECTURE.md</files>
  <action>
Read `.planning/ARCHITECTURE.md`. It currently has:
- Line 11: `---` (horizontal rule after "概述" section)
- Line 13: `## 系统分层` (start of next section)

Read `./ARCHITECTURE.md` lines 14-127. This block contains:
- `## 整体执行流程` heading
- The mermaid flowchart code block (flowchart TD with 4 paths: 新项目, 快速任务, 阶段生命周期, 全自动)
- The "### 流程要点" subsection with the summary table
- A trailing `---` horizontal rule

Insert this entire block (lines 14-127 from `./ARCHITECTURE.md`) into `.planning/ARCHITECTURE.md` between the `---` after "概述" (line 11) and `## 系统分层` (currently line 13). The result should be:
1. "概述" section ending with `---`
2. NEW: "整体执行流程" section (identical to root version)
3. NEW: `---` separator
4. "系统分层" section continuing as before

Do NOT change any other content. Only insert the missing section.
  </action>
  <verify>
    <automated>diff <(sed -n '1,127p' ./ARCHITECTURE.md) <(sed -n '1,127p' .planning/ARCHITECTURE.md) && echo "MATCH: First 127 lines identical"</automated>
  </verify>
  <done>
- `.planning/ARCHITECTURE.md` contains `## 整体执行流程` section with full mermaid flowchart
- Section is positioned between "概述" and "系统分层" (same structure as root version)
- All content after the inserted section is unchanged
- The first 127 lines of both files are identical
  </done>
</task>

</tasks>

<verification>
- `grep -c "## 整体执行流程" .planning/ARCHITECTURE.md` returns 1
- `diff ./ARCHITECTURE.md .planning/ARCHITECTURE.md` returns no differences (files are identical)
</verification>

<success_criteria>
- `.planning/ARCHITECTURE.md` and `./ARCHITECTURE.md` have identical content
- The "整体执行流程" mermaid flowchart section exists in both files between "概述" and "系统分层"
</success_criteria>

<output>
After completion, create `.planning/quick/260413-kfb-planning-architecture-md/260413-kfb-SUMMARY.md`
</output>
