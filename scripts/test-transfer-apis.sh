#!/bin/bash

# ======================================================
# TrustChain LTO - Test Transfer Ownership APIs
# Tests all new transfer-related endpoints
# ======================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  $1"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}\n"
}

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }

# Configuration
API_BASE="http://localhost:3001"
ADMIN_EMAIL="admin@lto.gov.ph"
ADMIN_PASSWORD="admin123"

print_header "Testing Transfer Ownership APIs"

# Check if server is running
if ! curl -s "$API_BASE/api/health" > /dev/null 2>&1; then
    print_error "Server is not running at $API_BASE"
    print_info "Start it with: npm start"
    exit 1
fi

print_success "Server is running"

# Step 1: Login as admin
print_info "Step 1: Logging in as admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    print_error "Failed to login. Response: $LOGIN_RESPONSE"
    exit 1
fi

print_success "Logged in successfully"
print_info "Token: ${TOKEN:0:20}..."

# Step 2: Test GET /api/admin/stats
print_info "Step 2: Testing GET /api/admin/stats..."
STATS_RESPONSE=$(curl -s -X GET "$API_BASE/api/admin/stats" \
    -H "Authorization: Bearer $TOKEN")

if echo "$STATS_RESPONSE" | grep -q '"success":true'; then
    print_success "Admin stats endpoint working"
    echo "$STATS_RESPONSE" | jq '.stats' 2>/dev/null || echo "$STATS_RESPONSE"
else
    print_error "Admin stats failed: $STATS_RESPONSE"
fi

# Step 3: Test GET /api/vehicles/transfer/requests
print_info "Step 3: Testing GET /api/vehicles/transfer/requests..."
TRANSFER_LIST=$(curl -s -X GET "$API_BASE/api/vehicles/transfer/requests" \
    -H "Authorization: Bearer $TOKEN")

if echo "$TRANSFER_LIST" | grep -q '"success":true'; then
    print_success "Transfer requests list endpoint working"
    REQUEST_COUNT=$(echo "$TRANSFER_LIST" | jq '.requests | length' 2>/dev/null || echo "0")
    print_info "Found $REQUEST_COUNT transfer requests"
else
    print_error "Transfer requests list failed: $TRANSFER_LIST"
fi

# Step 4: Test GET /api/vehicles/transfer/requests/stats
print_info "Step 4: Testing GET /api/vehicles/transfer/requests/stats..."
TRANSFER_STATS=$(curl -s -X GET "$API_BASE/api/vehicles/transfer/requests/stats" \
    -H "Authorization: Bearer $TOKEN")

if echo "$TRANSFER_STATS" | grep -q '"success":true'; then
    print_success "Transfer stats endpoint working"
    echo "$TRANSFER_STATS" | jq '.stats' 2>/dev/null || echo "$TRANSFER_STATS"
else
    print_error "Transfer stats failed: $TRANSFER_STATS"
fi

# Step 5: Test GET /api/documents/search
print_info "Step 5: Testing GET /api/documents/search..."
DOC_SEARCH=$(curl -s -X GET "$API_BASE/api/documents/search?limit=10" \
    -H "Authorization: Bearer $TOKEN")

if echo "$DOC_SEARCH" | grep -q '"success":true'; then
    print_success "Document search endpoint working"
    DOC_COUNT=$(echo "$DOC_SEARCH" | jq '.documents | length' 2>/dev/null || echo "0")
    print_info "Found $DOC_COUNT documents"
else
    print_error "Document search failed: $DOC_SEARCH"
fi

# Step 6: Test ownership history (if vehicles exist)
print_info "Step 6: Testing ownership history endpoints..."
# First, get a vehicle VIN
VEHICLES=$(curl -s -X GET "$API_BASE/api/vehicles?limit=1" \
    -H "Authorization: Bearer $TOKEN")

if echo "$VEHICLES" | grep -q '"success":true'; then
    VIN=$(echo "$VEHICLES" | jq -r '.vehicles[0].vin' 2>/dev/null)
    if [ "$VIN" != "null" ] && [ -n "$VIN" ]; then
        print_info "Testing with VIN: $VIN"
        
        OWNERSHIP_HISTORY=$(curl -s -X GET "$API_BASE/api/vehicles/$VIN/ownership-history" \
            -H "Authorization: Bearer $TOKEN")
        
        if echo "$OWNERSHIP_HISTORY" | grep -q '"success":true'; then
            print_success "Ownership history endpoint working"
        else
            print_error "Ownership history failed: $OWNERSHIP_HISTORY"
        fi
    else
        print_info "No vehicles found to test ownership history"
    fi
fi

# Summary
print_header "Test Summary"
print_success "API testing complete!"
print_info "All endpoints are accessible. Check the output above for any errors."
print_info ""
print_info "To test in browser:"
print_info "  1. Open: http://localhost:3001/admin-dashboard.html"
print_info "  2. Login with: $ADMIN_EMAIL / $ADMIN_PASSWORD"
print_info "  3. Navigate to Transfer Requests section"

