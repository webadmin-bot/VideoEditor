@echo off
echo ========================================================
echo       STOPPING AI VIDEO STUDIO SERVICES
echo ========================================================
echo.

echo Terminating uvicorn Python processes...
taskkill /F /IM uvicorn.exe /T 2>nul
taskkill /F /FI "WINDOWTITLE eq AI Video Studio Backend*" 2>nul

echo Terminating Node.js frontend processes...
taskkill /F /FI "WINDOWTITLE eq AI Video Studio Frontend*" 2>nul

echo All AI Video Studio services stopped.
echo.
pause
