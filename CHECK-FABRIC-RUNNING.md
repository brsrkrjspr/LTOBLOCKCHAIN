# 🔍 Check if Fabric is Actually Running

## Quick Diagnostic Commands

Run these to find the root cause:

```bash
# 1. Check if Fabric containers are running
docker-compose -f docker-compose.unified.yml ps | grep -E "peer0|orderer|couchdb"

# 2. Check application startup logs (did it connect?)
docker logs lto-app 2>&1 | grep -i "fabric\|blockchain\|connected" | head -30

# 3. Test network resolution inside container
docker exec lto-app ping -c 2 peer0.lto.gov.ph

# 4. Check CouchDB (if accessible, Fabric is running)
curl -u admin:adminpw http://localhost:5984/_all_dbs
```

---

## Most Likely Issue: Fabric Containers Not Running

If containers show as "Exited" or missing:

```bash
# Start Fabric network
docker-compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph orderer.lto.gov.ph couchdb

# Wait a few seconds, then check again
docker-compose -f docker-compose.unified.yml ps
```

---

## Critical Question: Is Application Actually Connected?

Check what the application logs show:

```bash
docker logs lto-app 2>&1 | grep -E "fabric|blockchain|connected" | tail -20
```

**If you see:**
- ✅ "✅ Connected to Hyperledger Fabric network successfully" → Application CAN connect
- ❌ "❌ Failed to connect" → Application CANNOT connect (Fabric not running?)
- ⚠️  No Fabric logs → Application might not be using Fabric

---

## If Fabric is Running But Can't Connect

Check network:

```bash
# Verify container is on trustchain network
docker inspect lto-app | grep -A 5 "Networks"

# Test DNS resolution
docker exec lto-app nslookup peer0.lto.gov.ph
```

Run these commands and share the output - this will tell us exactly what's wrong!
