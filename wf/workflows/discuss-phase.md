<purpose>
讨论指定阶段的设计决策和灰色地带。
识别需要人类判断的决策点，进行结构化讨论，记录结论。

产出文件：
- `.planning/phase-{N}/CONTEXT.md` — 阶段上下文和决策记录
- `.planning/phase-{N}/DISCUSSION-LOG.md` — 讨论过程记录
</purpose>

<flags>
- `--auto` — 自动模式。AI 自主分析灰色地带并给出推荐方案，用户只需批量确认。
- `--chain` — 链式模式。完成后自动调用 `/wf-plan-phase N`。
- `--batch` — 批量模式。将所有决策点汇总为一个表格，一次性确认。
</flags>

<process>

<step name="load_context">
## 1. 加载阶段上下文

读取以下文件：
- `.planning/ROADMAP.md` — 获取阶段 N 的目标和描述
- `.planning/REQUIREMENTS.md` — 获取相关需求
- `.planning/PROJECT.md` — 获取项目上下文
- `.planning/STATE.md` — 检查是否有之前的讨论进度

如果 `.planning/phase-{N}/CONTEXT.md` 已存在，加载已有决策（支持会话恢复）。

验证阶段 N 在 ROADMAP.md 中存在，否则报错退出。
</step>

<step name="identify_gray_areas">
## 2. 识别灰色地带

按领域类型扫描潜在的灰色地带：

**前端灰色地带：**
- 状态管理方案（local state / context / 状态库）
- 路由策略（文件路由 / 手动路由）
- 样式方案（CSS Modules / Tailwind / CSS-in-JS）
- 组件粒度（原子组件 vs 组合组件）

**后端灰色地带：**
- 认证方案（session / JWT / OAuth）
- 数据库选择和 ORM
- API 风格（REST / GraphQL / tRPC）
- 错误处理策略

**架构灰色地带：**
- monorepo vs multi-repo
- 微服务 vs 单体
- 部署策略
- CI/CD 流水线

**安全灰色地带：**
- 输入验证策略
- 密钥管理
- CORS 配置
- 速率限制

只保留与当前阶段**直接相关**的灰色地带。
</step>

<step name="codebase_scouting">
## 3. 代码库侦察

如果项目已有代码，扫描代码库提取已有决策：

```bash
# 检测已有模式
ls src/ 2>/dev/null
cat package.json 2>/dev/null | head -50
ls -la *.config.* 2>/dev/null
```

已有的技术选择直接采纳，标记为"已确定"，不作为灰色地带讨论。
</step>

<step name="discuss_or_auto">
## 4. 讨论决策

### 交互模式（默认）

逐个展示灰色地带，提供选项：

```
┌─ 决策点 1/5 ──────────────────────────────┐
│ 状态管理方案                               │
│                                           │
│ A) React Context（简单，适合小型应用）      │
│ B) Zustand（轻量，适合中型应用）            │
│ C) Redux Toolkit（完整，适合大型应用）      │
│ D) Jotai（原子化，适合细粒度状态）          │
│                                           │
│ 📌 推荐: B — 基于项目规模和技术栈          │
└───────────────────────────────────────────┘
```

### Auto 模式（`--auto`）

AI 自主选择推荐方案，汇总为决策表：

```
## 自动决策摘要

| # | 决策点 | 选择 | 原因 |
|---|--------|------|------|
| 1 | 状态管理 | Zustand | 项目规模适中，团队熟悉度高 |
| 2 | 样式方案 | Tailwind | 项目已配置，保持一致 |
| 3 | API 风格 | REST | 客户端简单，无需 GraphQL |

确认以上决策？ [Y/n]
```

### Batch 模式（`--batch`）

与 auto 类似，但将所有决策合并为一个确认步骤。

### 先前决策延续

如果 CONTEXT.md 已有记录的决策，直接采纳，不重新讨论。
展示"已有决策"部分让用户知晓。
</step>

<step name="advisor_research" condition="存在需要深入研究的决策">
## 5. 顾问研究（可选）

对于复杂决策，启动并行研究 agent：

```javascript
Agent({
  subagent_type: "wf-researcher",
  prompt: "比较 {{选项A}} vs {{选项B}} 在 {{项目上下文}} 中的适用性..."
})
```

研究结果附加到决策点描述中，帮助用户做出更好的选择。
</step>

<step name="save_context">
## 6. 保存阶段上下文

生成 `.planning/phase-{N}/CONTEXT.md`：

```markdown
# Phase {N}: {{name}} — 上下文

## 阶段目标
{{goal}}

## 关键决策

### 决策 1: {{topic}}
- **选择:** {{choice}}
- **原因:** {{reason}}
- **替代方案:** {{alternatives}}

## 技术约束
{{constraints}}

## 依赖关系
{{dependencies}}
```

生成 `.planning/phase-{N}/DISCUSSION-LOG.md` 记录完整讨论过程。

提交到 git：
```bash
git add .planning/phase-{N}/
git commit -m "docs(phase-{N}): complete discussion — {{decisions_count}} decisions"
```
</step>

<step name="route_next">
## 7. 路由下一步

```
✅ 阶段 {N} 讨论完成 — {decisions_count} 个决策已记录

▶ 下一步: /wf-plan-phase {N}
```

如果 `--chain` 模式，自动调用 `/wf-plan-phase N`。
</step>

</process>

<success_criteria>
- [ ] 所有灰色地带已识别并处理
- [ ] CONTEXT.md 包含所有决策和原因
- [ ] DISCUSSION-LOG.md 记录完整过程
- [ ] 已有代码的技术选择被正确采纳
- [ ] 文件已提交到 git
</success_criteria>
