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
│   │   └── troubleshooting.md       # 常见问题诊断与恢复
│   └── templates/                   # 项目模板
│       ├── config.json              # 工作流配置模板（auto 模式默认）
│       ├── project.md               # 项目文档模板
│       ├── state.md                 # 状态文件模板
│       ├── roadmap.md               # 路线图模板
│       ├── spec.md                  # 规格模板（Purpose + Requirement + Scenario）
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
├── agents/                          # 6 个核心 sub-agent
│   ├── wf-planner.md                # 计划生成器 — 任务分解/wave 分组/依赖分析
│   ├── wf-executor.md               # 任务执行器 — 逐任务执行/原子提交/偏差处理
│   ├── wf-verifier.md               # 目标验证器 — 4 级验证/需求覆盖/反模式扫描
│   ├── wf-researcher.md             # 技术研究员 — 技术调研/方案比较/风险分析
│   ├── wf-roadmapper.md             # 路线图设计 — 阶段划分/需求映射/依赖分析
│   └── wf-reviewer.md               # 代码审查器 — 逐文件审查/4 维度分析/REVIEW.md
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

Phase B 将引入 `changes/` 空间与 `ADDED/MODIFIED/REMOVED/RENAMED Requirements` delta 语法，实现完整的 propose-apply-archive 生命周期。详见 `/Users/zxs/.claude/plans/project-claude-peaceful-bengio.md`。
