#!/bin/bash
# TrustChain LTO - Reset PostgreSQL Password
# Resets PostgreSQL password to match docker-compose configuration

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Resetting PostgreSQL Password ===${NC}"
echo ""

# Check if PostgreSQL is running
if ! docker compose -f docker-compose.unified.yml ps postgres | grep -q "Up"; then
    echo -e "${RED}❌ PostgreSQL container is not running${NC}"
    exit 1
fi

PASSWORD="lto_password"

echo -e "${YELLOW}Resetting password for user 'lto_user' to 'lto_password'...${NC}"

# Try multiple methods to reset password
echo -e "${BLUE}Method 1: Using postgres superuser...${NC}"
docker exec postgres psql -U postgres -c "ALTER USER lto_user WITH PASSWORD '${PASSWORD}';" 2>/dev/null && {
    echo -e "${GREEN}✅ Password reset successful!${NC}"
} || {
    echo -e "${YELLOW}Method 1 failed, trying Method 2...${NC}"
    
    # Method 2: Connect via psql and update
    docker exec -i postgres psql -U postgres <<EOF 2>/dev/null && {
        ALTER USER lto_user WITH PASSWORD '${PASSWORD}';
EOF
        echo -e "${GREEN}✅ Password reset successful!${NC}"
    } || {
        echo -e "${YELLOW}Method 2 failed, trying Method 3 (recreate container)...${NC}"
        
        # Method 3: Stop, remove container, restart (keeps data volume)
        echo -e "${BLUE}Stopping PostgreSQL...${NC}"
        docker compose -f docker-compose.unified.yml stop postgres
        
        echo -e "${BLUE}Removing container (data volume preserved)...${NC}"
        docker compose -f docker-compose.unified.yml rm -f postgres
        
        echo -e "${BLUE}Starting PostgreSQL with correct password...${NC}"
        docker compose -f docker-compose.unified.yml up -d postgres
        
        echo -e "${BLUE}Waiting for PostgreSQL to initialize...${NC}"
        sleep 15
        
        echo -e "${GREEN}✅ PostgreSQL restarted${NC}"
    }
}

# Wait a moment
sleep 3

# Test connection
echo ""
echo -e "${BLUE}Testing database connection...${NC}"
docker exec lto-app node -e "
const db = require('./backend/database/db');
db.testConnection().then(result => {
    if (result) {
        console.log('✅ Database connection successful!');
        process.exit(0);
    } else {
        console.log('❌ Database connection failed');
        process.exit(1);
    }
}).catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
" && {
    echo ""
    echo -e "${GREEN}=== Password Reset Complete ===${NC}"
    echo -e "${GREEN}✅ PostgreSQL password is now: lto_password${NC}"
    echo -e "${GREEN}✅ Application can connect to database${NC}"
    echo ""
    echo -e "${BLUE}You can now try logging in again${NC}"
} || {
    echo ""
    echo -e "${RED}❌ Database connection still failing${NC}"
    echo -e "${YELLOW}Check PostgreSQL logs:${NC}"
    echo "  docker compose -f docker-compose.unified.yml logs postgres"
    exit 1
}

