# 🔍 Chaincode Traceability Enhancement

**Date:** 2026-01-24  
**Objective:** Ensure owner, past owner, current owner, and LTO officer who approved are fully traceable through chaincode

---

## ✅ **ENHANCEMENTS IMPLEMENTED**

### **1. Past Owners Tracking**

**Added to Vehicle Record:**
- `pastOwners` array - Tracks all previous owners with transfer details
- Each entry includes:
  - Owner information (email, firstName, lastName)
  - Transfer date
  - Transfer reason
  - Transaction ID

**Chaincode Location:** `chaincode/vehicle-registration-production/index.js:66`

```javascript
pastOwners: [], // Track all past owners for audit trail
```

**Updated During Transfer:**
```javascript
vehicle.pastOwners.push({
    owner: previousOwner,
    transferDate: timestamp,
    transferReason: transfer.reason || 'Ownership transfer',
    transactionId: txId
});
```

---

### **2. Officer Information Tracking**

**Enhanced History Entries:**
- All history entries now include `officerInfo` object
- Contains:
  - `userId` - Database user ID
  - `email` - Officer email
  - `name` - Officer full name
  - `mspId` - MSP organization ID

**Chaincode Location:** `chaincode/vehicle-registration-production/index.js`

**Registration History:**
```javascript
history: [{
    action: 'REGISTERED',
    timestamp: timestamp,
    performedBy: ctx.clientIdentity.getMSPID(),
    officerInfo: {
        userId: officerInfo.userId || null,
        email: officerInfo.email || null,
        name: officerInfo.name || null,
        mspId: ctx.clientIdentity.getMSPID()
    },
    details: 'Vehicle registration submitted',
    transactionId: txId
}]
```

**Transfer History:**
```javascript
history.push({
    action: 'OWNERSHIP_TRANSFERRED',
    timestamp: timestamp,
    performedBy: ctx.clientIdentity.getMSPID(),
    officerInfo: {
        userId: officerInfo.userId || null,
        email: officerInfo.email || null,
        name: officerInfo.name || null,
        mspId: ctx.clientIdentity.getMSPID()
    },
    previousOwner: { email, firstName, lastName },
    newOwner: { email, firstName, lastName },
    details: `Ownership transferred from ${previousOwner.email} to ${newOwner.email}`,
    transactionId: txId,
    transferData: transfer
});
```

**Verification History:**
```javascript
history.push({
    action: `VERIFICATION_${status}`,
    timestamp: timestamp,
    performedBy: ctx.clientIdentity.getMSPID(),
    officerInfo: officerInfo ? {
        userId: officerInfo.userId || null,
        email: officerInfo.email || null,
        name: officerInfo.name || null,
        mspId: ctx.clientIdentity.getMSPID()
    } : { mspId: ctx.clientIdentity.getMSPID() },
    details: `${verifierType} verification ${status.toLowerCase()}`,
    transactionId: txId,
    notes: notes || '',
    verifierType: verifierType
});
```

---

### **3. New Chaincode Query Functions**

**Added Functions:**

#### **GetOwnershipHistory**
- Returns current owner + all past owners
- Returns all ownership transfer transactions

**Usage:**
```javascript
const result = await contract.evaluateTransaction('GetOwnershipHistory', vin);
// Returns: { currentOwner, pastOwners[], ownershipTransfers[] }
```

#### **GetOfficerApprovals**
- Returns all actions performed by LTO officers
- Filters history for entries with officer information

**Usage:**
```javascript
const result = await contract.evaluateTransaction('GetOfficerApprovals', vin);
// Returns: { registeredByOfficer, officerActions[] }
```

**Chaincode Location:** `chaincode/vehicle-registration-production/index.js:397-450`

---

### **4. Backend Integration**

**Transfer Ownership (`backend/routes/transfer.js`):**
- Now includes `officerInfo` in `transferData`
- Passes officer userId, email, and name to chaincode

```javascript
const transferData = {
    reason: 'Ownership transfer approved',
    transferDate: new Date().toISOString(),
    approvedBy: req.user.email,
    currentOwnerEmail: vehicle.owner_email,
    officerInfo: {
        userId: req.user.userId,
        email: req.user.email,
        name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email
    },
    approvedByEmail: req.user.email,
    approvedByName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email
};
```

**Vehicle Registration (`backend/routes/lto.js`):**
- Now includes `officerInfo` in `vehicleData`
- Tracks which LTO officer registered the vehicle

```javascript
const vehicleData = {
    // ... vehicle fields ...
    officerInfo: {
        userId: req.user.userId,
        email: req.user.email,
        name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email
    }
};
```

**Verification Status Update (`backend/routes/vehicles.js`):**
- Now includes `officerInfo` in notes (JSON format)
- Chaincode parses JSON to extract officer information

```javascript
const notesWithOfficer = JSON.stringify({
    notes: notes || '',
    officerInfo: {
        userId: req.user.userId,
        email: req.user.email,
        name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email
    }
});
```

---

## 📊 **TRACEABILITY DATA STRUCTURE**

### **Vehicle Record Structure:**

```javascript
{
    vin: "ABC1234567890XYZ",
    owner: {
        email: "current@owner.com",
        firstName: "Current",
        lastName: "Owner"
    },
    pastOwners: [
        {
            owner: {
                email: "previous@owner.com",
                firstName: "Previous",
                lastName: "Owner"
            },
            transferDate: "2026-01-24T10:00:00.000Z",
            transferReason: "Ownership transfer",
            transactionId: "tx123456"
        }
    ],
    history: [
        {
            action: "REGISTERED",
            timestamp: "2026-01-20T10:00:00.000Z",
            performedBy: "LTOMSP",
            officerInfo: {
                userId: "user-uuid-123",
                email: "officer@lto.gov.ph",
                name: "John Doe",
                mspId: "LTOMSP"
            },
            transactionId: "tx123456"
        },
        {
            action: "OWNERSHIP_TRANSFERRED",
            timestamp: "2026-01-24T10:00:00.000Z",
            performedBy: "LTOMSP",
            officerInfo: {
                userId: "user-uuid-456",
                email: "approver@lto.gov.ph",
                name: "Jane Smith",
                mspId: "LTOMSP"
            },
            previousOwner: {
                email: "previous@owner.com",
                firstName: "Previous",
                lastName: "Owner"
            },
            newOwner: {
                email: "current@owner.com",
                firstName: "Current",
                lastName: "Owner"
            },
            transactionId: "tx789012"
        }
    ],
    registeredByOfficer: "user-uuid-123"
}
```

---

## 🔍 **QUERY EXAMPLES**

### **Get Current Owner:**
```javascript
const vehicle = await contract.evaluateTransaction('GetVehicle', vin);
const currentOwner = JSON.parse(vehicle).owner;
```

### **Get All Past Owners:**
```javascript
const ownershipHistory = await contract.evaluateTransaction('GetOwnershipHistory', vin);
const pastOwners = JSON.parse(ownershipHistory).pastOwners;
```

### **Get Officer Who Approved Transfer:**
```javascript
const history = await contract.evaluateTransaction('GetVehicleHistory', vin);
const transfers = JSON.parse(history).filter(h => h.action === 'OWNERSHIP_TRANSFERRED');
const approvingOfficer = transfers[transfers.length - 1].officerInfo;
```

### **Get All Officer Actions:**
```javascript
const approvals = await contract.evaluateTransaction('GetOfficerApprovals', vin);
const officerActions = JSON.parse(approvals).officerActions;
```

---

## ✅ **TRACEABILITY REQUIREMENTS MET**

| Requirement | Status | Implementation |
|------------|--------|----------------|
| **Current Owner** | ✅ | `vehicle.owner` field |
| **Past Owners** | ✅ | `vehicle.pastOwners[]` array |
| **Ownership Transfer History** | ✅ | `history[]` filtered by `OWNERSHIP_TRANSFERRED` |
| **LTO Officer Who Approved** | ✅ | `history[].officerInfo` for all actions |
| **Registration Officer** | ✅ | `registeredByOfficer` field + `history[0].officerInfo` |
| **Transfer Approval Officer** | ✅ | `history[].officerInfo` in transfer entries |
| **Verification Approval Officer** | ✅ | `history[].officerInfo` in verification entries |

---

## 🎯 **BENEFITS**

1. **Complete Audit Trail:** Every action is traceable to a specific officer
2. **Ownership History:** Full chain of ownership from registration to current
3. **Forensic Analysis:** Can trace who approved what and when
4. **Compliance:** Meets regulatory requirements for vehicle registration systems
5. **Accountability:** Officers are accountable for their approvals

---

## 📝 **NOTES**

- **Backward Compatibility:** Existing vehicles without `pastOwners` array will initialize it as empty
- **Officer Info Optional:** If officer info is not provided, only MSPID is stored (backward compatible)
- **JSON Parsing:** Chaincode attempts to parse notes as JSON for officer info, falls back to plain text if not JSON

---

**Enhancement Complete:** 2026-01-24  
**Status:** ✅ **All traceability requirements implemented**
