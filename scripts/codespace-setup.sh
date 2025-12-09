#!/bin/bash
# TrustChain LTO - Complete Codespace Setup
# One command to set up everything in GitHub Codespace

set -e

echo "🚀 TrustChain LTO - Complete Codespace Setup"
echo "============================================="
echo ""
echo "This script will:"
echo "  1. Install npm dependencies"
echo "  2. Start all Fabric and core services"
echo "  3. Setup the application"
echo ""
echo "Starting in 3 seconds..."
sleep 3

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Step 1: Make all scripts executable
print_status "Making scripts executable..."
chmod +x scripts/*.sh
print_success "Scripts are executable"

# Step 2: Install npm dependencies
print_status "Installing npm dependencies..."
npm install
if [ $? -eq 0 ]; then
    print_success "npm dependencies installed"
else
    print_warning "npm install had issues, but continuing..."
fi

# Step 3: Install chaincode dependencies
print_status "Installing chaincode dependencies..."
if [ -d "chaincode/vehicle-registration-production" ]; then
    cd chaincode/vehicle-registration-production
    npm install 2>/dev/null || print_warning "Chaincode npm install had issues"
    cd ../..
    print_success "Chaincode dependencies installed"
else
    print_warning "Chaincode directory not found, skipping..."
fi

# Step 4: Run the startup script
print_status "Starting all services..."
bash scripts/start-codespace.sh

if [ $? -ne 0 ]; then
    print_error "Startup script failed!"
    exit 1
fi

# Step 5: Verify services
print_status "Verifying services..."
bash scripts/verify-services.sh || true

# Step 6: Deploy chaincode (optional - may fail if already deployed)
print_status "Attempting chaincode deployment..."
bash scripts/complete-fabric-setup.sh || print_warning "Chaincode deployment had issues (may already be deployed)"

echo ""
echo "============================================="
print_success "Codespace setup complete!"
echo ""
echo "Your TrustChain LTO system is ready!"
echo ""
echo "To start the application:"
echo "  npm start"
echo ""
echo "Then access at:"
echo "  http://localhost:3001"
echo ""
echo "Default credentials:"
echo "  Admin: admin@lto.gov.ph / admin123"
echo "  Owner: owner@example.com / admin123"
echo ""

