@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo       AI VIDEO STUDIO — WORKSTATION LAUNCHER
echo ========================================================
echo.

if not exist "venv\Scripts\activate.bat" (
    echo [WARNING] Virtual environment not found. Running INSTALL.bat first...
    call INSTALL.bat
)

call venv\Scripts\activate.bat

echo [1/2] Starting Python FastAPI Backend on http://127.0.0.1:8000...
start "AI Video Studio Backend" cmd /k "venv\Scripts\activate.bat && uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo [2/2] Starting React + Vite Frontend on http://localhost:3000...
start "AI Video Studio Frontend" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo Launching browser to http://localhost:3000...
start http://localhost:3000

echo.
echo AI Video Studio is now running!
echo To stop all services, run STOP_AI_VIDEO_STUDIO.bat
echo.
pause
