#!/bin/bash
# TrustChain LTO - Check Backend Routes Authentication
# Verifies all backend routes have proper authentication middleware

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

log_info "=== Checking Backend Routes Authentication ==="
echo ""

ROUTES_DIR="backend/routes"
ROUTES=(
    "auth.js"
    "vehicles.js"
    "documents.js"
    "blockchain.js"
    "ledger.js"
    "notifications.js"
    "transfer.js"
    "lto.js"
    "insurance.js"
    "hpg.js"
    "emission.js"
    "admin.js"
    "monitoring.js"
    "health.js"
)

# Routes that should NOT require authentication (public endpoints)
PUBLIC_ROUTES=(
    "/api/auth/login"
    "/api/auth/register"
    "/api/health"
    "/api/vehicles/register"  # Uses optionalAuth
)

# Routes that should require authentication
PROTECTED_PATTERNS=(
    "router.get"
    "router.post"
    "router.put"
    "router.delete"
    "router.patch"
)

for route_file in "${ROUTES[@]}"; do
    file_path="${ROUTES_DIR}/${route_file}"
    if [ ! -f "$file_path" ]; then
        log_warn "⚠️  File not found: $file_path"
        continue
    fi
    
    log_info "Checking: $route_file"
    
    # Count routes
    total_routes=$(grep -c "router\.\(get\|post\|put\|delete\|patch\)" "$file_path" || echo "0")
    
    # Count routes with authentication
    auth_routes=$(grep -c "authenticateToken\|optionalAuth" "$file_path" || echo "0")
    
    # Find routes without authentication
    routes_without_auth=$(grep "router\.\(get\|post\|put\|delete\|patch\)" "$file_path" | grep -v "authenticateToken\|optionalAuth" || true)
    
    if [ -n "$routes_without_auth" ]; then
        log_warn "⚠️  Routes without authentication in $route_file:"
        echo "$routes_without_auth" | while read -r line; do
            echo "   $line"
        done
    else
        log_success "✅ All routes in $route_file have authentication"
    fi
    
    echo ""
done

log_info "=== Summary ==="
log_info "Note: Some routes may intentionally be public (auth endpoints, health checks)"
log_info "Routes using 'optionalAuth' allow both authenticated and unauthenticated access"

