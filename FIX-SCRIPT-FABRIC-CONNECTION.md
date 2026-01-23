# 🔧 Fix: Script Cannot Connect to Fabric Network

## Problem

When running the script on the **host machine** (outside Docker), it fails to connect:

```
Failed to connect before the deadline on Endorser- name: peer0.lto.gov.ph
Failed to connect before the deadline on Committer- name: orderer.lto.gov.ph
```

## Root Cause

The script runs on the **host**, but `network-config.json` uses **Docker internal hostnames** (`peer0.lto.gov.ph`, `orderer.lto.gov.ph`). The host machine cannot resolve these Docker hostnames.

## ✅ Solution

The script now automatically sets `FABRIC_AS_LOCALHOST=true` when running on the host. This tells the Fabric SDK to translate Docker hostnames to `localhost`.

**The fix is already applied** - just run the script again:

```bash
node backend/scripts/register-missing-vehicles-on-blockchain.js
```

## How It Works

1. **Inside Docker** (`FABRIC_AS_LOCALHOST=false`):
   - Uses Docker network names: `peer0.lto.gov.ph:7051`
   - Containers can resolve each other by name

2. **On Host** (`FABRIC_AS_LOCALHOST=true`):
   - SDK translates to: `localhost:7051`
   - Host connects via exposed ports

## Verify Ports Are Exposed

Make sure Docker ports are exposed:

```bash
docker-compose -f docker-compose.unified.yml ps | grep -E "7051|7050"
```

Should show:
```
peer0.lto.gov.ph     ... 0.0.0.0:7051->7051/tcp
orderer.lto.gov.ph   ... 0.0.0.0:7050->7050/tcp
```

## Test Connection

```bash
# Test peer connection
telnet localhost 7051

# Test orderer connection  
telnet localhost 7050
```

If these fail, check firewall rules.
