<purpose>
完成里程碑。验证所有阶段就绪，归档所有规划工件到 `.planning/milestones/<version>/`，
重置项目状态以准备下一个里程碑，可选自动启动 new-milestone 流程。

产出:
- `.planning/milestones/<version>/` -- 归档目录（ROADMAP、REQUIREMENTS、STATE、phases）
- 更新后的 `.planning/PROJECT.md` -- 里程碑完成记录
- 重置后的 `.planning/STATE.md` -- 新里程碑初始状态
- Git tag `<version>` -- 里程碑版本标签

> **参考:**
> - Agent 合同定义见 `wf/references/agent-contracts.md`
> - Git 约定（里程碑 tag、归档 commit scope）见 `wf/references/git-conventions.md`
</purpose>

<flags>
- `[version]` -- 可选，直接指定版本号（如 `v1.0`）。不指定时交互式确认。
</flags>

<process>

<step name="verify_readiness">
## 1. 验证里程碑就绪状态

检查所有阶段完成情况和需求覆盖：

```bash
# 获取路线图分析结果
ROADMAP_JSON=$(node "$HOME/.claude/wf/bin/wf-tools.cjs" roadmap analyze)
```

从 `ROADMAP_JSON` 解析每个阶段的 `disk_status` 字段：
- 统计总阶段数和已完成阶段数（`disk_status === 'complete'`）
- 如果有未完成阶段，列出清单并警告用户

解析 `.planning/REQUIREMENTS.md` 追溯表：
- 统计 v1 需求总数和已勾选 `[x]` 的数量
- 如果有未完成需求，列出清单

**确认版本号：**
- 如果 `$ARGUMENTS` 包含版本号，使用该版本
- 否则从 STATE.md 读取当前 milestone 字段作为建议版本
- 验证版本格式匹配 `v\d+\.\d+`（例如 v1.0、v2.1）
- 格式错误时提示用户重新输入

展示就绪摘要（ui-brand 标准横幅: 版本、阶段完成比、需求覆盖比；检查点框: 阶段完成状态、需求覆盖状态）。

如果有未完成项，提供选项：
1. **继续** -- 标记里程碑完成（已知缺口记录在 PROJECT.md）
2. **取消** -- 返回开发，先完成剩余工作

等待用户确认后继续。
</step>

<step name="archive">
## 2. 执行归档

使用 wf-tools CLI 执行归档操作（per D-07）：

```bash
# 归档里程碑工件到 .planning/milestones/<version>/
ARCHIVE_RESULT=$(node "$HOME/.claude/wf/bin/wf-tools.cjs" milestone archive {{version}})
```

解析 `ARCHIVE_RESULT`：
- `success: true` → 继续
- `success: false` → 显示 `error` 字段，停止执行

验证归档完整性：
- 确认 `archive_dir` 存在
- 确认 `files_copied > 0`
- 如果有 `warnings`，显示但继续

创建 Git 标签：

```bash
git tag {{version}} -m "Milestone {{version}} complete"
```

提交归档文件：

```bash
git add .planning/milestones/{{version}}/
git commit -m "chore: archive milestone {{version}}"
```

显示归档结果（ui-brand 检查点框: 归档目录路径、文件数量、Git 标签）。
</step>

<step name="update_project_md">
## 3. 更新 PROJECT.md

读取 `.planning/PROJECT.md`，记录里程碑完成信息。

**检查是否有 Key Decisions 表格：**
- 如果有 `## Key Decisions` 或类似表格 → 添加里程碑完成行
- 如果没有 → 在文件末尾（`---` 分隔线之前）追加 `## Completed Milestones` 段落

添加条目：

```markdown
| {{version}} | {{date}} | {{phase_count}} phases, {{req_count}} requirements |
```

**更新 Active/Validated 需求：**
- 已完成的需求从 Active 移动到 Validated，标注版本号
- 格式: `- ✓ [需求描述] — {{version}}`

**更新 Last updated 标注：**

```markdown
---
*Last updated: {{date}} after {{version}} milestone*
```

写入更新后的 PROJECT.md。
</step>

<step name="reset_state">
## 4. 重置项目状态

使用 wf-tools CLI 执行状态重置（per D-08）：

```bash
# 清空 phases/ 目录，删除 ROADMAP.md 和 REQUIREMENTS.md
# 保留: PROJECT.md, STATE.md, config.json, milestones/
RESET_RESULT=$(node "$HOME/.claude/wf/bin/wf-tools.cjs" milestone reset)
```

解析 `RESET_RESULT` 确认清理完成。

**计算下一版本号：**
- 从当前版本解析 major.minor
- 默认递增 minor：v1.0 → v1.1，v2.3 → v2.4
- 用户可在 new-milestone 流程中修改

**更新 STATE.md：**

> **阶段编号重置（per D-08）:** 新里程碑的阶段编号从 1 开始，与前一个里程碑的阶段编号无关。
> `milestone reset` CLI 命令会清空 phases/ 目录，后续 new-milestone 生成的 ROADMAP.md 从 Phase 1 开始编号。

```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" state set \
  --milestone "{{next_version}}" \
  --status "new-milestone" \
  --stopped_at "Milestone {{version}} archived, starting {{next_version}}"
```

显示重置结果（ui-brand 检查点框: 清理目录数、删除文件数、STATE.md 更新状态、下一里程碑版本）。
</step>

<step name="chain_new_milestone">
## 5. 自动链接新里程碑（per D-09）

显示归档完成消息（ui-brand 标准横幅: 版本号、已归档阶段数、已归档文件数、git 标签、归档位置）。

读取 `.planning/config.json` 的 `milestone.auto_new_milestone` 配置：

```bash
CONFIG_JSON=$(cat .planning/config.json 2>/dev/null)
```

从 `CONFIG_JSON` 解析 `milestone.auto_new_milestone` 字段。

**如果 `auto_new_milestone === true`：**

跳过用户确认，直接启动新里程碑流程：

```
▶ milestone.auto_new_milestone 已启用
▶ 自动启动新里程碑流程...
```

通过 Skill() 链接到 new-milestone 工作流：

```
Skill(new-milestone)
```

按照 `wf/workflows/new-milestone.md` 端到端执行新里程碑初始化。

**如果 `auto_new_milestone === false` 或字段不存在：**

提供手动链接选项（per D-09: 归档完成后可启动 new-milestone 流程）：

询问用户：

> 输入 **继续** 启动新里程碑流程，或 **跳过** 稍后手动运行 `/wf-new-milestone`

**如果用户选择继续：**

```
▶ 启动新里程碑流程...
```

通过 Skill() 链接到 new-milestone 工作流：

```
Skill(new-milestone)
```

按照 `wf/workflows/new-milestone.md` 端到端执行新里程碑初始化。

**如果用户选择跳过：** 显示下一步路由（ui-brand 检查点框: /wf-new-milestone、/wf-progress）。
</step>

</process>

<safety_constraints>
- **版本格式验证:** 版本号必须匹配 `/^v\d+\.\d+$/`（T-06-11）
- **归档先于重置:** archive 步骤必须在 reset 之前完成，确保数据不丢失（T-06-13）
- **Git 标签不可变:** 创建标签提供里程碑历史的不可变标记（T-06-14）
- **状态变更通过 CLI:** 所有 STATE.md 变更通过 `wf-tools state` 命令（Phase 2 约束）
- **归档操作通过 CLI:** 归档和重置通过 `wf-tools milestone` 命令（Phase 1 约束）
</safety_constraints>

<success_criteria>
- [ ] 路线图分析验证所有阶段完成状态
- [ ] 需求覆盖率已检查并向用户展示
- [ ] 版本号格式已验证（v\d+\.\d+）
- [ ] 归档目录 `.planning/milestones/<version>/` 已创建且包含完整工件
- [ ] Git 标签 `<version>` 已创建
- [ ] PROJECT.md 已更新里程碑完成记录
- [ ] phases/ 目录已清空，ROADMAP.md 和 REQUIREMENTS.md 已删除
- [ ] STATE.md 已重置为新里程碑初始状态
- [ ] 用户可选择自动启动 new-milestone 或稍后手动运行
</success_criteria>
