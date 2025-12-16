#!/bin/bash
# TrustChain LTO - Diagnose 502 Bad Gateway Error
# Checks why nginx cannot connect to lto-app backend

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

echo -e "${BLUE}=== Diagnosing 502 Bad Gateway Error ===${NC}"
echo ""

# 1. Check if lto-app container is running
log_info "1. Checking lto-app container status..."
if docker compose -f docker-compose.unified.yml ps lto-app | grep -q "Up"; then
    log_success "lto-app container is running"
    docker compose -f docker-compose.unified.yml ps lto-app
else
    log_error "lto-app container is NOT running!"
    log_info "Start it with: docker compose -f docker-compose.unified.yml up -d lto-app"
    exit 1
fi
echo ""

# 2. Check if nginx container is running
log_info "2. Checking nginx container status..."
if docker compose -f docker-compose.unified.yml ps nginx | grep -q "Up"; then
    log_success "nginx container is running"
    docker compose -f docker-compose.unified.yml ps nginx
else
    log_error "nginx container is NOT running!"
    log_info "Start it with: docker compose -f docker-compose.unified.yml up -d nginx"
    exit 1
fi
echo ""

# 3. Check if lto-app is listening on port 3001
log_info "3. Checking if lto-app is listening on port 3001..."
if docker exec lto-app netstat -tuln 2>/dev/null | grep -q ":3001" || docker exec lto-app ss -tuln 2>/dev/null | grep -q ":3001"; then
    log_success "lto-app is listening on port 3001"
else
    log_error "lto-app is NOT listening on port 3001!"
    log_info "This means the application failed to start or crashed."
fi
echo ""

# 4. Test application health endpoint from inside lto-app
log_info "4. Testing application health endpoint from inside lto-app..."
if docker exec lto-app curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
    log_success "Application health endpoint responds correctly"
    docker exec lto-app curl -s http://localhost:3001/api/health | head -5
else
    log_error "Application health endpoint is NOT responding!"
    log_info "The application may have crashed or failed to start."
fi
echo ""

# 5. Check application logs for errors
log_info "5. Checking recent application logs for errors..."
ERROR_COUNT=$(docker compose -f docker-compose.unified.yml logs lto-app --tail=50 2>&1 | grep -i "error\|fatal\|crash\|exit" | wc -l)
if [ "$ERROR_COUNT" -gt 0 ]; then
    log_warn "Found $ERROR_COUNT potential errors in recent logs:"
    docker compose -f docker-compose.unified.yml logs lto-app --tail=50 | grep -i "error\|fatal\|crash\|exit" | head -10
else
    log_success "No obvious errors in recent logs"
fi
echo ""

# 6. Test network connectivity from nginx to lto-app
log_info "6. Testing network connectivity from nginx to lto-app..."
if docker exec nginx ping -c 2 lto-app > /dev/null 2>&1; then
    log_success "Network connectivity: nginx can reach lto-app container"
else
    log_error "Network connectivity: nginx CANNOT reach lto-app container!"
    log_info "This suggests a Docker network issue."
fi
echo ""

# 7. Test HTTP connection from nginx to lto-app:3001
log_info "7. Testing HTTP connection from nginx to lto-app:3001..."
if docker exec nginx wget -q --spider --timeout=5 http://lto-app:3001/api/health 2>&1 || docker exec nginx curl -s -f --max-time 5 http://lto-app:3001/api/health > /dev/null 2>&1; then
    log_success "HTTP connection: nginx can connect to lto-app:3001"
else
    log_error "HTTP connection: nginx CANNOT connect to lto-app:3001!"
    log_info "This is the root cause of the 502 error."
fi
echo ""

# 8. Check nginx error logs
log_info "8. Checking nginx error logs..."
if docker exec nginx test -f /var/log/nginx/error.log; then
    ERROR_LOG_COUNT=$(docker exec nginx tail -20 /var/log/nginx/error.log 2>/dev/null | grep -i "502\|bad gateway\|upstream\|connect" | wc -l)
    if [ "$ERROR_LOG_COUNT" -gt 0 ]; then
        log_warn "Found $ERROR_LOG_COUNT relevant errors in nginx error log:"
        docker exec nginx tail -20 /var/log/nginx/error.log 2>/dev/null | grep -i "502\|bad gateway\|upstream\|connect" | head -5
    else
        log_success "No 502-related errors in nginx error log"
    fi
else
    log_warn "nginx error log not found or not accessible"
fi
echo ""

# 9. Check if both containers are on the same network
log_info "9. Checking Docker network configuration..."
NGINX_NETWORK=$(docker inspect nginx --format '{{range $net, $conf := .NetworkSettings.Networks}}{{$net}}{{end}}')
LTO_APP_NETWORK=$(docker inspect lto-app --format '{{range $net, $conf := .NetworkSettings.Networks}}{{$net}}{{end}}')
if [ "$NGINX_NETWORK" == "$LTO_APP_NETWORK" ]; then
    log_success "Both containers are on the same network: $NGINX_NETWORK"
else
    log_error "Containers are on different networks!"
    log_info "nginx network: $NGINX_NETWORK"
    log_info "lto-app network: $LTO_APP_NETWORK"
fi
echo ""

# 10. Summary and recommendations
echo -e "${BLUE}=== Summary ===${NC}"
echo ""
log_info "Most common causes of 502 Bad Gateway:"
echo "  1. Application container crashed or failed to start"
echo "  2. Application not listening on port 3001"
echo "  3. Network connectivity issue between nginx and lto-app"
echo "  4. Application taking too long to respond (timeout)"
echo ""
log_info "Recommended actions:"
echo "  1. Check application logs: docker compose -f docker-compose.unified.yml logs lto-app --tail=100"
echo "  2. Restart application: docker compose -f docker-compose.unified.yml restart lto-app"
echo "  3. Check if application is healthy: docker exec lto-app curl http://localhost:3001/api/health"
echo "  4. Restart nginx: docker compose -f docker-compose.unified.yml restart nginx"
echo "  5. Restart entire stack: docker compose -f docker-compose.unified.yml restart"
echo ""

