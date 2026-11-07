@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo       UPDATING AI VIDEO STUDIO DEPENDENCIES
echo ========================================================
echo.

if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
    echo Updating PyTorch with CUDA 12.8 (RTX 5060 Blackwell support)...
    python -m pip install --upgrade torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
    echo Updating Python packages...
    python -m pip install --upgrade -r requirements.txt
)

echo Updating npm packages...
call npm update

echo.
echo All components updated.
pause
