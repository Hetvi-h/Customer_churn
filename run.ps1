# Start Customer Churn Prediction System
$ProjectPath = "C:\BULLSHITPROJECTS\Customer Churn Prediction & Risk Analysis System"

Write-Host "Starting Customer Churn Prediction System..." -ForegroundColor Green

# Start Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectPath\backend'; python -m uvicorn app.main:app --reload --port 8000"

Start-Sleep -Seconds 4

# Start Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node '$ProjectPath\frontend\node_modules\vite\bin\vite.js' --port 3000"

Start-Sleep -Seconds 4

# Open Chrome
Start-Process "chrome" "http://localhost:3000"

Write-Host "Servers started!" -ForegroundColor Green
Write-Host "Backend: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
