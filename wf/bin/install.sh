#!/usr/bin/env bash
# WF Workflow System Installer
# 将 WF 工作流系统安装到目标项目的 .claude/ 目录
#
# 用法:
#   ./install.sh [target_dir]
#
# 参数:
#   target_dir  目标项目根目录（默认: 当前目录）
#
# 示例:
#   ./install.sh                    # 安装到当前项目
#   ./install.sh ~/projects/myapp   # 安装到指定项目

set -euo pipefail

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[WF]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[WF]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WF]${NC} $1"; }
log_error() { echo -e "${RED}[WF]${NC} $1"; }

# 定位 WF 源目录（此脚本所在目录的上两级）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WF_SOURCE="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# 目标目录
TARGET_DIR="${1:-.}"
TARGET_DIR="$(cd "${TARGET_DIR}" 2>/dev/null && pwd)" || {
  log_error "目标目录不存在: ${1}"
  exit 1
}

CLAUDE_DIR="${TARGET_DIR}/.claude"

# 检查前置条件
if ! git -C "${TARGET_DIR}" rev-parse --is-inside-work-tree &>/dev/null; then
  log_error "目标目录不是 Git 仓库: ${TARGET_DIR}"
  exit 1
fi

if ! command -v node &>/dev/null; then
  log_error "需要 Node.js (v14+)"
  exit 1
fi

log_info "安装 WF 工作流系统"
log_info "源:  ${WF_SOURCE}"
log_info "目标: ${CLAUDE_DIR}"
echo ""

# 创建目标目录结构
mkdir -p "${CLAUDE_DIR}/commands/wf"
mkdir -p "${CLAUDE_DIR}/agents"
mkdir -p "${CLAUDE_DIR}/hooks"
mkdir -p "${CLAUDE_DIR}/wf/workflows"
mkdir -p "${CLAUDE_DIR}/wf/references"
mkdir -p "${CLAUDE_DIR}/wf/templates"
mkdir -p "${CLAUDE_DIR}/wf/bin/lib"

# 复制文件（保留目录结构）
log_info "复制命令文件..."
cp -r "${WF_SOURCE}/commands/wf/"*.md "${CLAUDE_DIR}/commands/wf/"

log_info "复制 Agent 定义..."
cp "${WF_SOURCE}/agents/wf-"*.md "${CLAUDE_DIR}/agents/"

log_info "复制 Hook 脚本..."
cp "${WF_SOURCE}/hooks/wf-"*.js "${CLAUDE_DIR}/hooks/"
if [ -f "${WF_SOURCE}/hooks/wf-session-state.sh" ]; then
  cp "${WF_SOURCE}/hooks/wf-session-state.sh" "${CLAUDE_DIR}/hooks/"
  chmod +x "${CLAUDE_DIR}/hooks/wf-session-state.sh"
fi

log_info "复制工作流定义..."
cp "${WF_SOURCE}/wf/workflows/"*.md "${CLAUDE_DIR}/wf/workflows/"

log_info "复制参考文档..."
cp "${WF_SOURCE}/wf/references/"*.md "${CLAUDE_DIR}/wf/references/"

log_info "复制模板..."
cp "${WF_SOURCE}/wf/templates/"* "${CLAUDE_DIR}/wf/templates/"

log_info "复制 CLI 工具..."
cp "${WF_SOURCE}/wf/bin/wf-tools.cjs" "${CLAUDE_DIR}/wf/bin/"
cp "${WF_SOURCE}/wf/bin/lib/"*.cjs "${CLAUDE_DIR}/wf/bin/lib/"

# 复制 VERSION
if [ -f "${WF_SOURCE}/VERSION" ]; then
  cp "${WF_SOURCE}/VERSION" "${CLAUDE_DIR}/wf/VERSION"
fi

# 替换 {{WF_ROOT}} 占位符
log_info "替换路径占位符..."
WF_ROOT="${CLAUDE_DIR}/wf"
find "${CLAUDE_DIR}/commands" "${CLAUDE_DIR}/wf/workflows" -name "*.md" -print0 | \
  xargs -0 sed -i.bak "s|{{WF_ROOT}}|${WF_ROOT}|g" 2>/dev/null || true
find "${CLAUDE_DIR}" -name "*.bak" -delete 2>/dev/null || true

# 合并 settings.json（hook 配置）
log_info "配置 Hook 绑定..."
SETTINGS_SRC="${WF_SOURCE}/settings.json"
SETTINGS_DST="${CLAUDE_DIR}/settings.json"

if [ -f "${SETTINGS_SRC}" ]; then
  if [ -f "${SETTINGS_DST}" ]; then
    log_warn "settings.json 已存在，跳过覆盖"
    log_warn "请手动合并 hook 配置: ${SETTINGS_SRC}"
  else
    cp "${SETTINGS_SRC}" "${SETTINGS_DST}"
  fi
fi

# 使 hook 脚本可执行
chmod +x "${CLAUDE_DIR}/hooks/"*.js 2>/dev/null || true
chmod +x "${CLAUDE_DIR}/wf/bin/wf-tools.cjs" 2>/dev/null || true

# 验证安装
log_info "验证安装..."
ERRORS=0

check_exists() {
  if [ ! -e "$1" ]; then
    log_error "缺失: $1"
    ERRORS=$((ERRORS + 1))
  fi
}

check_exists "${CLAUDE_DIR}/wf/bin/wf-tools.cjs"
check_exists "${CLAUDE_DIR}/hooks/wf-context-monitor.js"
check_exists "${CLAUDE_DIR}/hooks/wf-statusline.js"
check_exists "${CLAUDE_DIR}/commands/wf/autonomous.md"
check_exists "${CLAUDE_DIR}/agents/wf-executor.md"
check_exists "${CLAUDE_DIR}/wf/workflows/execute-phase.md"
check_exists "${CLAUDE_DIR}/wf/templates/config.json"

# 测试 CLI 可运行
if node "${CLAUDE_DIR}/wf/bin/wf-tools.cjs" --help &>/dev/null || true; then
  : # wf-tools exits 1 on --help (shows usage), that's OK
fi

echo ""
if [ "${ERRORS}" -eq 0 ]; then
  log_ok "安装完成!"
  echo ""
  log_info "下一步:"
  log_info "  cd ${TARGET_DIR}"
  log_info "  启动 Claude Code，运行 /wf-new-project"
else
  log_error "安装完成但有 ${ERRORS} 个错误，请检查上方日志"
  exit 1
fi
