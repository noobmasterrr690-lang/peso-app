@echo off
setlocal
cd /d "%~dp0"
title PESO - Development Server
where node >nul 2>nul || (echo Node.js is required.&pause&exit /b 1)
call npm install --no-audit --no-fund
if errorlevel 1 (pause&exit /b 1)
call npm run db:generate
if errorlevel 1 (pause&exit /b 1)
call npm run db:push
if errorlevel 1 (pause&exit /b 1)
call npm run dev
pause
