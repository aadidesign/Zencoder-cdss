#!/bin/bash

echo "🛑 Stopping CDSS services..."

# Stop backend
if [ -f backend.pid ]; then
    kill $(cat backend.pid) 2>/dev/null
    rm backend.pid
    echo "✓ Backend stopped"
fi

# Stop frontend
if [ -f frontend.pid ]; then
    kill $(cat frontend.pid) 2>/dev/null
    rm frontend.pid
    echo "✓ Frontend stopped"
fi

# Stop Redis
if docker ps | grep -q cdss-redis; then
    docker stop cdss-redis > /dev/null 2>&1
    docker rm cdss-redis > /dev/null 2>&1
    echo "✓ Redis stopped"
fi

# Kill any remaining processes
pkill -f "uvicorn main:app" 2>/dev/null
pkill -f "react-scripts start" 2>/dev/null

echo "✅ All services stopped"

