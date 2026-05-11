# Git Conventions — WF 权威参考

> 本文档是 WF 工作流系统中**所有 git 操作的权威约定**。
> 继承自用户全局 `~/.claude/CLAUDE.md` 的 Git Conventions (Global Default)，并在其基础上增加 WF 特定扩展（phase / change / worktree / milestone）。
>
> 被以下工作流引用：
> - `wf/workflows/new-project.md`、`complete-milestone.md` —— 初始化 / 里程碑
> - `wf/workflows/execute-phase.md`、`quick.md` —— 阶段执行与快速任务
> - `commands/wf/apply-change.md` —— 变更应用
> - `agents/wf-executor.md`、`agents/wf-reviewer.md` —— 执行与审查
>
> **优先级**：全局规范是 baseline；本文提出的 WF 扩展仅在"更具体"（如 phase scope、worktree 合并策略）时覆盖全局。任何时候，**项目级 `CLAUDE.md` 的显式约束 > 本文档 > 全局 `~/.claude/CLAUDE.md`**。

---

## 1. Branch Naming（分支命名）

继承自全局规范，**不额外扩展**：

| Branch | 用途 | WF 典型触发 |
|--------|------|---|
| `master` (或 `main`) | 生产主分支，稳定发布 | 里程碑 tag 的基线 |
| `develop` | 开发主干 | 阶段执行的默认合并目标 |
| `feature/<name>` | 新功能分支（一需求一分支） | 大特性 / 跨多阶段实现 |
| `test/<name>` | 测试分支 | bug hunting |
| `release/<X.Y>` | 预发布分支 | UAT 前 |
| `hotfix/<name>` | 紧急修复 | 生产问题 |

### WF 扩展：Phase 和 Change 的分支策略（推荐，非强制）

| 场景 | 推荐分支 | 说明 |
|---|---|---|
| `/wf-execute-phase N` | `feature/phase-<N>-<slug>` | 当 phase 影响面大或多人协作时；默认**可直接在 develop**执行（WF sub-agent 已用 worktree 自动隔离，见 §5） |
| `/wf-apply-change <id>` | `feature/change-<id>` | 推荐每个 change 独立分支，与 PR 流程对齐 |
| `/wf-quick --spec <task>` | 当前分支即可 | 小任务，不单独建分支 |
| `/wf-new-project` | `develop` 或新初始化的 `main` | 视项目阶段 |
| `/wf-complete-milestone v<X.Y>` | 必在 `master`/`main` 上打 tag | `git tag v1.0` |

---

## 2. Branch / Environment Mapping

继承自全局规范：

| Branch | Role | Target Environment |
|--------|------|---|
| `master` / `main` | 稳定发布 | PRO (Production) |
| `develop` | 最新代码 | DEV |
| `feature/*` | 新功能开发 | FAT (Feature Acceptance Test) |
| `test/*` | 测试 & QA | FAT |
| `release/*` | 预发布 | UAT |
| `hotfix/*` | 紧急修复 | PRO |

> **提醒**：能访问某个环境不代表可以自由改它。Treat production gently.

---

## 3. Commit Message 规范

### 3.1 Conventional Commits 类型（继承全局）

| Type | 含义 | 示例 |
|------|---|---|
| `feat` | 新功能 | `feat: add user login` |
| `fix` | Bug 修复 | `fix: correct order total calculation` |
| `docs` | 仅文档 | `docs: update API reference` |
| `style` | 格式（不改逻辑） | `style: unify indentation` |
| `refactor` | 重构（不改行为） | `refactor: simplify order module` |
| `perf` | 性能优化 | `perf: speed up list rendering` |
| `test` | 测试相关 | `test: add unit tests for user service` |
| `chore` | 构建 / 工具 / 依赖 | `chore: bump dependency versions` |

### 3.2 WF Scope 约定（扩展）

WF 要求 commit 必须带 **scope**，用以标识本次提交归属于哪个执行上下文：

| 执行入口 | Scope 格式 | 示例 |
|---|---|---|
| `/wf-execute-phase N` / `/wf-autonomous` | `phase-<N>` | `feat(phase-1): create user model` |
| `/wf-apply-change <id>` | `change-<id>` | `feat(change-add-oauth): add OAuth callback endpoint` |
| `/wf-archive-change <id>` | `chore(spec)` | `chore(spec): archive change add-oauth, merged 2 capabilities` |
| `/wf-quick` (默认) | 无 scope 或 `quick` | `fix(quick): correct typo in README` |
| `/wf-quick --spec` | `change-<id>`（复用 apply 的约定） | — |
| `/wf-new-project` | `chore(planning)` | `chore(planning): initialize project — my-app` |
| `/wf-complete-milestone v<X.Y>` | `chore(milestone)` + git tag | `chore(milestone): archive v1.0` 然后 `git tag v1.0` |
| `/wf-propose <idea>` | `docs(spec)` | `docs(spec): propose add-oauth` |
| 文档/CLAUDE.md/架构同步 | `docs` | `docs: 同步 ARCHITECTURE.md / README.md / docs/workflow-diagram.md` |

### 3.3 Scope 的书写细节

- `phase-1` **不写** `phase-01`（阶段号取整数，不补零）
- `change-<id>` 使用 change 的 kebab-case id 原文（如 `change-add-password-reset`）
- 多 capability 变更仍用同一个 change scope，不拆分

---

## 4. Single-Commit 原则（继承全局，WF 强化）

1. **Do one thing** —— 单一职责，便于 revert
2. **规模克制** —— 单个 commit 不超过 ~13 个文件；超过说明拆得不够细
3. **Self-test before commit** —— WF 执行时由 verifier 负责；手工 commit 时自行跑相关测试
4. **Conventional message** —— 必带 type + scope + 简短动词开头的摘要
5. **Rebase upstream before push** —— 推送前先 `git pull --rebase` 或用 worktree 自动策略

### WF 强化细节

- **任务级原子性**：`wf-executor` 每完成 PLAN.md 里的**一个任务**立即 commit，不等全部任务完成
- **禁止 `--amend` / squash** —— 已 commit 就是事实；要改内容新开一个 commit
- **禁止 `--no-verify`** —— hook 失败必须查根因，不绕过（见 `~/.claude` 全局约束）
- **验证 → 提交的顺序**：task → verify → `git add` → `git commit`（见 `wf-executor.md` 和 `wf/references/anti-patterns.md`）

---

## 5. Worktree 合并策略（WF 专属）

`wf-executor` 在 sub-agent 模式下自动隔离到 git worktree：

```
主 session (develop 分支)
  │
  ├── Agent Task A (worktree 1, 临时分支 wave-1-task-A)
  │      ├── 独立 git commit（atomically）
  │      └── 返回主分支合并
  │
  ├── Agent Task B (worktree 2, 临时分支 wave-1-task-B)
  │      └── 独立 git commit / 返回合并
  │
  └── 合并回 develop
         ├── 无冲突 → fast-forward 或 merge commit
         ├── 文件冲突 → 当前 wave 降级为串行（execute-phase 会预检）
         └── 冲突严重 → 暂停请示用户
```

- 每个 worktree **独立分支**，避免并发写冲突
- 完成后 `git worktree remove` 清理
- 完整生命周期见 [`wf/references/worktree-lifecycle.md`](./worktree-lifecycle.md)

---

## 6. Milestone 与 Tag

`/wf-complete-milestone v1.0` 完成后：

1. `wf-tools milestone archive v1.0` 生成 `.planning/milestones/v1.0/` 快照
2. `chore(milestone): archive v1.0` 提交快照
3. **必须打 tag**：`git tag v1.0` 或 `git tag -a v1.0 -m "Milestone v1.0"`
4. 若已设定 release 流程，推到对应 release 分支

---

## 7. Push 与 PR 时机（WF 建议，非强制）

WF 不会自动 `git push`（push 对协作仓库是有副作用的动作，需用户显式批准）。建议：

| 时机 | 操作 |
|---|---|
| phase 全部完成且 verify PASS | `git push origin develop`（或当前 phase feature 分支） |
| change apply 完成且 archive 成功 | `git push origin feature/change-<id>`，提 PR 到 develop |
| 里程碑 tag | `git push --tags` |
| hotfix | `git push origin hotfix/<name>` 后立即 PR |

---

## 8. 违反规范的 fallback

当 WF 工作流检测到以下情形时：

| 情形 | 处理 |
|---|---|
| 工作区有未提交脏状态 | `execute-phase` 提示先 commit 或 stash，不覆盖用户改动 |
| 当前不在 git 仓库 | 降级为仅文件操作，不尝试 commit（会在 SUMMARY 中记录） |
| pre-commit hook 失败 | 不用 `--no-verify` 绕过；修复根因后重新 commit（新 commit，不 amend） |
| 分支与预期不符 | WF 不强制切换，警告提示；用户自行决定 |

---

## 附：与其他 WF reference 的关系

- [`anti-patterns.md`](./anti-patterns.md) —— 反模式第 N 条对应 git（如"禁止 squash"）
- [`worktree-lifecycle.md`](./worktree-lifecycle.md) —— worktree 内部细节
- [`shared-patterns.md`](./shared-patterns.md) —— 多工作流共享的 wave / commit 约定
- [`agent-contracts.md`](./agent-contracts.md) —— Agent 返回 JSON 完成标记中的 commit 字段
