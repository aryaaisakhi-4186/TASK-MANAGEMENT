@echo off
title TASK-VAANI Enterprise Launcher
echo ========================================================
echo   TASK-VAANI - Statutory Compliance Hub
echo   Starting / Checking Local App Server...
echo ========================================================

cd /d "C:\Users\aryaa\.gemini\antigravity\scratch\task-vaani"

:: 1. Check if server is already responding on port 5173
powershell -Command "$res = try { (Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 1).StatusCode } catch { 0 }; exit $res"
if %errorlevel% equ 200 (
    echo [OK] Server is already running.
) else (
    echo [..] Starting background server...
    start /min "" cmd /c "cd /d C:\Users\aryaa\.gemini\antigravity\scratch\task-vaani && npm.cmd run dev"
    timeout /t 3 /nobreak >nul
)

:: 2. Launch browser in Incognito / Private Mode
echo [..] Opening in Incognito Mode...
start chrome --incognito "http://localhost:5173/" 2>nul || start msedge --inprivate "http://localhost:5173/" 2>nul || start brave --incognito "http://localhost:5173/" 2>nul || start "http://localhost:5173/"
exit
