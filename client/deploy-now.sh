#!/bin/bash

# Quick deployment script for EC2
# Usage: ./deploy-now.sh [path-to-ssh-key]

set -e

EC2_HOST="98.86.116.222"
EC2_USER="ec2-user"
SSH_KEY=${1:-""}

echo "🚀 Quick Deploy to EC2"
echo "   Instance: ${EC2_HOST}"
echo ""

# Check if built
if [ ! -d "dist" ]; then
    echo "🔨 Building application..."
    export VITE_API_URL=${VITE_API_URL:-"http://98.86.116.222:3001"}
    npm run build
fi

# Find SSH key if not provided
if [ -z "${SSH_KEY}" ]; then
    echo "🔍 Looking for SSH key..."
    
    # Common locations
    if [ -f ~/.ssh/course-builder-prod.pem ]; then
        SSH_KEY=~/.ssh/course-builder-prod.pem
    elif [ -f ~/.ssh/aws-key.pem ]; then
        SSH_KEY=~/.ssh/aws-key.pem
    elif [ -f ~/Downloads/*.pem ]; then
        SSH_KEY=$(ls ~/Downloads/*.pem 2>/dev/null | head -1)
    else
        echo "❌ SSH key not found. Please provide path:"
        echo "   ./deploy-now.sh /path/to/your-key.pem"
        echo ""
        echo "Or set VITE_API_URL and deploy manually:"
        echo "   1. Build: npm run build"
        echo "   2. Copy: scp -r dist/* ec2-user@${EC2_HOST}:/var/www/html/"
        exit 1
    fi
fi

# If SSH key is provided but doesn't exist, check parent directory
if [ ! -f "${SSH_KEY}" ]; then
    # If it's a relative path, try parent directory
    if [[ "${SSH_KEY}" != /* ]]; then
        PARENT_KEY="../${SSH_KEY}"
        if [ -f "${PARENT_KEY}" ]; then
            SSH_KEY="${PARENT_KEY}"
            echo "✅ Found SSH key in parent directory: ${SSH_KEY}"
        fi
    fi
fi

if [ ! -f "${SSH_KEY}" ]; then
    echo "❌ SSH key not found: ${SSH_KEY}"
    echo ""
    echo "💡 Tip: If your PEM file is in the parent directory, use:"
    echo "   ./deploy-now.sh ../mercor.pem"
    exit 1
fi

echo "✅ Using SSH key: ${SSH_KEY}"
echo ""

# Test SSH connection
echo "🔌 Testing SSH connection..."
if ! ssh -i "${SSH_KEY}" -o ConnectTimeout=5 -o StrictHostKeyChecking=no ${EC2_USER}@${EC2_HOST} "echo 'Connected'" 2>/dev/null; then
    echo "❌ Cannot connect via SSH. Check:"
    echo "   1. Security group allows SSH (port 22) from your IP"
    echo "   2. SSH key is correct: ${SSH_KEY}"
    echo "   3. Instance is running"
    echo ""
    echo "You can still deploy manually:"
    echo "   scp -i ${SSH_KEY} -r dist/* ${EC2_USER}@${EC2_HOST}:/tmp/"
    exit 1
fi

echo "✅ SSH connection successful!"
echo ""

# Set API URL if not set
if [ -z "${VITE_API_URL}" ]; then
    echo "⚠️  VITE_API_URL not set. Using default."
    echo "   Set it with: export VITE_API_URL=https://your-api-url.com"
    export VITE_API_URL="http://98.86.116.222:3001"
fi

# Rebuild with correct API URL
echo "🔨 Building with API URL: ${VITE_API_URL}"
npm run build

# Deploy
echo "📤 Deploying to EC2..."

# Create remote directory and setup nginx
ssh -i "${SSH_KEY}" ${EC2_USER}@${EC2_HOST} <<ENDSSH
    # Install nginx if needed
    if ! command -v nginx &> /dev/null; then
        echo "Installing nginx..."
        sudo yum update -y
        sudo yum install -y nginx
    fi
    
    # Create web directory
    sudo mkdir -p /var/www/mercorboard
    sudo chown ${EC2_USER}:${EC2_USER} /var/www/mercorboard
    
    # Setup nginx config
    sudo tee /etc/nginx/conf.d/mercorboard.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/mercorboard;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    # Start nginx
    sudo systemctl enable nginx
    sudo systemctl restart nginx
    echo "✅ Nginx configured"
ENDSSH

# Copy files
echo "📋 Copying files..."
rsync -avz --delete -e "ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no" \
    dist/ ${EC2_USER}@${EC2_HOST}:/var/www/mercorboard/

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Your app is available at:"
echo "   http://${EC2_HOST}"
echo "   http://ec2-98-86-116-222.compute-1.amazonaws.com"
echo ""
echo "📋 Test it:"
echo "   curl http://${EC2_HOST}"
echo "   open http://${EC2_HOST}"
