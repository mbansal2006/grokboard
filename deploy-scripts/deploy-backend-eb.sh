#!/bin/bash
# Deploy backend to AWS Elastic Beanstalk

set -e

echo "🚀 Deploying backend to AWS Elastic Beanstalk..."

cd server

# Check if EB CLI is installed
if ! command -v eb &> /dev/null; then
    echo "❌ EB CLI not found. Install with: pip install awsebcli"
    exit 1
fi

# Initialize if not already done
if [ ! -f ".elasticbeanstalk/config.yml" ]; then
    echo "📦 Initializing Elastic Beanstalk..."
    eb init -p node.js -r us-east-1 course-builder-api
fi

# Create environment if it doesn't exist
if ! eb list | grep -q "course-builder-prod"; then
    echo "🌱 Creating Elastic Beanstalk environment..."
    eb create course-builder-prod
else
    echo "📤 Deploying to existing environment..."
    eb deploy course-builder-prod
fi

echo "✅ Deployment complete!"
echo "🔗 Get your URL with: eb status"
