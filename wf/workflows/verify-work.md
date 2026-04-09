<purpose>
对话式用户验收测试（UAT）。
用户用自然语言描述发现的问题或确认通过，系统追踪状态并自动修复。

产出文件：
- `.planning/UAT.md` — 验收测试状态（持久化）
- gap closure 计划（如有问题需修复）
</purpose>

<flags>
- `--smoke` — 冷启动模式。先执行自动化冒烟测试，再进入对话。
</flags>

<process>

<step name="load_state">
## 1. 加载验收状态

检查 `.planning/UAT.md` 是否存在：
- 存在 → 加载已有状态，继续上次对话
- 不存在 → 初始化新的 UAT 会话

从最近完成的阶段提取验证项：
- 阶段目标 → 顶级验证项
- 需求验收标准 → 细分验证项
- VERIFICATION.md 中的 WARN/FAIL 项 → 待关注项
</step>

<step name="smoke_test" condition="--smoke 或首次 UAT">
## 2. 冒烟测试（可选）

自动执行基础检查：

```bash
# 构建检查
npm run build 2>&1 || echo "BUILD_FAIL"

# 测试检查  
npm test 2>&1 || echo "TEST_FAIL"

# 启动检查
npm run dev &
sleep 5
curl -s http://localhost:3000 > /dev/null && echo "SERVER_OK" || echo "SERVER_FAIL"
kill %1 2>/dev/null
```

冒烟测试结果注入到 UAT 状态中。
</step>

<step name="conversation_loop">
## 3. 对话式验收

进入交互循环，用户可以：

**报告问题：**
```
用户: "登录页面没有显示错误提示"
→ 系统自动分类: severity=medium, area=frontend/auth
→ 记录到 UAT.md
→ 提示: "已记录。要我现在修复还是继续检查其他功能？"
```

**确认通过：**
```
用户: "用户列表功能正常"
→ 标记对应验证项为 PASS
→ 更新 UAT.md
```

**请求演示：**
```
用户: "演示一下搜索功能怎么用"
→ 描述功能使用方式和预期行为
```

**严重度推断规则：**
- "崩溃/报错/无法使用" → critical
- "不正确/没有/缺少" → high
- "不太好/可以改进/建议" → medium
- "小问题/微调" → low
</step>

<step name="auto_fix">
## 4. 自动修复

对于用户确认需要修复的问题：

1. 诊断问题根因
2. 生成修复计划（写入 gap closure PLAN）
3. 执行修复
4. 请用户重新验证

```
┌─ 修复 ────────────────────────────────────┐
│ 🔧 问题: 登录页面无错误提示               │
│ 📍 根因: LoginForm 未处理 API 错误响应    │
│ 📝 修复: 添加 error state 和显示组件      │
│ ✅ 已修复 — 请重新测试登录功能             │
└───────────────────────────────────────────┘
```
</step>

<step name="save_state">
## 5. 保存状态

每次交互后更新 `.planning/UAT.md`：

```markdown
# 用户验收测试

## 状态: 进行中

| 验证项 | 状态 | 严重度 | 备注 |
|--------|------|--------|------|
| 用户登录 | ✅ PASS | - | |
| 用户注册 | ❌ FAIL | high | 缺少邮箱验证 |
| 用户列表 | ✅ PASS | - | |
| 搜索功能 | ⬜ 未测试 | - | |

## 问题记录

### Issue 1: 缺少邮箱验证
- **严重度:** high
- **状态:** 修复中
- **描述:** 注册时未验证邮箱格式
```

提交到 git：
```bash
git add .planning/UAT.md
git commit -m "docs: update UAT status"
```
</step>

<step name="complete">
## 6. 验收完成

当所有验证项为 PASS 或被用户接受时：

```
╔══════════════════════════════════════════╗
║  WF · 验收测试完成                       ║
╚══════════════════════════════════════════╝

  通过: {{pass_count}}/{{total_count}}
  修复: {{fixed_count}} 个问题
  接受: {{accepted_count}} 个已知问题

▶ 下一步: /wf-progress 查看整体进度
```
</step>

</process>

<success_criteria>
- [ ] 所有验证项已检查
- [ ] 发现的问题已修复或被用户接受
- [ ] UAT.md 状态完整
- [ ] 状态已提交到 git
</success_criteria>
