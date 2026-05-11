#!/usr/bin/env bash
# WF Workflow System Installer
# 将 WF 工作流系统安装到 $HOME/.claude/ 或项目 .claude/ 目录
#
# 用法:
#   ./install.sh [选项]
#
# 选项:
#   --user        安装到用户级别 $HOME/.claude/ (默认)
#   --project     安装到当前项目 .claude/ 目录
#   --force       强制安装（跳过版本检查和确认）
#   --dry-run     仅显示将执行的操作，不实际安装
#   --uninstall   卸载 WF（仅删除 WF 文件，保留其他配置）
#   --help        显示帮助信息
#
# 示例:
#   ./install.sh                # 安装到用户级别
#   ./install.sh --project      # 安装到当前项目
#   ./install.sh --dry-run      # 预览安装操作
#   ./install.sh --uninstall    # 卸载 WF（用户级别）
#   ./install.sh --project --uninstall  # 卸载 WF（项目级别）
#   ./install.sh --force        # 强制重新安装

set -euo pipefail

# ─── 颜色和日志 ───────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[WF]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[WF]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WF]${NC} $1"; }
log_error() { echo -e "${RED}[WF]${NC} $1"; }
log_dim()   { echo -e "${DIM}     $1${NC}"; }

# ─── 参数解析 ─────────────────────────────────────

FORCE=false
DRY_RUN=false
UNINSTALL=false
INSTALL_SCOPE="user"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)      INSTALL_SCOPE="user"; shift ;;
    --project)   INSTALL_SCOPE="project"; shift ;;
    --force)     FORCE=true; shift ;;
    --dry-run)   DRY_RUN=true; shift ;;
    --uninstall) UNINSTALL=true; shift ;;
    --help|-h)
      echo "WF Workflow System Installer"
      echo ""
      echo "用法: ./install.sh [选项]"
      echo ""
      echo "选项:"
      echo "  --user        安装到用户级别 \$HOME/.claude/ (默认)"
      echo "  --project     安装到当前项目 .claude/ 目录"
      echo "  --force       强制安装（跳过版本检查和确认）"
      echo "  --dry-run     仅显示将执行的操作"
      echo "  --uninstall   卸载 WF 文件"
      echo "  --help        显示此帮助"
      exit 0
      ;;
    *)
      log_error "未知选项: $1"
      log_info "运行 ./install.sh --help 查看用法"
      exit 1
      ;;
  esac
done

# ─── 路径常量 ─────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WF_SOURCE="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [[ "$INSTALL_SCOPE" == "project" ]]; then
  CLAUDE_DIR="$(pwd)/.claude"
  SCOPE_LABEL="项目级别"
  # 项目级别用相对路径引用 hooks
  HOOK_PATH_PREFIX=".claude"
else
  CLAUDE_DIR="$HOME/.claude"
  SCOPE_LABEL="用户级别"
  # 用户级别用 $HOME 绝对路径
  HOOK_PATH_PREFIX="\$HOME/.claude"
fi

# ─── 前置条件检查 ─────────────────────────────────

check_prerequisites() {
  local errors=0

  if ! command -v node &>/dev/null; then
    log_error "需要 Node.js (v14+)"
    errors=$((errors + 1))
  else
    local node_major
    node_major=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
    if [[ "$node_major" -lt 14 ]]; then
      log_error "Node.js 版本过低: v$(node -v). 需要 v14+"
      errors=$((errors + 1))
    fi
  fi

  # 检查源文件完整性（核心文件 + hooks + lib 模块）
  local critical_files=(
    "wf/bin/wf-tools.cjs"
    "settings.json"
    "hooks/wf-session-state.js"
    "hooks/wf-context-monitor.js"
    "hooks/wf-prompt-guard.js"
    "hooks/wf-statusline.js"
    "wf/bin/lib/utils.cjs"
    "wf/bin/lib/state.cjs"
    "wf/bin/lib/config.cjs"
    "wf/bin/lib/frontmatter.cjs"
    "wf/bin/lib/merge-settings.cjs"
  )
  for f in "${critical_files[@]}"; do
    if [[ ! -f "${WF_SOURCE}/${f}" ]]; then
      log_error "源文件不完整: 缺少 ${f}"
      errors=$((errors + 1))
    fi
  done

  if [[ "$errors" -gt 0 ]]; then
    exit 1
  fi
}

# ─── 版本比较 ─────────────────────────────────────

# 比较语义版本号: 返回 "newer" | "same" | "older" | "fresh"
compare_versions() {
  local source_version="$1"
  local target_version_file="${CLAUDE_DIR}/wf/VERSION"

  if [[ ! -f "$target_version_file" ]]; then
    echo "fresh"
    return
  fi

  local target_version
  target_version=$(cat "$target_version_file" 2>/dev/null | tr -d '[:space:]')

  if [[ -z "$target_version" ]]; then
    echo "fresh"
    return
  fi

  if [[ "$source_version" == "$target_version" ]]; then
    echo "same"
    return
  fi

  # 拆分并逐段比较
  local IFS='.'
  read -r s_major s_minor s_patch <<< "$source_version"
  read -r t_major t_minor t_patch <<< "$target_version"

  s_major=${s_major:-0}; s_minor=${s_minor:-0}; s_patch=${s_patch:-0}
  t_major=${t_major:-0}; t_minor=${t_minor:-0}; t_patch=${t_patch:-0}

  if [[ "$s_major" -gt "$t_major" ]] ||
     [[ "$s_major" -eq "$t_major" && "$s_minor" -gt "$t_minor" ]] ||
     [[ "$s_major" -eq "$t_major" && "$s_minor" -eq "$t_minor" && "$s_patch" -gt "$t_patch" ]]; then
    echo "newer"
  else
    echo "older"
  fi
}

# ─── 备份 ─────────────────────────────────────────

create_backup() {
  local backup_dir="${CLAUDE_DIR}/.wf-backup-$(date +%Y%m%d-%H%M%S)"

  if $DRY_RUN; then
    log_info "[dry-run] 将创建备份: ${backup_dir}"
    return
  fi

  log_info "创建备份..."
  mkdir -p "$backup_dir"

  # 备份 WF 文件
  [[ -d "${CLAUDE_DIR}/hooks" ]]        && cp -r "${CLAUDE_DIR}/hooks" "$backup_dir/" 2>/dev/null || true
  [[ -d "${CLAUDE_DIR}/agents" ]]       && cp -r "${CLAUDE_DIR}/agents" "$backup_dir/" 2>/dev/null || true
  [[ -d "${CLAUDE_DIR}/commands/wf" ]]  && mkdir -p "$backup_dir/commands" && cp -r "${CLAUDE_DIR}/commands/wf" "$backup_dir/commands/" 2>/dev/null || true
  [[ -d "${CLAUDE_DIR}/wf" ]]           && cp -r "${CLAUDE_DIR}/wf" "$backup_dir/" 2>/dev/null || true
  [[ -f "${CLAUDE_DIR}/settings.json" ]] && cp "${CLAUDE_DIR}/settings.json" "$backup_dir/" 2>/dev/null || true

  log_dim "备份位置: ${backup_dir}"
}

# ─── 卸载 ─────────────────────────────────────────

do_uninstall() {
  log_info "卸载 WF 工作流系统..."
  echo ""

  local items=(
    "${CLAUDE_DIR}/hooks/wf-*.js"
    "${CLAUDE_DIR}/agents/wf-*.md"
    "${CLAUDE_DIR}/commands/wf"
    "${CLAUDE_DIR}/skills/wf-*"
    "${CLAUDE_DIR}/wf"
  )

  local count=0
  for pattern in "${items[@]}"; do
    # shellcheck disable=SC2086
    for item in $pattern; do
      [[ -e "$item" ]] || continue
      if $DRY_RUN; then
        log_dim "[dry-run] 删除: $item"
      else
        rm -rf "$item"
      fi
      count=$((count + 1))
    done
  done

  # 从 settings.json 中移除 WF 条目
  if [[ -f "${CLAUDE_DIR}/settings.json" ]]; then
    if $DRY_RUN; then
      log_dim "[dry-run] 从 settings.json 中移除 WF hooks"
    else
      # 用 Node.js 移除 WF 相关条目
      node -e "
        const fs = require('fs');
        const p = '${CLAUDE_DIR}/settings.json';
        try {
          const s = JSON.parse(fs.readFileSync(p, 'utf8'));
          // 移除包含 wf- 的 hook 条目
          if (s.hooks) {
            for (const [event, arr] of Object.entries(s.hooks)) {
              if (Array.isArray(arr)) {
                s.hooks[event] = arr.filter(e => {
                  const cmd = e.command || (e.hooks && e.hooks[0] && e.hooks[0].command) || '';
                  return !cmd.includes('wf-');
                });
                if (s.hooks[event].length === 0) delete s.hooks[event];
              }
            }
            if (Object.keys(s.hooks).length === 0) delete s.hooks;
          }
          // 移除 WF statusLine
          if (s.statusLine) {
            const cmd = s.statusLine.command || '';
            if (cmd.includes('wf-')) delete s.statusLine;
          }
          fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
        } catch(e) {}
      "
    fi
  fi

  echo ""
  if $DRY_RUN; then
    log_info "[dry-run] 将删除 ${count} 个 WF 项目"
  else
    log_ok "卸载完成! 已删除 ${count} 个 WF 项目"
    log_dim "用户配置 (permissions, env 等) 已保留"
  fi
}

# ─── 文件复制 ─────────────────────────────────────

TOTAL_FILES=0

copy_files() {
  local file_count=0

  # 创建目录结构（Phase E 完成：commands/wf 已全量迁至 skills/）
  local dirs=(
    "${CLAUDE_DIR}/agents"
    "${CLAUDE_DIR}/hooks"
    "${CLAUDE_DIR}/skills"
    "${CLAUDE_DIR}/wf/workflows"
    "${CLAUDE_DIR}/wf/references"
    "${CLAUDE_DIR}/wf/templates"
    "${CLAUDE_DIR}/wf/bin/lib"
  )

  for dir in "${dirs[@]}"; do
    if $DRY_RUN; then
      [[ -d "$dir" ]] || log_dim "[dry-run] mkdir: $dir"
    else
      mkdir -p "$dir"
    fi
  done

  # --- 命令文件（Phase E 完成：已全量迁至 skills/，本段保留仅为兼容历史 repo 意外留下的 commands/wf/） ---
  if [[ -d "${WF_SOURCE}/commands/wf" ]] && ls "${WF_SOURCE}/commands/wf/"*.md >/dev/null 2>&1; then
    log_info "复制遗留命令文件..."
    local cmd_count=0
    mkdir -p "${CLAUDE_DIR}/commands/wf"
    for f in "${WF_SOURCE}/commands/wf/"*.md; do
      [[ -f "$f" ]] || continue
      if $DRY_RUN; then
        log_dim "[dry-run] $(basename "$f")"
      else
        cp "$f" "${CLAUDE_DIR}/commands/wf/"
      fi
      cmd_count=$((cmd_count + 1))
    done
    log_dim "${cmd_count} 个遗留命令"
    file_count=$((file_count + cmd_count))
  fi

  # --- Agent 定义 ---
  log_info "复制 Agent 定义..."
  local agent_count=0
  for f in "${WF_SOURCE}/agents/wf-"*.md; do
    [[ -f "$f" ]] || continue
    if $DRY_RUN; then
      log_dim "[dry-run] $(basename "$f")"
    else
      cp "$f" "${CLAUDE_DIR}/agents/"
    fi
    agent_count=$((agent_count + 1))
  done
  log_dim "${agent_count} 个 Agent"
  file_count=$((file_count + agent_count))

  # --- Hook 脚本 (排除测试文件) ---
  log_info "复制 Hook 脚本..."
  local hook_count=0
  for f in "${WF_SOURCE}/hooks/wf-"*.js; do
    [[ -f "$f" ]] || continue
    # 排除测试文件
    [[ "$(basename "$f")" == *.test.* ]] && continue
    if $DRY_RUN; then
      log_dim "[dry-run] $(basename "$f")"
    else
      cp "$f" "${CLAUDE_DIR}/hooks/"
    fi
    hook_count=$((hook_count + 1))
  done
  log_dim "${hook_count} 个 Hook"
  file_count=$((file_count + hook_count))

  # --- 工作流定义 ---
  log_info "复制工作流定义..."
  local wf_count=0
  for f in "${WF_SOURCE}/wf/workflows/"*.md; do
    [[ -f "$f" ]] || continue
    if $DRY_RUN; then
      log_dim "[dry-run] $(basename "$f")"
    else
      cp "$f" "${CLAUDE_DIR}/wf/workflows/"
    fi
    wf_count=$((wf_count + 1))
  done
  log_dim "${wf_count} 个工作流"
  file_count=$((file_count + wf_count))

  # --- 参考文档 ---
  log_info "复制参考文档..."
  local ref_count=0
  for f in "${WF_SOURCE}/wf/references/"*.md; do
    [[ -f "$f" ]] || continue
    if $DRY_RUN; then
      log_dim "[dry-run] $(basename "$f")"
    else
      cp "$f" "${CLAUDE_DIR}/wf/references/"
    fi
    ref_count=$((ref_count + 1))
  done
  log_dim "${ref_count} 个参考文档"
  file_count=$((file_count + ref_count))

  # --- 模板 ---
  log_info "复制模板..."
  local tpl_count=0
  for f in "${WF_SOURCE}/wf/templates/"*; do
    [[ -f "$f" ]] || continue
    if $DRY_RUN; then
      log_dim "[dry-run] $(basename "$f")"
    else
      cp "$f" "${CLAUDE_DIR}/wf/templates/"
    fi
    tpl_count=$((tpl_count + 1))
  done
  log_dim "${tpl_count} 个模板"
  file_count=$((file_count + tpl_count))

  # --- Skills (每个 skill 是一个目录，含 SKILL.md + 可选辅助文件) ---
  if [[ -d "${WF_SOURCE}/wf/skills" ]]; then
    log_info "复制 Skills..."
    local skill_count=0
    for skill_dir in "${WF_SOURCE}/wf/skills/"*/; do
      [[ -d "$skill_dir" ]] || continue
      local skill_name
      skill_name=$(basename "$skill_dir")
      local target="${CLAUDE_DIR}/skills/${skill_name}"
      if $DRY_RUN; then
        log_dim "[dry-run] ${skill_name}/"
      else
        mkdir -p "$target"
        # 复制 SKILL.md + 其它文件，排除 *.test.*
        for f in "$skill_dir"*; do
          [[ -e "$f" ]] || continue
          [[ "$(basename "$f")" == *.test.* ]] && continue
          cp -r "$f" "$target/"
        done
      fi
      skill_count=$((skill_count + 1))
    done
    log_dim "${skill_count} 个 Skills"
    file_count=$((file_count + skill_count))
  fi

  # --- CLI 工具和 lib (排除测试文件) ---
  log_info "复制 CLI 工具..."
  local lib_count=0
  if $DRY_RUN; then
    log_dim "[dry-run] wf-tools.cjs"
  else
    cp "${WF_SOURCE}/wf/bin/wf-tools.cjs" "${CLAUDE_DIR}/wf/bin/"
  fi
  lib_count=$((lib_count + 1))

  for f in "${WF_SOURCE}/wf/bin/lib/"*.cjs; do
    [[ -f "$f" ]] || continue
    # 排除测试文件
    [[ "$(basename "$f")" == *.test.* ]] && continue
    if $DRY_RUN; then
      log_dim "[dry-run] lib/$(basename "$f")"
    else
      cp "$f" "${CLAUDE_DIR}/wf/bin/lib/"
    fi
    lib_count=$((lib_count + 1))
  done
  log_dim "${lib_count} 个工具文件"
  file_count=$((file_count + lib_count))

  # --- VERSION ---
  if [[ -f "${WF_SOURCE}/VERSION" ]]; then
    if $DRY_RUN; then
      log_dim "[dry-run] VERSION"
    else
      cp "${WF_SOURCE}/VERSION" "${CLAUDE_DIR}/wf/VERSION"
    fi
    file_count=$((file_count + 1))
  fi

  TOTAL_FILES=$file_count
}

# ─── Settings 合并 ────────────────────────────────

merge_settings() {
  local src="${WF_SOURCE}/settings.json"
  local dst="${CLAUDE_DIR}/settings.json"
  local merge_tool="${WF_SOURCE}/wf/bin/lib/merge-settings.cjs"

  if [[ ! -f "$merge_tool" ]]; then
    log_error "缺少合并工具: merge-settings.cjs"
    return 1
  fi

  if [[ ! -f "$dst" ]]; then
    # 目标不存在, 直接复制
    if $DRY_RUN; then
      log_info "[dry-run] 复制 settings.json (全新安装)"
    else
      cp "$src" "$dst"
      rewrite_hook_paths "$dst"
      log_ok "settings.json 已创建"
    fi
    return 0
  fi

  # 合并: 先输出到临时文件验证
  if $DRY_RUN; then
    log_info "[dry-run] 合并 settings.json (保留用户配置)"
    # 在 dry-run 模式下也运行合并来检查是否有问题
    if node "$merge_tool" "$src" "$dst" >/dev/null 2>&1; then
      log_dim "合并预检: 通过"
    else
      log_warn "合并预检: 可能有问题"
    fi
    return 0
  fi

  local merged merge_err
  merge_err=$(mktemp)
  merged=$(node "$merge_tool" "$src" "$dst" 2>"$merge_err")

  if [[ -z "$merged" ]]; then
    log_warn "settings.json 合并失败, 保留现有配置"
    if [[ -s "$merge_err" ]]; then
      log_warn "错误详情: $(cat "$merge_err")"
    fi
    log_warn "请手动合并: $src"
    rm -f "$merge_err"
    return 0
  fi
  rm -f "$merge_err"

  # 验证输出是合法 JSON
  if ! echo "$merged" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{JSON.parse(d)})" 2>/dev/null; then
    log_warn "合并结果不是合法 JSON, 保留现有配置"
    return 0
  fi

  echo "$merged" > "$dst"
  rewrite_hook_paths "$dst"
  log_ok "settings.json 已合并 (用户配置已保留)"
}

# ─── Hook 路径改写 ────────────────────────────────

# 项目级别安装时, 将 settings.json 中的 $HOME/.claude/ 路径改写为相对路径
rewrite_hook_paths() {
  local settings_file="$1"

  # 用户级别无需改写 (源文件默认即 $HOME/.claude/ 路径)
  [[ "$INSTALL_SCOPE" == "user" ]] && return 0

  node -e "
    const fs = require('fs');
    const p = '${settings_file}';
    try {
      let content = fs.readFileSync(p, 'utf8');
      // 替换 hook command 中的绝对路径为相对路径
      // \$HOME/.claude/ → .claude/
      // \\\$HOME/.claude/ → .claude/ (JSON 转义形式)
      content = content.replace(/\\\\\\\$HOME\\/\\.claude\\//g, '.claude/');
      content = content.replace(/\\\$HOME\\/\\.claude\\//g, '.claude/');
      // 验证结果仍是合法 JSON
      JSON.parse(content);
      fs.writeFileSync(p, content);
    } catch(e) {
      process.stderr.write('路径改写跳过: ' + e.message + '\\n');
    }
  "
}

# ─── 权限设置 ─────────────────────────────────────

set_permissions() {
  if $DRY_RUN; then
    log_info "[dry-run] 设置文件权限"
    return
  fi

  chmod +x "${CLAUDE_DIR}/hooks/"*.js 2>/dev/null || true
  chmod +x "${CLAUDE_DIR}/wf/bin/wf-tools.cjs" 2>/dev/null || true
}

# ─── 安装验证 ─────────────────────────────────────

VALIDATE_ERRORS=0

validate_install() {
  log_info "验证安装..."
  local errors=0

  local critical_files=(
    "${CLAUDE_DIR}/wf/bin/wf-tools.cjs"
    "${CLAUDE_DIR}/wf/bin/lib/utils.cjs"
    "${CLAUDE_DIR}/wf/bin/lib/merge-settings.cjs"
    "${CLAUDE_DIR}/hooks/wf-context-monitor.js"
    "${CLAUDE_DIR}/hooks/wf-statusline.js"
    "${CLAUDE_DIR}/hooks/wf-prompt-guard.js"
    "${CLAUDE_DIR}/hooks/wf-session-state.js"
    "${CLAUDE_DIR}/skills/wf-do/SKILL.md"
    "${CLAUDE_DIR}/agents/wf-executor.md"
    "${CLAUDE_DIR}/agents/wf-planner.md"
    "${CLAUDE_DIR}/wf/workflows/execute-phase.md"
    "${CLAUDE_DIR}/wf/workflows/new-project.md"
    "${CLAUDE_DIR}/wf/templates/config.json"
    "${CLAUDE_DIR}/wf/VERSION"
    "${CLAUDE_DIR}/settings.json"
    "${CLAUDE_DIR}/skills/wf-troubleshooting/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-anti-patterns/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-4-level-verification/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-progress/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-quick/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-new-project/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-execute-phase/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-autonomous/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-git-conventions/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-gates/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-worktree-lifecycle/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-code-review/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-apply-change/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-archive-change/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-validate-spec/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-new-milestone/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-discuss-phase/SKILL.md"
    "${CLAUDE_DIR}/skills/wf-plan-phase/SKILL.md"
  )

  for f in "${critical_files[@]}"; do
    if [[ ! -f "$f" ]]; then
      log_error "缺失: $(echo "$f" | sed "s|${CLAUDE_DIR}/||")"
      errors=$((errors + 1))
    fi
  done

  # 验证 settings.json 是合法 JSON
  if [[ -f "${CLAUDE_DIR}/settings.json" ]]; then
    if ! node -e "JSON.parse(require('fs').readFileSync('${CLAUDE_DIR}/settings.json','utf8'))" 2>/dev/null; then
      log_error "settings.json 不是合法 JSON"
      errors=$((errors + 1))
    fi
  fi

  # 验证无测试文件被安装
  local test_files
  test_files=$(find "${CLAUDE_DIR}/wf" "${CLAUDE_DIR}/hooks" -name "*.test.*" 2>/dev/null | head -5)
  if [[ -n "$test_files" ]]; then
    log_warn "发现测试文件被安装 (应排除):"
    echo "$test_files" | while read -r tf; do
      log_dim "  $(echo "$tf" | sed "s|${CLAUDE_DIR}/||")"
    done
    errors=$((errors + 1))
  fi

  # 烟雾测试: wf-tools.cjs 可运行
  if ! node "${CLAUDE_DIR}/wf/bin/wf-tools.cjs" 2>/dev/null; then
    : # wf-tools 无参数可能返回非零, 这是预期行为
  fi

  VALIDATE_ERRORS=$errors
}

# ─── 主流程 ───────────────────────────────────────

main() {
  # 标题
  echo ""
  echo -e "${BOLD}  WF Workflow System Installer${NC}"
  echo -e "  ─────────────────────────────"
  echo ""

  # 前置条件
  check_prerequisites

  # 卸载模式
  if $UNINSTALL; then
    do_uninstall
    exit 0
  fi

  # 版本信息
  local source_version
  source_version=$(cat "${WF_SOURCE}/VERSION" 2>/dev/null | tr -d '[:space:]')
  source_version=${source_version:-"unknown"}

  local version_status
  version_status=$(compare_versions "$source_version")

  local target_version="(无)"
  if [[ -f "${CLAUDE_DIR}/wf/VERSION" ]]; then
    target_version=$(cat "${CLAUDE_DIR}/wf/VERSION" 2>/dev/null | tr -d '[:space:]')
  fi

  # 项目级别检查: 确认当前目录是合理的项目根目录
  if [[ "$INSTALL_SCOPE" == "project" ]]; then
    if [[ ! -d ".git" && ! -f "package.json" && ! -f "CLAUDE.md" ]]; then
      log_warn "当前目录不像项目根目录 (无 .git, package.json 或 CLAUDE.md)"
      if ! $FORCE; then
        log_info "使用 --force 跳过此检查, 或 cd 到项目根目录"
        exit 1
      fi
      log_warn "继续安装 (--force)"
    fi
  fi

  # 显示信息
  log_info "安装范围: ${SCOPE_LABEL}"
  log_info "源目录:   ${WF_SOURCE}"
  log_info "安装到:   ${CLAUDE_DIR}"
  echo ""

  case "$version_status" in
    fresh)
      log_info "全新安装 → v${source_version}"
      ;;
    newer)
      log_info "升级: v${target_version} → v${source_version}"
      ;;
    same)
      if $FORCE; then
        log_info "重新安装: v${source_version} (--force)"
      else
        log_ok "已是最新版本: v${source_version}"
        log_info "使用 --force 强制重新安装"
        exit 0
      fi
      ;;
    older)
      if $FORCE; then
        log_warn "降级: v${target_version} → v${source_version} (--force)"
      else
        log_warn "源版本 (v${source_version}) 低于已安装版本 (v${target_version})"
        log_info "使用 --force 强制降级"
        exit 0
      fi
      ;;
  esac

  echo ""

  # dry-run 提示
  if $DRY_RUN; then
    log_warn "=== DRY RUN 模式 (不会实际修改文件) ==="
    echo ""
  fi

  # 升级时创建备份
  if [[ "$version_status" == "newer" || "$version_status" == "older" ]]; then
    create_backup
    echo ""
  fi

  # 复制文件
  copy_files
  echo ""

  # 合并 settings
  log_info "配置 settings.json..."
  merge_settings
  echo ""

  # 设置权限
  set_permissions

  # 验证
  if ! $DRY_RUN; then
    validate_install
    echo ""

    if [[ "$VALIDATE_ERRORS" -eq 0 ]]; then
      echo -e "${GREEN}${BOLD}  安装完成!${NC}"
      echo ""
      log_info "版本:  v${source_version}"
      log_info "范围:  ${SCOPE_LABEL}"
      log_info "文件:  ${TOTAL_FILES} 个"
      log_info "位置:  ${CLAUDE_DIR}"
      echo ""
      log_info "下一步:"
      if [[ "$INSTALL_SCOPE" == "project" ]]; then
        log_info "  在此项目中启动 Claude Code，运行 ${BOLD}/wf-new-project${NC}"
      else
        log_info "  启动 Claude Code，运行 ${BOLD}/wf-new-project${NC}"
      fi
    else
      echo -e "${RED}${BOLD}  安装完成但有 ${VALIDATE_ERRORS} 个问题${NC}"
      echo ""
      log_warn "请检查上方日志并修复问题"
      exit 1
    fi
  else
    echo -e "${YELLOW}${BOLD}  DRY RUN 完成${NC}"
    echo ""
    log_info "文件数:  ${TOTAL_FILES} 个"
    log_info "运行不带 --dry-run 来实际安装"
  fi

  echo ""
}

main
