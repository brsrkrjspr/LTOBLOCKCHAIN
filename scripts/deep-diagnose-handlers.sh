#!/bin/bash

# Deep diagnostic: Check handler initialization

echo "=========================================="
echo "Deep Diagnostic: Handler Initialization"
echo "=========================================="

echo ""
echo "Step 1: Check handler-related messages in peer logs..."
docker logs peer0.lto.gov.ph 2>&1 | grep -i "handler\|endorsement\|DefaultEndorsement\|plugin.*escc" | head -30

echo ""
echo "Step 2: Check peer startup sequence (first 200 lines)..."
docker logs peer0.lto.gov.ph 2>&1 | head -200 | grep -E "handler|endorsement|plugin|chaincode|config|init" | head -40

echo ""
echo "Step 3: Check for any errors/warnings during startup..."
docker logs peer0.lto.gov.ph 2>&1 | grep -i "error\|warn\|fail" | head -20

echo ""
echo "Step 4: Verify YAML parsing in container..."
docker exec peer0.lto.gov.ph python3 -c "
import yaml
try:
    with open('/var/hyperledger/fabric/config/core.yaml', 'r') as f:
        config = yaml.safe_load(f)
    if 'handlers' in config:
        print('✓ handlers section found in parsed YAML')
        print('Handlers keys:', list(config['handlers'].keys()))
        if 'endorsers' in config['handlers']:
            print('Endorsers:', config['handlers']['endorsers'])
        if 'validators' in config['handlers']:
            print('Validators:', config['handlers']['validators'])
    else:
        print('✗ handlers section NOT found in parsed YAML')
        print('Top-level keys:', list(config.keys())[:10])
except Exception as e:
    print('✗ YAML parsing error:', e)
    import traceback
    traceback.print_exc()
" 2>&1

echo ""
echo "Step 5: Check exact handlers section structure..."
docker exec peer0.lto.gov.ph cat -n /var/hyperledger/fabric/config/core.yaml | grep -B 2 -A 10 "handlers:"

echo ""
echo "Step 6: Check if peer is looking for plugin files..."
docker logs peer0.lto.gov.ph 2>&1 | grep -i "plugin\|\.so\|library" | head -20

echo ""
echo "=========================================="
echo "Diagnostic Complete"
echo "=========================================="
