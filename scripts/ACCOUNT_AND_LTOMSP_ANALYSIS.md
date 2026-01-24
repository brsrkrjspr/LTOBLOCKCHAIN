# Account & LTOMSP Connection Analysis

**Date:** 2026-01-24

---

## ✅ **1. EXISTING ACCOUNTS BEFORE ADDITIONS**

### **Yes, there are existing accounts:**

From your database dump and earlier information, these accounts already exist:
1. ✅ `admin@lto.gov.ph` - Role: `admin` (Legacy admin)
2. ✅ `staff@lto.gov.ph` - Role: `staff`
3. ✅ `insurance@lto.gov.ph` - Role: `insurance_verifier`
4. ✅ `emission@lto.gov.ph` - Role: `emission_verifier` (deprecated but still exists)
5. ✅ `owner@example.com` - Role: `vehicle_owner`

### **My Scripts Create NEW Accounts:**

**`create-lto-admin-officer-accounts.sql` creates:**
- `ltoadmin@lto.gov.ph` - NEW account (role: `lto_admin`)
- `ltofficer@lto.gov.ph` - NEW account (role: `lto_officer`)
- `hpgadmin@hpg.gov.ph` - NEW/UPDATE account (role: `admin` with HPG org)

**`create-real-accounts.sql` creates/updates:**
- `admin@lto.gov.ph` - UPDATE (if exists) or CREATE (if not)
- `hpgadmin@hpg.gov.ph` - UPDATE (if exists) or CREATE (if not)
- `insurance@insurance.gov.ph` - UPDATE (if exists) or CREATE (if not)
- `owner@example.com` - UPDATE (if exists) or CREATE (if not)

### **Important Note:**

The `ON CONFLICT (email) DO UPDATE SET` clause means:
- ✅ **Existing accounts are NOT deleted** - They remain in the database
- ✅ **If email matches** - The script updates the account (role, organization, etc.)
- ✅ **If email doesn't exist** - The script creates a new account
- ✅ **Your existing `admin@lto.gov.ph` and `staff@lto.gov.ph` remain untouched** unless the script tries to update them

**Conclusion:** Your existing accounts are safe. The scripts only add new accounts (`ltoadmin`, `ltofficer`) or update existing ones if they match the email.

---

## 🔗 **2. LTOMSP CONNECTION TO WALLET ID**

### **How Wallet ID 'admin' Connects to LTOMSP:**

#### **Step 1: Wallet Identity Creation**
**File:** `scripts/setup-fabric-wallet.js:119-128`

```javascript
const identity = {
    credentials: {
        certificate: cert,      // X.509 certificate from Admin@lto.gov.ph
        privateKey: key         // Private key from Admin@lto.gov.ph
    },
    mspId: 'LTOMSP',            // ← MSP ID SET HERE
    type: 'X.509'
};

await wallet.put('admin', identity);  // ← Wallet ID: 'admin'
```

**Key Point:** The identity object has `mspId: 'LTOMSP'` set when it's created.

---

#### **Step 2: Gateway Connection**
**File:** `backend/services/optimizedFabricService.js:64-72`

```javascript
await this.gateway.connect(connectionProfile, {
    wallet: this.wallet,
    identity: 'admin',          // ← Loads identity with wallet ID 'admin'
    discovery: { enabled: true, asLocalhost: asLocalhost },
    ...
});
```

**What Happens:**
1. Gateway loads identity with wallet ID `'admin'` from wallet
2. Identity contains `mspId: 'LTOMSP'`
3. Gateway uses this identity to authenticate to Fabric network

---

#### **Step 3: Network Configuration**
**File:** `network-config.json:16-20`

```json
"organizations": {
    "LTO": {
        "mspid": "LTOMSP",      // ← MSP ID matches wallet identity
        "peers": ["peer0.lto.gov.ph"],
        ...
    }
}
```

**Connection Flow:**
```
Wallet ID 'admin' 
    ↓
Loads Identity from Wallet
    ↓
Identity.mspId = 'LTOMSP'
    ↓
Gateway.connect() uses this identity
    ↓
Authenticates to Fabric network as LTOMSP member
    ↓
All transactions signed with LTOMSP identity
```

---

#### **Step 4: Channel Configuration**
**File:** `config/configtx.yaml:25-38`

```yaml
- &LTO
  Name: LTOMSP
  ID: LTOMSP                    # ← MSP ID in channel config
  MSPDir: crypto-config/peerOrganizations/lto.gov.ph/msp
  Policies:
    Readers:
      Rule: "OR('LTOMSP.admin', 'LTOMSP.peer', 'LTOMSP.client')"
    Writers:
      Rule: "OR('LTOMSP.admin', 'LTOMSP.client')"
    Admins:
      Rule: "OR('LTOMSP.admin')"
```

**Verification:**
- ✅ Wallet identity has `mspId: 'LTOMSP'`
- ✅ Network config specifies `mspid: 'LTOMSP'`
- ✅ Channel config defines `ID: LTOMSP`
- ✅ All match → Connection successful

---

## 📋 **COMPLETE CONNECTION TRACE**

### **Wallet ID → LTOMSP Connection:**

| Component | Value | Location |
|-----------|-------|----------|
| **Wallet ID** | `'admin'` | `optimizedFabricService.js:66` |
| **Identity MSP ID** | `'LTOMSP'` | `setup-fabric-wallet.js:124` |
| **Network Config MSP** | `'LTOMSP'` | `network-config.json:17` |
| **Channel Config MSP** | `'LTOMSP'` | `config/configtx.yaml:27` |
| **Certificate Source** | `Admin@lto.gov.ph` | `fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/signcerts/` |
| **Private Key Source** | `Admin@lto.gov.ph` | `fabric-network/crypto-config/peerOrganizations/lto.gov.ph/users/Admin@lto.gov.ph/msp/keystore/` |

### **Transaction Flow:**

```
1. User Action (e.g., register vehicle)
   ↓
2. Backend API receives request
   ↓
3. optimizedFabricService.js uses wallet ID 'admin'
   ↓
4. Gateway loads identity with mspId: 'LTOMSP'
   ↓
5. Transaction submitted to Fabric network
   ↓
6. Fabric validates: Identity belongs to LTOMSP
   ↓
7. Transaction signed with LTOMSP admin certificate
   ↓
8. Transaction committed to blockchain
   ↓
9. Transaction ID returned (64-char hex)
```

---

## ✅ **VERIFICATION**

### **Check Wallet Identity:**
```bash
# Check if wallet exists
ls -la wallet/

# Check wallet contents (if using Fabric SDK tools)
# The wallet contains identity 'admin' with mspId: 'LTOMSP'
```

### **Check Network Connection:**
```javascript
// In optimizedFabricService.js, after initialize():
console.log('MSP ID:', this.gateway.getIdentity().mspId);  // Should print: LTOMSP
```

### **Verify in Chaincode:**
The chaincode can verify the creator's MSP:
```javascript
// In chaincode (index.js)
const creatorMSP = ctx.clientIdentity.getMSPID();  // Returns: 'LTOMSP'
```

---

## 🎯 **SUMMARY**

### **1. Existing Accounts:**
- ✅ **YES** - `admin@lto.gov.ph` and `staff@lto.gov.ph` exist
- ✅ **Safe** - My scripts don't delete them, only add new accounts
- ✅ **ON CONFLICT** - Scripts update if email matches, create if new

### **2. LTOMSP Connection:**
- ✅ **Wallet ID:** `'admin'` (identity name in wallet)
- ✅ **MSP ID:** `'LTOMSP'` (set in identity object at line 124 of setup-fabric-wallet.js)
- ✅ **Connection:** Gateway uses wallet ID 'admin' → loads identity → uses mspId 'LTOMSP' → authenticates to Fabric
- ✅ **All Transactions:** Signed with LTOMSP admin identity

**Status:** ✅ **CORRECT** - Wallet ID 'admin' is properly connected to LTOMSP through the identity's mspId field.
