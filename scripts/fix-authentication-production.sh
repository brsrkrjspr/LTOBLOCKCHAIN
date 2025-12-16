#!/bin/bash
# TrustChain LTO - Fix Authentication for Production
# Updates auth-utils.js to disable dev mode and ensures all dashboards require authentication

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

log_info "=== Fixing Authentication for Production ==="
echo ""

# Step 1: Disable DISABLE_AUTH in auth-utils.js
log_info "Step 1: Disabling dev mode authentication..."
if [ ! -f "js/auth-utils.js" ]; then
    log_error "js/auth-utils.js not found!"
    exit 1
fi

# Backup
cp js/auth-utils.js js/auth-utils.js.backup.$(date +%Y%m%d_%H%M%S)

# Update DISABLE_AUTH to false
sed -i 's/const DISABLE_AUTH = true;/const DISABLE_AUTH = false;/g' js/auth-utils.js

if grep -q "const DISABLE_AUTH = false;" js/auth-utils.js; then
    log_success "✅ Authentication enabled in auth-utils.js"
else
    log_error "Failed to update auth-utils.js"
    exit 1
fi

echo ""

# Step 2: Verify admin-dashboard.js has production check
log_info "Step 2: Verifying admin-dashboard.js has production authentication check..."
if grep -q "isProduction = !isLocalhost" js/admin-dashboard.js; then
    log_success "✅ Admin dashboard has production authentication check"
else
    log_warn "⚠️  Admin dashboard may not have production check (file may need update)"
fi

echo ""

# Step 3: Check other dashboards
log_info "Step 3: Checking other dashboard files..."
DASHBOARDS=("js/owner-dashboard.js" "js/insurance-verifier-dashboard.js" "js/verifier-dashboard.js")

for dashboard in "${DASHBOARDS[@]}"; do
    if [ -f "$dashboard" ]; then
        if grep -q "requireAuth\|hasRole" "$dashboard"; then
            log_success "✅ $dashboard has authentication checks"
        else
            log_warn "⚠️  $dashboard may need authentication checks"
        fi
    else
        log_warn "⚠️  $dashboard not found"
    fi
done

echo ""
log_success "=== Authentication Fix Complete ==="
log_info ""
log_info "Next steps:"
log_info "1. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)"
log_info "2. Clear browser cache if needed"
log_info "3. Try accessing admin-dashboard.html in incognito mode"
log_info "4. You should be redirected to login page"
log_info ""
log_info "Note: The production check ensures authentication is required"
log_info "even if DISABLE_AUTH is true (for production domains)"

