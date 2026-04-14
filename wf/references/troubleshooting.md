# 故障排查手册

## 1. 自主模式未恢复

**症状:** `/wf-autonomous` 执行中 auto-compact 触发，但恢复后未自动继续。

**排查步骤:**

1. 检查 CONTINUATION.md 是否存在：
   ```bash
   cat .planning/CONTINUATION.md
   ```
2. 如果不存在：检查点未写入。查看 CLAUDE.md 是否包含 `Compact instructions` 段落。
3. 如果存在但 frontmatter 缺少 `phase` 或 `step`：检查点损坏。删除后手动恢复：
   ```bash
   rm .planning/CONTINUATION.md
   # 查看当前状态，手动指定起始阶段
   /wf-autonomous --from <phase>
   ```
4. 如果存在且完整：auto-compact 可能未保留检查点内容。确认 CLAUDE.md 中的 compact instructions 是否被意外删除。

**预防:** 确保 CLAUDE.md 包含 `## Compact instructions` 段落。

---

## 2. CONTINUATION.md 损坏

**症状:** 自主模式启动时显示 `"⚠ CONTINUATION.md 检查点损坏"`。

**原因:** auto-compact 截断、并发写入、或手动编辑导致 frontmatter 不完整。

**处理:**

1. 系统会自动回退到 HANDOFF.json 恢复
2. 如果 HANDOFF.json 也不存在，从 STATE.md 的 current_phase 开始
3. 手动恢复：
   ```bash
   rm .planning/CONTINUATION.md
   /wf-autonomous --from <上次执行到的阶段>
   ```

---

## 3. Agent 超时或无响应

**症状:** sub-agent（executor/planner/verifier）长时间无输出，最终超时。

**排查步骤:**

1. 检查 agent 输入是否完整（PLAN.md、CONTEXT.md 等文件是否存在）
2. 检查 worktree 是否正常创建（executor 使用 worktree 隔离）
3. 查看 agent 的 completion marker 是否输出：
   ```bash
   # 检查最近的 SUMMARY.md 是否为 partial
   cat .planning/phases/*/SUMMARY*.md | head -20
   ```
4. 如果 agent 返回 `"status": "failed"`，查看 summary 字段的错误原因

**常见原因:**
- PLAN.md 中 action 字段模糊 → executor 无法执行 → 超时
- 文件路径错误 → agent 读取失败
- Context 预算耗尽 → agent 返回 partial

---

## 4. 验证二次失败后暂停

**症状:** 自主模式在某个阶段暂停，显示 `"验证仍未通过"`。

**处理:**

1. 查看验证报告：
   ```bash
   cat .planning/phases/<NN>-*/VERIFICATION.md
   ```
2. 找到 FAIL 级别的验证项，分析原因
3. 手动修复代码，然后重新验证：
   ```bash
   /wf-verify-work
   ```
4. 验证通过后，继续自主模式：
   ```bash
   /wf-autonomous --from <当前阶段+1>
   ```

**注意:** gap closure 每阶段最多自动重试 1 次（防止无限循环）。第二次失败一定暂停。

---

## 5. Context 警告频繁出现

**症状:** 每次工具调用后都看到 context 警告。

**排查:**

1. 检查防抖文件是否正常写入：
   ```bash
   ls /tmp/claude-ctx-*-warned.json
   cat /tmp/claude-ctx-*-warned.json
   ```
2. 如果 `lastWarnTime` 正常但仍频繁警告：可能是级别升级（WARNING → CRITICAL）触发，这是预期行为
3. 临时禁用（不推荐）：
   ```bash
   # 在 .planning/config.json 中设置
   { "hooks": { "context_warnings": false } }
   ```

---

## 6. STATE.md 与实际进度不一致

**症状:** `/wf-progress` 显示的进度与实际完成的工作不符。

**排查:**

1. 检查 STATE.md frontmatter：
   ```bash
   head -20 .planning/STATE.md
   ```
2. 检查各阶段目录中是否有 SUMMARY.md 和 VERIFICATION.md
3. 如果文件存在但 STATE.md 未更新：可能是 `wf-tools state` CLI 未执行

**修复:** 使用 `/wf-progress` 重新扫描实际状态，或手动运行：
```bash
node "$HOME/.claude/wf/bin/wf-tools.cjs" state sync
```

---

## 7. Hook 启动失败

**症状:** session 启动时无状态提醒，或 statusline 不显示。

**排查:**

1. 确认 hook 文件存在：
   ```bash
   ls -la "$HOME/.claude/hooks/wf-"*.js
   ```
2. 确认 settings.json hook 配置正确：
   ```bash
   cat "$HOME/.claude/settings.json" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(d).hooks,null,2)))"
   ```
3. 手动测试 hook：
   ```bash
   echo '{"session_id":"test","cwd":"'$(pwd)'"}' | node "$HOME/.claude/hooks/wf-session-state.js"
   ```
4. 检查 Node.js 版本 >= 14

---

## 8. 计划质量门禁反复失败

**症状:** plan-phase 工作流进入修订循环，达到 3 次上限后仍未通过。

**原因:** 需求过于复杂，单个 PLAN.md 无法满足覆盖率要求（≥90%）。

**处理:**

1. 检查哪些需求未覆盖：查看 plan-phase 的输出
2. 考虑拆分阶段：将复杂阶段分为多个子阶段
3. 或手动降低门禁：
   ```bash
   /wf-settings
   # 将 gates.requirements_coverage 临时设为 false
   ```

---

## 快速诊断命令

```bash
# 查看当前状态
/wf-progress

# 查看 context 使用率
cat /tmp/claude-ctx-*.json 2>/dev/null

# 检查检查点
cat .planning/CONTINUATION.md 2>/dev/null || echo "无检查点"
cat .planning/HANDOFF.json 2>/dev/null || echo "无暂停点"

# 查看最近的验证结果
ls .planning/phases/*/VERIFICATION*.md 2>/dev/null

# 检查 hook 健康
echo '{}' | timeout 5 node "$HOME/.claude/hooks/wf-statusline.js" 2>/dev/null && echo "OK" || echo "FAIL"
```
