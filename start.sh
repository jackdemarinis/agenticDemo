#!/bin/bash

# DraftSmith Quick Start Script
# This script starts both backend and frontend in separate terminal windows

echo "Starting DraftSmith..."

# Check if virtual environment exists
if [ ! -d "backend/venv" ]; then
    echo "Virtual environment not found. Please run setup first:"
    echo "  cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo ".env file not found. Please create backend/.env with your credentials."
    echo "See backend/.env.example for reference."
    exit 1
fi

# Start backend
echo "Starting backend on http://localhost:8000..."
cd backend
source venv/bin/activate
python main.py &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend
echo "Starting frontend on http://localhost:5173..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "DraftSmith is running!"
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
