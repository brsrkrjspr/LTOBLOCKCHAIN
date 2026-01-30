#!/bin/bash
# Fix: Peer chaincode install fails with "manifest for hyperledger/fabric-ccenv:amd64-v2.5.0 not found"
# The peer needs this image to build chaincode. Docker Hub may not have amd64-v2.5.0; we pull a valid tag and retag.
# Run this on the host (where Docker runs), then re-run: bash scripts/quick-fix-install-chaincode.sh

set -e

echo "=========================================="
echo "Fix: Pre-pull and tag fabric-ccenv image"
echo "=========================================="
echo ""

# Try tags that commonly exist on Docker Hub (Fabric 2.5)
TAGS="2.5 2.5.0"
PULLED=""

for TAG in $TAGS; do
    echo "Trying hyperledger/fabric-ccenv:${TAG}..."
    if docker pull "hyperledger/fabric-ccenv:${TAG}" 2>/dev/null; then
        PULLED="$TAG"
        break
    fi
done

if [ -z "$PULLED" ]; then
    echo "❌ Could not pull any fabric-ccenv image. Check Docker Hub: https://hub.docker.com/r/hyperledger/fabric-ccenv/tags"
    echo "   If you have the image elsewhere, tag it as: hyperledger/fabric-ccenv:amd64-v2.5.0"
    exit 1
fi

echo "✓ Pulled hyperledger/fabric-ccenv:${PULLED}"
echo "  Tagging as hyperledger/fabric-ccenv:amd64-v2.5.0 (required by peer build)..."
docker tag "hyperledger/fabric-ccenv:${PULLED}" "hyperledger/fabric-ccenv:amd64-v2.5.0"
echo "✓ Done."
echo ""
echo "Next: run chaincode install:"
echo "  bash scripts/quick-fix-install-chaincode.sh"
echo ""
