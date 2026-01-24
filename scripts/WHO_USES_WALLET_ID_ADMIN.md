# Who Uses Wallet ID 'admin'?

**Date:** 2026-01-24

---

## 🔍 **ANSWER: Backend Service (Singleton) - ALL Users Share It**

### **Who Uses Wallet ID 'admin':**

**The `OptimizedFabricService` singleton uses wallet ID 'admin' for ALL blockchain transactions.**

---

## 📋 **DETAILED BREAKDOWN**

### **1. Service Architecture**

**File:** `backend/services/optimizedFabricService.js:1327-1329`

```javascript
// SINGLETON INSTANCE - One instance for entire application
const optimizedFabricService = new OptimizedFabricService();
optimizedFabricService.initialize().catch(err => console.error('Fabric init error:', err));
module.exports = optimizedFabricService;
```

**Key Point:** This is a **SINGLETON** - one instance shared by the entire backend application.

---

### **2. Wallet ID Usage**

**File:** `backend/services/optimizedFabricService.js:64-72`

```javascript
await this.gateway.connect(connectionProfile, {
    wallet: this.wallet,
    identity: 'admin',  // ← ALWAYS 'admin' - same for everyone
    discovery: { enabled: true, asLocalhost: asLocalhost },
    ...
});
```

**Key Point:** The service **ALWAYS** uses wallet ID `'admin'` for all Fabric connections.

---

### **3. Who Calls This Service?**

**All backend routes import the same singleton:**

| Route File | Usage | Who Can Call |
|------------|-------|--------------|
| `backend/routes/lto.js` | `fabricService.registerVehicle()` | `admin`, `lto_admin`, `lto_officer` |
| `backend/routes/transfer.js` | `fabricService.transferOwnership()` | `admin`, `lto_admin`, `lto_officer` |
| `backend/routes/vehicles.js` | `fabricService.getVehicle()` | `admin`, `lto_admin`, `lto_officer`, `vehicle_owner` |
| `backend/routes/blockchain.js` | `fabricService.*` | `admin`, `lto_admin`, `lto_officer` |
| `backend/routes/ledger.js` | `fabricService.getAllTransactions()` | `admin`, `lto_admin`, `lto_officer` |

**Key Point:** Multiple routes use the same service instance, which uses the same wallet ID.

---

### **4. Transaction Flow Example**

**When ANY user registers a vehicle:**

```
1. User (e.g., vehicle_owner@example.com) submits vehicle registration
   ↓
2. Backend route: POST /api/lto/approve-clearance
   ↓
3. Route checks: req.user.role (e.g., 'lto_officer')
   ↓
4. Route calls: fabricService.registerVehicle(vehicleData)
   ↓
5. optimizedFabricService uses wallet ID 'admin' (ALWAYS)
   ↓
6. Gateway connects with identity: 'admin' (mspId: 'LTOMSP')
   ↓
7. Transaction submitted to Fabric
   ↓
8. Transaction signed with 'admin' certificate
   ↓
9. Chaincode receives:
   - Transaction creator: 'admin' (from Fabric identity)
   - Owner info: vehicleData.owner (from transaction payload)
```

---

## ⚠️ **CRITICAL ARCHITECTURE POINT**

### **Shared Service Identity:**

- ✅ **Backend Service:** Uses wallet ID `'admin'` for ALL transactions
- ✅ **All Users:** Their actions go through the same Fabric identity
- ✅ **User Info:** Stored in transaction payload (email, name, etc.)
- ⚠️ **Blockchain Signature:** Always from 'admin' identity

### **What This Means:**

1. **All blockchain transactions are authenticated as 'admin'**
   - Vehicle registration → Signed by 'admin'
   - Ownership transfer → Signed by 'admin'
   - Verification updates → Signed by 'admin'

2. **User identification happens at application level**
   - PostgreSQL tracks which user initiated the action
   - Chaincode stores owner info in transaction data
   - But blockchain signature is always 'admin'

3. **This is a valid architecture for:**
   - ✅ **Server-side applications** (current implementation)
   - ✅ **Centralized LTO operations** (all actions through LTO system)
   - ⚠️ **NOT ideal for:** Per-user blockchain identities (would require Fabric CA)

---

## 📊 **WHO USES IT - COMPLETE LIST**

### **Direct Users:**

1. ✅ **`OptimizedFabricService` class** - Uses wallet ID 'admin' internally
   - Location: `backend/services/optimizedFabricService.js:66`

### **Indirect Users (via service):**

2. ✅ **LTO Officers** (`lto_officer`) - When approving clearances/inspections
   - Route: `POST /api/lto/approve-clearance`
   - Calls: `fabricService.registerVehicle()`

3. ✅ **LTO Admins** (`lto_admin`) - When managing vehicles/transfers
   - Routes: All LTO and transfer routes
   - Calls: `fabricService.*` methods

4. ✅ **Legacy Admins** (`admin`) - When performing admin actions
   - Routes: All admin routes
   - Calls: `fabricService.*` methods

5. ✅ **Vehicle Owners** (`vehicle_owner`) - When viewing blockchain data
   - Route: `GET /api/blockchain/vehicles/:vin`
   - Calls: `fabricService.getVehicle()`

6. ✅ **System Scripts** - When backfilling or querying
   - Scripts: `register-missing-vehicles-on-blockchain.js`, `query-fabric-vehicles.js`
   - Calls: `fabricService.*` methods

---

## 🔐 **SECURITY MODEL**

### **Current Architecture:**

```
Application Layer (PostgreSQL):
├── User: vehicle_owner@example.com (authenticated via JWT)
├── User: lto_officer@lto.gov.ph (authenticated via JWT)
└── User: admin@lto.gov.ph (authenticated via JWT)

Blockchain Layer (Fabric):
└── Identity: 'admin' (LTOMSP) ← ALL transactions use this
```

### **Authentication Flow:**

1. **User authenticates** → JWT token issued (contains userId, role, email)
2. **User makes request** → Backend validates JWT token
3. **Backend calls Fabric** → Uses wallet ID 'admin' (service identity)
4. **Fabric validates** → Checks 'admin' identity belongs to LTOMSP
5. **Transaction committed** → Signed with 'admin' certificate

---

## ✅ **SUMMARY**

### **Who Uses Wallet ID 'admin':**

- ✅ **Backend Service** (`OptimizedFabricService`) - The singleton service
- ✅ **ALL Users** - Indirectly, through the backend service
- ✅ **ALL Routes** - That call `fabricService.*` methods
- ✅ **System Scripts** - That interact with Fabric

### **Key Points:**

1. **Single Shared Identity:** One wallet ID 'admin' for entire application
2. **Service-Level Authentication:** Backend authenticates to Fabric as 'admin'
3. **User-Level Tracking:** User info stored in transaction payload, not Fabric identity
4. **Valid Architecture:** Standard for server-side blockchain applications

**Status:** ✅ **CORRECT** - Wallet ID 'admin' is used by the backend service singleton, which handles ALL blockchain transactions for ALL users.
