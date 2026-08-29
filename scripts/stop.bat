@echo off
setlocal

REM ============================================================
REM Clinical AI Workbench - Windows stop script
REM Stops the local Docker infra (mysql/redis/etcd/minio/milvus/mailhog).
REM Close the Web / BFF / Inference windows to stop those services.
REM ============================================================

set "DC="
docker compose version >nul 2>&1 && set "DC=docker compose"
if not defined DC docker-compose version >nul 2>&1 && set "DC=docker-compose"
if not defined DC (
  echo [ERR] Docker Compose not found.
  pause
  exit /b 1
)

echo [..] Stopping Docker infra containers (volumes kept)...
%DC% -f infra\compose\compose.dev.yml down
echo [OK] Stopped.

endlocal
