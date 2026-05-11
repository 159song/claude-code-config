# WF 工作流系统 — 架构文档

## 目录结构

```
/Users/zxs/Desktop/claude-code-config/
├── VERSION                          # 版本号
├── package.json                     # CommonJS 配置
├── settings.json                    # Hook 配置（安装时复制到 .claude/settings.json）
│
├── wf/                              # 核心系统
│   ├── bin/                         # CLI 工具
│   │   ├── wf-tools.cjs             # CLI 入口（命令分发）
│   │   └── lib/                     # 模块化功能库
│   │       ├── config.cjs           # 配置管理（读取/写入/schema）
│   │       ├── frontmatter.cjs      # 共享 YAML frontmatter 解析/序列化
│   │       ├── git.cjs              # Git 操作封装
│   │       ├── init.cjs             # 初始化和阶段信息
│   │       ├── milestone.cjs        # 里程碑归档和重置
│   │       ├── phase.cjs            # 阶段状态检测
│   │       ├── progress.cjs         # 进度计算
│   │       ├── review.cjs           # 代码审查文件范围计算
│   │       ├── roadmap.cjs          # 路线图分析
│   │       ├── session.cjs          # 会话暂停/恢复
│   │       ├── spec.cjs             # 规格空间（OpenSpec-inspired）解析/校验
│   │       ├── change.cjs           # 变更提议 + delta 合并（OpenSpec-inspired）
│   │       ├── state.cjs            # STATE.md 读写
│   │       ├── utils.cjs            # 通用工具函数
│   │       ├── validate.cjs         # 输入验证
│   │       ├── merge-settings.cjs  # settings.json 智能合并工具
│   │       └── *.test.cjs           # 单元测试文件
│   ├── workflows/                   # 15 个核心工作流
│   │   ├── do.md                    # 意图路由 — 自然语言 → 命令匹配
│   │   ├── new-project.md           # 项目初始化 — 提问 → 研究 → 需求 → 路线图
│   │   ├── discuss-phase.md         # 讨论阶段 — 灰色地带识别 → 决策记录
│   │   ├── plan-phase.md            # 规划阶段 — 研究 → 计划生成 → 质量检查
│   │   ├── execute-phase.md         # 执行阶段 — wave 并行执行 → 验证
│   │   ├── verify-work.md           # 验收测试 — 对话式 UAT → 自动修复
│   │   ├── autonomous.md            # 全自动模式 — 批量驱动所有阶段
│   │   ├── quick.md                 # 快速任务 — 阶段外临时任务
│   │   ├── progress.md              # 进度查看 — 状态报告 + 智能路由
│   │   ├── code-review.md           # 代码审查 — 审查+自动修复迭代链
│   │   ├── complete-milestone.md    # 完成里程碑 — 归档/标签/重置
│   │   ├── new-milestone.md         # 新里程碑 — 目标收集/研究/需求/路线图
│   │   ├── next.md                  # 自动推进 — 检测状态/路由下一步
│   │   ├── session.md               # 会话管理 — 暂停/恢复检查点
│   │   └── settings.md              # 配置管理 — 交互式/CLI 配置修改
│   ├── references/                  # 参考文档
│   │   ├── ui-brand.md              # 视觉规范（横幅/检查点/符号/进度条）
│   │   ├── gates.md                 # 质量门禁（硬门禁 + 软门禁）
│   │   ├── verification-patterns.md # 4 级验证模型（exists→substantive→wired→data-flowing）
│   │   ├── agent-contracts.md       # Agent 合同定义（输入/输出/完成标记）
│   │   ├── anti-patterns.md         # 工作流反模式（避免的常见错误）
│   │   ├── context-budget.md        # 上下文预算管理策略
│   │   ├── continuation-format.md  # 会话续接格式（HANDOFF.json 规范）
│   │   ├── worktree-lifecycle.md    # Sub-agent worktree 隔离生命周期
│   │   ├── shared-patterns.md       # Wave 执行模型/完成标记/预算检查
│   │   ├── config-precedence.md     # 配置优先级（CLI > env > config > defaults）
│   │   ├── git-conventions.md       # Git 分支策略/commit scope/worktree 合并（权威）
│   │   └── troubleshooting.md       # 常见问题诊断与恢复
│   └── templates/                   # 项目模板
│       ├── config.json              # 工作流配置模板（auto 模式默认）
│       ├── project.md               # 项目文档模板
│       ├── state.md                 # 状态文件模板
│       ├── roadmap.md               # 路线图模板
│       ├── spec.md                  # 规格模板（Purpose + Requirement + Scenario）
│       ├── change-proposal.md       # change proposal 正文模板（Phase B）
│       ├── change-tasks.md          # change 任务清单模板（Phase B）
│       ├── change-delta.md          # spec delta 模板（ADDED/MODIFIED/REMOVED/RENAMED）
│       └── requirements.md          # 需求文档模板
│
├── commands/wf/                     # 16 个命令入口（用户通过 /wf-* 调用）
│   ├── do.md                        # /wf-do <描述>
│   ├── new-project.md               # /wf-new-project [--auto]
│   ├── discuss-phase.md             # /wf-discuss-phase <N> [--auto|--chain|--batch]
│   ├── plan-phase.md                # /wf-plan-phase <N> [--chain|--skip-research]
│   ├── execute-phase.md             # /wf-execute-phase <N> [--wave N|--interactive|--chain]
│   ├── verify-work.md               # /wf-verify-work [--smoke]
│   ├── autonomous.md                # /wf-autonomous [--from N|--to N|--only N|--interactive]
│   ├── quick.md                     # /wf-quick <描述> [--full|--validate|--discuss|--research]
│   ├── progress.md                  # /wf-progress
│   ├── code-review.md               # /wf-code-review <phase> [--depth] [--files]
│   ├── complete-milestone.md        # /wf-complete-milestone [version]
│   ├── new-milestone.md             # /wf-new-milestone [version]
│   ├── next.md                      # /wf-next
│   ├── pause.md                     # /wf-pause
│   ├── resume.md                    # /wf-resume
│   └── settings.md                  # /wf-settings [set key value]
│
├── agents/                          # 7 个核心 sub-agent
│   ├── wf-planner.md                # 计划生成器 — 任务分解/wave 分组/依赖分析
│   ├── wf-executor.md               # 任务执行器 — 逐任务执行/原子提交/偏差处理
│   ├── wf-verifier.md               # 目标验证器 — 4 级验证/需求覆盖/反模式扫描
│   ├── wf-researcher.md             # 技术研究员 — 技术调研/方案比较/风险分析
│   ├── wf-roadmapper.md             # 路线图设计 — 阶段划分/需求映射/依赖分析
│   ├── wf-reviewer.md               # 代码审查器 — 逐文件审查/4 维度分析/REVIEW.md
│   └── wf-proposer.md               # 变更提议 — idea → proposal + delta specs + tasks（Phase B）
│
├── hooks/                           # 4 个 Claude Code hooks + 测试
│   ├── wf-session-state.js          # SessionStart — 注入项目状态提醒（Node.js）
│   ├── wf-context-monitor.js        # PostToolUse (Bash|Edit|Write|MultiEdit|Agent|Task) — 监控 context 使用率
│   ├── wf-prompt-guard.js           # PreToolUse — 检测 prompt injection
│   ├── wf-statusline.js             # StatusLine — 状态栏显示
│   ├── wf-session-state.test.cjs    # 单元测试
│   ├── wf-context-monitor.test.cjs  # 单元测试
│   ├── wf-prompt-guard.test.cjs     # 单元测试
│   └── wf-statusline.test.cjs       # 单元测试
│
└── .claude/                         # Claude Code 运行时配置
    ├── package.json                 # CommonJS 声明
    ├── settings.json                # Hook 绑定配置
    └── wf/VERSION                   # 版本文件


安装方式 (wf/bin/install.sh):
  commands/wf/  →  $HOME/.claude/commands/wf/    (16 个命令入口)
  agents/wf-*   →  $HOME/.claude/agents/         (6 个 Agent)
  hooks/wf-*.js →  $HOME/.claude/hooks/          (4 个 Hook, 排除 *.test.*)
  wf/           →  $HOME/.claude/wf/             (workflows/references/templates/bin)
  settings.json →  $HOME/.claude/settings.json   (智能合并, 不覆盖用户配置)
  VERSION       →  $HOME/.claude/wf/VERSION

  安装命令:
    ./wf/bin/install.sh              # 安装/升级
    ./wf/bin/install.sh --dry-run    # 预览操作
    ./wf/bin/install.sh --force      # 强制重新安装
    ./wf/bin/install.sh --uninstall  # 卸载 WF

  settings.json 合并策略 (merge-settings.cjs):
    hooks       — 按 wf- 关键字匹配更新, 保留用户自定义 hook
    statusLine  — 仅覆盖 WF 自己的 statusLine, 不替换用户自定义
    permissions — 取并集, 不重复
    env         — source 提供默认值, target 已有值优先
    其他字段    — 保留 target 已有值, source 补充缺失项
```

---

## 整体执行流程图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          WF 工作流系统 — 完整生命周期                            │
└─────────────────────────────────────────────────────────────────────────────────┘

用户输入
  │
  ▼
┌──────────────┐     自然语言      ┌──────────────┐
│  /wf-do      │ ◀──────────────── │  用户: "我想…" │
│  意图路由器   │                   └──────────────┘
└──────┬───────┘
       │ 匹配意图
       ▼
  ┌─────────────────────────────────────────────────────────┐
  │                    命令路由表                             │
  │                                                         │
  │  "新项目"      → /wf-new-project                        │
  │  "讨论阶段N"   → /wf-discuss-phase N                    │
  │  "规划阶段N"   → /wf-plan-phase N                       │
  │  "执行阶段N"   → /wf-execute-phase N                    │
  │  "验证/测试"   → /wf-verify-work                        │
  │  "全自动"      → /wf-autonomous      ◀── 推荐默认入口   │
  │  "快速修复"    → /wf-quick                              │
  │  "进度"        → /wf-progress                           │
  │  "代码审查"    → /wf-code-review                        │
  │  "完成里程碑"  → /wf-complete-milestone                  │
  │  "新里程碑"    → /wf-new-milestone                      │
  │  "下一步"      → /wf-next            ◀── 智能路由       │
  │  "暂停/恢复"   → /wf-pause, /wf-resume                  │
  │  "配置"        → /wf-settings                           │
  └─────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════
阶段 A: 项目初始化  /wf-new-project [--auto]
═══════════════════════════════════════════════════════════════════════════════════

  ┌──────────┐    ┌───────────────┐    ┌──────────────────────────────┐
  │ 1. 提问   │───▶│ 2. 配置生成   │───▶│ 3. 并行研究（4 个 agent）    │
  │ (5 个问题) │    │ config.json   │    │                              │
  └──────────┘    └───────────────┘    │  ┌─────────┐ ┌─────────┐     │
                                       │  │技术栈研究│ │功能参考 │     │
       产出:                           │  └─────────┘ └─────────┘     │
       PROJECT.md                      │  ┌─────────┐ ┌─────────┐     │
       config.json                     │  │架构研究 │ │风险研究 │     │
                                       │  └─────────┘ └─────────┘     │
                                       └──────────────┬───────────────┘
                                                      │
                                                      ▼
                              ┌──────────────┐    ┌──────────────┐
                              │ 4. 需求生成   │───▶│ 5. 路线图生成 │
                              │              │    │ (roadmapper) │
                              └──────────────┘    └──────┬───────┘
                                                         │
                              产出:                      │ 产出:
                              REQUIREMENTS.md            │ ROADMAP.md
                              (FR-N + NFR-N)             │ STATE.md
                                                         │
                       ┌─────────────────────────────────┘
                       ▼
              ┌─────────────────┐
              │ 用户确认路线图   │ ◀── gates.confirm_roadmap
              │ (auto 模式跳过) │
              └────────┬────────┘
                       │
                       ▼
              ▶ /wf-autonomous 或 /wf-discuss-phase 1


═══════════════════════════════════════════════════════════════════════════════════
阶段 B: 全自动模式  /wf-autonomous  (对每个 phase 循环执行 B1→B2→B3)
═══════════════════════════════════════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │   Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ ... ──▶ Phase N             │
  │      │           │           │                     │                │
  │   ┌──┴──┐     ┌──┴──┐    ┌──┴──┐              ┌──┴──┐             │
  │   │B1   │     │B1   │    │B1   │              │B1   │             │
  │   │讨论 │     │讨论 │    │讨论 │              │讨论 │             │
  │   ├─────┤     ├─────┤    ├─────┤              ├─────┤             │
  │   │B2   │     │B2   │    │B2   │              │B2   │             │
  │   │规划 │     │规划 │    │规划 │              │规划 │             │
  │   ├─────┤     ├─────┤    ├─────┤              ├─────┤             │
  │   │B3   │     │B3   │    │B3   │              │B3   │             │
  │   │执行 │     │执行 │    │执行 │              │执行 │             │
  │   └──┬──┘     └──┬──┘    └──┬──┘              └──┬──┘             │
  │      │           │           │                     │                │
  │      ▼           ▼           ▼                     ▼                │
  │   验证 ✅      验证 ✅     验证 ✅              验证 ✅            │
  │                                                                     │
  └─────────────────────────────────────────┬───────────────────────────┘
                                            │
                                            ▼
                                   /wf-verify-work (最终验收)
                                            │
                               ┌────────────┴────────────┐
                               │                         │
                     auto_archive=true          auto_archive=false
                               │                         │
                               ▼                         ▼
                     /wf-complete-milestone      建议手动归档
                     (自动链式调用)              /wf-complete-milestone


═══════════════════════════════════════════════════════════════════════════════════
B1: 讨论阶段  /wf-discuss-phase N [--auto|--chain|--batch]
═══════════════════════════════════════════════════════════════════════════════════

  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
  │ 加载阶段上下文│───▶│ 识别灰色地带 │───▶│ 代码库侦察       │
  │ ROADMAP.md   │    │ (按领域分类) │    │ (提取已有决策)   │
  │ REQUIREMENTS │    │              │    │                  │
  └──────────────┘    └──────────────┘    └────────┬─────────┘
                                                   │
                      ┌────────────────────────────┘
                      ▼
           ┌─────────────────────┐
           │  决策模式选择        │
           │                     │
           │  交互 ─── 逐个讨论  │ ◀── 默认
           │  auto ─── AI 推荐   │ ◀── --auto
           │  batch── 一次确认   │ ◀── --batch
           └──────────┬──────────┘
                      │
                      ▼
           ┌─────────────────────┐     可选
           │  顾问研究           │ ◀── 复杂决策启动
           │  (wf-researcher)    │     并行研究 agent
           └──────────┬──────────┘
                      │
                      ▼
           ┌─────────────────────┐
           │  保存决策            │
           │  CONTEXT.md         │
           │  DISCUSSION-LOG.md  │
           └──────────┬──────────┘
                      │
                      ▼
              ▶ /wf-plan-phase N  (--chain 自动触发)


═══════════════════════════════════════════════════════════════════════════════════
B2: 规划阶段  /wf-plan-phase N [--chain|--skip-research]
═══════════════════════════════════════════════════════════════════════════════════

  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
  │ 加载上下文    │───▶│ 实现研究         │───▶│ 生成计划          │
  │ CONTEXT.md   │    │ (wf-researcher)  │    │ (wf-planner)     │
  │ REQUIREMENTS │    │                  │    │                  │
  └──────────────┘    └──────────────────┘    └────────┬─────────┘
                                                       │
                                                       ▼
                                            ┌──────────────────┐
                                            │  质量检查         │
                                            │  ┌─────────────┐ │
                                            │  │需求覆盖 ≥90%│ │
                                            │  │依赖无循环   │ │
                                 ┌──────────│  │任务完整性   │ │
                                 │ 失败     │  │安全覆盖     │ │
                                 │ (≤3次)   │  └─────────────┘ │
                                 │          └────────┬─────────┘
                                 │                   │ 通过
                                 ▼                   ▼
                          ┌────────────┐   ┌──────────────────┐
                          │ 修订计划    │   │ 安全门禁          │
                          │ (返回生成)  │   │ THREAT-MODEL.md  │
                          └────────────┘   └────────┬─────────┘
                                                    │
                                                    ▼
                              产出: PLAN.md (或 PLAN-A.md, PLAN-B.md)
                              格式: wave 分组 + 任务(files/action/verify/done)
                                                    │
                                                    ▼
                              ▶ /wf-execute-phase N  (--chain 自动触发)


═══════════════════════════════════════════════════════════════════════════════════
B3: 执行阶段  /wf-execute-phase N [--wave N|--interactive|--chain]
═══════════════════════════════════════════════════════════════════════════════════

  ┌──────────────┐
  │ 加载计划      │
  │ PLAN*.md     │
  └──────┬───────┘
         │ 按 wave 分组
         ▼
  ┌─────────────────────────────────────────────────────────┐
  │  Wave 1 (并行)                                          │
  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
  │  │ wf-executor │  │ wf-executor │  │ wf-executor │     │
  │  │ PLAN-A      │  │ PLAN-B      │  │ PLAN-C      │     │
  │  │ (worktree)  │  │ (worktree)  │  │ (worktree)  │     │
  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
  │         │                │                │             │
  │         └────────────────┼────────────────┘             │
  │                          │                              │
  │                    合并 worktree                         │
  │                    冲突检查                              │
  └──────────────────────────┬──────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Wave 间检查      │
                    │ ✅ 回归测试      │
                    │ ✅ Schema 漂移   │
                    │ ✅ 进度更新      │
                    └────────┬────────┘
                             │
                             ▼
  ┌──────────────────────────────────────────────────────────┐
  │  Wave 2 (并行)                                           │
  │  ...（重复上述流程）                                      │
  └──────────────────────────┬───────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ 阶段验证         │
                    │ (wf-verifier)   │
                    │                 │
                    │ 4 级验证:       │
                    │ 1. EXISTS       │
                    │ 2. SUBSTANTIVE  │
                    │ 3. WIRED        │
                    │ 4. DATA-FLOWING │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                 通过 ✅           失败 ❌
                    │                 │
                    ▼                 ▼
             ┌──────────┐    ┌──────────────┐
             │ 完成阶段  │    │ Gap Closure  │
             │ STATE 更新│    │ 生成修复计划  │
             └──────────┘    │ 执行修复      │
                             │ 重新验证(1次) │
                             └──────────────┘
                                    │
                             ▶ 下一阶段 或 /wf-verify-work


═══════════════════════════════════════════════════════════════════════════════════
阶段 C: 验收测试  /wf-verify-work [--smoke]
═══════════════════════════════════════════════════════════════════════════════════

  ┌──────────────┐    ┌──────────────┐
  │ 加载 UAT 状态│───▶│ 冒烟测试     │ ◀── --smoke 或首次
  │ (支持恢复)   │    │ build/test   │
  └──────────────┘    └──────┬───────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  对话式验收循环  │ ◀───────────────────┐
                    │                 │                      │
                    │ 用户: "登录没   │    ┌──────────────┐  │
                    │ 有错误提示"     │───▶│ 自动诊断     │  │
                    │                 │    │ 生成修复计划 │  │
                    │ 用户: "列表正常"│    │ 执行修复     │──┘
                    │ → 标记 PASS     │    └──────────────┘
                    │                 │
                    │ 用户: "完成"    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ 保存 UAT.md     │
                    │ 所有项 PASS     │
                    └─────────────────┘


═══════════════════════════════════════════════════════════════════════════════════
快速通道:  /wf-quick <描述>
═══════════════════════════════════════════════════════════════════════════════════

  用户输入 ──▶ 理解任务 ──▶ [研究] ──▶ [讨论] ──▶ 规划+执行 ──▶ [验证] ──▶ 完成
                  │                                    │
                  │ 评估复杂度                         │ wf-executor
                  │ trivial/small/medium               │ 原子 commit
                  │                                    │
                  └─ large → 建议使用正式阶段流程       └─ SUMMARY


═══════════════════════════════════════════════════════════════════════════════════
代码审查:  /wf-code-review <phase> [--depth] [--files]
═══════════════════════════════════════════════════════════════════════════════════

  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
  │ 1. 初始化     │───▶│ 2. 配置门禁      │───▶│ 3. 计算文件范围  │
  │ 解析参数      │    │ code_review=true?│    │ (三级回退策略)   │
  │ 加载配置      │    │                  │    │ review.cjs       │
  └──────────────┘    └──────────────────┘    └────────┬─────────┘
                             │ false                    │
                             ▼                         ▼
                      ⚠️ 退出（已禁用）     ┌─────────────────────┐
                                            │ 4. 审查-修复链       │
                                            │ (核心循环, ≤3 轮)   │
                                            └──────────┬──────────┘
                                                       │
                    ┌──────────────────────────────────┘
                    ▼
         ┌───────────────────────────────────────────────────────┐
         │  LOOP iteration < max_iterations:                     │
         │                                                       │
         │  ┌─────────────┐    ┌─────────────┐    ┌──────────┐  │
         │  │ A: 审查      │───▶│ B: 解析结果 │───▶│ C: 判定  │  │
         │  │ (wf-reviewer)│    │ REVIEW.md   │    │          │  │
         │  └─────────────┘    └─────────────┘    └────┬─────┘  │
         │                                             │        │
         │                                    ┌────────┴──────┐ │
         │                                    │               │ │
         │                              clean/error       有问题│ │
         │                                    │               │ │
         │                                    ▼               ▼ │
         │                               BREAK        ┌────────┐│
         │                                             │D: 修复 ││
         │                                             │wf-exec ││
         │                                             └───┬────┘│
         │                                                 │     │
         │                                    E: 返回顶部 re-review
         └───────────────────────────────────────────────────────┘
                    │
                    ▼
         ┌─────────────────┐    ┌──────────────────┐
         │ 5. 展示结果      │───▶│ 6. 提交 REVIEW.md│
         │ ✅ 通过/⚠️ 剩余  │    │ git commit       │
         └─────────────────┘    └──────────────────┘

  产出: <phaseDir>/REVIEW.md


═══════════════════════════════════════════════════════════════════════════════════
自动推进:  /wf-next
═══════════════════════════════════════════════════════════════════════════════════

  ┌──────────────┐
  │ 1. 项目存在？ │
  └──────┬───────┘
         │
    ┌────┴────┐
    │         │
  否 ✘      是 ✔
    │         │
    ▼         ▼
  提示       ┌──────────────┐
  new-project│ 2. 有暂停     │
             │ 检查点？      │
             └──────┬───────┘
                    │
               ┌────┴────┐
               │         │
             是 ✔      否 ✘
               │         │
               ▼         ▼
            提示       ┌──────────────────┐
            resume     │ 3. 路线图分析     │
                       │ roadmap analyze  │
                       └──────┬───────────┘
                              │
                     ┌────────┴────────┐
                     │                 │
                全部 verified      有未完成阶段
                     │                 │
                     ▼                 ▼
                提示完成        ┌──────────────────┐
                milestone      │ 4. 检测阶段步骤   │
                               │ init phase-op    │
                               └──────┬───────────┘
                                      │
              ┌──────────────────────┬┴──────────────────────┐
              │                     │                        │
         无 CONTEXT            无 PLAN             有 PLAN 无 SUMMARY
              │                     │                        │
              ▼                     ▼                        ▼
        /wf-discuss-phase N   /wf-plan-phase N    /wf-execute-phase N
              │                     │                        │
              └─────────────────────┼────────────────────────┘
                                    │
                          有 SUMMARY 无/未通过 VERIFICATION
                                    │
                                    ▼
                             /wf-verify-work

  ▶ 检测完成后直接 Skill() 调用对应工作流，无需用户确认


═══════════════════════════════════════════════════════════════════════════════════
里程碑管理:  /wf-complete-milestone [version] + /wf-new-milestone [version]
═══════════════════════════════════════════════════════════════════════════════════

  ── 完成里程碑 (/wf-complete-milestone) ──────────────────────────

  ┌──────────────────┐    ┌──────────────────┐
  │ 1. 验证就绪       │───▶│ 2. 执行归档      │
  │ 阶段完成度?       │    │ milestone archive│
  │ 需求覆盖度?       │    │ Git tag 创建     │
  │ 版本号确认        │    │ git commit       │
  └──────────────────┘    └────────┬─────────┘
                                   │
                                   ▼
  ┌──────────────────┐    ┌──────────────────┐
  │ 3. 更新 PROJECT  │───▶│ 4. 重置状态      │
  │ 记录完成里程碑    │    │ milestone reset  │
  │ 移动已完成需求    │    │ 清空 phases/     │
  └──────────────────┘    │ 删除 ROADMAP     │
                          │ 删除 REQUIREMENTS │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │ 5. 链接新里程碑   │
                          └──────┬───────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
          auto_new_milestone=true   auto_new_milestone=false
                    │                         │
                    ▼                         ▼
          直接 Skill()             询问用户: 继续/跳过
          /wf-new-milestone        继续 → Skill() /wf-new-milestone
                                   跳过 → 手动执行

  产出: .planning/milestones/<version>/（归档）、Git tag、STATE.md 重置

  ── 新里程碑 (/wf-new-milestone) ────────────────────────────────

  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────────┐
  │ 1. 加载上下文     │───▶│ 2. 收集目标      │───▶│ 3. 领域研究              │
  │ PROJECT.md       │    │ 版本号/名称      │    │ wf-researcher ×N         │
  │ 前一里程碑归档    │    │ 3-5 个目标       │    │ (聚焦新领域,不重复研究)  │
  └──────────────────┘    └──────────────────┘    └────────────┬─────────────┘
                                                               │
                          ┌────────────────────────────────────┘
                          ▼
  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
  │ 4. 生成需求       │───▶│ 5. 生成路线图    │───▶│ 6. 更新 STATE    │
  │ REQUIREMENTS.md  │    │ wf-roadmapper    │    │ 重置进度计数器   │
  │ FR-N + NFR-N     │    │ ROADMAP.md       │    │ git commit       │
  │ 用户确认         │    │ 阶段从 1 开始    │    └──────────────────┘
  └──────────────────┘    └──────────────────┘

  产出: REQUIREMENTS.md、ROADMAP.md、STATE.md、RESEARCH-SUMMARY.md
  ▶ 下一步: /wf-discuss-phase 1 或 /wf-autonomous


═══════════════════════════════════════════════════════════════════════════════════
会话管理:  /wf-pause + /wf-resume
═══════════════════════════════════════════════════════════════════════════════════

  ── 暂停 (/wf-pause) ───────────────────────────────────────────

  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
  │ 1. 检测当前状态   │───▶│ 2. 推断步骤      │───▶│ 3. 写入检查点    │
  │ state json       │    │ has_verification? │    │ session pause    │
  │ roadmap analyze  │    │ has_plans?        │    │ HANDOFF.json     │
  │ init phase-op    │    │ has_context?      │    │ .continue-here.md│
  └──────────────────┘    └──────────────────┘    └────────┬─────────┘
                                                           │
                                                           ▼
                                                  确认暂停 + 提示 /wf-resume

  ── 恢复 (/wf-resume) ──────────────────────────────────────────

  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
  │ 1. 读取检查点     │───▶│ 2. 分支检查      │───▶│ 3. 路由恢复      │
  │ session status   │    │ git_branch 比对  │    │ step → Skill()  │
  │ HANDOFF.json     │    │ 不一致则警告     │    │                  │
  └──────────────────┘    └──────────────────┘    └────────┬─────────┘
         │                                                  │
    无检查点                                   ┌────────────┴────────────┐
         │                                     │                         │
         ▼                               discuss/plan/          execute/verify
    提示 /wf-next                        Skill(对应工作流)      Skill(对应工作流)
                                               │                         │
                                               └────────────┬────────────┘
                                                            │
                                                            ▼
                                                  ┌──────────────────┐
                                                  │ 4. 清理检查点    │
                                                  │ session resume   │
                                                  │ 删除 HANDOFF.json│
                                                  └──────────────────┘


═══════════════════════════════════════════════════════════════════════════════════
配置管理:  /wf-settings [set key value]
═══════════════════════════════════════════════════════════════════════════════════

  ┌──────────────────┐
  │ 检测模式          │
  └──────┬───────────┘
         │
    ┌────┴─────────────┐
    │                  │
  无参数             有 "set"
    │                  │
    ▼                  ▼
  交互式菜单        直接 CLI
    │                  │
    ▼                  ▼
  ┌─────────────┐   ┌─────────────────────────────┐
  │ schema +    │   │ settings set <key> <value>   │
  │ 当前配置    │   └──────────────┬──────────────┘
  │ 分类展示    │                  │
  └──────┬──────┘                  ▼
         │                    显示修改结果
         ▼
  ┌─────────────┐
  │ 用户选择键  │ ◀──────── 循环
  │ 修改 → 确认 │ ───────▶ 直到 "done"
  └─────────────┘

  配置类别: 基本设置 │ 工作流行为 │ 并行化 │ 里程碑 │ 门禁 │ 安全 │ Hook │ Agent 模型 │ 规划
  写入目标: .planning/config.json（不修改 wf/templates/config.json）


═══════════════════════════════════════════════════════════════════════════════════
进度查看:  /wf-progress
═══════════════════════════════════════════════════════════════════════════════════

                    ┌─────────────────┐
                    │ 读取 STATE.md   │
                    │ 读取 ROADMAP.md │
                    │ 扫描 phase-N/   │
                    └────────┬────────┘
                             │
                    计算进度 + 智能路由
                             │
                    ┌────────┴────────┐
                    │                 │
               显示进度条         推荐下一步
                    │                 │
    ┌───────────────┴──┐    ┌────────┴────────┐
    │ Phase 1 ████ 100%│    │ Route A: 继续执行│
    │ Phase 2 ████  72%│    │ Route B: 去验证  │
    │ Phase 3 ░░░░   0%│    │ Route C: 下一阶段│
    └──────────────────┘    │ Route D: 全部完成│
                            │ Route E: 暂停中  │
                            │ Route F: 有阻塞  │
                            └─────────────────┘


═══════════════════════════════════════════════════════════════════════════════════
Hooks 运行时机
═══════════════════════════════════════════════════════════════════════════════════

  SessionStart ─────────────────────────────────────────────────────
    │
    └── wf-session-state.js     注入 STATE.md 摘要到会话上下文（Node.js）

  PreToolUse (Write|Edit) ──────────────────────────────────────────
    │
    └── wf-prompt-guard.js      扫描 .planning/ 写入内容的注入模式

  PostToolUse (Bash|Edit|Write|MultiEdit|Agent|Task) ───────────────
    │
    └── wf-context-monitor.js   检查 context 使用率
                                WARNING  ≤30% → 确保 CONTINUATION.md 检查点已写入
                                CRITICAL ≤15% → auto-compact 即将触发，确认检查点就绪
                                防抖: 同级别警告至少间隔 60 秒，级别升级立即触发

  StatusLine (持续) ────────────────────────────────────────────────
    │
    └── wf-statusline.js        WF │ Model │ Task │ Dir │ ██░░ 47%


═══════════════════════════════════════════════════════════════════════════════════
.planning/ 目录状态演进
═══════════════════════════════════════════════════════════════════════════════════

  /wf-new-project 后:
  .planning/
  ├── PROJECT.md
  ├── config.json
  ├── REQUIREMENTS.md
  ├── ROADMAP.md
  ├── STATE.md
  └── research/SUMMARY.md

  /wf-discuss-phase 1 后:
  .planning/
  ├── ...
  └── phase-1/
      ├── CONTEXT.md
      └── DISCUSSION-LOG.md

  /wf-plan-phase 1 后:
  .planning/
  ├── ...
  └── phase-1/
      ├── CONTEXT.md
      ├── DISCUSSION-LOG.md
      ├── RESEARCH.md
      ├── PLAN.md (或 PLAN-A.md, PLAN-B.md)
      └── THREAT-MODEL.md (如安全门禁开启)

  /wf-execute-phase 1 后:
  .planning/
  ├── ...
  └── phase-1/
      ├── ...
      ├── SUMMARY.md (或 SUMMARY-A.md, SUMMARY-B.md)
      └── VERIFICATION.md

  /wf-code-review 1 后:
  .planning/
  ├── ...
  └── phase-1/
      ├── ...
      └── REVIEW.md

  /wf-verify-work 后:
  .planning/
  ├── ...
  └── UAT.md

  /wf-pause 后:
  .planning/
  ├── ...
  ├── HANDOFF.json
  └── .continue-here.md

  /wf-complete-milestone v1.0 后:
  .planning/
  ├── PROJECT.md (保留，更新里程碑记录)
  ├── config.json (保留)
  ├── STATE.md (重置)
  └── milestones/
      └── v1.0/
          ├── v1.0-ROADMAP.md
          ├── v1.0-REQUIREMENTS.md
          ├── v1.0-STATE.md
          └── phases/ (归档的阶段工件)


═══════════════════════════════════════════════════════════════════════════════════
Agent 调度关系
═══════════════════════════════════════════════════════════════════════════════════

  Orchestrator (主会话)
    │
    ├── wf-researcher ×4    ◀── /wf-new-project 并行研究
    ├── wf-roadmapper ×1    ◀── /wf-new-project 生成路线图
    │
    ├── wf-researcher ×1    ◀── /wf-discuss-phase 顾问研究（可选）
    │
    ├── wf-researcher ×1    ◀── /wf-plan-phase 实现研究
    ├── wf-planner ×1       ◀── /wf-plan-phase 计划生成
    │
    ├── wf-executor ×N      ◀── /wf-execute-phase wave 内并行
    │   (worktree 隔离)         每个 executor 独立执行一个 PLAN
    │
    ├── wf-verifier ×1      ◀── /wf-execute-phase 阶段验证
    │
    ├── wf-reviewer ×1      ◀── /wf-code-review 代码审查
    │
    ├── wf-researcher ×N    ◀── /wf-new-milestone 新领域研究
    ├── wf-roadmapper ×1    ◀── /wf-new-milestone 生成路线图
    │
    └── wf-executor ×1      ◀── /wf-code-review 自动修复（审查-修复链）
```

---

## 规格空间（Phase A — OpenSpec-inspired，可选）

WF 现有架构以 **phase-driven**（阶段驱动）为核心：REQUIREMENTS.md 单文件承载全部需求。Phase A 借鉴 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 的 Requirement/Scenario 模型，作为**正交的第二轴**叠加进来，不改动 phase/wave/agent/hook/milestone 任何现有机制。

### 目录结构

```
.planning/
├── REQUIREMENTS.md                 # 保留：跨 capability 的需求索引
├── specs/                          # 可选新增（spec.enabled=true 时生效）
│   └── <capability>/               # kebab-case 命名，每个 capability 一个目录
│       └── spec.md                 # Purpose + Requirements + Scenarios
├── phase-N/ ...                    # 保留：阶段驱动完全不变
└── milestones/ ...                 # 保留
```

### Spec 文件格式

```markdown
# <Capability> Specification

## Purpose
{{一句话，用 SHALL 句式表达系统目标能力}}

## Requirements

### Requirement: {{稳定 header 即 ID}}
{{用 SHALL/MUST 描述行为}}

#### Scenario: {{scenario 名}}
- **WHEN** {{触发}}
- **THEN** {{结果}}
- **AND** {{附加结果}}
```

### 开关配置

`.planning/config.json` 新增 `spec` 命名空间，默认全部关闭保证向后兼容：

```json
{
  "spec": {
    "enabled": false,
    "require_scenarios": true,
    "verifier_use_scenarios": false
  }
}
```

### CLI 接口

| 命令 | 作用 |
|---|---|
| `wf-tools spec list [--json]` | 列出所有 capability，含 requirement/scenario 计数 |
| `wf-tools spec show <capability>` | 结构化输出某 capability 的 parsed spec |
| `wf-tools spec validate [<cap>] [--all]` | 校验 Purpose 存在、requirement header 唯一、每个 scenario 必含 WHEN+THEN |

实现落在 `wf/bin/lib/spec.cjs`，路由在 `wf/bin/wf-tools.cjs` 的 switch 上追加 `case 'spec'`。

### Agent 集成点（条件触发）

| Agent | 触发条件 | 新增行为 |
|---|---|---|
| `wf-roadmapper` | `spec.enabled = true` | 生成 ROADMAP.md 后额外按 capability 产出初始 `specs/<cap>/spec.md`，并跑 `wf-tools spec validate --all` 自检 |
| `wf-verifier` | `spec.enabled && spec.verifier_use_scenarios` | 常规需求覆盖之外追加"Scenario 覆盖"小节：每个 WHEN/THEN 反推到测试或代码位置作为证据 |

### 单元测试

`wf/bin/lib/spec.test.cjs` 覆盖 25 个用例：parseSpec 行为、listSpecs 过滤、showSpec 错误路径、validateOne/validateAll 的全部错误分支（Purpose 缺失、无 requirement、无 scenario、重复 header、WHEN/THEN 缺失、非 kebab-case 名称等）。

### 后续 Phase

Phase B 已实施：引入 `changes/` 空间与 delta 语法，详见下一节。

---

## 变更提议（Phase B — OpenSpec-inspired，可选）

在 Phase A 的规格空间之上引入**变更生命周期**：独立的 change 包作为规格的"提议-应用-归档"单元，多个 change 可并发存在互不冲突，归档时才把增量写进主干 specs/。

### 目录结构

```
.planning/
├── specs/<cap>/spec.md             # 主干（Phase A）
└── changes/                        # 新增（Phase B）
    ├── <change-id>/                # 活跃变更（kebab-case id）
    │   ├── proposal.md             # Why + What Changes + Capabilities + Impact
    │   ├── tasks.md                # 实现任务 checkbox
    │   ├── design.md               # 可选：技术方案
    │   └── specs/<cap>/spec.md     # delta：ADDED/MODIFIED/REMOVED/RENAMED Requirements
    └── archive/
        └── YYYY-MM-DD-<change-id>/ # 归档后的 change 包（含 delta 历史）
```

一个 change 可以跨多个 capability（每个 capability 一个 delta 文件）。archive 目录以日期前缀命名避免重名。

### Delta 语法

二级标题必须是以下四个之一（大小写敏感）：

| 操作 | 行为 |
|---|---|
| `## ADDED Requirements` | 追加到主 spec 的 `## Requirements` 段末 |
| `## MODIFIED Requirements` | 按 `### Requirement:` header 匹配，**整块替换**（含全部 scenarios） |
| `## REMOVED Requirements` | 按 header 删除 |
| `## RENAMED Requirements` | `- From: <old-name>` 行声明旧名；body 非空时同时替换内容，body 为空时仅改名保留 body |

每个 requirement 内部结构与主干 spec 相同：`### Requirement: <header 稳定 ID>` + `#### Scenario:` + WHEN/THEN/AND 步骤。

### 合并算法（`archiveChange` 的核心）

```
1. 校验：收集所有 delta 文件
2. 对每个 (capability, delta) 对：
   - 读主干 specs/<cap>/spec.md（若不存在则按 ADDED 建新 capability）
   - splitRequirements 拆成 [{name, block}] 列表
   - 检查：ADDED 目标必须不存在；MODIFIED/REMOVED/RENAMED.From 必须存在；RENAMED 目标必须不存在
   - 任一冲突 → 抛错，终止合并（fail-fast，主 specs/ 不动）
3. 按 MODIFIED → REMOVED → RENAMED → ADDED 顺序应用
4. 全部成功后：writeFile 到主 specs/ + mv changes/<id>/ → changes/archive/YYYY-MM-DD-<id>/
```

### CLI 接口

| 命令 | 作用 |
|---|---|
| `wf-tools change list [--json]` | 列活跃 changes 和已归档 changes |
| `wf-tools change show <id>` | 结构化展示某 change（proposal/tasks/design 存在性 + 每个 delta 的计数） |
| `wf-tools change validate <id>` | 校验 delta 语法 + 与主 spec 的语义一致性 |
| `wf-tools change archive <id> [--dry-run]` | 合并 + 归档；dry-run 预览不写文件 |

### 命令/工作流入口

- `/wf-propose <idea>` → `wf/workflows/propose.md` → 调用 `wf-proposer` agent
- `/wf-validate-spec <id\|--all>` → 直接走 CLI（spec 或 change validate 自动识别）
- `/wf-apply-change <id>` → 读 tasks.md，委托 `wf-executor` 实现代码
- `/wf-archive-change <id>` → 直接走 CLI，建议先 `--dry-run`

### 与阶段驱动的正交性

变更驱动与阶段驱动并存不冲突：
- change 描述**规格层**变更（行为/契约），phase 描述**实现层**组织（wave/worktree/commit）
- 一个 change apply 时可以复用现有 phase，也可以单独走 executor 一次性完成
- milestone 归档机制保持不变；建议将来 Phase C 把 `specs/` 纳入 milestone 快照

### 单元测试

`wf/bin/lib/change.test.cjs` 覆盖 33 个用例：parseDelta 四种操作、validateDelta 冲突检测、applyDeltaToSpec 的成功路径 + 所有错误路径（ADDED 重名 / MODIFIED 目标缺失 / REMOVED 目标缺失 / RENAMED 冲突）、listChanges/showChange/validateChange/archiveChange（含 dry-run、新 capability、merge 冲突场景）。

### 负面清单（明确**不借鉴**的 OpenSpec 元素）

- `/opsx:*` slash 前缀 → 坚持 `wf-` 前缀
- `openspec.yaml` → 复用 `.planning/config.json`
- `openspec workspace` 多仓协调 → 非 WF 单仓定位
- "fluid not rigid" 去门禁哲学 → WF 的 4 级验证/门禁保留，只把规格层做成 fluid

---

## 深度整合（Phase C）

把 Phase A/B 的规格空间和变更生命周期嵌进 WF 现有的项目/里程碑/快速任务工作流，保持向后兼容：未启用 `spec.enabled` 时行为完全不变。

### new-project 工作流

`wf/workflows/new-project.md` 在生成 ROADMAP.md 之后，当 `config.spec.enabled = true` 时，`wf-roadmapper` 按其 agent 指令**额外**产出初始 `.planning/specs/<capability>/spec.md` 骨架：按业务域 kebab-case 拆分，每个 FR 映射为 `### Requirement:` + 至少一个 `#### Scenario:`（WHEN/THEN），并自行跑 `wf-tools spec validate --all` 自检。

REQUIREMENTS.md 保留为**跨 capability 的需求索引**，specs/ 是**按 capability 分治的行为契约**。

### milestone 归档

`wf/bin/lib/milestone.cjs::archiveMilestone` 在复制 phases/ 之外新增：

1. 复制 `specs/` → `milestones/<version>/specs/`（主干规格的版本快照）
2. 复制 `changes/archive/` → `milestones/<version>/changes-archive/`（历史 change 的版本内快照）
3. 检测到活跃（未归档）`changes/<id>/` 时在 `warnings` 中提示，不阻塞归档

`resetForNewMilestone` **保留** specs/：规格是跨里程碑的长期资产，不应随 REQUIREMENTS/ROADMAP 一起清空。活跃 changes/ 同样保留（由用户决定带入新里程碑或手工清理）。

### /wf-quick 的 `--spec` 短链路

当用户显式传 `--spec` 或任务明显涉及"系统已记录的行为契约"时，`wf/workflows/quick.md` 走 **propose → validate → apply → archive** 而非传统的 PLAN.md 路径：

- 前置检查 `config.spec.enabled`，未启用则引导或降级
- 推断 kebab-case `change_id`，委托 `wf-proposer` 产出完整 change 包
- `wf-tools change validate <id>` 通过后交给 `wf-executor` 按 tasks.md 实现代码
- `wf-tools change archive <id> --dry-run` 预览 → 用户确认 → 真正归档

适用于小特性/小修改，**绕过**阶段化开销但仍保留规格级可审计性。

### prompt-guard 覆盖

`hooks/wf-prompt-guard.js` 基于路径前缀 `.planning/` 扫描，Phase A 的 `specs/` 和 Phase B 的 `changes/` 自动被覆盖。`.md` 文件走 REDUCED_SEVERITY 路径以避免讨论安全话题时的噪音。

### 测试

`wf/bin/lib/milestone.test.cjs` 新增 5 个用例：
- `specs/` 被归档进 milestone 快照
- `changes/archive/` 被快照为 `changes-archive/`
- 存在活跃 change 时产生 warning
- `archive/` 子目录不会被误认为活跃 change
- 跨里程碑 reset 时 `specs/` 保留

---

## 进阶加固（Phase D）

三项可选进阶能力。全部保持默认向后兼容：不声明 id 时行为与 Phase A/B 完全一致。

### D-1：`wf-tools change diff <id>` 可视化预览

纯 JavaScript 实现的 LCS 行级 unified diff，展示"change apply 后主 spec 会变成什么样"，**不修改任何文件**。审阅前的第一件事：

```bash
wf-tools change diff add-oauth            # 人类可读
wf-tools change diff add-oauth --json     # 结构化（capability/stats/diff 字段）
```

每个 capability 独立显示：`+N -M` 统计、新 capability 标记、带 ± 前缀的 hunk（上下文 3 行）。

### D-2：稳定 requirement ID

在 requirement body 或 scenario body 中加入 `<!-- req-id: <STABLE-ID> -->` 即声明稳定标识。id 字符集：`[A-Za-z0-9._-]`。

- `parseSpec` 自动抽取 id 存入 `req.id`
- `listSpecs` 结果附带 `requirement_ids: [...]`
- `validateOne` 检查 id 在 spec 内唯一（duplicate 报 error）
- change delta 的 ADDED/MODIFIED/REMOVED 的匹配策略：**id 优先，header 次之**
  - MODIFIED 可以同时改 header + id 保留
  - REMOVED 通过 id 定位，header 可任意
- RENAMED 支持新语法：`- From: @id:<stable-id>`，不再依赖旧 header 文本
- coverage 查询支持直接传 id：`wf-tools spec coverage AUTH-LOGIN`，`detail.match = "requirement id"`

**向后兼容**：没有 id 的 spec / delta 全部按 header 匹配，Phase A/B 已有产出不受影响（回归测试 77 个全部原样通过）。

### D-3：`wf-tools spec coverage <query>` 反向追踪

解决 WF 在"需求 → 实现"追溯上的历史缺口。给定 `FR-N` / requirement header / capability 名 / 稳定 id，扫描：

1. `REQUIREMENTS.md`（FR-N 按词边界匹配，`FR-1` 不会误命中 `FR-10`）
2. `specs/<cap>/spec.md`（capability 名、requirement header、requirement id）
3. `phase-N/{PLAN,SUMMARY,VERIFICATION,CONTEXT}.md`（文本匹配）
4. `changes/<id>/specs/<cap>/spec.md`（active，requirement header 优先）
5. `changes/archive/<stamp-id>/specs/<cap>/spec.md`（archived，与 active 分开上报）
6. `git log --grep`（最多 10 条，忽略错误）

输出结构化 traces：`{ query, total, traces: [{ source, detail }] }`。

### 测试

- D-1：`change.test.cjs` +11 用例
- D-3：`spec.test.cjs` +8 用例
- D-2：`spec.test.cjs` +6（id 解析/唯一性/coverage 命中）+ `change.test.cjs` +6（MODIFIED/REMOVED/RENAMED by id、向后兼容回归）

Phase A+B+C+D 累计 **107/107 测试通过**。

### 下一步（可选）

- 把 `wf-proposer` 与 `wf-planner` 合并为按 prompt 参数切换的双模式，降低维护成本
- `wf-tools change diff` 增加 `--html` 输出以便贴到 code review 评论
