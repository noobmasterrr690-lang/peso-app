@echo off
setlocal
where git >nul 2>nul
if %errorlevel% neq 0 (
  set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"
)
title Push PESO to GitHub
echo ========================================================
echo   PESO - Push to GitHub
echo ========================================================
echo.

git remote get-url origin 2>nul >temp_origin.txt
set /p CURRENT_URL=<temp_origin.txt 2>nul
del temp_origin.txt 2>nul

if not "%CURRENT_URL%"=="" (
  echo Repository: %CURRENT_URL%
  echo.
  set /p REPO_URL="Press Enter to push to this repo, or paste a new URL: "
) else (
  set /p REPO_URL="Paste your GitHub repository URL: "
)

if "%REPO_URL%"=="" set "REPO_URL=%CURRENT_URL%"
if "%REPO_URL%"=="" (
  echo Error: No URL provided.
  pause
  exit /b 1
)

git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
echo.
echo Pushing to GitHub...
echo (When the browser opens, sign in as 'noobmasterrr690-lang'!)
echo.
git push -u origin main

if %errorlevel% equ 0 (
  echo.
  echo ========================================================
  echo [SUCCESS] Your code is now live on GitHub!
  echo Next step: Connect this repository to Render (https://render.com)
  echo ========================================================
) else (
  echo.
  echo [ERROR] Push failed.
  echo If you saw permission denied, make sure you signed in as
  echo 'noobmasterrr690-lang' in your browser.
)
echo.
pause
