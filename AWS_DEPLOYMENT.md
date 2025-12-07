# AWS Deployment Guide

This guide covers multiple deployment options for the Course Builder application on AWS.

## Architecture Overview

- **Frontend**: React/Vite application (static files)
- **Backend**: Node.js/Express API server
- **Database**: Supabase (external, no AWS deployment needed)

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured (`aws configure`)
- Node.js installed locally (for building)
- Docker installed (for containerized deployment)

## Deployment Options

### Option 1: AWS Elastic Beanstalk (Easiest - Recommended for Backend)

**Pros**: Simple, managed service, auto-scaling, load balancing
**Cons**: Less control over infrastructure

#### Backend Deployment Steps:

1. **Install EB CLI**:
```bash
pip install awsebcli
```

2. **Initialize Elastic Beanstalk**:
```bash
cd server
eb init -p node.js -r us-east-1 course-builder-api
```

3. **Create environment**:
```bash
eb create course-builder-prod
```

4. **Set environment variables**:
```bash
eb setenv ANTHROPIC_API_KEY=your_key \
          SUPABASE_URL=your_url \
          SUPABASE_SERVICE_ROLE_KEY=your_key \
          SUPABASE_ANON_KEY=your_key \
          PORT=8080 \
          NODE_ENV=production
```

5. **Deploy**:
```bash
eb deploy
```

6. **Get URL**:
```bash
eb status
```

#### Frontend Deployment (S3 + CloudFront):

1. **Build the frontend**:
```bash
cd client
npm run build
```

2. **Create S3 bucket**:
```bash
aws s3 mb s3://course-builder-frontend --region us-east-1
```

3. **Enable static website hosting**:
```bash
aws s3 website s3://course-builder-frontend \
  --index-document index.html \
  --error-document index.html
```

4. **Upload build files**:
```bash
aws s3 sync dist/ s3://course-builder-frontend --delete
```

5. **Create CloudFront distribution** (optional, for CDN):
- Go to CloudFront console
- Create distribution
- Origin: S3 bucket (course-builder-frontend)
- Default root object: index.html
- Enable HTTPS

6. **Update frontend API URL**:
   - Update `vite.config.js` to point to your backend URL
   - Or use environment variables (see below)

---

### Option 2: AWS ECS/Fargate (Containerized - Recommended for Production)

**Pros**: Fully containerized, scalable, modern
**Cons**: More complex setup

#### Backend Container Deployment:

1. **Build and push Docker image**:
```bash
# Build
docker build -t course-builder-api:latest -f server/Dockerfile .

# Tag for ECR
aws ecr create-repository --repository-name course-builder-api
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag course-builder-api:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/course-builder-api:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/course-builder-api:latest
```

2. **Create ECS Task Definition** (see `ecs-task-definition.json`)

3. **Create ECS Cluster and Service**:
```bash
aws ecs create-cluster --cluster-name course-builder-cluster
# Then create service via console or CLI
```

4. **Set up Application Load Balancer** for the service

#### Frontend Container Deployment:

1. **Build and push frontend image**:
```bash
docker build -t course-builder-frontend:latest -f client/Dockerfile .
# Similar ECR push process
```

2. **Deploy to ECS** or use S3 + CloudFront (simpler for static files)

---

### Option 3: EC2 Instance (Traditional - Full Control)

**Pros**: Full control, can customize everything
**Cons**: Manual setup, need to manage updates

#### Setup Steps:

1. **Launch EC2 instance** (Ubuntu 22.04 LTS recommended)

2. **SSH into instance**:
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

3. **Install Node.js**:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

4. **Clone repository**:
```bash
git clone <your-repo-url>
cd mercorboard
```

5. **Install dependencies**:
```bash
npm run install-all
```

6. **Set up environment variables**:
```bash
cp .env.example .env
nano .env  # Edit with your values
```

7. **Set up PM2 for process management**:
```bash
sudo npm install -g pm2
cd server
pm2 start index.js --name course-builder-api
pm2 save
pm2 startup  # Follow instructions
```

8. **Set up Nginx reverse proxy**:
```bash
sudo apt-get install nginx
sudo nano /etc/nginx/sites-available/default
```

Add configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        root /path/to/client/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

9. **Enable HTTPS with Let's Encrypt**:
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Frontend Configuration for Production

### Update API URL

Create `client/.env.production`:
```env
VITE_API_URL=https://your-backend-url.com
```

Update `client/vite.config.js`:
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

Or update API calls in components to use `import.meta.env.VITE_API_URL`.

---

## Environment Variables

### Backend (.env)
```env
ANTHROPIC_API_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
SUPABASE_ANON_KEY=your_key
PORT=3001
NODE_ENV=production
```

### Frontend (.env.production)
```env
VITE_API_URL=https://your-backend-url.com
```

---

## Security Considerations

1. **Never commit `.env` files** - Already in `.gitignore`
2. **Use AWS Secrets Manager** or **Parameter Store** for production secrets
3. **Enable HTTPS** everywhere (CloudFront, ALB, or Let's Encrypt)
4. **Set up CORS** properly in backend (already configured)
5. **Use IAM roles** instead of access keys when possible
6. **Enable CloudWatch logging** for monitoring

---

## Monitoring & Logging

### CloudWatch Setup:

1. **Backend logs**:
   - Elastic Beanstalk: Automatic
   - ECS: Configure log driver in task definition
   - EC2: Install CloudWatch agent

2. **Set up alarms** for:
   - High CPU usage
   - High memory usage
   - Error rates
   - API response times

---

## Cost Optimization

1. **Use S3 + CloudFront** for frontend (cheaper than EC2)
2. **Use Elastic Beanstalk** free tier initially
3. **Right-size EC2 instances** based on actual usage
4. **Enable auto-scaling** to scale down during low traffic
5. **Use Reserved Instances** for predictable workloads

---

## CI/CD Setup (Optional)

### GitHub Actions Example:

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Elastic Beanstalk
        uses: einaregilsson/beanstalk-deploy@v20
        with:
          aws_access_key: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws_secret_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          application_name: course-builder-api
          environment_name: course-builder-prod
          version_label: ${{ github.sha }}
          region: us-east-1
          deployment_package: server.zip

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '20'
      - name: Build
        run: |
          cd client
          npm install
          npm run build
      - name: Deploy to S3
        run: |
          aws s3 sync client/dist/ s3://course-builder-frontend --delete
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

---

## Troubleshooting

### Backend Issues:

1. **Check logs**:
   - Elastic Beanstalk: `eb logs`
   - ECS: CloudWatch Logs
   - EC2: `pm2 logs` or `/var/log/`

2. **Verify environment variables** are set correctly

3. **Check Supabase connection**:
   ```bash
   curl https://your-backend-url.com/api/test-storage
   ```

### Frontend Issues:

1. **Check API URL** is correct in production build
2. **Verify CORS** settings allow your frontend domain
3. **Check browser console** for errors
4. **Verify S3 bucket** has correct permissions (public read)

---

## Quick Start (Recommended Path)

1. **Backend**: Deploy to Elastic Beanstalk (easiest)
2. **Frontend**: Build and deploy to S3 + CloudFront
3. **Update frontend** API URL to point to backend
4. **Test** the full application
5. **Set up monitoring** and alerts

---

## Next Steps

1. Choose your deployment option
2. Follow the specific steps for that option
3. Set up monitoring and alerts
4. Configure custom domain (optional)
5. Set up CI/CD pipeline (optional)

For questions or issues, refer to AWS documentation or check the troubleshooting section above.
