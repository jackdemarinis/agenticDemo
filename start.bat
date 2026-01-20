@echo off
REM DraftSmith Quick Start Script for Windows
REM This script starts both backend and frontend

echo Starting DraftSmith...

REM Check if virtual environment exists
if not exist "backend\venv" (
    echo Virtual environment not found. Please run setup first:
    echo   cd backend
    echo   python -m venv venv
    echo   venv\Scripts\activate
    echo   pip install -r requirements.txt
    exit /b 1
)

REM Check if .env exists
if not exist "backend\.env" (
    echo .env file not found. Please create backend\.env with your credentials.
    echo See backend\.env.example for reference.
    exit /b 1
)

echo Starting backend on http://localhost:8000...
start cmd /k "cd backend && venv\Scripts\activate && python main.py"

timeout /t 3 /nobreak > nul

echo Starting frontend on http://localhost:5173...
start cmd /k "cd frontend && npm run dev"

echo.
echo DraftSmith is running!
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo.
echo Close the terminal windows to stop the services.
