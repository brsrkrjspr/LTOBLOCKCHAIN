#!/bin/bash
# TrustChain LTO - Verify Database Passwords
# Checks all password configurations to find mismatches

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Password Verification Report ===${NC}"
echo ""

# 1. Check .env file
echo -e "${YELLOW}1. .env File (on host):${NC}"
if [ -f ".env" ]; then
    POSTGRES_PASSWORD_ENV=$(grep "^POSTGRES_PASSWORD=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "")
    if [ -n "$POSTGRES_PASSWORD_ENV" ]; then
        echo -e "   ${GREEN}✅ Found: POSTGRES_PASSWORD=${POSTGRES_PASSWORD_ENV:0:10}...${NC}"
    else
        echo -e "   ${RED}❌ POSTGRES_PASSWORD not found in .env${NC}"
    fi
else
    echo -e "   ${YELLOW}⚠️  .env file not found${NC}"
fi

# 2. Check PostgreSQL container environment
echo ""
echo -e "${YELLOW}2. PostgreSQL Container Environment:${NC}"
POSTGRES_CONTAINER_PASSWORD=$(docker exec postgres env 2>/dev/null | grep "^POSTGRES_PASSWORD=" | cut -d'=' -f2 || echo "")
if [ -n "$POSTGRES_CONTAINER_PASSWORD" ]; then
    echo -e "   ${GREEN}✅ POSTGRES_PASSWORD=${POSTGRES_CONTAINER_PASSWORD:0:10}...${NC}"
else
    echo -e "   ${RED}❌ Could not read PostgreSQL container password${NC}"
fi

# 3. Check Application container environment
echo ""
echo -e "${YELLOW}3. Application Container Environment:${NC}"
APP_DB_PASSWORD=$(docker exec lto-app env 2>/dev/null | grep "^DB_PASSWORD=" | cut -d'=' -f2 || echo "")
if [ -n "$APP_DB_PASSWORD" ]; then
    echo -e "   ${GREEN}✅ DB_PASSWORD=${APP_DB_PASSWORD:0:10}...${NC}"
else
    echo -e "   ${RED}❌ Could not read application container DB_PASSWORD${NC}"
fi

# 4. Check docker-compose configuration
echo ""
echo -e "${YELLOW}4. docker-compose.unified.yml Configuration:${NC}"
COMPOSE_POSTGRES_PASSWORD=$(grep "POSTGRES_PASSWORD" docker-compose.unified.yml | head -1 | grep -o '\${POSTGRES_PASSWORD:-[^}]*}' | cut -d':' -f2 | cut -d'}' -f1 || echo "lto_password")
COMPOSE_DB_PASSWORD=$(grep "DB_PASSWORD" docker-compose.unified.yml | head -1 | grep -o '\${POSTGRES_PASSWORD:-[^}]*}' | cut -d':' -f2 | cut -d'}' -f1 || echo "lto_password")
echo -e "   PostgreSQL default: ${COMPOSE_POSTGRES_PASSWORD}"
echo -e "   Application default: ${COMPOSE_DB_PASSWORD}"

# 5. Compare passwords
echo ""
echo -e "${BLUE}=== Comparison ===${NC}"
if [ -n "$POSTGRES_CONTAINER_PASSWORD" ] && [ -n "$APP_DB_PASSWORD" ]; then
    if [ "$POSTGRES_CONTAINER_PASSWORD" = "$APP_DB_PASSWORD" ]; then
        echo -e "${GREEN}✅ PASSWORDS MATCH!${NC}"
        echo -e "   PostgreSQL: ${POSTGRES_CONTAINER_PASSWORD:0:10}..."
        echo -e "   Application: ${APP_DB_PASSWORD:0:10}..."
    else
        echo -e "${RED}❌ PASSWORDS DO NOT MATCH!${NC}"
        echo -e "   PostgreSQL uses: ${POSTGRES_CONTAINER_PASSWORD:0:10}..."
        echo -e "   Application uses: ${APP_DB_PASSWORD:0:10}..."
        echo ""
        echo -e "${YELLOW}⚠️  This is why login is failing!${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Could not compare (missing values)${NC}"
fi

# 6. Test actual connection
echo ""
echo -e "${BLUE}=== Connection Test ===${NC}"
echo -e "${YELLOW}Testing database connection from application...${NC}"
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
    echo -e "${GREEN}✅ Connection test passed!${NC}"
} || {
    echo -e "${RED}❌ Connection test failed${NC}"
}

echo ""
echo -e "${BLUE}=== Summary ===${NC}"
echo "To fix password mismatch:"
echo "  1. Ensure .env file has: POSTGRES_PASSWORD=your_password"
echo "  2. Restart containers: docker compose -f docker-compose.unified.yml restart"
echo "  3. Verify passwords match using this script"

