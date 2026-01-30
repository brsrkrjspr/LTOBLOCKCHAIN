#!/bin/bash
# Fix: Node.js chaincode install fails with "npm: not found"
# The peer uses fabric-ccenv as the chaincode *builder* image. That image does not include npm.
# For Node.js chaincode, the build must run npm install, so we use fabric-nodeenv (which has
# Node.js and npm) and tag it as the builder image the peer expects (fabric-ccenv:amd64-v2.5.0).
# Run this on the host (where Docker runs), then re-run: bash scripts/quick-fix-install-chaincode.sh

set -e

echo "=========================================="
echo "Fix: Node.js chaincode build (npm not found)"
echo "=========================================="
echo ""
echo "The peer builds Node chaincode using the 'builder' image (fabric-ccenv),"
echo "which does not include npm. This script pulls fabric-nodeenv (has npm)"
echo "and tags it as the builder image so the install succeeds."
echo ""

# Image the peer uses for chaincode build (from core.yaml chaincode.builder)
CCENV_TAG="amd64-v2.5.0"
TARGET_IMAGE="hyperledger/fabric-ccenv:${CCENV_TAG}"

# Try fabric-nodeenv tags (Docker Hub or GHCR)
for NODEENV_IMAGE in \
    "hyperledger/fabric-nodeenv:2.5" \
    "hyperledger/fabric-nodeenv:2.5.0" \
    "ghcr.io/hyperledger/fabric-nodeenv:2.5"; do
    echo "Trying ${NODEENV_IMAGE}..."
    if docker pull "${NODEENV_IMAGE}" 2>/dev/null; then
        echo "✓ Pulled ${NODEENV_IMAGE}"
        echo "  Tagging as ${TARGET_IMAGE} (required by peer build)..."
        docker tag "${NODEENV_IMAGE}" "${TARGET_IMAGE}"
        echo "  Tagging as hyperledger/fabric-ccenv:2.5 (peer may use TWO_DIGIT_VERSION=2.5)..."
        docker tag "${NODEENV_IMAGE}" "hyperledger/fabric-ccenv:2.5"
        echo "✓ Done."
        echo ""
        echo "Next: run chaincode install:"
        echo "  bash scripts/quick-fix-install-chaincode.sh"
        echo ""
        exit 0
    fi
done

echo "❌ Could not pull any fabric-nodeenv image."
echo "   Check: Docker Hub (hyperledger/fabric-nodeenv) or GHCR (ghcr.io/hyperledger/fabric-nodeenv)"
echo "   Tag the image manually as: ${TARGET_IMAGE}"
exit 1
