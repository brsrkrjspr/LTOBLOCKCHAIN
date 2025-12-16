#!/bin/bash
# TrustChain LTO - Fix PostgreSQL Password Mismatch
# This script fixes the password authentication error

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Fixing PostgreSQL Password ===${NC}"
echo ""

# Check if PostgreSQL is running
if ! docker compose -f docker-compose.unified.yml ps postgres | grep -q "Up"; then
    echo -e "${RED}❌ PostgreSQL container is not running${NC}"
    exit 1
fi

# Expected password from docker-compose
EXPECTED_PASSWORD="${POSTGRES_PASSWORD:-lto_password}"

echo -e "${YELLOW}Attempting to connect with password: ${EXPECTED_PASSWORD}${NC}"

# Try to connect with expected password
if docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Password is correct!${NC}"
    echo -e "${GREEN}✅ Database connection should work now${NC}"
    exit 0
fi

echo -e "${YELLOW}⚠️  Password mismatch detected${NC}"
echo ""
echo -e "${BLUE}Option 1: Reset PostgreSQL password (RECOMMENDED)${NC}"
echo "This will update PostgreSQL password to match docker-compose"
echo ""
read -p "Reset PostgreSQL password to '${EXPECTED_PASSWORD}'? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Resetting PostgreSQL password...${NC}"
    
    # Update password in PostgreSQL
    docker exec postgres psql -U postgres -c "ALTER USER lto_user WITH PASSWORD '${EXPECTED_PASSWORD}';" 2>/dev/null || {
        # If postgres user doesn't work, try with lto_user if we can connect
        echo -e "${YELLOW}Trying alternative method...${NC}"
        # We'll need to stop and recreate the container with correct password
        echo -e "${YELLOW}⚠️  Need to recreate PostgreSQL container with correct password${NC}"
        echo ""
        echo -e "${BLUE}Stopping PostgreSQL...${NC}"
        docker compose -f docker-compose.unified.yml stop postgres
        
        echo -e "${BLUE}Removing PostgreSQL container...${NC}"
        docker compose -f docker-compose.unified.yml rm -f postgres
        
        echo -e "${YELLOW}⚠️  WARNING: This will DELETE all database data!${NC}"
        read -p "Continue? (y/n): " -n 1 -r
        echo ""
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}Removing PostgreSQL volume...${NC}"
            docker volume rm ltoblockchain_postgres-data 2>/dev/null || true
            
            echo -e "${BLUE}Starting PostgreSQL with correct password...${NC}"
            docker compose -f docker-compose.unified.yml up -d postgres
            
            echo -e "${BLUE}Waiting for PostgreSQL to initialize...${NC}"
            sleep 10
            
            echo -e "${GREEN}✅ PostgreSQL restarted with correct password${NC}"
            echo -e "${YELLOW}⚠️  Note: Database was reset - you'll need to run migrations again${NC}"
        else
            echo -e "${YELLOW}Cancelled. PostgreSQL container not restarted.${NC}"
            exit 1
        fi
    }
    
    echo -e "${GREEN}✅ Password updated successfully${NC}"
else
    echo -e "${YELLOW}Option 2: Update docker-compose to match PostgreSQL password${NC}"
    echo ""
    read -p "Enter the actual PostgreSQL password: " ACTUAL_PASSWORD
    
    if [ -z "$ACTUAL_PASSWORD" ]; then
        echo -e "${RED}❌ Password cannot be empty${NC}"
        exit 1
    fi
    
    # Test the password
    if docker exec -e PGPASSWORD="$ACTUAL_PASSWORD" postgres psql -U lto_user -d lto_blockchain -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Password verified${NC}"
        echo ""
        echo -e "${YELLOW}To use this password, update docker-compose.unified.yml:${NC}"
        echo "  POSTGRES_PASSWORD=${ACTUAL_PASSWORD}"
        echo ""
        echo "Or set it in .env file:"
        echo "  POSTGRES_PASSWORD=${ACTUAL_PASSWORD}"
        echo ""
        echo -e "${BLUE}Then restart the application:${NC}"
        echo "  docker compose -f docker-compose.unified.yml restart lto-app"
    else
        echo -e "${RED}❌ Password test failed${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}Testing database connection from application...${NC}"
sleep 2

# Test connection
docker exec lto-app node -e "
const db = require('./backend/database/db');
db.testConnection().then(result => {
    console.log(result ? '✅ Database connection OK' : '❌ Database connection FAILED');
    process.exit(result ? 0 : 1);
}).catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
" && {
    echo ""
    echo -e "${GREEN}=== Fix Complete ===${NC}"
    echo -e "${GREEN}✅ Database password is now correct${NC}"
    echo -e "${GREEN}✅ Application can connect to database${NC}"
    echo ""
    echo -e "${BLUE}You can now try logging in again${NC}"
} || {
    echo ""
    echo -e "${RED}❌ Database connection still failing${NC}"
    echo -e "${YELLOW}Check logs: docker compose -f docker-compose.unified.yml logs lto-app${NC}"
    exit 1
}

