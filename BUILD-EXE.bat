@echo off
title Car Deals Manager - build Windows installer
cd /d "%~dp0"
call npm install
if errorlevel 1 ( echo npm install failed & pause & exit /b 1 )
call npm run dist
echo.
echo Done. Your installer is in the "release" folder.
pause
