# AWS Deployment Checklist

## Quick Start Guide

### Prerequisites ✅
- [x] AWS CLI installed and configured
- [x] Node.js installed
- [ ] Backend API URL ready
- [ ] AWS account permissions verified

---

## Choose Your Deployment Method

### Option 1: AWS Amplify (Easiest - Recommended for Quick Start)
**Best for:** Quick setup, automatic CI/CD, built-in SSL

**Steps:**
1. [ ] Set your backend API URL:
   ```bash
   export VITE_API_URL=https://your-backend-api-url.com
   ```

2. [ ] Connect to AWS Amplify Console:
   - Go to https://console.aws.amazon.com/amplify
   - Click "New app" → "Host web app"
   - Connect your Git repository (GitHub/GitLab)
   - Select branch: `main`
   - Build settings will auto-detect `amplify.yml`

3. [ ] Add environment variable in Amplify Console:
   - App settings → Environment variables
   - Add: `VITE_API_URL` = `https://your-backend-api-url.com`

4. [ ] Deploy:
   - Click "Save and deploy"
   - Wait for build to complete (~5-10 minutes)

**✅ Done!** Your app will be live at: `https://[random-id].amplifyapp.com`

---

### Option 2: S3 + CloudFront (Production-Ready)
**Best for:** Production deployments, custom domains, more control

**Steps:**

1. [ ] Set your backend API URL:
   ```bash
   export VITE_API_URL=https://your-backend-api-url.com
   ```

2. [ ] Deploy infrastructure using CloudFormation:
   ```bash
   chmod +x deploy-cloudformation.sh
   ./deploy-cloudformation.sh mercorboard-client-stack mercorboard-client https://your-backend-api-url.com
   ```
   This creates:
   - S3 bucket for hosting
   - CloudFront distribution
   - Proper bucket policies

3. [ ] Build and deploy your application:
   ```bash
   npm run build
   ./deploy-s3.sh mercorboard-client [CLOUDFRONT_DISTRIBUTION_ID]
   ```
   (Get CloudFront Distribution ID from CloudFormation outputs)

4. [ ] Get your CloudFront URL:
   ```bash
   aws cloudformation describe-stacks \
     --stack-name mercorboard-client-stack \
     --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDomainName`].OutputValue' \
     --output text
   ```

**✅ Done!** Your app will be live at the CloudFront URL

---

### Option 3: GitHub Actions (Automated CI/CD)
**Best for:** Automatic deployments on every push to main

**Steps:**

1. [ ] Add GitHub Secrets:
   - Go to: Repository → Settings → Secrets and variables → Actions
   - Add these secrets:
     - `AWS_ACCESS_KEY_ID`: Your AWS access key
     - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
     - `S3_BUCKET_NAME`: `mercorboard-client` (or your bucket name)
     - `CLOUDFRONT_DISTRIBUTION_ID`: (Get after CloudFormation deployment)
     - `VITE_API_URL`: `https://your-backend-api-url.com`

2. [ ] Deploy infrastructure first (if not done):
   ```bash
   ./deploy-cloudformation.sh mercorboard-client-stack mercorboard-client https://your-backend-api-url.com
   ```

3. [ ] Push to main branch:
   ```bash
   git push origin main
   ```

**✅ Done!** GitHub Actions will automatically build and deploy

---

## Current Status Check

Run these commands to check your current setup:

```bash
# Check if S3 bucket exists
aws s3 ls | grep mercorboard-client

# Check if CloudFormation stack exists
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE --query 'StackSummaries[?contains(StackName, `mercorboard-client`)].StackName' --output table

# Check GitHub secrets (if using GitHub Actions)
# Go to: https://github.com/[your-org]/[your-repo]/settings/secrets/actions
```

---

## Next Steps After Deployment

1. [ ] **Test your deployment:**
   - Visit your CloudFront/Amplify URL
   - Verify API calls work
   - Test all routes (SPA routing should work)

2. [ ] **Set up custom domain** (optional):
   - Add domain in CloudFront/Amplify Console
   - Update DNS records in Route 53 or your DNS provider

3. [ ] **Monitor and optimize:**
   - Set up CloudWatch alarms
   - Monitor CloudFront metrics
   - Review access logs

4. [ ] **Set up staging environment** (optional):
   - Create separate stack/bucket for staging
   - Use different branch for staging deployments

---

## Troubleshooting

### Common Issues:

1. **404 errors on routes:**
   - CloudFront: Ensure error pages are configured (403/404 → 200 → /index.html)
   - Amplify: Should work automatically

2. **API calls failing:**
   - Check CORS settings on backend
   - Verify `VITE_API_URL` is set correctly
   - Check browser console for errors

3. **Build failures:**
   - Check build logs in Amplify Console or GitHub Actions
   - Verify `VITE_API_URL` is set
   - Check Node.js version compatibility

---

## Quick Commands Reference

```bash
# Build locally
export VITE_API_URL=https://your-api-url.com
npm run build

# Deploy infrastructure
./deploy-cloudformation.sh mercorboard-client-stack mercorboard-client https://your-api-url.com

# Deploy application
./deploy-s3.sh mercorboard-client [DISTRIBUTION_ID]

# Check CloudFormation outputs
aws cloudformation describe-stacks --stack-name mercorboard-client-stack --query 'Stacks[0].Outputs' --output table

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id [DISTRIBUTION_ID] --paths "/*"
```

---

## Need Help?

- Check `AWS_DEPLOYMENT.md` for detailed documentation
- Review CloudFormation template: `cloudformation-template.yaml`
- Check deployment scripts: `deploy-cloudformation.sh`, `deploy-s3.sh`
