#!/bin/bash
# Deploy frontend to S3 + CloudFront

set -e

echo "🚀 Deploying frontend to S3..."

# Configuration
BUCKET_NAME="${BUCKET_NAME:-course-builder-frontend}"
REGION="${AWS_REGION:-us-east-1}"
CLOUDFRONT_DIST_ID="${CLOUDFRONT_DIST_ID:-}"

cd client

# Build the application
echo "📦 Building frontend..."
npm run build

# Check if bucket exists, create if not
if ! aws s3 ls "s3://${BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
    echo "📦 Creating S3 bucket..."
    aws s3 mb "s3://${BUCKET_NAME}" --region "${REGION}"
    
    # Enable static website hosting
    aws s3 website "s3://${BUCKET_NAME}" \
        --index-document index.html \
        --error-document index.html
fi

# Upload files
echo "📤 Uploading files to S3..."
aws s3 sync dist/ "s3://${BUCKET_NAME}" --delete --region "${REGION}"

# Set public read permissions
echo "🔓 Setting bucket permissions..."
aws s3api put-bucket-policy --bucket "${BUCKET_NAME}" --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::'"${BUCKET_NAME}"'/*"
    }
  ]
}'

# Invalidate CloudFront cache if distribution ID is provided
if [ -n "${CLOUDFRONT_DIST_ID}" ]; then
    echo "🔄 Invalidating CloudFront cache..."
    aws cloudfront create-invalidation \
        --distribution-id "${CLOUDFRONT_DIST_ID}" \
        --paths "/*"
fi

echo "✅ Frontend deployed successfully!"
echo "🔗 Website URL: http://${BUCKET_NAME}.s3-website-${REGION}.amazonaws.com"
if [ -n "${CLOUDFRONT_DIST_ID}" ]; then
    echo "🌐 CloudFront URL: Check CloudFront console for distribution URL"
fi
