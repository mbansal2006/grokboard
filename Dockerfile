# Root Dockerfile for fly.io deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build argument for API URL
ARG VITE_API_URL=http://localhost:3001

# Set as environment variable for Vite build
ENV VITE_API_URL=${VITE_API_URL}

# Copy root package files
COPY package*.json ./

# Copy client package files
COPY client/package*.json ./client/

# Install root dependencies (if any needed for build)
RUN npm ci --ignore-scripts || true

# Install client dependencies
WORKDIR /app/client
RUN npm ci

# Return to root and copy all files
WORKDIR /app
COPY . .

# Build the client application
WORKDIR /app/client
RUN npm run build

# Production stage - run both frontend (nginx) and backend (node)
FROM node:20-alpine

# Install nginx
RUN apk add --no-cache nginx

WORKDIR /app

# Copy backend files
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production

# Copy backend source
COPY server/ ./

# Note: Environment variables should be set at runtime (not copied from .env)
# For fly.io: Use `fly secrets set KEY=value`
# For docker: Use `docker run -e KEY=value` or `--env-file .env`
# dotenv will load from /app/.env if it exists, but runtime env vars take precedence

# Create necessary directories
RUN mkdir -p uploads courses exports

# Copy built frontend files
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Copy nginx configuration
COPY client/nginx.conf /etc/nginx/nginx.conf

# Create startup script that runs both nginx and node
# Environment variables are set at runtime (via fly secrets or docker -e flags)
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'set -e' >> /start.sh && \
    echo '' >> /start.sh && \
    echo '# Start node backend in background' >> /start.sh && \
    echo '# Environment variables should be set at runtime' >> /start.sh && \
    echo 'cd /app/server && node index.js &' >> /start.sh && \
    echo '' >> /start.sh && \
    echo '# Wait a moment for backend to start' >> /start.sh && \
    echo 'sleep 2' >> /start.sh && \
    echo '' >> /start.sh && \
    echo '# Start nginx in foreground (keeps container alive)' >> /start.sh && \
    echo 'exec nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

# Expose ports
EXPOSE 80 3001

# Start both nginx and node
CMD ["/start.sh"]
