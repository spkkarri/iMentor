# Docker Deployment Guide for iMentor

This guide provides instructions for deploying the iMentor application using Docker for one-click deployment.

## 🚀 Quick Start (One-Click Deployment)

### For Windows Users:
```bash
# Double-click or run:
docker-deploy.bat start
```

### For Linux/Mac Users:
```bash
# Make the script executable and run:
chmod +x docker-deploy.sh
./docker-deploy.sh start
```

### Using npm scripts:
```bash
npm run docker:start
```

## 📋 Prerequisites

- Docker Desktop installed and running
- Docker Compose (included with Docker Desktop)
- Git (to clone the repository)

## 🏗️ Project Structure

```
iMentor/
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Production deployment
├── docker-compose.dev.yml     # Development deployment
├── docker-deploy.sh          # Linux/Mac deployment script
├── docker-deploy.bat         # Windows deployment script
├── mongo-init.js             # MongoDB initialization
├── .dockerignore             # Docker ignore file
├── ecosystem.config.js       # PM2 configuration
├── client/                   # React frontend
├── server/                   # Node.js backend
└── .env                      # Environment variables
```

## 🐳 Docker Services

The application consists of these services:

1. **app**: Main application (Frontend + Backend)
   - Frontend: React app served on port 4004
   - Backend: Node.js API on port 5007
   
2. **mongodb**: MongoDB database on port 27017
3. **redis**: Redis cache on port 6379
4. **nginx**: Reverse proxy on ports 80/443 (optional)

## 🛠️ Available Commands

### Using Docker Scripts:

**Windows:**
```cmd
docker-deploy.bat start      # Start all services
docker-deploy.bat stop       # Stop all services
docker-deploy.bat restart    # Restart all services
docker-deploy.bat status     # Show service status
docker-deploy.bat logs       # View logs
docker-deploy.bat cleanup    # Remove everything
docker-deploy.bat help       # Show help
```

**Linux/Mac:**
```bash
./docker-deploy.sh start     # Start all services
./docker-deploy.sh stop      # Stop all services
./docker-deploy.sh restart   # Restart all services
./docker-deploy.sh status    # Show service status
./docker-deploy.sh logs      # View logs
./docker-deploy.sh cleanup   # Remove everything
./docker-deploy.sh help      # Show help
```

### Using npm scripts:
```bash
npm run docker:start         # Build and start all services
npm run docker:stop          # Stop all services
npm run docker:restart       # Restart all services
npm run docker:logs          # View logs
npm run docker:status        # Show service status
npm run docker:clean         # Clean up everything
```

### Using Docker Compose directly:
```bash
# Production deployment
docker-compose up --build -d
docker-compose down
docker-compose logs -f

# Development deployment
docker-compose -f docker-compose.dev.yml up --build -d
docker-compose -f docker-compose.dev.yml down
```

## 🌐 Access URLs

After successful deployment:

- **Frontend**: http://localhost:4004
- **Backend API**: http://localhost:5007
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379
- **Nginx** (if enabled): http://localhost:80

## 🔧 Configuration

### Environment Variables

The application uses the `.env` file for configuration. Key variables:

```env
NODE_ENV=production
PORT=5007
CLIENT_PORT=4004
MONGODB_URI=mongodb://vinay:admin@mongodb:27017/chatbotGeminiDB4?authSource=admin
REDIS_URL=redis://redis:6379
JWT_SECRET=your-jwt-secret
GEMINI_API_KEY=your-gemini-api-key
DEEPSEEK_API_KEY=your-deepseek-api-key
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

### Database Configuration

MongoDB is automatically initialized with:
- Database: `chatbotGeminiDB4`
- Username: `vinay`
- Password: `admin`
- Collections and indexes are created automatically

## 🚨 Troubleshooting

### Common Issues:

1. **Port already in use**:
   ```bash
   # Stop any existing services
   docker-compose down
   # Or change ports in docker-compose.yml
   ```

2. **Permission denied on Linux/Mac**:
   ```bash
   chmod +x docker-deploy.sh
   ```

3. **Docker not running**:
   - Start Docker Desktop
   - Wait for it to fully initialize

4. **Build failures**:
   ```bash
   # Clean build cache
   docker system prune -f
   docker-compose build --no-cache
   ```

### View Service Logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f mongodb
```

### Check Service Status:
```bash
docker-compose ps
```

### Access Container Shell:
```bash
# Access app container
docker-compose exec app sh

# Access MongoDB
docker-compose exec mongodb mongo
```

## 🔄 Development vs Production

### Development Mode:
- Uses `docker-compose.dev.yml`
- Separate volume mounts for development
- Hot reloading enabled

### Production Mode:
- Uses `docker-compose.yml`
- Includes Nginx reverse proxy
- Optimized for performance

## 📊 Monitoring

### Health Checks:
The application includes health checks:
- API health endpoint: `http://localhost:5007/health`
- Docker health check built-in

### Logs:
- Application logs: `./server/logs/`
- PM2 logs within container
- Docker logs via `docker-compose logs`

## 🛡️ Security Considerations

1. **Change default passwords** in production
2. **Use environment-specific .env files**
3. **Enable HTTPS with proper SSL certificates**
4. **Configure firewall rules**
5. **Regular security updates**

## 📈 Scaling

To scale the application:

```bash
# Scale app service to 3 instances
docker-compose up --scale app=3 -d
```

## 🗂️ Data Persistence

- MongoDB data: Stored in Docker volume `mongodb_data`
- Redis data: Stored in Docker volume `redis_data`
- Uploads: Mounted to `./server/uploads`
- Logs: Mounted to `./server/logs`

## 🧹 Cleanup

To completely remove everything:

```bash
# Using script
./docker-deploy.sh cleanup

# Or manually
docker-compose down -v --rmi all
docker system prune -f
```

## 📞 Support

For issues or questions:
1. Check the logs: `docker-compose logs -f`
2. Verify service status: `docker-compose ps`
3. Check Docker installation: `docker --version`
4. Review environment variables in `.env`

---

**Happy Deploying! 🎉**
