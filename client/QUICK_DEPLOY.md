# Quick Deploy to EC2 - Get It Running Now!

## Your EC2 Instance Details
- **Public IP**: 98.86.116.222
- **Public DNS**: ec2-98-86-116-222.compute-1.amazonaws.com
- **Instance**: i-0a6446d7de46e8385 (course-builder-prod)

## Step 1: Set Your Backend API URL

```bash
# If your backend is on the same EC2 instance:
export VITE_API_URL=http://98.86.116.222:3001

# Or if your backend is elsewhere:
export VITE_API_URL=https://your-backend-api-url.com

# If you don't have a backend yet, you can still deploy (will show errors but app will load):
export VITE_API_URL=http://localhost:3001
```

## Step 2: Build the Application

```bash
cd /Users/mahirbansal/src/mercorboard/client
npm run build
```

## Step 3: Deploy to EC2

### Option A: Using the Deployment Script (Easiest)

**First, make sure you can SSH to your EC2 instance:**

```bash
# Test SSH connection (you'll need your EC2 key file)
ssh -i /path/to/your-key.pem ec2-user@98.86.116.222

# If that works, deploy:
export VITE_API_URL=http://98.86.116.222:3001  # or your backend URL
./deploy-ec2.sh 98.86.116.222 static
```

### Option B: Manual Deployment (If SSH works but script doesn't)

```bash
# 1. Build (already done above)
npm run build

# 2. Copy files to EC2
rsync -avz --delete -e "ssh -i /path/to/your-key.pem" \
  dist/ ec2-user@98.86.116.222:/var/www/mercorboard/

# 3. SSH to EC2 and setup nginx
ssh -i /path/to/your-key.pem ec2-user@98.86.116.222

# On the EC2 instance, run:
sudo yum update -y
sudo yum install -y nginx
sudo mkdir -p /var/www/mercorboard
sudo chown ec2-user:ec2-user /var/www/mercorboard

# Create nginx config
sudo tee /etc/nginx/conf.d/mercorboard.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/mercorboard;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Test and start nginx
sudo nginx -t
sudo systemctl start nginx
sudo systemctl enable nginx

# Exit SSH
exit
```

### Option C: If SSH Doesn't Work (Security Group Issue)

1. **Go to AWS Console → EC2 → Security Groups**
2. **Find your instance's security group**
3. **Add inbound rule:**
   - Type: SSH
   - Port: 22
   - Source: Your IP address (or 0.0.0.0/0 for testing)
4. **Add inbound rule:**
   - Type: HTTP
   - Port: 80
   - Source: 0.0.0.0/0
5. **Try SSH again**

## Step 4: Access Your Application

Once deployed, visit:
```
http://98.86.116.222
```

## Troubleshooting

### Can't SSH?
1. Check security group allows SSH (port 22) from your IP
2. Make sure you have the correct .pem key file
3. Try: `ssh -v -i /path/to/key.pem ec2-user@98.86.116.222` for verbose output

### App not loading?
1. Check security group allows HTTP (port 80)
2. SSH to instance and check nginx: `sudo systemctl status nginx`
3. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`

### Need to find your SSH key?
- Check AWS Console → EC2 → Key Pairs
- Or check your local `~/.ssh/` directory

## Quick Test Commands

```bash
# Test if port 80 is open
curl http://98.86.116.222

# Test SSH
ssh -i /path/to/key.pem ec2-user@98.86.116.222 "echo 'Connected!'"

# Check what's running on EC2 (after SSH)
sudo systemctl status nginx
sudo docker ps  # if using Docker
```
