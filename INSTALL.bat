@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo       AI VIDEO STUDIO — ONE-CLICK INSTALLER (WINDOWS)
echo ========================================================
echo.

:: Check Python
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not found in system PATH.
    echo Please install Python 3.10 or 3.11 from https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

:: Check Node.js
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in system PATH.
    echo Please install Node.js 20+ from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] Creating Python Virtual Environment (venv)...
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate.bat

echo [2/4] Upgrading pip and installing PyTorch with CUDA 12.8 (RTX 5060 Blackwell Support)...
python -m pip install --upgrade pip
echo Installing PyTorch with CUDA 12.8 for NVIDIA GeForce RTX 5060 (sm_120 / Blackwell)...
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
if %ERRORLEVEL% neq 0 (
    echo.
    echo [NOTICE] CUDA 12.8 wheel repository not reachable, attempting CUDA 12.6 wheel fallback...
    python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
)

echo Verifying PyTorch CUDA installation...
python -c "import torch; print(f'[INFO] PyTorch version: {torch.__version__} | CUDA Available: {torch.cuda.is_available()} | Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"None (CPU)\"}')"

echo [3/4] Installing Python Backend dependencies (preserving CUDA 12.8)...
python -m pip install -r requirements.txt

echo.
echo Verifying installation, CUDA tensor execution, and hardware encoders...
python backend/verify_installation.py

echo.
echo [4/4] Installing Node.js Frontend dependencies...
call npm install

echo.
echo ========================================================
echo       INSTALLATION AND VERIFICATION COMPLETED
echo ========================================================
echo Run START_AI_VIDEO_STUDIO.bat to launch the application.
echo.
pause

