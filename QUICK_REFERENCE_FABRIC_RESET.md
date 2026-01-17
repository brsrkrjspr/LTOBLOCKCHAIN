# Quick Reference: Fabric Network Reset

## When to Use Complete Reset

Use `scripts/complete-fabric-reset.sh` when:
- ✅ Certificate trust chain errors occur
- ✅ Channel creation fails with policy errors
- ✅ Application can't connect to Fabric
- ✅ After major crypto material changes
- ✅ Wallet and certificates are mismatched

## Quick Commands

### Complete Reset (Recommended)
```bash
bash scripts/complete-fabric-reset.sh
```

This script automatically:
1. Cleans up old materials
2. Generates fresh crypto
3. Sets up admincerts at all levels
4. Creates channel
5. Deploys chaincode
6. Regenerates wallet

### Manual Steps (If Script Fails)

```bash
# 1. Cleanup
docker compose -f docker-compose.unified.yml down -v
sudo rm -rf fabric-network/crypto-config fabric-network/channel-artifacts wallet

# 2. Generate crypto
docker run --rm -v "$(pwd)/config:/config" -v "$(pwd)/fabric-network:/fabric-network" \
    -u $(id -u):$(id -g) hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=/config/crypto-config.yaml --output=/fabric-network/crypto-config

# 3. Setup admincerts (CRITICAL!)
ADMIN_CERT="fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/signcerts/Admin@lto.gov.ph-cert.pem"
mkdir -p fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp/{admincerts,signcerts}
cp "$ADMIN_CERT" fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp/admincerts/
cp "$ADMIN_CERT" fabric-network/crypto-config/peerOrganizations/lto.gov.ph/msp/signcerts/

# 4. Generate artifacts
mkdir -p config/crypto-config
cp -r fabric-network/crypto-config/* config/crypto-config/
docker run --rm -v "$(pwd)/config:/config" -v "$(pwd)/fabric-network:/fabric-network" \
    -e FABRIC_CFG_PATH=/config hyperledger/fabric-tools:2.5 \
    configtxgen -profile Genesis -channelID system-channel -outputBlock /fabric-network/channel-artifacts/genesis.block
docker run --rm -v "$(pwd)/config:/config" -v "$(pwd)/fabric-network:/fabric-network" \
    -e FABRIC_CFG_PATH=/config hyperledger/fabric-tools:2.5 \
    configtxgen -profile Channel -outputCreateChannelTx /fabric-network/channel-artifacts/channel.tx -channelID ltochannel
rm -rf config/crypto-config

# 5. Start containers
docker compose -f docker-compose.unified.yml up -d
sleep 30

# 6. Create channel
docker exec cli peer channel create -o orderer.lto.gov.ph:7050 -c ltochannel \
    -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/channel.tx \
    --tls --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/lto.gov.ph/orderers/orderer.lto.gov.ph/msp/tlscacerts/tlsca.lto.gov.ph-cert.pem

# 7. Join peer
docker exec cli peer channel join -b ltochannel.block

# 8. Deploy chaincode (see FABRIC_NETWORK_RESET_COMPLETE.md for full commands)

# 9. Regenerate wallet
node scripts/setup-fabric-wallet.js
```

## Database Migrations

After reset, ensure database tables exist:

```bash
# Refresh tokens and sessions
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_refresh_tokens.sql

# Token blacklist
docker exec -i postgres psql -U lto_user -d lto_blockchain < backend/migrations/add_token_blacklist.sql
```

## Verification Checklist

- [ ] Channel exists: `docker exec cli peer channel list`
- [ ] Chaincode committed: `docker exec cli peer lifecycle chaincode querycommitted --channelID ltochannel --name vehicle-registration`
- [ ] Wallet exists: `ls -la wallet/admin.id`
- [ ] App connected: `docker logs lto-app | grep "Connected to Hyperledger Fabric"`
- [ ] Database tables: `docker exec -it postgres psql -U lto_user -d lto_blockchain -c "\dt"`

## Common Issues

### "Policy not satisfied" error
→ Organization-level admincerts missing. Re-run Step 3.

### "Certificate signed by unknown authority"
→ Wallet has old certificates. Regenerate wallet (Step 9/10).

### "Table does not exist"
→ Run database migrations.

### "Channel creation failed"
→ Check orderer logs: `docker logs orderer.lto.gov.ph --tail 50`

## Full Documentation

See `FABRIC_NETWORK_RESET_COMPLETE.md` for complete details.
