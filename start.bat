@echo off
echo Starting Customer Churn Prediction System...
echo.

REM Start backend in a new window
start "Churn API Backend" cmd /k "cd backend && ..\antigravity-env\Scripts\activate && uvicorn app.main:app --reload --port 8000"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in a new window
start "Churn Frontend" cmd /k "cd frontend && node \"node_modules/vite/bin/vite.js\""

echo.
echo Backend starting at: http://localhost:8000
echo Frontend starting at: http://localhost:5173
echo API Docs at: http://localhost:8000/docs
echo.
echo Close this window when done.
