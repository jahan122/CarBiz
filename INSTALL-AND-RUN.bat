@echo off
title Car Deals Manager - install and run
cd /d "%~dp0"
echo ==== Installing (first time takes a few minutes) ====
call npm install
if errorlevel 1 (
  echo.
  echo npm install failed. Copy the text above and send it for help.
  pause
  exit /b 1
)
echo ==== Starting Car Deals Manager ====
call npm start
pause
