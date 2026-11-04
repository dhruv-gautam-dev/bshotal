# B.S. Hotel & Restaurant - Backend Server Launcher (PowerShell)
Set-Location -Path $PSScriptRoot

Write-Host "[INFO] Starting Uvicorn backend server..." -ForegroundColor Green
Write-Host "[INFO] Watching directory: 'app' (ignoring .venv and db to avoid OneDrive reload loops)" -ForegroundColor Gray

if (Test-Path ".\.venv\Scripts\python.exe") {
    & ".\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
} elseif (Test-Path ".\.venv\Scripts\uvicorn.exe") {
    .\.venv\Scripts\uvicorn.exe app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
} else {
    python -m uvicorn app.main:app --reload --reload-dir app --host 0.0.0.0 --port 8000
}


