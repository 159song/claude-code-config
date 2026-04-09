<purpose>
分析自然语言输入，路由到最合适的 WF 命令。
作为智能调度器——自身不执行工作，只匹配意图并转发。
</purpose>

<process>

<step name="parse_intent">
解析用户输入，提取关键意图：

**路由规则（按优先级排列）：**

| 意图模式 | 目标命令 |
|----------|----------|
| "新项目/初始化/开始" | `/wf-new-project` |
| "讨论/分析/设计 阶段N" | `/wf-discuss-phase N` |
| "规划/计划 阶段N" | `/wf-plan-phase N` |
| "执行/实现/开发 阶段N" | `/wf-execute-phase N` |
| "验证/检查/测试" | `/wf-verify-work` |
| "自动/全自动/一键运行" | `/wf-autonomous` |
| "快速/修复/小改动" | `/wf-quick` |
| "进度/状态" | `/wf-progress` |
| "下一步/继续" | `/wf-next` |

如果无法明确匹配，展示候选列表让用户选择。
</step>

<step name="confirm_and_dispatch">
显示匹配结果：

```
▶ 意图识别: {{用户输入摘要}}
  路由到: /wf-{{command}} {{args}}
```

然后通过 Skill() 调用对应命令。
</step>

</process>
