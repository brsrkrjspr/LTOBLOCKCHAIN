#!/bin/bash
# Apply token blacklist migration on DigitalOcean
# Usage: ./scripts/apply-blacklist-migration.sh

echo "🔧 Applying token blacklist migration..."

# Check if we're in a Docker environment
if [ -f /.dockerenv ] || [ -n "$DOCKER_CONTAINER" ]; then
    echo "⚠️  Running inside Docker container"
    # If running inside container, connect directly
    psql -U lto_user -d lto_blockchain -f backend/migrations/add_token_blacklist.sql
else
    # Running on host, use docker exec
    # Find postgres container name
    POSTGRES_CONTAINER=$(docker ps --format "{{.Names}}" | grep -i postgres | head -n 1)
    
    if [ -z "$POSTGRES_CONTAINER" ]; then
        echo "❌ PostgreSQL container not found"
        echo "Available containers:"
        docker ps --format "{{.Names}}"
        exit 1
    fi
    
    echo "📦 Using PostgreSQL container: $POSTGRES_CONTAINER"
    
    # Run migration
    docker exec -i $POSTGRES_CONTAINER psql -U lto_user -d lto_blockchain < backend/migrations/add_token_blacklist.sql
fi

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully"
    
    # Verify table exists
    if [ -f /.dockerenv ] || [ -n "$DOCKER_CONTAINER" ]; then
        psql -U lto_user -d lto_blockchain -c "\d token_blacklist"
    else
        docker exec -it $POSTGRES_CONTAINER psql -U lto_user -d lto_blockchain -c "\d token_blacklist"
    fi
    
    echo ""
    echo "🔄 To restart application:"
    echo "   docker compose -f docker-compose.unified.yml restart lto-app"
    echo ""
    echo "📊 Check logs:"
    echo "   docker compose -f docker-compose.unified.yml logs -f lto-app | grep blacklist"
else
    echo "❌ Migration failed"
    exit 1
fi

