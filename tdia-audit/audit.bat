@echo off
setlocal

if "%~1"=="" (
    echo Usage: audit.bat ^<onboarding.json^>
    exit /b 1
)

set "PYTHONIOENCODING=utf-8"
set "PATH=C:\Program Files\GTK3-Runtime Win64\bin;%PATH%"

if not exist ".venv\Scripts\python.exe" (
    echo [setup] Creating venv...
    python -m venv .venv || exit /b 1
    echo [setup] Installing requirements...
    ".venv\Scripts\python.exe" -m pip install -q -r requirements.txt || exit /b 1
    ".venv\Scripts\python.exe" -m playwright install chromium || exit /b 1
)

".venv\Scripts\python.exe" scripts\run_local.py %1
