# AWS Deployment Guide

This guide covers deploying the Mercorboard client to AWS using multiple methods.

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured (`aws configure`)
- Node.js 20+ installed
- npm installed

## Environment Variables

The application requires the following environment variable:
- `VITE_API_URL`: The backend API URL (e.g., `https://api.example.com`)

## Deployment Options

### Option 1: AWS Amplify (Recommended - Easiest)

AWS Amplify provides automatic CI/CD, hosting, and environment variable management.

#### Steps:

1. **Install AWS Amplify CLI** (if not already installed):
   ```bash
   npm install -g @aws-amplify/cli
   ```

2. **Initialize Amplify**:
   ```bash
   amplify init
   ```
   - Choose your AWS profile
   - Select a region (e.g., `us-east-1`)
   - Choose a name for your app
   - Choose the default editor
   - Choose default build settings (use `amplify.yml`)

3. **Add Hosting**:
   ```bash
   amplify add hosting
   ```
   - Choose "Hosting with Amplify Console"
   - Choose "Manual deployment"

4. **Push to AWS**:
   ```bash
   amplify push
   ```

5. **Connect Repository** (Alternative - via AWS Console):
   - Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify)
   - Click "New app" → "Host web app"
   - Connect your Git repository (GitHub, GitLab, etc.)
   - Select the branch (e.g., `main`)
   - Review build settings (should auto-detect `amplify.yml`)
   - Add environment variable: `VITE_API_URL` with your API URL
   - Click "Save and deploy"

#### Environment Variables in Amplify:

1. Go to your app in Amplify Console
2. Navigate to "App settings" → "Environment variables"
3. Add `VITE_API_URL` with your backend API URL

---

### Option 2: S3 + CloudFront (Production-Ready)

This method provides more control and is better for production workloads.

#### Step 1: Create S3 Bucket

```bash
# Create bucket
aws s3 mb s3://mercorboard-client --region us-east-1

# Enable static website hosting
aws s3 website s3://mercorboard-client \
    --index-document index.html \
    --error-document index.html

# Set bucket policy for public read access
cat > bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::mercorboard-client/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket mercorboard-client --policy file://bucket-policy.json
```

#### Step 2: Create CloudFront Distribution

1. Go to [CloudFront Console](https://console.aws.amazon.com/cloudfront)
2. Click "Create Distribution"
3. Configure:
   - **Origin Domain**: Select your S3 bucket (`mercorboard-client.s3.amazonaws.com`)
   - **Origin Access**: Choose "Origin access control settings (recommended)"
   - Create new OAC or use existing
   - **Viewer Protocol Policy**: Redirect HTTP to HTTPS
   - **Allowed HTTP Methods**: GET, HEAD, OPTIONS
   - **Default Root Object**: `index.html`
   - **Error Pages**: Add custom error response for 403/404 → 200 → `/index.html` (for SPA routing)
4. Click "Create Distribution"
5. Note the Distribution ID for later use

#### Step 3: Update S3 Bucket Policy for CloudFront

After creating CloudFront, update the bucket policy:

```bash
# Get your CloudFront OAC ID from the CloudFront console
# Replace YOUR_OAC_ID with the actual OAC ID
cat > bucket-policy-cloudfront.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::mercorboard-client/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR_ACCOUNT_ID:distribution/YOUR_DISTRIBUTION_ID"
        }
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket mercorboard-client --policy file://bucket-policy-cloudfront.json
```

#### Step 4: Deploy Using Script

```bash
# Set environment variable
export VITE_API_URL=https://your-api-url.com

# Build and deploy
npm run build
./deploy-s3.sh mercorboard-client YOUR_CLOUDFRONT_DISTRIBUTION_ID
```

Or manually:

```bash
# Build
export VITE_API_URL=https://your-api-url.com
npm run build

# Deploy to S3
aws s3 sync dist/ s3://mercorboard-client --delete \
    --cache-control "public, max-age=31536000, immutable" \
    --exclude "*.html"

aws s3 sync dist/ s3://mercorboard-client \
    --cache-control "no-cache, no-store, must-revalidate" \
    --exclude "*" \
    --include "*.html"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
    --distribution-id YOUR_DISTRIBUTION_ID \
    --paths "/*"
```

---

### Option 3: GitHub Actions (Automated CI/CD)

The repository includes a GitHub Actions workflow that automatically deploys on push to `main`.

#### Setup:

1. **Add GitHub Secrets**:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `AWS_ACCESS_KEY_ID`: Your AWS access key
     - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
     - `S3_BUCKET_NAME`: Your S3 bucket name (e.g., `mercorboard-client`)
     - `CLOUDFRONT_DISTRIBUTION_ID`: Your CloudFront distribution ID
     - `VITE_API_URL`: Your backend API URL

2. **Push to main branch**:
   ```bash
   git push origin main
   ```

The workflow will automatically:
- Build the application
- Deploy to S3
- Invalidate CloudFront cache

---

### Option 4: Docker + ECS/Fargate (Containerized)

If you prefer containerized deployment:

#### Step 1: Build and Push Docker Image

```bash
# Build image
docker build -t mercorboard-client:latest \
    --build-arg VITE_API_URL=https://your-api-url.com .

# Tag for ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

docker tag mercorboard-client:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mercorboard-client:latest

# Push to ECR
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/mercorboard-client:latest
```

#### Step 2: Deploy to ECS/Fargate

Create ECS task definition and service using AWS Console or CLI.

---

## Post-Deployment

### Verify Deployment

1. **S3 + CloudFront**: Visit your CloudFront distribution URL
2. **Amplify**: Visit the Amplify app URL from the console
3. **ECS**: Visit your load balancer URL

### Monitoring

- **CloudWatch**: Monitor logs and metrics
- **Amplify Console**: Built-in monitoring and logs
- **CloudFront**: View distribution metrics and access logs

### Troubleshooting

#### Common Issues:

1. **404 errors on routes**: Ensure SPA routing is configured (CloudFront error pages or nginx config)
2. **API calls failing**: Check CORS settings on backend and `VITE_API_URL` environment variable
3. **Assets not loading**: Verify cache headers and CloudFront invalidation
4. **Build failures**: Check build logs in Amplify Console or GitHub Actions

---

## Cost Estimation

- **S3**: ~$0.023 per GB storage + $0.0004 per 1,000 requests
- **CloudFront**: ~$0.085 per GB data transfer (first 10TB)
- **Amplify**: Free tier includes 15 build minutes/month, then $0.01 per build minute
- **ECS/Fargate**: ~$0.04 per vCPU-hour + $0.004 per GB-hour

For a small application, expect ~$1-5/month with S3+CloudFront or Amplify.

---

## Security Best Practices

1. **Enable HTTPS**: Always use CloudFront or Amplify (both provide SSL)
2. **CORS**: Configure backend CORS to only allow your domain
3. **Environment Variables**: Never commit secrets to repository
4. **Bucket Policies**: Restrict S3 bucket access appropriately
5. **CloudFront**: Use Origin Access Control (OAC) instead of public bucket access

---

## Next Steps

- Set up custom domain (Route 53 + CloudFront/Amplify)
- Configure monitoring and alerts
- Set up staging environment
- Implement blue-green deployments
