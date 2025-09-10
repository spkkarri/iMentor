#!/bin/bash

# Quick Deploy Script - Rebuilds and starts the fixed version
echo "🔧 Rebuilding iMentor with fixes..."

# Stop any running containers
docker-compose down

# Build with the fixes
docker-compose build --no-cache app

# Start the services
docker-compose up -d

echo "✅ Deployment complete!"
echo "📊 Checking service status..."
docker-compose ps

echo ""
echo "🌐 Access URLs:"
echo "   Frontend: http://localhost:4004"
echo "   Backend:  http://localhost:5007"
echo ""
echo "📋 To view logs: docker-compose logs -f"
