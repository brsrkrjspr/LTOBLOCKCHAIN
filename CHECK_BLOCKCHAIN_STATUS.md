# How to Check Blockchain Status

## Quick Status Check Commands

### 1. Check via API (Browser/Postman)
```bash
# Using curl
curl http://localhost:3000/api/blockchain/status

# Or with authentication token
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/api/blockchain/status
```

### 2. Check via Browser Console
Open browser console (F12) and run:
```javascript
// Check blockchain status
fetch('/api/blockchain/status')
    .then(res => res.json())
    .then(data => {
        console.log('Blockchain Status:', data);
        if (data.success && data.blockchain) {
            console.log('Status:', data.blockchain.status);
            console.log('Connected:', data.blockchain.status === 'CONNECTED');
            console.log('Network:', data.blockchain.networkName);
            console.log('Channel:', data.blockchain.channelName);
            console.log('Chaincode:', data.blockchain.chaincodeName);
            console.log('Peers:', data.blockchain.peers);
        }
    })
    .catch(err => console.error('Error:', err));
```

### 3. Check Backend Logs
Look for these messages in your backend console:
- ✅ `Connected to Hyperledger Fabric network successfully` - Connected
- ❌ `Failed to connect to Fabric network` - Disconnected
- 🔗 `Connecting to Hyperledger Fabric network...` - Attempting connection

### 4. Check Fabric Service Directly (Node.js)
If you have access to the backend, you can check:
```javascript
const fabricService = require('./backend/services/optimizedFabricService');
const status = fabricService.getStatus();
console.log('Fabric Status:', status);
console.log('Is Connected:', status.isConnected);
```

### 5. Check Docker Containers (If using Docker)
```bash
# Check if Fabric containers are running
docker ps | grep fabric

# Check Fabric network status
docker-compose -f docker-compose.fabric.yml ps

# View Fabric logs
docker-compose -f docker-compose.fabric.yml logs peer0.lto.example.com
```

### 6. Check Environment Variables
Ensure these are set in your `.env` file:
```bash
BLOCKCHAIN_MODE=fabric
FABRIC_AS_LOCALHOST=true  # or false if using Docker network names
FABRIC_NETWORK_NAME=trustchain-network
FABRIC_CHANNEL_NAME=ltochannel
FABRIC_CHAINCODE_NAME=vehicle-registration
```

### 7. Check Network Configuration
Verify these files exist:
- `network-config.json` (or `network-config.yaml`)
- `wallet/` directory with admin user enrolled

### 8. Test Connection Manually
```bash
# If you have Fabric CLI tools installed
peer channel list

# Or check if you can query the chaincode
peer chaincode query -C ltochannel -n vehicle-registration -c '{"function":"GetAllVehicles","Args":[]}'
```

## Troubleshooting

### If Status Shows "Disconnected":

1. **Check if Fabric network is running:**
   ```bash
   docker ps | grep peer
   docker ps | grep orderer
   ```

2. **Check backend initialization:**
   - Look for initialization errors in backend logs
   - Verify `fabricService.initialize()` was called successfully

3. **Check wallet:**
   ```bash
   ls -la wallet/
   # Should see admin user identity
   ```

4. **Check network-config.json:**
   ```bash
   cat network-config.json
   # Verify it's valid JSON and has correct peer/orderer endpoints
   ```

5. **Restart backend service:**
   ```bash
   # If using PM2
   pm2 restart lto-backend
   
   # If using npm
   npm restart
   
   # If using Docker
   docker-compose restart backend
   ```

### Expected Response Format
```json
{
  "success": true,
  "blockchain": {
    "networkName": "trustchain-network",
    "channelName": "ltochannel",
    "chaincodeName": "vehicle-registration",
    "chaincodeVersion": "1.0",
    "status": "CONNECTED",
    "network": "Hyperledger Fabric",
    "channel": "ltochannel",
    "contract": "vehicle-registration",
    "timestamp": "2025-01-01T12:00:00.000Z",
    "peers": [
      {
        "name": "peer0.lto.example.com",
        "status": "UP",
        "port": 7051
      }
    ],
    "orderer": {
      "name": "orderer.example.com",
      "status": "UP",
      "port": 7050
    }
  }
}
```

## UI Status Badge

The status badge in the dashboard header will automatically:
- Show "Connected" (green) when `status === 'CONNECTED'`
- Show "Disconnected" (red) when `status === 'DISCONNECTED'`
- Update every 30 seconds
- Show peer count when connected

If the badge shows "Disconnected" but Fabric is actually running, check:
1. Backend logs for API errors
2. Browser console for network errors
3. CORS settings if accessing from different domain
4. Authentication token if endpoint requires auth

