#!/bin/bash
# TrustChain LTO - Docker Engine Downgrade Script
# Fixes Hyperledger Fabric chaincode installation error caused by Docker Engine v29.x
# Downgrades from Docker Engine v29.1.3 to v28.0.4
# Reference: GitHub Issue #5350 - Docker Engine v29.x breaks Hyperledger Fabric chaincode builds

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}  $1"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}\n"
}

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# Detect Ubuntu version
detect_ubuntu_version() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        UBUNTU_VERSION=$VERSION_ID
        UBUNTU_CODENAME=$VERSION_CODENAME
        print_success "Detected Ubuntu $UBUNTU_VERSION ($UBUNTU_CODENAME)"
    else
        print_error "Cannot detect Ubuntu version"
        exit 1
    fi
}

# Check current Docker version
check_docker_version() {
    print_header "Step 1: Checking Current Docker Version"
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
    print_info "Current Docker Engine version: $DOCKER_VERSION"
    
    if [[ "$DOCKER_VERSION" == "29."* ]]; then
        print_warning "Docker Engine v29.x detected - needs downgrade"
        return 0
    elif [[ "$DOCKER_VERSION" == "28."* ]]; then
        print_success "Docker Engine v28.x already installed!"
        print_info "Version: $DOCKER_VERSION"
        exit 0
    else
        print_warning "Unexpected Docker version: $DOCKER_VERSION"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
}

# Stop Fabric network safely
stop_fabric_network() {
    print_header "Step 2: Stopping Fabric Network"
    
    cd "$(dirname "$0")/.." 2>/dev/null || cd /root/LTOBLOCKCHAIN
    
    if [ -f "docker-compose.unified.yml" ]; then
        print_info "Stopping all containers..."
        docker compose -f docker-compose.unified.yml down || true
        print_success "Fabric network stopped"
    else
        print_warning "docker-compose.unified.yml not found, skipping network stop"
    fi
    
    # Wait for containers to fully stop
    sleep 5
}

# Backup Docker state
backup_docker_state() {
    print_header "Step 3: Backing Up Docker State"
    
    BACKUP_DIR="/root/docker-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    print_info "Backing up Docker configuration..."
    cp -r /etc/docker "$BACKUP_DIR/docker-config" 2>/dev/null || true
    docker info > "$BACKUP_DIR/docker-info.txt" 2>/dev/null || true
    
    print_success "Backup created at: $BACKUP_DIR"
}

# Uninstall Docker Engine v29
uninstall_docker() {
    print_header "Step 4: Uninstalling Docker Engine v29"
    
    print_info "Stopping Docker service..."
    systemctl stop docker || true
    systemctl stop docker.socket || true
    systemctl stop containerd || true
    
    print_info "Removing Docker packages..."
    apt-get remove -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
    
    print_info "Removing Docker data (images/containers will be lost)..."
    rm -rf /var/lib/docker/* 2>/dev/null || true
    
    print_success "Docker Engine v29 uninstalled"
}

# Install Docker Engine v28.0.4
install_docker_v28() {
    print_header "Step 5: Installing Docker Engine v28.0.4"
    
    print_info "Updating package index..."
    apt-get update -qq
    
    print_info "Installing prerequisites..."
    apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    print_info "Adding Docker GPG key..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Set up repository
    print_info "Setting up Docker repository..."
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update -qq
    
    # Get Ubuntu codename for version-specific package names
    UBUNTU_CODENAME=$(lsb_release -cs)
    UBUNTU_VERSION_NUM=$(lsb_release -rs | sed 's/\.//')
    
    # Check available Docker versions
    print_info "Checking available Docker Engine versions..."
    AVAILABLE_VERSIONS=$(apt-cache madison docker-ce | grep "5:28\." | head -5 || echo "")
    
    if [ -z "$AVAILABLE_VERSIONS" ]; then
        print_error "No Docker Engine v28.x versions found for Ubuntu ${UBUNTU_CODENAME}"
        print_info "Checking all available versions..."
        apt-cache madison docker-ce | head -10
        print_error "Cannot proceed - Docker v28.x not available for this Ubuntu version"
        print_info "You may need to use Ubuntu 22.04 (jammy) or wait for Docker v28.x support"
        exit 1
    fi
    
    print_info "Available v28.x versions:"
    echo "$AVAILABLE_VERSIONS" | head -3
    
    # Try to install latest v28.x (most compatible)
    print_info "Installing latest Docker Engine v28.x..."
    
    if ! apt-get install -y \
        docker-ce=5:28.* \
        docker-ce-cli=5:28.* \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin 2>&1 | tee /tmp/docker-install.log; then
        print_error "Failed to install Docker Engine v28.x"
        print_info "Installation log saved to /tmp/docker-install.log"
        cat /tmp/docker-install.log | tail -20
        exit 1
    fi
    
    INSTALLED_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
    print_success "Docker Engine v28.x installed: $INSTALLED_VERSION"
}

# Pin Docker version to prevent upgrades
pin_docker_version() {
    print_header "Step 6: Pinning Docker Version (Prevent Auto-Upgrade)"
    
    print_info "Creating apt preferences file..."
    cat > /etc/apt/preferences.d/docker << 'EOF'
Package: docker-ce
Pin: version 5:28.*
Pin-Priority: 1001

Package: docker-ce-cli
Pin: version 5:28.*
Pin-Priority: 1001
EOF
    
    print_success "Docker version pinned to v28.x"
    print_info "Auto-upgrade prevented"
}

# Start Docker service
start_docker() {
    print_header "Step 7: Starting Docker Service"
    
    # Check if Docker is actually installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed! Cannot start service."
        print_info "Previous installation step must have failed."
        exit 1
    fi
    
    print_info "Starting Docker daemon..."
    systemctl start docker || true
    systemctl enable docker || true
    
    sleep 5
    
    print_info "Verifying Docker is running..."
    if systemctl is-active --quiet docker; then
        print_success "Docker service is running"
    else
        print_error "Docker service failed to start"
        systemctl status docker --no-pager -l | head -20
        exit 1
    fi
}

# Verify Docker version
verify_docker_version() {
    print_header "Step 8: Verifying Docker Version"
    
    DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null)
    print_info "Docker Engine version: $DOCKER_VERSION"
    
    if [[ "$DOCKER_VERSION" == "28."* ]]; then
        print_success "✅ Docker Engine successfully downgraded to v28.x"
    else
        print_error "❌ Docker version verification failed"
        print_error "Expected v28.x, got: $DOCKER_VERSION"
        exit 1
    fi
    
    # Test Docker functionality
    print_info "Testing Docker functionality..."
    if docker run --rm hello-world > /dev/null 2>&1; then
        print_success "Docker is working correctly"
    else
        print_warning "Docker test failed, but version is correct"
    fi
}

# Cleanup
cleanup() {
    print_header "Step 9: Cleanup"
    
    print_info "Cleaning up apt cache..."
    apt-get autoremove -y
    apt-get clean
    
    print_info "Removing old Docker images (optional)..."
    docker system prune -f || true
    
    print_success "Cleanup complete"
}

# Restart Fabric network
restart_fabric_network() {
    print_header "Step 10: Restarting Fabric Network"
    
    cd "$(dirname "$0")/.." 2>/dev/null || cd /root/LTOBLOCKCHAIN
    
    if [ -f "docker-compose.unified.yml" ]; then
        print_info "Starting Fabric network..."
        docker compose -f docker-compose.unified.yml up -d
        
        print_info "Waiting for containers to start (30s)..."
        sleep 30
        
        print_info "Checking container status..."
        docker compose -f docker-compose.unified.yml ps
        
        print_success "Fabric network restarted"
        print_info "You can now retry chaincode installation: bash scripts/unified-setup.sh"
    else
        print_warning "docker-compose.unified.yml not found, skipping network restart"
    fi
}

# Main execution
main() {
    print_header "Docker Engine Downgrade: v29.1.3 → v28.0.4"
    print_warning "This script will:"
    echo "  1. Stop your Fabric network"
    echo "  2. Uninstall Docker Engine v29"
    echo "  3. Install Docker Engine v28.0.4"
    echo "  4. Pin version to prevent auto-upgrade"
    echo "  5. Restart Fabric network"
    echo ""
    print_warning "All Docker containers and images will be removed!"
    echo ""
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cancelled"
        exit 0
    fi
    
    detect_ubuntu_version
    check_docker_version
    stop_fabric_network
    backup_docker_state
    uninstall_docker
    install_docker_v28
    pin_docker_version
    start_docker
    verify_docker_version
    cleanup
    restart_fabric_network
    
    print_header "✅ Downgrade Complete!"
    print_success "Docker Engine v28.0.4 is now installed and pinned"
    print_info "Next step: Retry chaincode installation"
    print_info "Run: bash scripts/unified-setup.sh"
}

# Run main function
main "$@"

