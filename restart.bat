@echo off
setlocal
chcp 65001 >nul
title car_relay restart

cd /d "%~dp0"

echo ========================================
echo car_relay restart
echo Project: %cd%
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found. Please reinstall Node.js.
    pause
    exit /b 1
)

if not exist ".env.local" (
    if exist ".env.example" (
        echo [INFO] .env.local not found.
        echo [INFO] Copying .env.example to .env.local ...
        copy /Y ".env.example" ".env.local" >nul
        echo [WARN] Please edit .env.local and set GEMINI_API_KEY if your app needs Gemini API.
        echo.
    )
)

if not exist "node_modules" (
    echo [INFO] node_modules not found, installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo.
)

set APP_PORT=3100

echo [INFO] Stopping any process using port %APP_PORT%...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%APP_PORT%" ^| findstr "LISTENING"') do (
    taskkill /PID %%p /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo [INFO] Starting development server...
echo [INFO] URL: http://localhost:%APP_PORT%
echo.
call npm run dev

set EXIT_CODE=%ERRORLEVEL%
echo.
if not "%EXIT_CODE%"=="0" (
    echo [ERROR] Server exited with code %EXIT_CODE%.
) else (
    echo [INFO] Server exited normally.
)
pause
exit /b %EXIT_CODE%
