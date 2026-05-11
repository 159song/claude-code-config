---
description: WF workflow anti-patterns reference (manual STATE.md edits, nested Task(), skipping verification, batch 10+ file commits, ignoring context budget). Claude references this before executing sensitive actions in a WF project. Not user-invocable — exposed via wf-troubleshooting when diagnosing issues.
user-invocable: false
---

# WF Anti-Patterns Skill

当 Claude 即将执行以下任一危险动作时激活此 skill，先警告用户并提出正确做法：

| 危险动作信号 | 正确做法 |
|---|---|
| 直接 Write/Edit `.planning/STATE.md` | 改用 `wf-tools state set/merge/patch` CLI |
| Task() 中再次调用 Task() 形成嵌套 | 改用 Skill() 链（同 context 执行） |
| 阶段任务都完成后直接标记 complete | 必须先跑 4 级验证，见 `wf-4-level-verification` skill |
| 收到 WARNING/CRITICAL context 警告仍推进复杂任务 | WARNING 收尾当前任务、CRITICAL 保存状态立即暂停 |
| 单个任务修改 10+ 个文件 | 拆分到每任务 3-5 文件，每任务一 commit |
| 在 WF 上下文外直接编辑仓库 | 通过 `/wf-quick` 或相应 workflow 启动 |
| Git `--amend` / `--no-verify` | 绝对禁止，根因修复后新建 commit |

## 权威参考

完整反模式清单与原因分析见 `$HOME/.claude/wf/references/anti-patterns.md`：

@$HOME/.claude/wf/references/anti-patterns.md

## 触发时的行为

1. 暂停拟议的危险动作
2. 引用本 skill 中对应条目给出替代方案
3. 询问用户是否切换到正确路径
4. **绝不自作主张继续执行**——必须得到用户明确确认

## 反模式（Don't use when...）

- 用户显式声明"忽略 WF 规则，直接改"（用户知情同意的情况）
- 操作的是 `.planning/` 之外的文件，且不涉及上述危险模式
- 用户在阅读文档、询问概念（教学场景）
