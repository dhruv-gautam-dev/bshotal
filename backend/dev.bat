@echo off
cd /d "%~dp0"
echo [INFO] Starting Uvicorn backend server...
echo [INFO] Watching directory: 'app' (ignoring .venv and db to avoid OneDrive reload loops)

if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe -m uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
) else if exist .venv\Scripts\uvicorn.exe (
    .venv\Scripts\uvicorn.exe app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
) else (
    python -m uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
)

