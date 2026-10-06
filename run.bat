@echo off
setlocal enabledelayedexpansion
title PESO App - Dev Server

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    if exist "%LOCALAPPDATA%\Programs\nodejs\node-v24.19.0-win-x64\node.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\nodejs\node-v24.19.0-win-x64;%PATH%"
    )
)

echo ========================================================
echo   Starting PESO App (Personal Expense and Spending Organizer)
echo   Client:  http://127.0.0.1:5173
echo   Server:  http://127.0.0.1:3001
echo ========================================================
echo.

call npm run dev
if errorlevel 1 (
    echo.
    echo Dev server exited with an error.
    pause
)
