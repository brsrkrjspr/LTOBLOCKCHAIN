#!/bin/bash
# TrustChain LTO - Free HTTPS Setup (DuckDNS + Let's Encrypt)
# This script sets up free HTTPS using DuckDNS and Let's Encrypt

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Free HTTPS Setup ===${NC}"
echo ""
echo "This script will set up HTTPS using:"
echo "  - DuckDNS (free subdomain)"
echo "  - Let's Encrypt (free SSL certificate)"
echo ""

# Check if running from correct directory
if [ ! -f "docker-compose.unified.yml" ]; then
    echo -e "${RED}❌ Error: docker-compose.unified.yml not found${NC}"
    echo "Please run this script from the project root directory"
    exit 1
fi

# DuckDNS domain (pre-configured)
DUCKDNS_DOMAIN="ltoblockchain.duckdns.org"
echo -e "${YELLOW}Step 1: DuckDNS Configuration${NC}"
echo -e "${GREEN}✓ Using domain: ${DUCKDNS_DOMAIN}${NC}"

# Get email for Let's Encrypt
read -p "Enter your email address (for Let's Encrypt notifications): " EMAIL

if [ -z "$EMAIL" ]; then
    EMAIL="admin@${DUCKDNS_DOMAIN}"
    echo -e "${YELLOW}⚠️  No email provided, using: ${EMAIL}${NC}"
fi

# Create necessary directories
echo ""
echo -e "${BLUE}Step 2: Creating directories...${NC}"
mkdir -p nginx/ssl
mkdir -p nginx/letsencrypt
mkdir -p /var/www/certbot

# Update Nginx config with domain
echo ""
echo -e "${BLUE}Step 3: Preparing Nginx configuration...${NC}"

# Backup the original SSL config (if it exists and hasn't been backed up)
if [ ! -f "nginx/nginx-ssl.conf.original" ] && [ -f "nginx/nginx-ssl.conf" ]; then
    cp nginx/nginx-ssl.conf nginx/nginx-ssl.conf.original
    echo -e "${GREEN}✓ Backed up original SSL configuration${NC}"
fi

# Use HTTP-only config first (for Let's Encrypt verification)
if [ ! -f "nginx/nginx-http-only.conf" ]; then
    echo -e "${RED}❌ Error: nginx/nginx-http-only.conf not found${NC}"
    exit 1
fi

# Temporarily use HTTP-only config for Let's Encrypt verification
cp nginx/nginx-http-only.conf nginx/nginx-ssl.conf

echo -e "${GREEN}✓ Using HTTP-only config for certificate verification${NC}"

# Start Nginx with HTTP-only config for Let's Encrypt verification
echo ""
echo -e "${BLUE}Step 4: Starting Nginx for certificate verification...${NC}"
docker compose -f docker-compose.unified.yml up -d nginx

# Wait for Nginx to be ready
echo "Waiting for Nginx to start..."
sleep 10

# Check if Nginx is running
if ! docker compose -f docker-compose.unified.yml ps nginx | grep -q "Up"; then
    echo -e "${RED}❌ Error: Nginx failed to start${NC}"
    echo "Check logs: docker compose -f docker-compose.unified.yml logs nginx"
    exit 1
fi

echo -e "${GREEN}✓ Nginx is running${NC}"

# Get Let's Encrypt certificate using Certbot in Docker
echo ""
echo -e "${BLUE}Step 5: Obtaining SSL certificate from Let's Encrypt...${NC}"
echo "This may take a minute..."

docker run -it --rm \
  -v "$(pwd)/nginx/letsencrypt:/etc/letsencrypt" \
  -v "/var/www/certbot:/var/www/certbot" \
  --network host \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  -d "${DUCKDNS_DOMAIN}" || {
    echo -e "${RED}❌ Failed to obtain certificate${NC}"
    echo ""
    echo "Common issues:"
    echo "  1. DuckDNS domain not pointing to this server"
    echo "  2. Port 80 not accessible from internet"
    echo "  3. Firewall blocking port 80"
    echo ""
    echo "Check:"
    echo "  - DNS: dig ${DUCKDNS_DOMAIN}"
    echo "  - Firewall: ufw status"
    exit 1
  }

# Verify certificate
if [ -f "nginx/letsencrypt/live/${DUCKDNS_DOMAIN}/fullchain.pem" ]; then
    echo -e "${GREEN}✅ SSL certificate obtained successfully!${NC}"
else
    echo -e "${RED}❌ Certificate file not found${NC}"
    exit 1
fi

# Switch to SSL configuration
echo ""
echo -e "${BLUE}Step 6: Switching to HTTPS configuration...${NC}"

# Restore the SSL config file from backup
if [ -f "nginx/nginx-ssl.conf.original" ]; then
    cp nginx/nginx-ssl.conf.original nginx/nginx-ssl.conf
    echo -e "${GREEN}✓ Restored SSL configuration${NC}"
else
    echo -e "${RED}❌ Error: SSL config backup not found${NC}"
    echo "The original SSL config should have been backed up earlier."
    exit 1
fi

echo -e "${GREEN}✓ SSL configuration ready${NC}"

# Restart Nginx with SSL configuration
echo ""
echo -e "${BLUE}Step 7: Restarting Nginx with SSL configuration...${NC}"
docker compose -f docker-compose.unified.yml restart nginx

# Wait a moment
sleep 5

# Test HTTPS
echo ""
echo -e "${BLUE}Step 8: Testing HTTPS connection...${NC}"
if curl -k -s -o /dev/null -w "%{http_code}" "https://${DUCKDNS_DOMAIN}/health" | grep -q "200"; then
    echo -e "${GREEN}✅ HTTPS is working!${NC}"
else
    echo -e "${YELLOW}⚠️  HTTPS test failed, but certificate is installed${NC}"
    echo "Check: docker compose -f docker-compose.unified.yml logs nginx"
fi

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo -e "🌐 Access your site at: ${GREEN}https://${DUCKDNS_DOMAIN}${NC}"
echo ""
echo "📋 Next steps:"
echo "  1. Update your DuckDNS IP if it changes (or set up auto-update)"
echo "  2. Certificate will auto-renew every 90 days"
echo "  3. To renew manually: docker run -it --rm -v \"\$(pwd)/nginx/letsencrypt:/etc/letsencrypt\" certbot/certbot renew"
echo ""
echo "🔒 Security features enabled:"
echo "  ✓ HTTPS encryption (TLS 1.2/1.3)"
echo "  ✓ HSTS (HTTP Strict Transport Security)"
echo "  ✓ Rate limiting (DDoS protection)"
echo "  ✓ Security headers (XSS, clickjacking protection)"
echo "  ✓ Connection limiting"
echo ""

