#!/usr/bin/env bash
# WF 一键升级脚本 — 无需 git clone
#
# 用法:
#   curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/wf/bin/upgrade.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/wf/bin/upgrade.sh | bash -s -- --project
#   curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/wf/bin/upgrade.sh | WF_REF=main bash
#
# 选项 (转发给 install.sh):
#   --user        升级用户级别 ~/.claude/  (默认)
#   --project     升级当前目录的 .claude/
#   --dry-run     仅预览，不实际写入
#   --uninstall   卸载 (升级语义下不常用)
#   --no-force    跳过 --force (默认会注入 --force 以应对未 bump VERSION 的修复发布)
#
# 环境变量:
#   WF_REPO    仓库 (默认 159song/claude-code-config)
#   WF_REF     分支或 tag (默认 main)
#   WF_TMPDIR  临时目录 (默认系统 mktemp)

set -euo pipefail

# ─── 颜色 ────────────────────────────────────────────

if [[ -t 1 ]]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'
  CYAN=$'\033[0;36m'; DIM=$'\033[2m'; NC=$'\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; DIM=''; NC=''
fi
log_info()  { echo "${CYAN}[WF-UPGRADE]${NC} $1"; }
log_ok()    { echo "${GREEN}[WF-UPGRADE]${NC} $1"; }
log_warn()  { echo "${YELLOW}[WF-UPGRADE]${NC} $1"; }
log_error() { echo "${RED}[WF-UPGRADE]${NC} $1" >&2; }
log_dim()   { echo "${DIM}     $1${NC}"; }

# ─── 配置 ────────────────────────────────────────────

WF_REPO="${WF_REPO:-159song/claude-code-config}"
WF_REF="${WF_REF:-main}"
WF_TMPDIR="${WF_TMPDIR:-}"

# 默认追加 --force（修复发布常常不 bump VERSION，install.sh 会判定 same 跳过）
INJECT_FORCE=true
INSTALL_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-force)
      INJECT_FORCE=false; shift ;;
    --help|-h)
      sed -n '2,21p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)
      INSTALL_ARGS+=("$1"); shift ;;
  esac
done

if $INJECT_FORCE; then
  INSTALL_ARGS+=("--force")
fi

# ─── 前置检查 ────────────────────────────────────────

need_cmd() {
  if ! command -v "$1" &>/dev/null; then
    log_error "缺少依赖: $1"
    exit 1
  fi
}
need_cmd curl
need_cmd tar
need_cmd node
need_cmd bash

# ─── 准备 ────────────────────────────────────────────

if [[ -z "$WF_TMPDIR" ]]; then
  WF_TMPDIR="$(mktemp -d -t wf-upgrade-XXXXXXXX)"
fi
trap 'rm -rf "$WF_TMPDIR"' EXIT INT TERM

TARBALL_URL="https://codeload.github.com/${WF_REPO}/tar.gz/refs/heads/${WF_REF}"

log_info "升级源: ${WF_REPO}@${WF_REF}"
log_info "临时目录: ${WF_TMPDIR}"
log_info "install.sh 参数: ${INSTALL_ARGS[*]:-(无)}"

# ─── 下载 + 解压 ─────────────────────────────────────

log_info "下载 tarball..."
if ! curl -fsSL "$TARBALL_URL" -o "${WF_TMPDIR}/wf.tar.gz"; then
  log_error "下载失败: $TARBALL_URL"
  log_warn "若分支名不是 main，请用: WF_REF=<branch_or_tag> 重试"
  exit 1
fi

log_info "解压..."
tar -xzf "${WF_TMPDIR}/wf.tar.gz" -C "$WF_TMPDIR"

# 解压后目录形如 claude-code-config-main/，定位它
SRC_DIR="$(find "$WF_TMPDIR" -maxdepth 1 -mindepth 1 -type d ! -name '.*' | head -n1)"
if [[ -z "$SRC_DIR" || ! -f "${SRC_DIR}/wf/bin/install.sh" ]]; then
  log_error "tarball 结构异常，未找到 wf/bin/install.sh"
  exit 1
fi

# 读出新版本号方便提示
SRC_VERSION="$(cat "${SRC_DIR}/VERSION" 2>/dev/null | tr -d '[:space:]' || echo unknown)"
log_ok "已下载 v${SRC_VERSION}"

# ─── 调用 install.sh ─────────────────────────────────

chmod +x "${SRC_DIR}/wf/bin/install.sh"

log_info "运行 install.sh..."
echo
( cd "$SRC_DIR" && bash "wf/bin/install.sh" "${INSTALL_ARGS[@]}" )
echo

log_ok "升级完成 (v${SRC_VERSION})"
log_dim "如需校验:  node \"\$HOME/.claude/wf/bin/wf-tools.cjs\" --help"
log_dim "项目级安装请到对应项目目录再次运行: curl ... | bash -s -- --project"
