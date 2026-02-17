@echo off
echo ========================================
echo Customer Churn Prediction System Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    exit /b 1
)

echo [1/5] Setting up Python virtual environment...
cd backend
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate.bat

echo [2/5] Installing Python dependencies...
pip install -r requirements.txt --quiet

echo [3/5] Training ML model...
cd ..
python ml\train_model.py

echo [4/5] Seeding database...
cd backend
python seed_data.py

echo [5/5] Installing frontend dependencies...
cd ..\frontend
call npm install --silent

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo To start the application:
echo.
echo 1. Start the backend:
echo    cd backend
echo    venv\Scripts\activate
echo    uvicorn app.main:app --reload --port 8000
echo.
echo 2. Start the frontend (new terminal):
echo    cd frontend
echo    npm run dev
echo.
echo 3. Open http://localhost:3000 in your browser
echo.

cd ..
