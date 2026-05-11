<!--
WF Roadmap Template (human-reference only)

注意：本模板只作为人类参考骨架展示实际 ROADMAP.md 的样貌。
真正的 ROADMAP.md 由 `agents/wf-roadmapper.md` 在 /wf-new-project / /wf-new-milestone
流程中按 agent 指令直接生成，**不会经过本模板的占位符替换**（WF 代码库中无 substitution 逻辑）。

阶段状态（已完成 / 进行中 / 未开始）由 wf-tools CLI 在运行时根据磁盘反推：
  - 检测 phase 目录下 VERIFICATION.md / SUMMARY.md / PLAN*.md / CONTEXT.md 的存在性
  - 见 wf/bin/lib/roadmap.cjs 的 disk_status 逻辑
因此本表格 **不维护 status 列**，避免与磁盘 SSOT 双写漂移。
-->

# 路线图

## 里程碑: {{milestone_name}}

### 阶段概览

| 阶段 | 名称 | 描述 | 依赖 | 预期复杂度 |
|------|------|------|------|-----------|
| 1 | 项目基础设施 | 初始化项目、配置开发环境 | 无 | 低 |
| 2 | {{name}} | {{desc}} | Phase 1 | 中 |

---

## Phase 1: 项目基础设施

**目标:** 建立可运行的项目骨架和开发环境

**交付物:**
- 项目目录结构
- 基础配置文件
- 开发服务器可启动

**需求覆盖:** FR-1（部分）

## Phase 2: {{name}}

**目标:** {{goal}}

**交付物:**
- {{deliverable_1}}
- {{deliverable_2}}

**依赖:** Phase 1

**需求覆盖:** FR-2, FR-3
