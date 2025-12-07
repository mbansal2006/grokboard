#!/bin/bash

# EC2 Deployment Script
# Usage: ./deploy-ec2.sh [ec2-host] [deployment-method]
# Methods: docker, static, or both

set -e

EC2_HOST=${1:-""}
DEPLOYMENT_METHOD=${2:-"static"}
EC2_USER=${EC2_USER:-"ec2-user"}
REMOTE_DIR=${REMOTE_DIR:-"/var/www/mercorboard"}
DOCKER_IMAGE_NAME=${DOCKER_IMAGE_NAME:-"mercorboard-client"}

if [ -z "${EC2_HOST}" ]; then
    echo "❌ Error: EC2 host is required"
    echo "Usage: ./deploy-ec2.sh [ec2-host] [deployment-method]"
    echo ""
    echo "Examples:"
    echo "  ./deploy-ec2.sh ec2-123-45-67-89.compute-1.amazonaws.com static"
    echo "  ./deploy-ec2.sh 54.123.45.67 docker"
    echo "  EC2_USER=ubuntu ./deploy-ec2.sh my-ec2-instance.com static"
    echo ""
    echo "Deployment methods:"
    echo "  static  - Deploy static files to nginx (default)"
    echo "  docker  - Deploy using Docker"
    echo "  both    - Deploy both static and Docker"
    exit 1
fi

if [ -z "${VITE_API_URL}" ]; then
    echo "⚠️  Warning: VITE_API_URL not set. Using default: http://localhost:3001"
    echo "Set it with: export VITE_API_URL=https://your-api-url.com"
    VITE_API_URL=${VITE_API_URL:-"http://localhost:3001"}
fi

echo "🚀 Starting EC2 deployment..."
echo "   Host: ${EC2_HOST}"
echo "   User: ${EC2_USER}"
echo "   Method: ${DEPLOYMENT_METHOD}"
echo "   API URL: ${VITE_API_URL}"
echo ""

# Build the application
echo "🔨 Building application..."
npm ci
npm run build

if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed - dist directory not found"
    exit 1
fi

# Function to deploy static files
deploy_static() {
    echo "📤 Deploying static files to EC2..."
    
    # Create remote directory if it doesn't exist
    ssh ${EC2_USER}@${EC2_HOST} "sudo mkdir -p ${REMOTE_DIR} && sudo chown ${EC2_USER}:${EC2_USER} ${REMOTE_DIR}"
    
    # Copy files using rsync
    rsync -avz --delete \
        --exclude '.git' \
        --exclude 'node_modules' \
        dist/ ${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/
    
    # Copy nginx config if it doesn't exist
    echo "📋 Checking nginx configuration..."
    ssh ${EC2_USER}@${EC2_HOST} "sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled"
    
    # Create nginx config
    cat > /tmp/mercorboard-nginx.conf <<EOF
server {
    listen 80;
    server_name _;
    root ${REMOTE_DIR};
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # SPA routing - serve index.html for all routes
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
    
    scp /tmp/mercorboard-nginx.conf ${EC2_USER}@${EC2_HOST}:/tmp/mercorboard-nginx.conf
    
    # Setup nginx
    ssh ${EC2_USER}@${EC2_HOST} <<'ENDSSH'
        # Install nginx if not installed
        if ! command -v nginx &> /dev/null; then
            echo "Installing nginx..."
            if command -v yum &> /dev/null; then
                sudo yum update -y
                sudo yum install -y nginx
            elif command -v apt-get &> /dev/null; then
                sudo apt-get update
                sudo apt-get install -y nginx
            fi
        fi
        
        # Copy nginx config
        sudo cp /tmp/mercorboard-nginx.conf /etc/nginx/sites-available/mercorboard
        sudo ln -sf /etc/nginx/sites-available/mercorboard /etc/nginx/sites-enabled/
        
        # Remove default nginx site if it exists
        sudo rm -f /etc/nginx/sites-enabled/default
        
        # Test nginx config
        sudo nginx -t
        
        # Start and enable nginx
        sudo systemctl enable nginx
        sudo systemctl restart nginx
        
        echo "✅ Nginx configured and restarted"
ENDSSH
    
    echo "✅ Static files deployed successfully!"
}

# Function to deploy using Docker
deploy_docker() {
    echo "🐳 Deploying using Docker..."
    
    # Build Docker image
    echo "🔨 Building Docker image..."
    docker build -t ${DOCKER_IMAGE_NAME}:latest \
        --build-arg VITE_API_URL=${VITE_API_URL} .
    
    # Save image as tar
    echo "💾 Saving Docker image..."
    docker save ${DOCKER_IMAGE_NAME}:latest | gzip > /tmp/mercorboard-client.tar.gz
    
    # Copy image to EC2
    echo "📤 Copying Docker image to EC2..."
    scp /tmp/mercorboard-client.tar.gz ${EC2_USER}@${EC2_HOST}:/tmp/
    
    # Load and run on EC2
    ssh ${EC2_USER}@${EC2_HOST} <<ENDSSH
        # Install Docker if not installed
        if ! command -v docker &> /dev/null; then
            echo "Installing Docker..."
            if command -v yum &> /dev/null; then
                sudo yum update -y
                sudo yum install -y docker
            elif command -v apt-get &> /dev/null; then
                sudo apt-get update
                sudo apt-get install -y docker.io
            fi
            sudo systemctl start docker
            sudo systemctl enable docker
            sudo usermod -aG docker ${EC2_USER}
        fi
        
        # Load Docker image
        echo "Loading Docker image..."
        gunzip -c /tmp/mercorboard-client.tar.gz | sudo docker load
        
        # Stop existing container if running
        sudo docker stop ${DOCKER_IMAGE_NAME} 2>/dev/null || true
        sudo docker rm ${DOCKER_IMAGE_NAME} 2>/dev/null || true
        
        # Run new container
        echo "Starting Docker container..."
        sudo docker run -d \
            --name ${DOCKER_IMAGE_NAME} \
            --restart unless-stopped \
            -p 80:80 \
            ${DOCKER_IMAGE_NAME}:latest
        
        echo "✅ Docker container started"
ENDSSH
    
    # Cleanup
    rm -f /tmp/mercorboard-client.tar.gz
    
    echo "✅ Docker deployment complete!"
}

# Deploy based on method
case ${DEPLOYMENT_METHOD} in
    static)
        deploy_static
        ;;
    docker)
        deploy_docker
        ;;
    both)
        deploy_static
        deploy_docker
        ;;
    *)
        echo "❌ Unknown deployment method: ${DEPLOYMENT_METHOD}"
        echo "Use: static, docker, or both"
        exit 1
        ;;
esac

echo ""
echo "✅ Deployment complete!"
echo "🌐 Your application should be available at: http://${EC2_HOST}"
echo ""
echo "📋 Next steps:"
echo "   1. Test your application: curl http://${EC2_HOST}"
echo "   2. Check nginx/Docker logs if needed"
echo "   3. Configure firewall/security groups to allow HTTP traffic (port 80)"
echo "   4. Set up SSL/TLS certificate (Let's Encrypt) for HTTPS"
