---
description: Apply WF git commit scope (phase-N / change-id / milestone), branch naming (master/develop/feature/hotfix), and worktree merge strategy. Use ONLY in WF projects (has .planning/ directory) when creating commits, writing commit messages, tagging milestones, resolving worktree branches, or deciding which branch to create. SKIP when committing in non-WF repos — fall back to the repo's own conventions or the global ~/.claude/CLAUDE.md defaults.
user-invocable: true
---

# WF Git Conventions (Skill)

当用户在 WF 项目中进行任何 git 操作时，应用此 skill 的约定。

## Commit Scope 速查

| 执行入口 | Scope | 示例 |
|---|---|---|
| `/wf-execute-phase N` / `/wf-autonomous` | `phase-<N>` | `feat(phase-1): create user model` |
| `/wf-apply-change <id>` | `change-<id>` | `feat(change-add-oauth): add OAuth callback` |
| `/wf-archive-change <id>` | `chore(spec)` | `chore(spec): archive change add-oauth` |
| `/wf-quick` (默认) | 无 scope 或 `quick` | `fix: correct typo` |
| `/wf-quick --spec` | `change-<id>` | 同 apply-change |
| `/wf-new-project` | `chore(planning)` | `chore(planning): initialize project` |
| `/wf-complete-milestone v<X.Y>` | `chore(milestone)` + `git tag v<X.Y>` | — |
| `/wf-propose` | `docs(spec)` | — |
| 文档同步 | `docs` | `docs: 同步 ARCHITECTURE.md / README.md` |

## 铁律（来自全局 ~/.claude/CLAUDE.md + WF 强化）

1. **Conventional Commits**：`<type>(<scope>): <subject>`
2. **一任务一 commit**：不等批量、不 squash
3. **禁止 `--amend`**：已 commit 是事实；要改内容新开 commit
4. **禁止 `--no-verify`**：hook 失败查根因，不绕过
5. **Rebase upstream before push**：`git pull --rebase`
6. **WF 不自动 push**：push 对协作仓库有副作用，需用户显式批准

## 分支策略（继承全局）

`master`→PRO / `develop`→DEV / `feature/*`→FAT / `release/*`→UAT / `hotfix/*`→PRO

WF 扩展建议：
- 大 phase 可用 `feature/phase-<N>-<slug>` 独立分支
- 每个 change apply 可用 `feature/change-<id>` 独立分支
- `/wf-quick` 通常在当前分支即可

## Worktree 合并策略

sub-agent 的 executor 自动隔离到 git worktree：
- 每个 worktree 独立分支，完成后 fast-forward 合回
- 有文件冲突时当前 wave 降级为串行（execute-phase 会预检）
- 冲突严重时暂停请示

## 权威参考

完整约定见 `$HOME/.claude/wf/references/git-conventions.md`：

@$HOME/.claude/wf/references/git-conventions.md

## Don't use when

- 不在 git 仓库中（`git status` 报错）
- 用户只是在问 git 命令用法（应直接查 git 文档）
- 用户在 WF 之外的项目且不需要 WF 约定
