@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0"

echo ==========================================
echo   佛教经典电子书合集
echo ==========================================

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo [Error] Node.js is not installed.
    echo Please install Node.js ^(v14+^) from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Display Node version
for /f "tokens=*" %%v in ('node -v') do echo [OK] Node.js %%v detected

:: Install dependencies if needed
if not exist "Src\node_modules" (
    echo [...] Installing dependencies...
    pushd Src
    call npm install --silent
    if %ERRORLEVEL% neq 0 (
        echo [Error] Failed to install dependencies.
        popd
        pause
        exit /b 1
    )
    popd
    echo [OK] Dependencies installed
) else (
    echo [OK] Dependencies already installed
)

echo.
echo Starting server... Close this window or press Ctrl+C to stop.
echo.

node Src\server.js --open
pause
