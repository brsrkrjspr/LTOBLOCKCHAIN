# Quick Fix: Peer FABRIC_CFG_PATH Error

## **Run the Fix Script**

On your Linux server, run:

```bash
cd ~/LTOBLOCKCHAIN
bash scripts/fix-peer-fabric-cfg-path.sh
```

Or make it executable first (if needed):

```bash
chmod +x scripts/fix-peer-fabric-cfg-path.sh
./scripts/fix-peer-fabric-cfg-path.sh
```

---

## **What the Script Does**

1. ✅ Creates `fabric-network/config/` directory
2. ✅ Creates `fabric-network/config/core.yaml` file
3. ✅ Stops Docker containers
4. ✅ Starts Docker containers
5. ✅ Waits 30 seconds for containers to start
6. ✅ Shows container status
7. ✅ Shows peer logs
8. ✅ Verifies peer is running without errors

---

## **Expected Output**

You should see:
```
✓ core.yaml created successfully
✓ Peer container is running!
✓ No FABRIC_CFG_PATH errors found!
Fix completed successfully!
```

---

## **If There Are Still Errors**

Check the logs manually:
```bash
docker logs peer0.lto.gov.ph | tail -50
```

Or check if config was created:
```bash
ls -la fabric-network/config/
cat fabric-network/config/core.yaml | head -20
```
