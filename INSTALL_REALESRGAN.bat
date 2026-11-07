@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   AI VIDEO STUDIO — REAL-ESRGAN NEURAL UPSCALER SETUP
echo ========================================================
echo.

if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found. Please run INSTALL.bat first.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo [1/3] Verifying pinned PyTorch CUDA 12.8 environment...
python -c "import torch; print(f'PyTorch: {torch.__version__} | CUDA: {torch.cuda.is_available()}')"

echo.
echo [2/3] Installing Real-ESRGAN and BasicSR dependencies...
echo (Preserving existing PyTorch installation without downgrading)
python -m pip install basicsr>=1.4.2 realesrgan>=0.3.0 --no-deps
python -m pip install facexlib gfpgan

echo.
echo [3/3] Downloading model weights, verifying SHA-256, and testing inference...
python backend/install_realesrgan.py --auto

echo.
echo ========================================================
echo           REAL-ESRGAN SETUP PROCEDURE COMPLETE
echo ========================================================
echo.
pause
