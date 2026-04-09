# 验证模式

## 概述

WF 使用 **目标反推验证**（goal-backward verification），而非任务完成检查。
核心问题不是"任务都做了吗？"，而是"目标达成了吗？"

## 4 级验证模型

### Level 1: EXISTS（存在性）

检查必要的 artifact 是否存在于文件系统中。

**验证方法:** 文件路径检查
**示例:**
- `src/components/UserProfile.tsx` 是否存在？
- `src/api/auth.ts` 是否存在？
- 数据库迁移文件是否存在？

### Level 2: SUBSTANTIVE（实质性）

检查 artifact 是否包含有意义的实现，而非空壳或占位符。

**验证方法:** 内容分析
**检查项:**
- 文件行数 > 合理阈值（非空文件）
- 不包含 `TODO`、`FIXME`、`placeholder`、`not implemented`
- 导出的函数/类有实际逻辑
- 测试文件有实际断言

### Level 3: WIRED（连通性）

检查 artifact 是否正确接入系统，而非孤立存在。

**验证方法:** 引用关系分析
**检查项:**
- 组件是否被路由或父组件引用
- API endpoint 是否注册到路由表
- 数据库模型是否有对应的迁移和 seed
- 配置项是否被实际读取使用

### Level 4: DATA-FLOWING（数据流通）

检查数据是否在系统中正确流动，端到端可用。

**验证方法:** 数据路径追踪
**检查项:**
- 用户输入 → 验证 → 处理 → 存储 → 响应 全链路通
- API 请求 → 后端处理 → 数据库 → 响应 全链路通
- 事件触发 → 处理函数 → 副作用 全链路通

## 关键链接验证模式

对于每个阶段目标，提取 3-5 个"关键链接"进行深度验证：

```
关键链接: 用户登录流程
  入口: src/pages/login.tsx
  验证: src/lib/auth.ts::validateCredentials()
  存储: src/lib/db/users.ts::createSession()
  出口: middleware.ts::checkAuth()
  
  EXISTS:       ✅ 4/4 文件存在
  SUBSTANTIVE:  ✅ 4/4 有实际实现
  WIRED:        ✅ login.tsx → auth.ts → users.ts ✅
  DATA-FLOWING: ✅ 表单提交 → 验证 → session 创建 → cookie 设置 ✅
```

## 验证结果分类

| 结果 | 含义 | 操作 |
|------|------|------|
| PASS | 所有 4 级验证通过 | 可以推进 |
| WARN | Level 1-2 通过，Level 3-4 有问题 | 标记待修复，可选推进 |
| FAIL | 任何级别有严重问题 | 必须修复后才能推进 |
| SKIP | 验证项被延迟到后续阶段 | 不计入当前阶段结果 |

## 覆盖机制

当验证失败但有合理原因时，可以在 VERIFICATION.md 中添加覆盖：

```markdown
### Override: [验证项名称]
- **原因:** [为什么可以跳过]
- **风险:** [跳过的风险]
- **计划:** [后续如何处理]
- **批准:** 用户确认
```
