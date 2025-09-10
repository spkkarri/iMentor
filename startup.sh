#!/bin/bash

# Startup script for iMentor Docker container
echo "🚀 Starting iMentor Application..."

# Ensure log directory exists
mkdir -p /app/server/logs

# Check if client build exists
if [ ! -d "/app/client/build" ]; then
    echo "❌ Client build not found. Building client..."
    cd /app/client && npm run build
fi

# Start the server in background
echo "🔧 Starting backend server..."
cd /app/server && node server.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 3

# Serve the frontend using a simple HTTP server
echo "🌐 Starting frontend server..."
cd /app/client/build && python3 -m http.server 4004 &
CLIENT_PID=$!

echo "✅ Application started!"
echo "   Backend (API): http://localhost:5007"
echo "   Frontend: http://localhost:4004"

# Function to handle shutdown
cleanup() {
    echo "🛑 Shutting down..."
    kill $SERVER_PID $CLIENT_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Wait for processes
wait
