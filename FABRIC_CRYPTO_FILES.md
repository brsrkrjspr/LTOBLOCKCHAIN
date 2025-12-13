# Fabric Crypto Related Files
## Complete List of Files for Crypto Material Generation and Wallet Setup

---

## 📁 Core Files

### **1. Configuration Files**

#### `config/crypto-config.yaml`
- **Purpose:** Main crypto configuration for generating certificates
- **Location:** `config/crypto-config.yaml`
- **Usage:** Used by `cryptogen` to generate all cryptographic materials
- **Contains:**
  - Orderer organization configuration
  - Peer organization configuration
  - User definitions
  - NodeOUs settings

#### `fabric-network/crypto-config-simple.yaml`
- **Purpose:** Simplified crypto config (alternative/fallback)
- **Location:** `fabric-network/crypto-config-simple.yaml`
- **Usage:** Fallback if main config not found

---

### **2. Scripts**

#### `scripts/generate-crypto.sh`
- **Purpose:** Generates Fabric cryptographic materials using Docker
- **What it does:**
  1. Checks for `crypto-config.yaml` in multiple locations (root, config/, fabric-network/)
  2. Removes old crypto materials
  3. Runs `cryptogen` in Docker container
  4. Generates certificates, keys, and MSP materials
- **Output:** `fabric-network/crypto-config/` directory

#### `scripts/setup-fabric-wallet.js`
- **Purpose:** Creates wallet with admin identity for Node.js SDK
- **What it does:**
  1. Creates wallet directory
  2. Finds certificate file (any .pem in signcerts)
  3. Finds private key file (any _sk or .pem in keystore)
  4. Creates X.509 identity
  5. Stores in wallet as 'admin'
  6. Sets up admincerts directories
- **Output:** `wallet/admin/` directory with identity

#### `scripts/fix-fabric-crypto.sh`
- **Purpose:** Complete fix for corrupted crypto materials
- **What it does:**
  1. Stops Fabric containers
  2. Removes old crypto materials
  3. Regenerates crypto materials
  4. Sets up admincerts
  5. Removes old wallet
  6. Restarts containers
  7. Recreates wallet
  8. Verifies everything works

---

### **3. Generated Directories**

#### `fabric-network/crypto-config/`
- **Purpose:** Generated cryptographic materials
- **Structure:**
  ```
  crypto-config/
  ├── ordererOrganizations/
  │   └── lto.gov.ph/
  │       ├── orderers/orderer.lto.gov.ph/
  │       └── users/Admin@lto.gov.ph/
  └── peerOrganizations/
      └── lto.gov.ph/
          ├── peers/peer0.lto.gov.ph/
          └── users/
              ├── Admin@lto.gov.ph/
              └── User1@lto.gov.ph/
  ```
- **Key Files:**
  - `msp/signcerts/*.pem` - User certificates
  - `msp/keystore/*_sk` - Private keys
  - `msp/cacerts/*.pem` - CA certificates
  - `msp/admincerts/*.pem` - Admin certificates (for NodeOUs)

#### `wallet/`
- **Purpose:** Node.js SDK wallet for application connections
- **Structure:**
  ```
  wallet/
  └── admin/
      └── [identity files]
  ```
- **Created by:** `scripts/setup-fabric-wallet.js`

---

## 🔧 Usage

### **Generate Crypto Materials:**
```bash
bash scripts/generate-crypto.sh
```

### **Create Wallet:**
```bash
node scripts/setup-fabric-wallet.js
```

### **Fix Corrupted Crypto (Complete Fix):**
```bash
bash scripts/fix-fabric-crypto.sh
```

### **Manual Steps:**
```bash
# 1. Copy config
cp config/crypto-config.yaml fabric-network/crypto-config.yaml

# 2. Generate
docker run --rm \
    -v "$(pwd)/fabric-network:/workspace" \
    -w /workspace \
    hyperledger/fabric-tools:2.5 \
    cryptogen generate --config=./crypto-config.yaml --output=./crypto-config

# 3. Setup wallet
node scripts/setup-fabric-wallet.js
```

---

## 🐛 Common Issues

### **Issue: "crypto-config.yaml not found"**
- **Solution:** Script now checks multiple locations (root, config/, fabric-network/)
- **Fix:** Copy `config/crypto-config.yaml` to `fabric-network/crypto-config.yaml`

### **Issue: "Certificate file not found"**
- **Solution:** Script now finds any .pem file in signcerts directory
- **Fix:** Regenerate crypto materials

### **Issue: "keyPath is not defined"**
- **Solution:** Script now properly finds and defines keyPath
- **Fix:** Updated in `setup-fabric-wallet.js`

### **Issue: "x509: certificate signed by unknown authority"**
- **Solution:** Regenerate crypto materials and restart containers
- **Fix:** Run `bash scripts/fix-fabric-crypto.sh`

---

## 📝 File Dependencies

```
config/crypto-config.yaml
    ↓
scripts/generate-crypto.sh
    ↓
fabric-network/crypto-config/
    ↓
scripts/setup-fabric-wallet.js
    ↓
wallet/admin/
```

---

## ✅ Verification

After setup, verify with:
```bash
# Check crypto materials exist
ls -la fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/signcerts/

# Check wallet exists
ls -la wallet/admin/

# Test Fabric CLI
docker exec cli peer version
```

---

**All files are now properly configured and should work together!**

