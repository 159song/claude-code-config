---
description: WF sub-agent worktree lifecycle - creation, execution, merge, cleanup. Claude references this when dispatching Agent({ isolation: "worktree" }) for parallel executor agents, diagnosing worktree conflicts, understanding merge strategy (fast-forward / merge commit / conflict pause), or cleaning stale worktrees.
user-invocable: false
---

# WF Worktree Lifecycle (Skill)

> 后台知识 skill：Claude 在编排并行 executor 或排查 worktree 问题时自动参考。

## 生命周期五阶段

```
创建 → Agent 执行 → 结果收集 → 合并 → 清理
```

## 关键机制

| 阶段 | 机制 |
|---|---|
| 创建 | `Agent({ isolation: "worktree" })` 自动创建临时 worktree + 临时分支 |
| 执行 | executor 在自己的 worktree 中独立 commit，父 session 不干扰 |
| 收集 | 父 session 读 agent 返回的完成标记 + commit 列表 |
| 合并 | 无冲突 → fast-forward / merge commit；有冲突 → 降级串行 / 暂停请示 |
| 清理 | `git worktree remove <path>`；残留用 `git worktree prune` |

## 冲突处理三级

1. **无冲突**：fast-forward 自动合并
2. **文件冲突**：`execute-phase` 预检时降级为串行（避免冲突发生）
3. **语义冲突**：暂停请示，由用户决定合并策略

## 常见诊断命令

```bash
git worktree list                 # 查看所有 worktree
git worktree remove <path>        # 删除指定 worktree
git worktree prune                # 清理无效记录
```

## 权威参考

完整流程图、错误场景、清理规范见 `$HOME/.claude/wf/references/worktree-lifecycle.md`：

@$HOME/.claude/wf/references/worktree-lifecycle.md
