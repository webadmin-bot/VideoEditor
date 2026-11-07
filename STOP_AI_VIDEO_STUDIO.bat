@echo off
echo ========================================================
echo       STOPPING AI VIDEO STUDIO SERVICES
echo ========================================================
echo.

echo Terminating AI Video Studio Backend processes...
taskkill /F /FI "WINDOWTITLE eq AI Video Studio Backend*" /T 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul

echo Terminating AI Video Studio Frontend processes...
taskkill /F /FI "WINDOWTITLE eq AI Video Studio Frontend*" /T 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /F /PID %%a 2>nul

echo.
echo All AI Video Studio services safely stopped.
echo.
pause
