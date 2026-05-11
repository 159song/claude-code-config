---
description: Diagnose and recover WF workflow failures. Use when CONTINUATION.md is corrupted, autonomous mode fails to resume after auto-compact, HANDOFF.json is missing, a sub-agent times out, phase verification keeps failing, or STATE.md shows inconsistent frontmatter.
user-invocable: true
---

# WF Troubleshooting Skill

当用户描述以下类型症状时激活此 skill，按症状定位排查步骤并执行修复或指导修复：

- "autonomous 恢复失败" / "auto-compact 后没继续"
- "CONTINUATION.md 损坏 / 缺 frontmatter"
- "HANDOFF.json 不见了" / "pause/resume 失效"
- "sub-agent 卡住 / 超时 / 无响应"
- "阶段验证一直 FAIL" / "gap closure 也修不好"
- "STATE.md 格式异常" / "wf-tools state 报错"
- "worktree 残留" / "git worktree list 里有无效条目"
- "里程碑归档报错" / "complete-milestone 失败"

## 诊断原则

1. **先读现场**：`ls -la .planning/` 确认文件存在性；读相关 frontmatter
2. **再试 CLI**：优先用 `wf-tools validate health --repair` 自动修复 STATE.md
3. **最后改文件**：直接手改 `.planning/` 文件是最后手段，修完要立即重新 validate

## 权威参考

本 skill 的完整症状清单与步骤见 `$HOME/.claude/wf/references/troubleshooting.md`——当用户症状不在本 SKILL.md 明列清单内时，读取此参考文件。

@$HOME/.claude/wf/references/troubleshooting.md

## 反模式（Don't use when...）

- 用户问的是 WF 概念（如"什么是 phase？"）—— 不要触发此 skill，那是教学场景
- 用户正在写新代码 —— 排障 skill 不应在正常开发路径触发
- 用户的问题与 `.planning/` 和 autonomous 机制无关
