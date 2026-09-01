@echo off
setlocal EnableExtensions

REM ============================================================
REM Clinical AI Workbench - Windows one-click local startup
REM Usage: double-click, or run from repo root:  scripts\start.bat
REM Prereq: Docker Desktop (any Docker engine), Node.js 18+, pnpm
REM         Python 3.11+ or uv (uv.exe / uv in PATH)
REM Steps : create .env -> pull missing Docker images (auto retry)
REM       -> start Docker infra -> install deps -> create venv
REM       -> open Web / BFF / Inference windows
REM NOTE : ASCII only, and NO parentheses/ellipsis inside block echoes
REM         (cmd treats them as structure tokens inside parens blocks)
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

REM ---------- 4. pull missing images (auto retry, resume-able) ----------
REM Keep in sync with infra\compose\compose.dev.yml
set "REQUIRED_IMAGES=mysql:8.0 redis:7 quay.io/coreos/etcd:v3.5.5 minio/minio:RELEASE.2024-01-11T07-46-16Z milvusdb/milvus:v2.4.0 mailhog/mailhog:v1.0.1"
for %%I in (%REQUIRED_IMAGES%) do call :ensure_image %%I
if errorlevel 1 (
  echo [ERR] One or more Docker images could not be pulled. Check network/VPN/registry mirror, then rerun.
  pause
  exit /b 1
)

REM ---------- 5. start docker infra ----------
echo [..] Starting Docker infra (mysql/redis/etcd/minio/milvus/mailhog)...
REM docker compose v2 supports --env-file; docker-compose v1 reads .env from the working dir
if "%DC%"=="docker compose" (
  %DC% --env-file "%CD%\.env" -f infra\compose\compose.dev.yml up -d
) else (
  %DC% -f infra\compose\compose.dev.yml up -d
)
if errorlevel 1 (
  echo [ERR] Docker infra failed to start. See log above.
  pause
  exit /b 1
)
echo [OK] Docker infra started.

REM ---------- 6. install pnpm deps ----------
if not exist "node_modules" (
  echo [..] Installing pnpm dependencies...
  call pnpm install
  if errorlevel 1 (
    echo [ERR] pnpm install failed.
    pause
    exit /b 1
  )
)

REM ---------- 7. build workspace packages (@repo/*) ----------
REM If any packages/* lacks dist output, build them (API/Web need these to start)
set "NEED_BUILD=0"
for /D %%D in (packages\*) do if not exist "%%D\dist\index.js" set "NEED_BUILD=1"
if "%NEED_BUILD%"=="1" (
  echo [..] Building workspace packages @repo/*
  call pnpm exec turbo run build --filter="./packages/*"
  if errorlevel 1 (
    echo [ERR] Workspace packages build failed.
    pause
    exit /b 1
  )
)

REM ---------- 8. prepare python env (prefer uv, fallback to python) ----------
if not exist "apps\inference\.venv\Scripts\python.exe" (
  echo [..] Creating inference venv and installing python deps...
  if exist "uv.exe" (
    echo [..] Using bundled uv.exe to create venv Python 3.11
    "uv.exe" venv --python 3.11 "apps\inference\.venv"
    if errorlevel 1 (
      echo [ERR] Failed to create venv with uv.exe.
      pause
      exit /b 1
    )
    "uv.exe" pip install --python "apps\inference\.venv\Scripts\python.exe" -r "apps\inference\requirements.txt"
    if errorlevel 1 (
      echo [ERR] Python dependencies install failed with uv.
      pause
      exit /b 1
    )
  ) else (
    python -m venv apps\inference\.venv
    if errorlevel 1 (
      echo [ERR] Failed to create Python venv. Install Python 3.11+ or put uv.exe in repo root.
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
)

REM ---------- 8b. free dev ports 3000/3001/8000 before launching ----------
REM Kill leftover service processes from previous runs to avoid EADDRINUSE,
REM then taskkill whatever still holds our ports as a safety net.
echo [..] Freeing stale dev processes on ports 3000/3001/8000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'node|python|cmd' -and $_.CommandLine -match 'dev:web|dev:api|start:dev|start-server\.js|nest\.js|uvicorn|next dev|apps.api.dist.src.main' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /c:":3000 " /c:":3001 " /c:":8000 " ^| findstr /c:"LISTENING"') do taskkill /F /PID %%P >nul 2>&1
timeout /t 2 /nobreak >nul

REM ---------- 9. open service windows ----------
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
exit /b 0

REM ============================================================
REM subroutine: pull a single image with retry if missing
REM ============================================================
:ensure_image
docker image inspect "%~1" >nul 2>&1
if not errorlevel 1 (
  echo [OK] Image "%~1" already present.
  exit /b 0
)
echo [..] Pulling image: %~1
for /L %%N in (1,1,10) do (
  echo     attempt %%N/10
  docker pull "%~1"
  if not errorlevel 1 (
    echo [OK] Image "%~1" pulled.
    exit /b 0
  )
  timeout /t 3 /nobreak >nul
)
echo [ERR] Failed to pull image: %~1
exit /b 1
