#!/bin/bash

# CloudFormation Deployment Script
# Usage: ./deploy-cloudformation.sh [stack-name] [bucket-name] [api-url]

set -e

STACK_NAME=${1:-"mercorboard-client-stack"}
BUCKET_NAME=${2:-"mercorboard-client"}
API_URL=${3:-""}
REGION=${AWS_REGION:-"us-east-1"}

if [ -z "${API_URL}" ]; then
    echo "❌ Error: API URL is required"
    echo "Usage: ./deploy-cloudformation.sh [stack-name] [bucket-name] [api-url]"
    exit 1
fi

echo "🚀 Deploying CloudFormation stack..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Deploy CloudFormation stack
aws cloudformation deploy \
    --template-file cloudformation-template.yaml \
    --stack-name "${STACK_NAME}" \
    --parameter-overrides \
        BucketName="${BUCKET_NAME}" \
        ApiUrl="${API_URL}" \
    --region "${REGION}" \
    --capabilities CAPABILITY_IAM

# Get outputs
echo "📋 Stack outputs:"
aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query 'Stacks[0].Outputs' \
    --output table

# Get CloudFront Distribution ID
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text)

echo ""
echo "✅ CloudFormation stack deployed successfully!"
echo ""
echo "📦 Next steps:"
echo "1. Build your application:"
echo "   export VITE_API_URL=${API_URL}"
echo "   npm run build"
echo ""
echo "2. Deploy to S3:"
echo "   ./deploy-s3.sh ${BUCKET_NAME} ${DISTRIBUTION_ID}"
echo ""
echo "🌐 Your CloudFront URL will be available after deployment"
