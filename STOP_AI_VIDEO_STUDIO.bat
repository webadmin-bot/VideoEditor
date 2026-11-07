@echo off
setlocal
title AI Video Studio - Stop Services
color 0C

echo =====================================================================
echo                STOPPING AI VIDEO STUDIO SERVICES
echo =====================================================================
echo.

echo Terminating Python Uvicorn backend process on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo Terminating Vite Node dev server on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo All studio local background tasks have been stopped.
echo.
pause
