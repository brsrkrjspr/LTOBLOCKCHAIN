#!/bin/bash
# TrustChain LTO - Fix PostgreSQL Password (Direct Method)
# Since database was initialized with POSTGRES_USER=lto_user, we need to reset password directly

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Fixing PostgreSQL Password ===${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will reset the PostgreSQL password${NC}"
echo -e "${YELLOW}⚠️  If you have important data, make a backup first${NC}"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Stop PostgreSQL
echo -e "${BLUE}Stopping PostgreSQL...${NC}"
docker compose -f docker-compose.unified.yml stop postgres

# Remove container
echo -e "${BLUE}Removing container...${NC}"
docker compose -f docker-compose.unified.yml rm -f postgres

# Find the volume name
VOLUME_NAME=$(docker volume ls | grep "postgres-data" | awk '{print $2}' | head -1)

if [ -z "$VOLUME_NAME" ]; then
    VOLUME_NAME="ltoblockchain_postgres-data"
fi

echo -e "${YELLOW}Found volume: ${VOLUME_NAME}${NC}"
echo -e "${YELLOW}⚠️  Removing volume will DELETE all database data${NC}"
read -p "Delete volume and start fresh? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Remove volume
    echo -e "${BLUE}Removing PostgreSQL volume...${NC}"
    docker volume rm "$VOLUME_NAME" 2>/dev/null || {
        echo -e "${YELLOW}Volume not found or already removed${NC}"
    }
    
    # Start PostgreSQL fresh
    echo -e "${BLUE}Starting PostgreSQL with fresh database...${NC}"
    docker compose -f docker-compose.unified.yml up -d postgres
    
    echo -e "${BLUE}Waiting for PostgreSQL to initialize (this may take 30-60 seconds)...${NC}"
    sleep 30
    
    # Wait for PostgreSQL to be ready
    echo -e "${BLUE}Waiting for PostgreSQL to be ready...${NC}"
    for i in {1..30}; do
        if docker exec postgres pg_isready -U lto_user -d lto_blockchain > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL is ready!${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done
    echo ""
    
    # Check if database was initialized
    if docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database is accessible${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  Database was reset - you need to run migrations:${NC}"
        echo "  bash scripts/setup-wallet-only.sh  # This will also initialize database"
        echo ""
        echo -e "${BLUE}Or manually run SQL initialization:${NC}"
        echo "  docker exec -i postgres psql -U lto_user -d lto_blockchain < database/init-laptop.sql"
    else
        echo -e "${RED}❌ Database initialization may have failed${NC}"
        echo -e "${YELLOW}Check logs: docker compose -f docker-compose.unified.yml logs postgres${NC}"
    fi
else
    echo -e "${YELLOW}Volume preserved. Starting PostgreSQL...${NC}"
    docker compose -f docker-compose.unified.yml up -d postgres
    echo -e "${YELLOW}⚠️  Password issue may persist. You may need to manually reset it.${NC}"
fi

# Test connection from app
echo ""
echo -e "${BLUE}Testing connection from application...${NC}"
sleep 5

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
    echo -e "${GREEN}=== Fix Complete ===${NC}"
    echo -e "${GREEN}✅ Database password is now: lto_password${NC}"
    echo -e "${GREEN}✅ Application can connect${NC}"
} || {
    echo ""
    echo -e "${RED}❌ Connection still failing${NC}"
    echo -e "${YELLOW}You may need to run database initialization scripts${NC}"
}

