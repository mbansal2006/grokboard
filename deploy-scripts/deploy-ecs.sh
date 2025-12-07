#!/bin/bash
# Deploy to AWS ECS/Fargate

set -e

echo "🚀 Deploying to AWS ECS..."

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO="${ECR_REPO:-course-builder-api}"
CLUSTER_NAME="${CLUSTER_NAME:-course-builder-cluster}"
SERVICE_NAME="${SERVICE_NAME:-course-builder-service}"
TASK_FAMILY="${TASK_FAMILY:-course-builder-task}"

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

cd server

# Create ECR repository if it doesn't exist
if ! aws ecr describe-repositories --repository-names "${ECR_REPO}" --region "${AWS_REGION}" 2>&1 | grep -q 'RepositoryNotFoundException'; then
    echo "📦 Creating ECR repository..."
    aws ecr create-repository --repository-name "${ECR_REPO}" --region "${AWS_REGION}"
fi

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_URI}"

# Build Docker image
echo "🔨 Building Docker image..."
docker build -t "${ECR_REPO}:latest" .

# Tag and push image
echo "📤 Pushing image to ECR..."
docker tag "${ECR_REPO}:latest" "${ECR_URI}:latest"
docker push "${ECR_URI}:latest"

# Update ECS service (assumes service already exists)
if aws ecs describe-services --cluster "${CLUSTER_NAME}" --services "${SERVICE_NAME}" --region "${AWS_REGION}" 2>&1 | grep -q "${SERVICE_NAME}"; then
    echo "🔄 Updating ECS service..."
    aws ecs update-service \
        --cluster "${CLUSTER_NAME}" \
        --service "${SERVICE_NAME}" \
        --force-new-deployment \
        --region "${AWS_REGION}"
    
    echo "✅ Service update initiated. Check ECS console for status."
else
    echo "⚠️  Service ${SERVICE_NAME} not found. Please create it first using the ECS console or terraform/cloudformation."
fi

echo "✅ Deployment complete!"
