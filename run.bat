@echo off
echo Starting Customer Churn Prediction System...

set "PROJECT=C:\BULLSHITPROJECTS\Customer Churn Prediction ^& Risk Analysis System"

REM Start backend in a new window
start "Churn Backend" cmd /k "cd /d "%PROJECT%\backend" && python -m uvicorn app.main:app --reload --port 8000"

REM Wait for backend to start
timeout /t 4 /nobreak >nul

REM Start frontend in a new window
start "Churn Frontend" cmd /k "node "%PROJECT%\frontend\node_modules\vite\bin\vite.js" --port 3000"

REM Wait for frontend to start
timeout /t 4 /nobreak >nul

REM Open Chrome
start chrome http://localhost:3000

echo.
echo Servers started!
