@echo off
echo ===================================================
echo   Deploying TASK-VAANI to GitHub Pages...
echo ===================================================
cd /d "C:/Users/aryaa/.gemini/antigravity/scratch/task-vaani"
call git push -u origin main
call npm run deploy
echo ===================================================
echo   Live URL: https://aryaaisakhi-4186.github.io/TASK-MANAGEMENT/
echo ===================================================
pause
