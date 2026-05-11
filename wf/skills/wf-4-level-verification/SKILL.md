---
description: Verify implementation against phase or feature goals using WF's 4-level model. Use when validating that code changes achieve stated requirements, when reviewing whether a phase is truly complete, when checking if a new feature is end-to-end functional (not just present), or before marking a task as done.
user-invocable: true
---

# WF 4-Level Verification Skill

WF 用**目标反推验证**代替"任务完成检查"。核心问题不是"任务都做了吗？"，而是"目标达成了吗？"

## 4 级验证速查

| Level | 含义 | 判定方法 | 示例 |
|---|---|---|---|
| **EXISTS** | 必要 artifact 存在于文件系统 | 文件路径检查 | `src/api/auth.ts` 是否存在 |
| **SUBSTANTIVE** | artifact 包含有意义的实现（非占位） | 内容扫描 | 行数 > 阈值、不含 TODO/FIXME、导出函数有逻辑 |
| **WIRED** | 模块正确接入系统 | 引用/路由/依赖关系 | import 链路连通、路由注册、DI 容器装配 |
| **DATA-FLOWING** | 端到端数据路径畅通 | 手工追踪或冒烟测试 | 入口 → 处理 → 存储 → 出口全链路 |

## 使用时的决策流

```
目标 → 需要哪些能力？→ 能力需要哪些 artifact？
                         ↓
        Level 1: artifact 存在吗？
              ↓ PASS
        Level 2: 有实质实现吗？
              ↓ PASS
        Level 3: 和系统接起来了吗？
              ↓ PASS
        Level 4: 数据真的流起来了吗？
              ↓ PASS
        目标达成
```

任一级 FAIL → gap closure（最多 1 次）→ 再次从该级验证。

## 权威参考

完整方法论、Override 机制、延迟项过滤规则见 `$HOME/.claude/wf/references/verification-patterns.md`：

@$HOME/.claude/wf/references/verification-patterns.md

## 何时不要触发

- 纯代码风格/格式检查（归 linter）
- 单元测试本身的写法审查（归 reviewer skill）
- 在没有明确"目标"的场景（如探索性改动）——先让用户定义目标再用此 skill
