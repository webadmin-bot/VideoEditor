@echo off
setlocal enabledelayedexpansion
title AI Video Studio - Windows Launcher
color 0B

echo =====================================================================
echo                 AI VIDEO STUDIO - LOCAL WINDOWS LAUNCHER
echo =====================================================================
echo.

:: 1. Check Python
echo [1/6] Checking Python installation...
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python 3.10+ is NOT found in PATH.
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)
python --version

:: 2. Check Node.js
echo.
echo [2/6] Checking Node.js installation...
node -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is NOT found in PATH.
    echo Please install Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)
node -v

:: 3. Check FFmpeg and FFprobe
echo.
echo [3/6] Checking FFmpeg and FFprobe...
ffmpeg -version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [WARNING] FFmpeg not found on PATH.
    echo FFmpeg is required for video encoding, audio extraction, and subtitle burning.
    echo Download from https://www.gyan.dev/ffmpeg/builds/ and add the /bin folder to your Windows System PATH.
) else (
    echo FFmpeg is detected and ready.
)

:: 4. Check Python Virtualenv and Dependencies
echo.
echo [4/6] Verifying Python backend packages...
if exist "venv\Scripts\activate.bat" (
    echo Activating Python virtual environment...
    call venv\Scripts\activate.bat
)

python -c "import fastapi, uvicorn, pydantic" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Python requirements not fully installed. Running quick installer...
    pip install -r requirements.txt
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to install Python dependencies. Please run INSTALL.bat manually.
        pause
        exit /b 1
    )
)
echo Python backend packages verified.

:: 5. Check NVIDIA GPU and CUDA (Optimized for NVIDIA GeForce RTX 5060)
echo.
echo [5/6] Detecting NVIDIA GeForce RTX 5060 and CUDA acceleration...
nvidia-smi >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo Detected NVIDIA Hardware:
    nvidia-smi --query-gpu=name,memory.total,memory.free,driver_version --format=csv,noheader
    echo.
    echo Testing Blackwell CUDA kernel initialization in PyTorch...
    python -c "import torch; print(f'PyTorch CUDA Active: {torch.cuda.is_available()}, Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"None\"}')" >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo [OK] PyTorch CUDA kernel initialized successfully on RTX 5060.
    ) else (
        echo [NOTICE] GPU detected. If PyTorch complains about Blackwell architecture, run:
        echo pip install --upgrade torch torchvision --index-url https://download.pytorch.org/whl/cu128
    )
) else (
    echo [INFO] No dedicated NVIDIA GPU found or nvidia-smi not in PATH. Studio will run with high-performance CPU mode.
)

:: 6. Launch Backend & Frontend
echo.
echo [6/6] Starting AI Video Studio local servers...
echo.
echo Starting FastAPI Python Backend (http://127.0.0.1:8000)...
start "AI Video Studio Backend" /min uvicorn backend.main:app --host 127.0.0.1 --port 8000

echo Starting React Studio Frontend (http://localhost:3000)...
start "AI Video Studio Frontend" /min npm run dev

echo.
echo Waiting for services to initialize...
timeout /t 3 /nobreak >nul

:: Automatically open Chrome or Edge
echo Opening AI Video Studio in your default browser...
start http://localhost:3000

echo.
echo =====================================================================
echo  AI VIDEO STUDIO IS RUNNING!
echo  Frontend: http://localhost:3000
echo  Backend:  http://127.0.0.1:8000
echo.
echo  Keep this terminal open while using the application.
echo  To cleanly stop all studio services, run STOP_AI_VIDEO_STUDIO.bat.
echo =====================================================================
echo.
pause
