#!/bin/bash
# TrustChain LTO - Fabric CA Admin Enrollment Script
# Enrolls bootstrap CA admins for LTO, HPG, and Insurance organizations
# This script should be run AFTER Fabric CA services are started

set -e

echo "🔐 Fabric CA Admin Enrollment Script"
echo "======================================"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# CA URLs (defaults if not in .env)
CA_LTO_URL=${FABRIC_CA_LTO_URL:-https://ca-lto:7054}
CA_HPG_URL=${FABRIC_CA_HPG_URL:-https://ca-hpg:7054}
CA_INSURANCE_URL=${FABRIC_CA_INSURANCE_URL:-https://ca-insurance:7054}

# CA Admin credentials
CA_ADMIN_USER=${FABRIC_CA_ADMIN_USERNAME:-admin}
CA_ADMIN_PASS=${FABRIC_CA_ADMIN_PASSWORD:-adminpw}

# Wallet path
WALLET_PATH=${WALLET_PATH:-./wallet}

echo "📁 Wallet path: $WALLET_PATH"
echo ""

# Function to enroll CA admin
enroll_ca_admin() {
    local org_name=$1
    local ca_url=$2
    local msp_id=$3
    local admin_username=$4
    
    echo "🔐 Enrolling CA admin for $org_name..."
    echo "   CA URL: $ca_url"
    echo "   MSP ID: $msp_id"
    echo "   Admin username: $admin_username"
    
    # This script assumes Fabric CA client is available
    # In production, you would use fabric-ca-client CLI or Node.js SDK
    
    echo "   ⚠️  Note: This script is a template."
    echo "   ⚠️  Actual enrollment should be done via:"
    echo "       1. fabric-ca-client CLI (if available)"
    echo "       2. Node.js script using fabric-ca-client SDK"
    echo "       3. Backend enrollment service (fabricEnrollmentService.js)"
    echo ""
    echo "   Example fabric-ca-client command:"
    echo "   fabric-ca-client enroll -u https://$CA_ADMIN_USER:$CA_ADMIN_PASS@$ca_url \\"
    echo "     --caname ca-$org_name \\"
    echo "     --mspdir $WALLET_PATH/$admin_username"
    echo ""
}

# Enroll LTO CA admin
enroll_ca_admin "lto" "$CA_LTO_URL" "LTOMSP" "admin-lto"

# Enroll HPG CA admin
enroll_ca_admin "hpg" "$CA_HPG_URL" "HPGMSP" "admin-hpg"

# Enroll Insurance CA admin
enroll_ca_admin "insurance" "$CA_INSURANCE_URL" "InsuranceMSP" "admin-insurance"

echo "✅ CA admin enrollment script completed"
echo ""
echo "📝 Next steps:"
echo "   1. Ensure Fabric CA services are running (docker-compose up ca-lto ca-hpg ca-insurance)"
echo "   2. Run actual enrollment using fabric-ca-client or Node.js SDK"
echo "   3. Verify identities exist in wallet: $WALLET_PATH"
echo "   4. Test connection: node scripts/test-fabric-network.js"
