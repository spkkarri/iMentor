# Multi-stage build for Node.js application
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install all dependencies (including devDependencies needed for build)
RUN npm ci && \
    cd server && npm ci && \
    cd ../client && npm ci

# Copy application code
COPY . .

# Build client application (with fallback)
RUN cd client && (npm run build || npm run build-simple)

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install PM2 globally and curl for health checks
RUN npm install -g pm2 serve && \
    apk add --no-cache curl python3

# Copy built application from base stage
COPY --from=base /app .

# Make startup script executable
RUN chmod +x startup.sh

# Remove client devDependencies to reduce size (keep only build output)
RUN rm -rf client/node_modules && \
    rm -rf client/src && \
    rm -rf client/public && \
    rm -f client/package*.json

# Create necessary directories
RUN mkdir -p server/logs server/uploads data

# Set proper permissions
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose ports
EXPOSE 5007 4004

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5007/ || exit 1

# Start application using PM2 or fallback to simple startup
CMD ["sh", "-c", "pm2-runtime start ecosystem.config.js --env production || ./startup.sh"]
