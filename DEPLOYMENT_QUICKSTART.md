# Quick Start: Deploy to AWS

This is a simplified guide to get you deployed quickly. For detailed options, see [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md).

## Prerequisites

1. **AWS Account** with CLI configured (`aws configure`)
2. **Environment variables** ready (see `.env.example`)

## Fastest Path: Elastic Beanstalk + S3

### Step 1: Deploy Backend (5 minutes)

```bash
# Install EB CLI
pip install awsebcli

# Navigate to server directory
cd server

# Initialize Elastic Beanstalk
eb init -p node.js -r us-east-1 course-builder-api

# Create and deploy
eb create course-builder-prod

# Set environment variables
eb setenv \
  ANTHROPIC_API_KEY=your_key \
  SUPABASE_URL=your_url \
  SUPABASE_SERVICE_ROLE_KEY=your_key \
  SUPABASE_ANON_KEY=your_key \
  PORT=8080 \
  NODE_ENV=production

# Get your backend URL
eb status
# Note the CNAME URL (e.g., course-builder-prod.us-east-1.elasticbeanstalk.com)
```

### Step 2: Deploy Frontend (5 minutes)

```bash
# Go back to project root
cd ..

# Build frontend
cd client
npm run build

# Create S3 bucket
aws s3 mb s3://course-builder-frontend --region us-east-1

# Enable static hosting
aws s3 website s3://course-builder-frontend \
  --index-document index.html \
  --error-document index.html

# Upload files
aws s3 sync dist/ s3://course-builder-frontend --delete

# Make bucket public
aws s3api put-bucket-policy --bucket course-builder-frontend --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::course-builder-frontend/*"
  }]
}'
```

### Step 3: Configure Frontend API URL

Create `client/.env.production`:
```env
VITE_API_URL=https://your-backend-url.elasticbeanstalk.com
```

Rebuild and redeploy:
```bash
cd client
npm run build
aws s3 sync dist/ s3://course-builder-frontend --delete
```

### Step 4: Test

1. Visit your S3 website URL: `http://course-builder-frontend.s3-website-us-east-1.amazonaws.com`
2. Test creating a course
3. Verify it works end-to-end

## Using Deployment Scripts

We've included helper scripts in `deploy-scripts/`:

```bash
# Deploy backend to Elastic Beanstalk
./deploy-scripts/deploy-backend-eb.sh

# Deploy frontend to S3
BUCKET_NAME=course-builder-frontend ./deploy-scripts/deploy-frontend-s3.sh

# Deploy to ECS (if using containers)
./deploy-scripts/deploy-ecs.sh
```

## Next Steps

1. **Set up CloudFront** for CDN (optional but recommended)
2. **Configure custom domain** (optional)
3. **Set up monitoring** in CloudWatch
4. **Enable HTTPS** via CloudFront or Let's Encrypt

## Troubleshooting

**Backend not responding?**
- Check Elastic Beanstalk logs: `eb logs`
- Verify environment variables: `eb printenv`

**Frontend can't reach backend?**
- Check CORS settings in `server/index.js`
- Verify `VITE_API_URL` is set correctly
- Check browser console for errors

**Need help?**
- See [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) for detailed options
- Check AWS CloudWatch logs
- Verify all environment variables are set
