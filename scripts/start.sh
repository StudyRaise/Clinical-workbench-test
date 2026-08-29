#!/usr/bin/env bash
# ============================================================
# 临床 AI 工作台 - 一键启动脚本（本地开发 / 线上部署通用）
#
# 用法：
#   ./scripts/start.sh dev              本地开发：Docker 基础设施 + 本地进程（推荐）
#   ./scripts/start.sh prod             线上部署：全量 Docker Compose 构建并后台启动
#   ./scripts/start.sh stop [dev|prod]  停止对应模式服务
#   ./scripts/start.sh status           查看容器运行状态
#   ./scripts/start.sh logs [service]   跟踪日志（service: web/api/inference/mysql/...）
#   ./scripts/start.sh help             显示帮助
#
# 兼容 Linux / macOS / 线上服务器（需安装 Docker + Docker Compose v2）。
# 首次运行会自动从 .env.example 生成 .env，请修改其中的密钥与 API Key。
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_DEV="infra/compose/compose.dev.yml"
COMPOSE_PROD="infra/compose/compose.prod.yml"

C_GREEN='\033[32m'; C_YELLOW='\033[33m'; C_RED='\033[31m'; C_CYAN='\033[36m'; C_NC='\033[0m'
ok()   { printf "${C_GREEN}[OK]${C_NC} %s\n" "$*"; }
warn() { printf "${C_YELLOW}[WARN]${C_NC} %s\n" "$*"; }
err()  { printf "${C_RED}[ERR]${C_NC} %s\n" "$*" >&2; }
info() { printf "${C_CYAN}[..]${C_NC} %s\n" "$*"; }

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

# ---------- 工具检测 ----------
detect_compose() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    err "未检测到 Docker Compose，请先安装 Docker + Compose v2。"
    exit 1
  fi
}

ensure_env() {
  if [ ! -f .env ]; then
    cp .env.example .env
    warn "已从 .env.example 生成 .env，请打开修改：密钥(JWT_SECRET/FIELD_ENCRYPTION_KEY)、LLM API Key、线上域名等。"
  fi
}

# ---------- 本地开发模式 ----------
dev_up() {
  ensure_env

  if ! command -v docker >/dev/null 2>&1; then
    err "未安装 Docker，本地开发需先启动 MySQL/Milvus/MinIO/Redis 等基础设施。"
    exit 1
  fi
  local compose; compose="$(detect_compose)"
  info "启动 Docker 基础设施（MySQL/Redis/etcd/MinIO/Milvus/MailHog）..."
  $compose -f "$COMPOSE_DEV" up -d
  ok "基础设施已启动"

  # 前端 / BFF 依赖
  if [ ! -d node_modules ]; then
    info "安装 pnpm 依赖..."
    pnpm install
  fi

  # Python 推理服务环境
  if [ ! -d apps/inference/.venv ]; then
    info "创建 inference 虚拟环境并安装依赖..."
    python3 -m venv apps/inference/.venv
    apps/inference/.venv/bin/pip install -q -r apps/inference/requirements.txt
  fi

  # 读取环境变量（供本地进程使用）
  set -a; . ./.env; set +a

  info "启动本地服务（Ctrl+C 全部退出）..."
  trap 'echo; warn "正在停止本地服务..."; kill $(jobs -p) 2>/dev/null || true' EXIT INT TERM

  pnpm dev:web &
  pnpm dev:api &
  (cd apps/inference && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &

  sleep 1
  echo
  ok "本地服务已启动："
  info "  前端   http://localhost:3000"
  info "  BFF    http://localhost:3001/api        (Swagger: http://localhost:3001/api/docs)"
  info "  推理   http://localhost:8000            (Health: http://localhost:8000/health)"
  echo
  wait
}

# ---------- 线上部署模式 ----------
prod_up() {
  ensure_env

  if ! command -v docker >/dev/null 2>&1; then
    err "线上部署依赖 Docker，请先安装。"
    exit 1
  fi
  local compose; compose="$(detect_compose)"

  # 关键配置校验（占位值提醒）
  set -a; . ./.env; set +a
  if [[ "${JWT_SECRET:-}" == "change_me"* || -z "${JWT_SECRET:-}" ]]; then
    warn "JWT_SECRET 仍为占位值，生产环境请改为强随机字符串（如 openssl rand -hex 32）。"
  fi
  if [[ "${FIELD_ENCRYPTION_KEY:-}" == "change_me"* || -z "${FIELD_ENCRYPTION_KEY:-}" ]]; then
    warn "FIELD_ENCRYPTION_KEY 仍为占位值，生产环境请改为 32 字节密钥。"
  fi

  info "构建并启动全量服务（web/api/inference/celery + 基础设施）..."
  $compose -f "$COMPOSE_PROD" up -d --build
  ok "线上服务已后台启动。"
  $compose -f "$COMPOSE_PROD" ps
  echo
  info "访问：web http://服务器IP:3000 ，API http://服务器IP:3001/api"
}

# ---------- 停止 ----------
stop_all() {
  local target="${1:-dev}"
  local compose; compose="$(detect_compose)"
  case "$target" in
    dev)
      info "停止本地服务（后台进程由关闭终端自动结束；此处停止 Docker 基础设施）..."
      $compose -f "$COMPOSE_DEV" down || true
      ok "已停止 dev 基础设施容器。"
      ;;
    prod)
      info "停止线上服务..."
      $compose -f "$COMPOSE_PROD" down
      ok "已停止 prod 服务。"
      ;;
    *)
      err "未知模式：$target（dev|prod）"
      exit 1
      ;;
  esac
}

# ---------- 状态 / 日志 ----------
status_all() {
  local compose; compose="$(detect_compose)"
  info "dev 基础设施："
  $compose -f "$COMPOSE_DEV" ps || true
  echo
  info "prod 服务："
  $compose -f "$COMPOSE_PROD" ps || true
}

logs_all() {
  local compose; compose="$(detect_compose)"
  local service="${1:-}"
  $compose -f "$COMPOSE_PROD" logs -f --tail=200 "$service"
}

# ---------- 入口 ----------
ACTION="${1:-help}"
shift || true

case "$ACTION" in
  dev)   dev_up ;;
  prod)  prod_up ;;
  stop)  stop_all "${1:-dev}" ;;
  status) status_all ;;
  logs)  logs_all "${1:-}" ;;
  help|-h|--help) usage ;;
  *)     err "未知命令：$ACTION" ; usage ;;
esac
