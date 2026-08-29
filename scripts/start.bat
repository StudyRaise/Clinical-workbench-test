@echo off
setlocal EnableExtensions

REM ============================================================
REM Clinical AI Workbench - Windows one-click local startup
REM Usage: double-click, or run from repo root:  scripts\start.bat
REM Prereq: Docker, Node.js 18+, pnpm, Python 3.11+
REM Steps : create .env -> start Docker infra -> install deps
REM       -> open Web / BFF / Inference windows
REM NOTE : ASCII only (safe under any system codepage)
REM ============================================================

set "ROOT=%~dp0.."
cd /d "%ROOT%"

echo.
echo [OK] Work dir: %ROOT%

REM ---------- 1. create .env from template ----------
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo [WARN] .env created from .env.example. Edit secrets/API keys, then rerun.
)

REM ---------- 2. check docker ----------
where docker >nul 2>&1
if errorlevel 1 (
  echo [ERR] Docker not found. Please start Docker Desktop.
  pause
  exit /b 1
)

REM ---------- 3. detect compose command ----------
set "DC="
docker compose version >nul 2>&1 && set "DC=docker compose"
if not defined DC docker-compose version >nul 2>&1 && set "DC=docker-compose"
if not defined DC (
  echo [ERR] Docker Compose not found. Install Docker Desktop or Compose v2.
  pause
  exit /b 1
)
echo [OK] Using compose command: %DC%

REM ---------- 4. start docker infra ----------
echo [..] Starting Docker infra (mysql/redis/etcd/minio/milvus/mailhog)...
%DC% -f infra\compose\compose.dev.yml up -d
if errorlevel 1 (
  echo [ERR] Docker infra failed to start. See log above.
  pause
  exit /b 1
)
echo [OK] Docker infra started.

REM ---------- 5. install pnpm deps ----------
if not exist "node_modules" (
  echo [..] Installing pnpm dependencies...
  call pnpm install
  if errorlevel 1 (
    echo [ERR] pnpm install failed.
    pause
    exit /b 1
  )
)

REM ---------- 6. prepare python env ----------
if not exist "apps\inference\.venv\Scripts\python.exe" (
  echo [..] Creating inference venv and installing python deps...
  python -m venv apps\inference\.venv
  if errorlevel 1 (
    echo [ERR] Failed to create Python venv. Check Python 3.11+.
    pause
    exit /b 1
  )
  apps\inference\.venv\Scripts\python.exe -m pip install -r apps\inference\requirements.txt
  if errorlevel 1 (
    echo [ERR] Python dependencies install failed.
    pause
    exit /b 1
  )
)

REM ---------- 7. open service windows ----------
echo [..] Opening service windows...
start "ClinicalAI-Web" /D "%ROOT%" cmd /k "call pnpm dev:web"
start "ClinicalAI-BFF" /D "%ROOT%" cmd /k "call pnpm dev:api"
start "ClinicalAI-Inference" /D "%ROOT%\apps\inference" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo.
echo [OK] Local services starting:
echo       Web        http://localhost:3000
echo       BFF        http://localhost:3001/api   (Swagger: http://localhost:3001/api/docs)
echo       Inference  http://localhost:8000        (Health:  http://localhost:8000/health)
echo.
echo [..] Close each window to stop that service. Run scripts\stop.bat to stop infra.
pause
endlocal
