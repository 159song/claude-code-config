<purpose>
显示项目整体进度和当前状态。
智能路由：根据当前状态推荐下一步操作。
</purpose>

<process>

<step name="read_state">
## 1. 读取状态

读取以下文件：
- `.planning/STATE.md` — 当前状态
- `.planning/ROADMAP.md` — 阶段列表
- `.planning/config.json` — 配置

如果 `.planning/` 不存在：
```
没有检测到 WF 项目。运行 /wf-new-project 开始。
```
</step>

<step name="calculate_progress">
## 2. 计算进度

遍历每个阶段目录，检查产出文件：

| 文件 | 代表状态 |
|------|----------|
| CONTEXT.md | 讨论完成 |
| PLAN*.md | 规划完成 |
| SUMMARY*.md | 执行完成 |
| VERIFICATION.md | 验证完成 |

阶段进度 = 已完成步骤 / 总步骤 × 100%
项目进度 = 所有阶段进度的加权平均
</step>

<step name="display">
## 3. 显示进度

```
╔══════════════════════════════════════════╗
║  WF · 项目进度                           ║
╚══════════════════════════════════════════╝

项目: {{project_name}}
模式: {{mode}}
整体: ████████░░░░░░░░ 47%

阶段详情:
  ✅ Phase 1: 项目基础设施        ████████████████ 100%
  ✅ Phase 2: 用户认证系统        ████████████████ 100%
  🔄 Phase 3: 数据管理模块        ████████████░░░░  72%
     → 执行中: Wave 2/3
  ⬜ Phase 4: 前端界面            ░░░░░░░░░░░░░░░░   0%
  ⬜ Phase 5: 集成测试            ░░░░░░░░░░░░░░░░   0%
```
</step>

<step name="smart_routing">
## 4. 智能路由

根据当前状态推荐下一步：

**Route A: 有阶段正在执行**
```
▶ 继续: /wf-execute-phase {N}
  阶段 {N} 有未完成的计划
```

**Route B: 阶段执行完成未验证**
```
▶ 验证: /wf-verify-work
  阶段 {N} 执行完成，等待验收
```

**Route C: 验证通过待推进**
```
▶ 下一阶段: /wf-discuss-phase {N+1}
  阶段 {N} 已验证通过
```

**Route D: 全部完成**
```
🎉 所有阶段已完成！
  建议: /wf-verify-work 进行最终验收
```

**Route E: 暂停中**
```
⏸ 项目暂停于阶段 {N}
  恢复: /wf-autonomous --from {N}
```

**Route F: 有阻塞**
```
⛔ 阶段 {N} 有阻塞项
  详情: {{blocker_description}}
```
</step>

</process>

<success_criteria>
- [ ] 进度计算正确
- [ ] 状态显示完整
- [ ] 路由建议合理
</success_criteria>
