#!/bin/bash
# TrustChain LTO - Cleanup Orphaned Vehicles
# Removes vehicles that were created but registration failed

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

log_info "=== Cleanup Orphaned Vehicles ==="
echo ""

# Check if VIN is provided
if [ -z "$1" ]; then
    log_error "Usage: $0 <VIN>"
    log_info "Example: $0 ABC1234567890XYZ"
    exit 1
fi

VIN="$1"

log_info "Removing vehicle with VIN: $VIN"

# Check if postgres container is running
if ! docker compose -f docker-compose.unified.yml ps postgres | grep -q "Up"; then
    log_error "PostgreSQL container is not running"
    exit 1
fi

# Check if vehicle exists
log_info "Checking if vehicle exists..."
VEHICLE_EXISTS=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT COUNT(*) FROM vehicles WHERE vin = '$VIN';" 2>/dev/null | tr -d ' ' || echo "0")

if [ "$VEHICLE_EXISTS" = "0" ]; then
    log_warn "⚠️  Vehicle with VIN $VIN not found in database"
    exit 0
fi

log_info "Vehicle found. Getting vehicle ID..."
VEHICLE_ID=$(docker exec postgres psql -U lto_user -d lto_blockchain -t -c "SELECT id FROM vehicles WHERE vin = '$VIN';" 2>/dev/null | tr -d ' ' || echo "")

if [ -z "$VEHICLE_ID" ]; then
    log_error "Could not get vehicle ID"
    exit 1
fi

log_info "Vehicle ID: $VEHICLE_ID"

# Confirm deletion
log_warn "⚠️  This will delete:"
log_warn "   - Vehicle record (ID: $VEHICLE_ID, VIN: $VIN)"
log_warn "   - Related documents"
log_warn "   - Related history records"
echo ""
read -p "Are you sure you want to delete this vehicle? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log_info "Deletion cancelled"
    exit 0
fi

# Delete vehicle (cascade will handle related records)
log_info "Deleting vehicle..."
docker exec postgres psql -U lto_user -d lto_blockchain -c "DELETE FROM vehicles WHERE id = '$VEHICLE_ID';" 2>/dev/null

if [ $? -eq 0 ]; then
    log_success "✅ Vehicle deleted successfully"
else
    log_error "❌ Failed to delete vehicle"
    exit 1
fi

log_info "Cleanup completed"

