#!/bin/bash
# TrustChain LTO - Check All Services Status
# Comprehensive service status check for all Docker Compose services

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_service() { echo -e "${CYAN}[SERVICE]${NC} $1"; }

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     TrustChain LTO - Service Status Check                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

COMPOSE_FILE="docker-compose.unified.yml"

# Check if docker-compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
    log_error "docker-compose.unified.yml not found!"
    exit 1
fi

# 1. Check Docker Compose Services Status
log_info "=== 1. Docker Compose Services Status ==="
echo ""

docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || {
    log_error "Failed to get Docker Compose status. Is Docker running?"
    exit 1
}

echo ""

# 2. Check Individual Services
log_info "=== 2. Individual Service Health Checks ==="
echo ""

# Function to check service
check_service() {
    local service_name=$1
    local check_command=$2
    local description=$3
    
    log_service "Checking: $description ($service_name)"
    
    if docker compose -f "$COMPOSE_FILE" ps "$service_name" | grep -q "Up"; then
        log_success "  ✅ Container is running"
        
        # Run custom check if provided
        if [ -n "$check_command" ]; then
            if eval "$check_command" > /dev/null 2>&1; then
                log_success "  ✅ Service is healthy"
            else
                log_warn "  ⚠️  Service check failed (container running but service may not be ready)"
            fi
        fi
    else
        log_error "  ❌ Container is NOT running"
    fi
    echo ""
}

# Check PostgreSQL
check_service "postgres" \
    "docker exec postgres pg_isready -U lto_user -d lto_blockchain" \
    "PostgreSQL Database"

# Check IPFS
check_service "ipfs" \
    "docker exec ipfs sh -c 'ipfs id > /dev/null 2>&1 || curl -f -s -X POST http://localhost:5001/api/v0/version > /dev/null'" \
    "IPFS Document Storage"

# Check Application
check_service "lto-app" \
    "docker exec lto-app curl -s http://localhost:3001/api/health > /dev/null" \
    "LTO Application (Node.js)"

# Check Nginx
check_service "nginx" \
    "docker exec nginx nginx -t > /dev/null 2>&1" \
    "Nginx Reverse Proxy"

# Check Hyperledger Fabric Orderer
check_service "orderer.lto.gov.ph" \
    "" \
    "Hyperledger Fabric Orderer"

# Check Hyperledger Fabric Peer
check_service "peer0.lto.gov.ph" \
    "" \
    "Hyperledger Fabric Peer"

# Check CouchDB
check_service "couchdb" \
    "docker exec couchdb curl -s http://localhost:5984 > /dev/null" \
    "CouchDB (Fabric State Database)"

echo ""

# 3. Check Service Connectivity
log_info "=== 3. Service Connectivity Tests ==="
echo ""

# Test PostgreSQL connection from application
log_service "Testing PostgreSQL connection from application..."
if docker exec lto-app node -e "
const db = require('./backend/database/db');
db.testConnection().then(result => {
    console.log(result ? 'OK' : 'FAILED');
    process.exit(result ? 0 : 1);
}).catch(err => {
    console.log('FAILED');
    process.exit(1);
});
" > /dev/null 2>&1; then
    log_success "  ✅ Application can connect to PostgreSQL"
else
    log_error "  ❌ Application cannot connect to PostgreSQL"
fi
echo ""

# Test IPFS connection from application
log_service "Testing IPFS connection from application..."
if docker exec lto-app node -e "
const http = require('http');
const options = {
    hostname: 'ipfs',
    port: 5001,
    path: '/api/v0/version',
    method: 'POST',
    timeout: 2000
};
const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
        console.log('OK');
        process.exit(0);
    } else {
        console.log('FAILED');
        process.exit(1);
    }
});
req.on('error', () => {
    console.log('FAILED');
    process.exit(1);
});
req.on('timeout', () => {
    req.destroy();
    console.log('FAILED');
    process.exit(1);
});
req.end();
" > /dev/null 2>&1; then
    log_success "  ✅ Application can connect to IPFS"
else
    log_error "  ❌ Application cannot connect to IPFS"
fi
echo ""

# Test Fabric connection from application
log_service "Testing Hyperledger Fabric connection from application..."
if docker exec lto-app node -e "
const fabricService = require('./backend/services/optimizedFabricService');
fabricService.initialize().then(() => {
    if (fabricService.isConnected) {
        console.log('OK');
        process.exit(0);
    } else {
        console.log('FAILED');
        process.exit(1);
    }
}).catch(() => {
    console.log('FAILED');
    process.exit(1);
});
" > /dev/null 2>&1; then
    log_success "  ✅ Application can connect to Hyperledger Fabric"
else
    log_warn "  ⚠️  Application cannot connect to Hyperledger Fabric (may need wallet setup)"
fi
echo ""

# 4. Check Resource Usage
log_info "=== 4. Resource Usage ==="
echo ""

docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null | head -10
echo ""

# 5. Check Port Availability
log_info "=== 5. Port Availability ==="
echo ""

check_port() {
    local port=$1
    local service=$2
    
    if netstat -tuln 2>/dev/null | grep -q ":$port " || ss -tuln 2>/dev/null | grep -q ":$port "; then
        log_success "  ✅ Port $port is in use ($service)"
    else
        log_warn "  ⚠️  Port $port is not in use ($service)"
    fi
}

check_port "80" "HTTP (Nginx)"
check_port "443" "HTTPS (Nginx)"
check_port "3001" "Application (internal)"
check_port "5432" "PostgreSQL (internal)"
check_port "5001" "IPFS API (internal)"
check_port "8080" "IPFS Gateway (internal)"
check_port "7050" "Fabric Orderer (internal)"
check_port "7051" "Fabric Peer (internal)"
check_port "5984" "CouchDB (internal)"

echo ""

# 6. Check Environment Variables
log_info "=== 6. Critical Environment Variables ==="
echo ""

check_env_var() {
    local var_name=$1
    local container=$2
    
    local value=$(docker exec "$container" printenv "$var_name" 2>/dev/null || echo "NOT_SET")
    
    if [ "$value" != "NOT_SET" ] && [ -n "$value" ]; then
        # Mask sensitive values
        if [[ "$var_name" == *"PASSWORD"* ]] || [[ "$var_name" == *"SECRET"* ]]; then
            log_success "  ✅ $var_name is set (${value:0:10}...)"
        else
            log_success "  ✅ $var_name = $value"
        fi
    else
        log_warn "  ⚠️  $var_name is not set"
    fi
}

if docker compose -f "$COMPOSE_FILE" ps lto-app | grep -q "Up"; then
    log_service "Application Container Environment:"
    check_env_var "STORAGE_MODE" "lto-app"
    check_env_var "BLOCKCHAIN_MODE" "lto-app"
    check_env_var "DB_HOST" "lto-app"
    check_env_var "DB_NAME" "lto-app"
    check_env_var "NODE_ENV" "lto-app"
    echo ""
fi

# 7. Summary
log_info "=== 7. Summary ==="
echo ""

# Count running containers
RUNNING_COUNT=$(docker compose -f "$COMPOSE_FILE" ps --format json 2>/dev/null | grep -c '"State":"running"' || echo "0")
TOTAL_COUNT=$(docker compose -f "$COMPOSE_FILE" config --services 2>/dev/null | wc -l)

log_info "Running containers: $RUNNING_COUNT / $TOTAL_COUNT"

if [ "$RUNNING_COUNT" -eq "$TOTAL_COUNT" ]; then
    log_success "✅ All services are running!"
else
    log_warn "⚠️  Some services are not running. Check the status above."
fi

echo ""
log_info "=== Quick Commands ==="
echo ""
echo "  View logs:        docker compose -f $COMPOSE_FILE logs [service_name]"
echo "  Restart service:  docker compose -f $COMPOSE_FILE restart [service_name]"
echo "  Start all:        docker compose -f $COMPOSE_FILE up -d"
echo "  Stop all:         docker compose -f $COMPOSE_FILE down"
echo ""

