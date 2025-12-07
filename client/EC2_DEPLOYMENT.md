# EC2 Deployment Guide

This guide covers deploying the Mercorboard client to an EC2 instance.

## Prerequisites

- EC2 instance running (Amazon Linux, Ubuntu, or similar)
- SSH access to EC2 instance
- AWS CLI configured (for some operations)
- Node.js 20+ installed locally
- Docker installed locally (if using Docker deployment)

## Quick Start

### 1. Set Environment Variables

```bash
export VITE_API_URL=https://your-backend-api-url.com
export EC2_HOST=ec2-123-45-67-89.compute-1.amazonaws.com
export EC2_USER=ec2-user  # or 'ubuntu' for Ubuntu instances
```

### 2. Deploy

**Option A: Static Files (nginx) - Recommended**
```bash
chmod +x deploy-ec2.sh
./deploy-ec2.sh $EC2_HOST static
```

**Option B: Docker**
```bash
chmod +x deploy-ec2.sh
./deploy-ec2.sh $EC2_HOST docker
```

**Option C: Both**
```bash
./deploy-ec2.sh $EC2_HOST both
```

---

## Deployment Methods

### Method 1: Static Files with nginx (Recommended)

This method deploys the built static files to your EC2 instance and serves them with nginx.

**Advantages:**
- Lightweight and fast
- Easy to update
- Low resource usage
- Standard web server setup

**Steps:**

1. **Set your API URL:**
   ```bash
   export VITE_API_URL=https://your-backend-api-url.com
   ```

2. **Deploy:**
   ```bash
   ./deploy-ec2.sh your-ec2-host.compute-1.amazonaws.com static
   ```

3. **The script will:**
   - Build your application locally
   - Install nginx on EC2 (if not installed)
   - Copy files to `/var/www/mercorboard`
   - Configure nginx with SPA routing
   - Start/restart nginx

4. **Access your app:**
   ```
   http://your-ec2-public-ip
   ```

---

### Method 2: Docker Deployment

This method builds a Docker image and runs it on your EC2 instance.

**Advantages:**
- Consistent environment
- Easy to rollback
- Isolated from host system
- Can run multiple versions

**Steps:**

1. **Set your API URL:**
   ```bash
   export VITE_API_URL=https://your-backend-api-url.com
   ```

2. **Deploy:**
   ```bash
   ./deploy-ec2.sh your-ec2-host.compute-1.amazonaws.com docker
   ```

3. **The script will:**
   - Build Docker image locally
   - Copy image to EC2
   - Install Docker on EC2 (if not installed)
   - Load and run the container
   - Expose on port 80

4. **Access your app:**
   ```
   http://your-ec2-public-ip
   ```

---

## EC2 Instance Setup

### Initial EC2 Setup

If you're setting up a new EC2 instance:

1. **Launch EC2 Instance:**
   - Choose Amazon Linux 2023 or Ubuntu 22.04 LTS
   - Instance type: t3.micro or t3.small (sufficient for static files)
   - Configure security group to allow:
     - SSH (port 22) from your IP
     - HTTP (port 80) from anywhere (0.0.0.0/0)
     - HTTPS (port 443) from anywhere (if using SSL)

2. **Connect to Instance:**
   ```bash
   ssh -i your-key.pem ec2-user@your-ec2-public-ip
   # or for Ubuntu:
   ssh -i your-key.pem ubuntu@your-ec2-public-ip
   ```

3. **Configure SSH Key (if needed):**
   ```bash
   # Add your public key to ~/.ssh/authorized_keys on EC2
   # Or use SSH agent forwarding
   ssh-add your-key.pem
   ```

### Security Group Configuration

Ensure your EC2 security group allows:
- **Inbound:**
  - SSH (22) from your IP
  - HTTP (80) from 0.0.0.0/0
  - HTTPS (443) from 0.0.0.0/0 (if using SSL)

---

## Manual Deployment (Alternative)

If you prefer manual deployment:

### Static Files Method

```bash
# 1. Build locally
export VITE_API_URL=https://your-api-url.com
npm run build

# 2. Copy to EC2
rsync -avz --delete dist/ ec2-user@your-ec2-host:/var/www/mercorboard/

# 3. SSH to EC2 and setup nginx
ssh ec2-user@your-ec2-host

# On EC2:
sudo yum install -y nginx  # Amazon Linux
# or
sudo apt-get update && sudo apt-get install -y nginx  # Ubuntu

# Copy nginx config
sudo cp nginx.conf /etc/nginx/conf.d/mercorboard.conf

# Update root path in nginx.conf to /var/www/mercorboard
sudo sed -i 's|/usr/share/nginx/html|/var/www/mercorboard|g' /etc/nginx/conf.d/mercorboard.conf

# Test and restart
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Docker Method

```bash
# 1. Build image locally
docker build -t mercorboard-client:latest --build-arg VITE_API_URL=https://your-api-url.com .

# 2. Save and copy
docker save mercorboard-client:latest | gzip > mercorboard.tar.gz
scp mercorboard.tar.gz ec2-user@your-ec2-host:/tmp/

# 3. SSH to EC2
ssh ec2-user@your-ec2-host

# On EC2:
sudo yum install -y docker  # Amazon Linux
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Load and run
gunzip -c /tmp/mercorboard.tar.gz | sudo docker load
sudo docker run -d --name mercorboard-client -p 80:80 --restart unless-stopped mercorboard-client:latest
```

---

## Environment Variables

The application requires `VITE_API_URL` to be set during build time.

**For static deployment:**
```bash
export VITE_API_URL=https://your-backend-api-url.com
npm run build
```

**For Docker deployment:**
```bash
docker build --build-arg VITE_API_URL=https://your-backend-api-url.com -t mercorboard-client .
```

---

## SSL/HTTPS Setup (Optional but Recommended)

### Using Let's Encrypt (Certbot)

```bash
# SSH to EC2
ssh ec2-user@your-ec2-host

# Install Certbot
sudo yum install -y certbot python3-certbot-nginx  # Amazon Linux
# or
sudo apt-get install -y certbot python3-certbot-nginx  # Ubuntu

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal (already configured by certbot)
sudo certbot renew --dry-run
```

### Using AWS Certificate Manager + Application Load Balancer

1. Request certificate in ACM
2. Create Application Load Balancer
3. Attach certificate to HTTPS listener
4. Point your domain to ALB

---

## Updating Deployment

### Quick Update

```bash
export VITE_API_URL=https://your-api-url.com
./deploy-ec2.sh your-ec2-host.compute-1.amazonaws.com static
```

### Docker Update

```bash
export VITE_API_URL=https://your-api-url.com
./deploy-ec2.sh your-ec2-host.compute-1.amazonaws.com docker
```

---

## Troubleshooting

### Cannot connect via SSH

1. Check security group allows SSH from your IP
2. Verify key pair is correct
3. Check EC2 instance is running
4. Verify public IP/DNS is correct

### Application not accessible

1. **Check nginx/Docker is running:**
   ```bash
   # For nginx
   ssh ec2-user@your-host
   sudo systemctl status nginx
   sudo nginx -t
   
   # For Docker
   sudo docker ps
   sudo docker logs mercorboard-client
   ```

2. **Check security group:**
   - Ensure port 80 (and 443 if using HTTPS) is open

3. **Check firewall:**
   ```bash
   # Amazon Linux
   sudo firewall-cmd --list-all
   
   # Ubuntu
   sudo ufw status
   ```

### API calls failing

1. Check `VITE_API_URL` was set correctly during build
2. Verify backend API is accessible from EC2
3. Check CORS settings on backend
4. Check browser console for errors

### 404 errors on routes

- For nginx: Ensure `try_files $uri $uri/ /index.html;` is in config
- For Docker: Verify nginx.conf is correct in Dockerfile

---

## Monitoring

### View Logs

**Nginx logs:**
```bash
ssh ec2-user@your-host
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

**Docker logs:**
```bash
ssh ec2-user@your-host
sudo docker logs -f mercorboard-client
```

### Health Check

```bash
curl http://your-ec2-host/health
# Should return: healthy
```

---

## Cost Optimization

- Use t3.micro or t3.small instances (free tier eligible)
- Static file deployment uses minimal resources
- Consider using EC2 Spot Instances for non-production
- Use CloudWatch for monitoring (free tier: 10 custom metrics)

---

## Next Steps

1. ✅ Deploy application
2. [ ] Set up custom domain
3. [ ] Configure SSL certificate
4. [ ] Set up monitoring and alerts
5. [ ] Configure automated backups
6. [ ] Set up CI/CD pipeline
7. [ ] Configure CloudWatch alarms

---

## Security Best Practices

1. **Keep EC2 instance updated:**
   ```bash
   sudo yum update -y  # Amazon Linux
   sudo apt-get update && sudo apt-get upgrade -y  # Ubuntu
   ```

2. **Use security groups:** Restrict SSH access to your IP only

3. **Enable HTTPS:** Use Let's Encrypt or ACM

4. **Regular backups:** Consider EBS snapshots

5. **Monitor access logs:** Review nginx/Docker logs regularly

6. **Use IAM roles:** Instead of storing AWS credentials on EC2

---

## Script Customization

You can customize the deployment script by setting environment variables:

```bash
export EC2_USER=ubuntu              # Default: ec2-user
export REMOTE_DIR=/var/www/app      # Default: /var/www/mercorboard
export DOCKER_IMAGE_NAME=my-app     # Default: mercorboard-client
```

Then run:
```bash
./deploy-ec2.sh your-host.com static
```
