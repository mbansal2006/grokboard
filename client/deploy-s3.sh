#!/bin/bash

# AWS S3 + CloudFront Deployment Script
# Usage: ./deploy-s3.sh [bucket-name] [cloudfront-distribution-id]

set -e

BUCKET_NAME=${1:-"mercorboard-client"}
DISTRIBUTION_ID=${2:-""}
REGION=${AWS_REGION:-"us-east-1"}

echo "🚀 Starting deployment to S3..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if bucket exists, create if not
if ! aws s3 ls "s3://${BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
    echo "📦 Bucket ${BUCKET_NAME} exists"
else
    echo "📦 Creating bucket ${BUCKET_NAME}..."
    aws s3 mb "s3://${BUCKET_NAME}" --region "${REGION}"
    
    # Enable static website hosting
    aws s3 website "s3://${BUCKET_NAME}" \
        --index-document index.html \
        --error-document index.html
fi

# Build the application
echo "🔨 Building application..."
npm ci
npm run build

# Upload files to S3
echo "📤 Uploading files to S3..."
aws s3 sync dist/ "s3://${BUCKET_NAME}" \
    --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html" \
    --exclude "service-worker.js"

# Upload HTML files with no cache
aws s3 sync dist/ "s3://${BUCKET_NAME}" \
    --delete \
    --cache-control "no-cache, no-store, must-revalidate" \
    --exclude "*" \
    --include "*.html"

# Upload service worker with no cache
if [ -f "dist/service-worker.js" ]; then
    aws s3 cp dist/service-worker.js "s3://${BUCKET_NAME}/service-worker.js" \
        --cache-control "no-cache, no-store, must-revalidate"
fi

# Invalidate CloudFront cache if distribution ID is provided
if [ -n "${DISTRIBUTION_ID}" ]; then
    echo "🔄 Invalidating CloudFront cache..."
    aws cloudfront create-invalidation \
        --distribution-id "${DISTRIBUTION_ID}" \
        --paths "/*"
    echo "✅ CloudFront cache invalidation initiated"
fi

echo "✅ Deployment complete!"
echo "🌐 Website URL: http://${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com"
if [ -n "${DISTRIBUTION_ID}" ]; then
    echo "🌐 CloudFront URL: Check AWS Console for your distribution domain"
fi
