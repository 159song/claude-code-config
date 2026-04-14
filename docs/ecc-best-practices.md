# Everything Claude Code (ECC) 最佳使用方法

> ECC v1.10.0 | 47 代理 / 181 技能 / 79 命令 / 12+ 语言

---

## 一、核心开发工作流

### 新功能开发

```
/ecc:plan → /ecc:tdd → /ecc:code-review → /ecc:verify
```

| 步骤 | 命令 | 作用 |
|------|------|------|
| 规划 | `/ecc:plan` | 需求分析、风险评估、实现方案 |
| TDD | `/ecc:tdd` | 先写测试(RED) → 实现(GREEN) → 重构 |
| 审查 | `/ecc:code-review` | 代码质量、安全、可维护性审查 |
| 验证 | `/ecc:verify` | build → lint → test → type-check 全流水线 |

### Bug 修复

```
/ecc:tdd（先写失败测试）→ 修复 → /ecc:code-review → /ecc:verify
```

### 生产准备

```
/ecc:security-scan → /ecc:e2e → 确认覆盖率 80%+ → /ecc:verify
```

### 快速修复

| 命令 | 作用 |
|------|------|
| `/ecc:build-fix` | 自动诊断和修复构建错误 |
| `/ecc:refactor-clean` | 死代码清理和结构优化 |

---

## 二、语言专用工具

### 代码审查

| 语言 | 命令 |
|------|------|
| Python | `/ecc:python-review` |
| Go | `/ecc:go-review` |
| Rust | `/ecc:rust-review` |
| TypeScript | `/ecc:code-review` |
| Kotlin | `/ecc:kotlin-review` |
| C++ | `/ecc:cpp-review` |
| Flutter | `/ecc:flutter-review` |

### 构建修复

| 语言 | 命令 |
|------|------|
| Go | `/ecc:go-build` |
| Rust | `/ecc:rust-build` |
| Kotlin | `/ecc:kotlin-build` |
| C++ | `/ecc:cpp-build` |
| Flutter | `/ecc:flutter-build` |
| Gradle | `/ecc:gradle-build` |

---

## 三、关键代理

### 核心代理（自动调度）

| 代理 | 用途 | 触发时机 |
|------|------|---------|
| `ecc:code-reviewer` | 通用代码质量审查 | 编写/修改代码后 |
| `ecc:security-reviewer` | 安全漏洞检测（OWASP Top 10） | 涉及认证/输入/API |
| `ecc:architect` | 系统架构决策 | 复杂架构变更 |
| `ecc:planner` | 复杂功能规划 | 大型功能请求 |
| `ecc:tdd-guide` | TDD 流程执行 | 新功能/Bug 修复 |
| `ecc:build-error-resolver` | 通用构建错误修复 | 构建失败 |
| `ecc:performance-optimizer` | 性能分析优化 | 性能瓶颈 |
| `ecc:e2e-runner` | Playwright E2E 测试 | 关键用户流程 |

### 语言专用代理

| 代理 | 语言 |
|------|------|
| `ecc:python-reviewer` | Python |
| `ecc:go-reviewer` | Go |
| `ecc:typescript-reviewer` | TypeScript/JavaScript |
| `ecc:rust-reviewer` | Rust |
| `ecc:java-reviewer` | Java/Spring Boot |
| `ecc:kotlin-reviewer` | Kotlin/Android |
| `ecc:cpp-reviewer` | C++ |
| `ecc:flutter-reviewer` | Flutter/Dart |
| `ecc:csharp-reviewer` | C#/.NET |
| `ecc:database-reviewer` | PostgreSQL/Supabase |

---

## 四、会话管理

| 命令 | 作用 |
|------|------|
| `/ecc:save-session` | 保存当前上下文和进度 |
| `/ecc:resume-session` | 恢复之前的会话 |
| `/ecc:sessions` | 浏览和管理会话历史 |
| `/ecc:checkpoint` | 标记重要里程碑 |
| `/ecc:context-budget` | 分析 token 使用情况 |
| `/ecc:aside` | 快速侧问不丢失上下文 |

---

## 五、持续学习系统

```
开发会话 → /ecc:learn-eval → /ecc:evolve → /ecc:skill-health
```

| 命令 | 作用 |
|------|------|
| `/ecc:learn-eval` | 从当前会话提取可复用模式 |
| `/ecc:evolve` | 将模式演进为成熟技能 |
| `/ecc:skill-health` | 技能组合健康度仪表板 |
| `/ecc:rules-distill` | 跨技能提炼通用原则 |
| `/ecc:promote` | 项目级模式提升为全局 |
| `/ecc:instinct-status` | 查看已学习的 instinct |

**实践建议：**
- 每次会话结束前运行 `/ecc:learn-eval`
- 积累 5-10 个 instinct 后运行 `/ecc:evolve`
- 定期用 `/ecc:skill-health` 检查覆盖度

---

## 六、高级功能

| 类别 | 命令 | 作用 |
|------|------|------|
| 多模型协作 | `/ecc:orchestrate` | tmux/worktree 编排 |
| 多模型协作 | `/ecc:devfleet` | 并行代理编排 |
| 文档知识 | `/ecc:docs` | Context7 实时文档查询 |
| 文档知识 | `/ecc:update-docs` | 更新项目文档 |
| 文档知识 | `/ecc:update-codemaps` | 重新生成代码地图 |
| 文档知识 | `/ecc:code-tour` | CodeTour 入门引导 |
| 安全 | `/ecc:security-scan` | 全面安全扫描 |
| 安全 | `/ecc:security-review` | 安全审查 |
| 自动化 | `/ecc:santa-loop` | 递归问题求解循环 |
| 自动化 | `/ecc:claw` | NanoClaw v2 持久化 REPL |

---

## 七、日常速查

### 开发节奏

1. **开始前** — `/ecc:plan` 规划方案
2. **编码时** — `/ecc:tdd` 测试驱动
3. **完成后** — `/ecc:code-review` + `/ecc:verify`
4. **提交前** — 确认无安全问题、覆盖率 80%+
5. **会话结束** — `/ecc:learn-eval` + `/ecc:save-session`

### 性能与成本

- 子代理任务尽量并行执行
- MCP 服务器按需启用，不超过 10 个
- 用 `/ecc:context-budget` 监控 token 消耗

### 质量保障

- 每次代码变更后运行 `code-reviewer` 代理
- 安全敏感代码使用 `security-reviewer` 代理
- 关键用户流程必须有 E2E 测试
- 测试覆盖率保持 80%+
