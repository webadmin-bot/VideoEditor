@echo off
setlocal enabledelayedexpansion
title AI Video Studio - Windows Installation Script
color 0A

echo =====================================================================
echo               AI VIDEO STUDIO - ONE-CLICK INSTALLATION
echo =====================================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python 3 is not installed or not in your PATH.
    echo Please install Python 3.10+ from python.org and check "Add Python to PATH".
    pause
    exit /b 1
)

:: 2. Check Node
node -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js LTS from nodejs.org.
    pause
    exit /b 1
)

:: 3. Create Virtualenv if needed
echo Setting up Python virtual environment...
if not exist "venv" (
    python -m venv venv
)
call venv\Scripts\activate.bat

:: 4. Install Python Dependencies
echo.
echo Installing Python packages from requirements.txt...
pip install --upgrade pip
pip install -r requirements.txt

echo.
echo Installing PyTorch 2.6+ with CUDA 12.8 (Blackwell RTX 5060 Optimized)...
pip install --upgrade torch torchvision --index-url https://download.pytorch.org/whl/cu128

:: 5. Install Node Dependencies
echo.
echo Installing Node.js frontend dependencies...
call npm install

:: 6. Check FFmpeg
echo.
ffmpeg -version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ATTENTION] FFmpeg is not found in your System PATH.
    echo To render finished MP4 videos and burn kinetic subtitles, FFmpeg is required.
    echo Quick setup:
    echo 1. Download: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
    echo 2. Extract to C:\ffmpeg
    echo 3. Add C:\ffmpeg\bin to your Windows Environment PATH.
) else (
    echo FFmpeg is verified and ready!
)

echo.
echo =====================================================================
echo  INSTALLATION COMPLETE!
echo  Run START_AI_VIDEO_STUDIO.bat to launch the application.
echo =====================================================================
echo.
pause
