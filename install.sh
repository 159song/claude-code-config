#!/usr/bin/env bash
# WF Workflow System — 一键安装入口
#
# 支持两种运行方式：
#   1) 本地仓库根执行       ./install.sh [...]
#   2) 通过 curl 远程安装    curl -fsSL https://raw.githubusercontent.com/159song/claude-code-config/main/install.sh | bash
#                           curl -fsSL .../install.sh | bash -s -- --user
#
# 此脚本与 wf/bin/install.sh 的差异：
#   - 默认安装范围：project（原 wf/bin/install.sh 默认 user）—— 与"一键安装"场景匹配
#   - curl 管道模式下自动 git clone 到临时目录，无需用户提前 clone
#   - 其它参数全部透传给 wf/bin/install.sh
#
# 用法:
#   ./install.sh                   # 项目级（默认）
#   ./install.sh --user            # 用户级（$HOME/.claude/）
#   ./install.sh --dry-run         # 预览不写入
#   ./install.sh --uninstall       # 卸载（按当前 scope）
#   ./install.sh --force           # 强制重装
#   ./install.sh --ref <branch>    # 远程安装时指定分支/tag（默认 main）
#   ./install.sh --help

set -euo pipefail

# ─── 配置 ──────────────────────────────────────────

REPO_URL_DEFAULT="https://github.com/159song/claude-code-config.git"
REPO_URL="${WF_REPO_URL:-$REPO_URL_DEFAULT}"
REF_DEFAULT="main"

# ─── 颜色 ──────────────────────────────────────────

if [[ -t 1 ]]; then
  CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
else
  CYAN=''; GREEN=''; YELLOW=''; RED=''; BOLD=''; NC=''
fi

log()    { echo -e "${CYAN}[wf-install]${NC} $*"; }
ok()     { echo -e "${GREEN}[wf-install]${NC} $*"; }
warn()   { echo -e "${YELLOW}[wf-install]${NC} $*"; }
err()    { echo -e "${RED}[wf-install]${NC} $*" >&2; }

# ─── 参数解析 ──────────────────────────────────────

# 默认与 wf/bin/install.sh 相反：此入口面向"一键安装"，默认 project
SCOPE="project"
REF="$REF_DEFAULT"
FORWARD_ARGS=()  # 透传给底层 install.sh 的参数
SHOW_HELP=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)       SCOPE="user"; shift ;;
    --project)    SCOPE="project"; shift ;;
    --ref)        REF="${2:-}"; shift 2 ;;
    --ref=*)      REF="${1#*=}"; shift ;;
    --help|-h)    SHOW_HELP=true; shift ;;
    # 其它已知参数一律透传（--force / --dry-run / --uninstall 等）
    --force|--dry-run|--uninstall)
                  FORWARD_ARGS+=("$1"); shift ;;
    *)
                  FORWARD_ARGS+=("$1"); shift ;;
  esac
done

if $SHOW_HELP; then
  sed -n '2,20p' "$0" | sed 's/^# \?//'
  exit 0
fi

# 兼容 set -u + macOS Bash 3.2：空数组展开 "${arr[@]}" 会触发 unbound variable，
# 用 ${arr[@]+"${arr[@]}"} 惯用法安全展开
FORWARD_ARGS=("--${SCOPE}" ${FORWARD_ARGS[@]+"${FORWARD_ARGS[@]}"})

# ─── 运行模式检测 ──────────────────────────────────
#
# 模式 A：本地仓库根执行 —— 直接转发到 ./wf/bin/install.sh
# 模式 B：curl 管道远程执行 —— 需要先 git clone 到临时目录

SCRIPT_PATH="${BASH_SOURCE[0]:-$0}"
if [[ -f "$SCRIPT_PATH" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
else
  SCRIPT_DIR=""
fi

LOCAL_INSTALLER=""
if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/wf/bin/install.sh" ]]; then
  LOCAL_INSTALLER="$SCRIPT_DIR/wf/bin/install.sh"
fi

# curl | bash 的 $0 通常是 "bash"，定位不到 wf/bin/install.sh —— 进入远程模式
if [[ -z "$LOCAL_INSTALLER" ]]; then
  log "未检测到本地仓库，进入远程安装模式"
  log "仓库: ${REPO_URL}"
  log "分支/tag: ${REF}"

  if ! command -v git &>/dev/null; then
    err "需要 git 才能进行远程安装。请先安装 git 或手动 clone 仓库。"
    exit 1
  fi

  TMP_DIR="$(mktemp -d -t wf-install-XXXXXX)"
  trap 'rm -rf "$TMP_DIR"' EXIT

  log "git clone → ${TMP_DIR}"
  if ! git clone --quiet --depth 1 --branch "$REF" "$REPO_URL" "$TMP_DIR/repo" 2>/dev/null; then
    # --depth 1 与任意 ref 组合在老版本 git 上可能失败，退化到全量 clone
    warn "浅克隆失败，退化为全量 clone"
    rm -rf "$TMP_DIR/repo"
    git clone --quiet "$REPO_URL" "$TMP_DIR/repo"
    ( cd "$TMP_DIR/repo" && git checkout --quiet "$REF" )
  fi
  LOCAL_INSTALLER="$TMP_DIR/repo/wf/bin/install.sh"

  if [[ ! -f "$LOCAL_INSTALLER" ]]; then
    err "远程仓库缺失 wf/bin/install.sh，无法继续"
    exit 1
  fi
fi

# ─── 展示计划 + 转发 ───────────────────────────────

echo ""
echo -e "${BOLD}WF Workflow System — 一键安装${NC}"
echo "────────────────────────────────"
log "安装范围: ${SCOPE}"
if [[ "$SCOPE" == "project" ]]; then
  log "目标: $(pwd)/.claude/"
else
  log "目标: ${HOME}/.claude/"
fi
log "参数: ${FORWARD_ARGS[*]}"
echo ""

exec bash "$LOCAL_INSTALLER" "${FORWARD_ARGS[@]}"
