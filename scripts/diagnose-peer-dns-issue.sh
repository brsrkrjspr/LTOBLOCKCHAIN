#!/bin/bash

# Diagnostic Script: Peer DNS Resolution Issue
# Checks why peer0.lto.gov.ph cannot be resolved after restart

set -e

echo "=========================================="
echo "Diagnosing Peer DNS Resolution Issue"
echo "=========================================="
echo ""

cd ~/LTOBLOCKCHAIN || exit 1

# Step 1: Check if peer container is running
echo "Step 1: Checking peer container status..."
PEER_STATUS=$(docker ps --filter "name=peer0.lto.gov.ph" --format "{{.Status}}" 2>&1 || echo "NOT_RUNNING")
if [ "$PEER_STATUS" = "NOT_RUNNING" ] || [ -z "$PEER_STATUS" ]; then
    echo "  ✗ Peer container is NOT running!"
    echo ""
    echo "  Checking stopped containers..."
    docker ps -a --filter "name=peer0.lto.gov.ph" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}"
    echo ""
    echo "  Checking peer logs for crash reason..."
    docker logs peer0.lto.gov.ph --tail=50 2>&1 | tail -20
    exit 1
else
    echo "  ✓ Peer container is running: $PEER_STATUS"
fi

# Step 2: Check peer logs for startup completion
echo ""
echo "Step 2: Checking peer startup logs..."
PEER_LOGS=$(docker logs peer0.lto.gov.ph --tail=100 2>&1)

# Check for successful startup
if echo "$PEER_LOGS" | grep -q "Deployed system chaincodes"; then
    echo "  ✓ Peer has deployed system chaincodes (fully started)"
    STARTUP_COMPLETE=true
else
    echo "  ⚠ Peer has NOT deployed system chaincodes yet (may still be starting)"
    STARTUP_COMPLETE=false
fi

# Check for errors
PEER_ERRORS=$(echo "$PEER_LOGS" | grep -i "error\|fatal\|panic" | tail -5)
if [ -n "$PEER_ERRORS" ]; then
    echo "  ⚠ Found errors in peer logs:"
    echo "$PEER_ERRORS" | sed 's/^/    /'
fi

# Step 3: Check network connectivity
echo ""
echo "Step 3: Checking network configuration..."
CLI_NETWORK=$(docker inspect cli 2>/dev/null | grep -A 5 '"Networks"' | grep -o '"trustchain"' || echo "")
PEER_NETWORK=$(docker inspect peer0.lto.gov.ph 2>/dev/null | grep -A 5 '"Networks"' | grep -o '"trustchain"' || echo "")

if [ -n "$CLI_NETWORK" ] && [ -n "$PEER_NETWORK" ]; then
    echo "  ✓ Both CLI and peer are on 'trustchain' network"
else
    echo "  ✗ Network mismatch!"
    echo "    CLI network: ${CLI_NETWORK:-NOT_FOUND}"
    echo "    Peer network: ${PEER_NETWORK:-NOT_FOUND}"
fi

# Step 4: Test DNS resolution from CLI container
echo ""
echo "Step 4: Testing DNS resolution from CLI container..."
DNS_RESULT=$(docker exec cli nslookup peer0.lto.gov.ph 2>&1 || echo "DNS_FAILED")
if echo "$DNS_RESULT" | grep -q "can't find\|no such host\|DNS_FAILED"; then
    echo "  ✗ DNS resolution FAILED"
    echo "    CLI cannot resolve peer0.lto.gov.ph"
    echo ""
    echo "    DNS lookup result:"
    echo "$DNS_RESULT" | sed 's/^/    /'
else
    echo "  ✓ DNS resolution succeeded"
    echo "    CLI can resolve peer0.lto.gov.ph"
    echo "$DNS_RESULT" | grep -A 2 "Name:" | sed 's/^/    /'
fi

# Step 5: Test direct connection (ping)
echo ""
echo "Step 5: Testing direct connection (ping)..."
PING_RESULT=$(docker exec cli ping -c 2 peer0.lto.gov.ph 2>&1 || echo "PING_FAILED")
if echo "$PING_RESULT" | grep -q "unknown host\|no such host\|PING_FAILED"; then
    echo "  ✗ Ping FAILED - cannot reach peer"
    echo "$PING_RESULT" | tail -3 | sed 's/^/    /'
else
    echo "  ✓ Ping succeeded - peer is reachable"
    echo "$PING_RESULT" | grep -E "PING|packets" | sed 's/^/    /'
fi

# Step 6: Check peer port 7051
echo ""
echo "Step 6: Checking if peer is listening on port 7051..."
PEER_PORT=$(docker exec peer0.lto.gov.ph netstat -tlnp 2>/dev/null | grep ":7051" || echo "PORT_NOT_FOUND")
if [ "$PEER_PORT" = "PORT_NOT_FOUND" ]; then
    echo "  ✗ Peer is NOT listening on port 7051"
    echo "    This means peer hasn't fully started yet"
else
    echo "  ✓ Peer is listening on port 7051"
    echo "$PEER_PORT" | sed 's/^/    /'
fi

# Step 7: Check when peer started
echo ""
echo "Step 7: Checking peer start time..."
PEER_STARTED=$(docker inspect peer0.lto.gov.ph --format='{{.State.StartedAt}}' 2>/dev/null || echo "UNKNOWN")
if [ "$PEER_STARTED" != "UNKNOWN" ]; then
    echo "  Peer started at: $PEER_STARTED"
    
    # Calculate how long peer has been running
    START_TIME=$(date -d "$PEER_STARTED" +%s 2>/dev/null || echo "0")
    CURRENT_TIME=$(date +%s)
    if [ "$START_TIME" != "0" ]; then
        ELAPSED=$((CURRENT_TIME - START_TIME))
        echo "  Peer has been running for: ${ELAPSED} seconds"
        
        if [ $ELAPSED -lt 60 ]; then
            echo "  ⚠ Peer started less than 60 seconds ago - may still be initializing"
        fi
    fi
else
    echo "  ⚠ Could not determine peer start time"
fi

# Step 8: Summary and recommendations
echo ""
echo "=========================================="
echo "Diagnosis Summary"
echo "=========================================="
echo ""

if [ "$STARTUP_COMPLETE" = "false" ]; then
    echo "❌ ISSUE: Peer has not fully started yet"
    echo ""
    echo "Recommendation:"
    echo "  1. Wait longer (60+ seconds)"
    echo "  2. Check peer logs: docker logs peer0.lto.gov.ph --tail=100"
    echo "  3. Look for 'Deployed system chaincodes' message"
    echo ""
elif echo "$DNS_RESULT" | grep -q "can't find\|no such host\|DNS_FAILED"; then
    echo "❌ ISSUE: DNS resolution failed"
    echo ""
    echo "Possible causes:"
    echo "  1. Peer container crashed during startup"
    echo "  2. Network configuration issue"
    echo "  3. DNS service not running"
    echo ""
    echo "Recommendation:"
    echo "  1. Check peer logs: docker logs peer0.lto.gov.ph --tail=100"
    echo "  2. Restart peer: docker-compose -f docker-compose.unified.yml restart peer0.lto.gov.ph"
    echo "  3. Wait 60+ seconds after restart"
    echo "  4. Try using IP address instead of hostname (workaround)"
    echo ""
else
    echo "✅ Peer appears to be running and DNS should work"
    echo ""
    echo "If query still fails, check:"
    echo "  1. TLS certificates are correct"
    echo "  2. Channel exists: docker exec cli peer channel list"
    echo "  3. Chaincode is installed: docker exec cli peer chaincode list --installed"
    echo ""
fi

echo "Next steps:"
echo "  1. Review the diagnostics above"
echo "  2. If peer is not ready, wait and check logs"
echo "  3. If DNS fails, restart peer and wait longer"
echo "  4. Try query again after peer is fully ready"
echo ""
