@echo off
setlocal
title AI Video Studio - Update Script
color 0E

echo =====================================================================
echo                     AI VIDEO STUDIO - UPDATER
echo =====================================================================
echo.

git --version >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo Pulling latest code changes...
    git pull
)

if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

echo Updating Python dependencies...
pip install --upgrade -r requirements.txt

echo Updating Node dependencies...
call npm install

echo.
echo =====================================================================
echo  UPDATE COMPLETE!
echo =====================================================================
pause
