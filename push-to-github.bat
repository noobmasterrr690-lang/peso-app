@echo off
title Push PESO to GitHub
echo ========================================================
echo   PESO - Push to GitHub
echo ========================================================
echo.
echo Make sure you have created an empty repository on GitHub first!
echo (https://github.com/new)
echo.
set /p REPO_URL="Paste your GitHub repository URL: "
if "%REPO_URL%"=="" (
  echo Error: No URL entered.
  pause
  exit /b 1
)

git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
echo.
echo Pushing to GitHub...
git push -u origin main

if %errorlevel% equ 0 (
  echo.
  echo [SUCCESS] Your code is now live on GitHub!
  echo Next step: Connect this repository to Render (https://render.com)
) else (
  echo.
  echo [ERROR] Push failed. Check your GitHub URL and try again.
)
echo.
pause
