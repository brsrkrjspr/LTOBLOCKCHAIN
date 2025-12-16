#!/bin/bash
# TrustChain LTO - Install Docker Engine v28.x
# Installs Docker Engine v28.x for Hyperledger Fabric compatibility
# Use this when Docker is not installed or needs to be installed fresh

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

# Check if Docker is already installed
check_existing_docker() {
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
        print_info "Docker is already installed: $DOCKER_VERSION"
        
        if [[ "$DOCKER_VERSION" == "28."* ]]; then
            print_success "Docker Engine v28.x already installed!"
            exit 0
        elif [[ "$DOCKER_VERSION" == "29."* ]]; then
            print_warning "Docker Engine v29.x detected"
            print_info "Please run scripts/downgrade-docker.sh instead"
            exit 1
        fi
    fi
}

# Install Docker Engine v28.x
install_docker_v28() {
    print_header "Installing Docker Engine v28.x"
    
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
    UBUNTU_CODENAME=$(lsb_release -cs)
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      ${UBUNTU_CODENAME} stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update -qq
    
    # Check available versions
    print_info "Checking available Docker Engine v28.x versions..."
    AVAILABLE_VERSIONS=$(apt-cache madison docker-ce | grep "5:28\." | head -5 || echo "")
    
    if [ -z "$AVAILABLE_VERSIONS" ]; then
        print_error "No Docker Engine v28.x versions found"
        exit 1
    fi
    
    print_info "Available v28.x versions:"
    echo "$AVAILABLE_VERSIONS" | head -3
    
    # Install latest v28.x
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
    
    print_success "Docker Engine v28.x installed"
}

# Pin Docker version
pin_docker_version() {
    print_header "Pinning Docker Version (Prevent Auto-Upgrade)"
    
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
}

# Start Docker service
start_docker() {
    print_header "Starting Docker Service"
    
    print_info "Starting Docker daemon..."
    systemctl start docker
    systemctl enable docker
    
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

# Verify installation
verify_installation() {
    print_header "Verifying Docker Installation"
    
    DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null)
    print_info "Docker Engine version: $DOCKER_VERSION"
    
    if [[ "$DOCKER_VERSION" == "28."* ]]; then
        print_success "✅ Docker Engine v28.x successfully installed!"
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

# Main execution
main() {
    print_header "Docker Engine v28.x Installation"
    print_info "This script will install Docker Engine v28.x for Hyperledger Fabric compatibility"
    echo ""
    
    check_existing_docker
    install_docker_v28
    pin_docker_version
    start_docker
    verify_installation
    
    print_header "✅ Installation Complete!"
    print_success "Docker Engine v28.x is now installed and pinned"
    print_info "Next steps:"
    print_info "  1. Start Fabric network: docker compose -f docker-compose.unified.yml up -d"
    print_info "  2. Run setup: bash scripts/unified-setup.sh"
}

main "$@"

