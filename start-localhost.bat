@echo off
setlocal
cd /d "%~dp0"
title PESO - Localhost

echo ========================================================
echo        PESO - LOCALHOST VERSION
echo ========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js was not found in PATH.
    echo Install Node.js LTS, restart this window, and run again.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm was not found in PATH.
    pause
    exit /b 1
)

echo [1/4] Installing project dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto :error

echo.
echo [2/4] Preparing Prisma client and local database...
call npm run db:generate
if errorlevel 1 goto :error
call npm run db:push
if errorlevel 1 goto :error

echo.
echo [3/4] Building the existing frontend...
call npm run build
if errorlevel 1 goto :error

echo.
echo [4/4] Starting PESO...
echo.
echo LOCAL:   http://localhost:3001
echo NETWORK: Use your PC's IPv4 address with port 3001
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /R /C:"IPv4 Address" /C:"IPv4 Address\. "') do echo          http://%%A:3001
for /f "tokens=*" %%A in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do echo %%A

echo.
echo Keep this window open while using PESO.
echo Press Ctrl+C to stop the server.
echo.
call npm start
if errorlevel 1 goto :error
exit /b 0

:error
echo.
echo ========================================================
echo PESO could not start. The error is shown above.
echo ========================================================
pause
exit /b 1
