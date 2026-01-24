# Can LTO Officers Approve/Reject Applications?

## ✅ YES - Officers CAN Approve/Reject Applications

LTO officers (`lto_officer` role) **CAN** approve and reject both:
1. **Vehicle Registration Applications**
2. **Transfer of Ownership Applications**

---

## 🚗 Vehicle Registration Applications

### ✅ Approve Vehicle Registration

**Route:** `PUT /api/vehicles/id/:id/status`  
**Authorization:** `authorizeRole(['admin', 'lto_admin', 'lto_officer'])`  
**Status:** ✅ **OFFICERS CAN ACCESS**

**What Officers Can Do:**
- Set vehicle status to `'APPROVED'` - Approve registration
- Set vehicle status to `'REJECTED'` - Reject registration
- Set vehicle status to `'SUBMITTED'`, `'PROCESSING'`, `'REGISTERED'`

**Code Reference:** `backend/routes/vehicles.js:1659`

```javascript
router.put('/id/:id/status', 
    authenticateToken, 
    authorizeRole(['admin', 'lto_admin', 'lto_officer']),  // ✅ Officers allowed
    async (req, res) => {
        const { status, notes } = req.body;
        // Valid statuses: 'SUBMITTED', 'APPROVED', 'REJECTED', 'REGISTERED', 'PROCESSING'
        await db.updateVehicle(id, { status: status, notes: notes });
        // ...
    }
);
```

### ✅ Approve Clearance (Final Approval)

**Route:** `POST /api/lto/approve-clearance`  
**Authorization:** `authorizeRole(['admin', 'lto_admin', 'lto_officer'])`  
**Status:** ✅ **OFFICERS CAN ACCESS**

**What Officers Can Do:**
- Approve clearance after all verifications are complete
- Validates HPG and Insurance approvals before finalizing
- Generates OR/CR numbers
- Registers vehicle on blockchain

**Code Reference:** `backend/routes/lto.js:502`

```javascript
router.post('/approve-clearance', 
    authenticateToken, 
    authorizeRole(['admin', 'lto_admin', 'lto_officer']),  // ✅ Officers allowed
    async (req, res) => {
        // Validates all verifications complete
        // Generates OR/CR numbers
        // Updates vehicle status to APPROVED
        // Registers on blockchain
    }
);
```

---

## 🔄 Transfer of Ownership Applications

### ✅ Approve Transfer Request

**Route:** `POST /api/transfer/requests/:id/approve`  
**Authorization:** `authorizeRole(['admin', 'lto_admin', 'lto_officer'])`  
**Status:** ✅ **OFFICERS CAN ACCESS** (with value limit)

**What Officers Can Do:**
- Approve transfer requests **under 500,000 PHP value**
- Cannot approve transfers over 500k (requires admin/lto_admin)
- Validates all required approvals (HPG, Insurance, MVIR)
- Completes ownership transfer
- Updates blockchain

**Code Reference:** `backend/routes/transfer.js:2772`

```javascript
router.post('/requests/:id/approve', 
    authenticateToken, 
    authorizeRole(['admin', 'lto_admin', 'lto_officer']),  // ✅ Officers allowed
    async (req, res) => {
        // STRICT: lto_officer can only approve transfers under 500k PHP value
        if (userRole === 'lto_officer' && transferValue > 500000) {
            return res.status(403).json({
                error: 'Transfers over 500,000 PHP require admin approval'
            });
        }
        // Approve transfer...
    }
);
```

### ✅ Reject Transfer Request

**Route:** `POST /api/transfer/requests/:id/reject`  
**Authorization:** `authorizeRole(['admin', 'lto_admin', 'lto_officer'])`  
**Status:** ✅ **OFFICERS CAN ACCESS**

**What Officers Can Do:**
- Reject transfer requests with a reason
- No value limit on rejections
- Sends rejection emails to seller and buyer
- Reverts vehicle status

**Code Reference:** `backend/routes/transfer.js:3303`

```javascript
router.post('/requests/:id/reject', 
    authenticateToken, 
    authorizeRole(['admin', 'lto_admin', 'lto_officer']),  // ✅ Officers allowed
    async (req, res) => {
        const { reason } = req.body;
        await db.updateTransferRequestStatus(id, 'REJECTED', req.user.userId, reason);
        // Sends emails, creates notifications...
    }
);
```

---

## 📋 Summary Table

| Application Type | Action | Route | Officer Access | Notes |
|------------------|--------|-------|----------------|-------|
| **Vehicle Registration** | Approve | `PUT /api/vehicles/id/:id/status` | ✅ Yes | Can set status to `APPROVED` |
| **Vehicle Registration** | Reject | `PUT /api/vehicles/id/:id/status` | ✅ Yes | Can set status to `REJECTED` |
| **Vehicle Registration** | Final Approval | `POST /api/lto/approve-clearance` | ✅ Yes | After all verifications complete |
| **Transfer Request** | Approve | `POST /api/transfer/requests/:id/approve` | ✅ Yes | **Only if value < 500k PHP** |
| **Transfer Request** | Reject | `POST /api/transfer/requests/:id/reject` | ✅ Yes | No value limit |

---

## ⚠️ Limitations for Officers

### Transfer Approvals
- ❌ **Cannot approve transfers over 500,000 PHP**
- ✅ Can approve transfers under 500k PHP
- ✅ Can reject transfers of any value

**Why?** High-value transfers require admin-level approval for security and compliance.

### Bulk Operations
- ❌ Cannot bulk approve/reject (admin-only)
- ✅ Must process applications individually

---

## ✅ What Officers CAN Do

### Vehicle Registration
1. ✅ **Review** vehicle registration applications
2. ✅ **Approve** vehicle registrations (set status to `APPROVED`)
3. ✅ **Reject** vehicle registrations (set status to `REJECTED`)
4. ✅ **Final approval** after all verifications complete
5. ✅ **Update status** to any valid status (`SUBMITTED`, `PROCESSING`, `REGISTERED`, etc.)

### Transfer Requests
1. ✅ **Review** transfer requests
2. ✅ **Approve** transfers under 500k PHP
3. ✅ **Reject** transfers of any value
4. ✅ **Verify** documents and MVIR
5. ✅ **Forward** to HPG/Insurance

---

## 🔒 Security Notes

1. **All actions are logged** - Officer actions are recorded in vehicle history and audit logs
2. **Value limits enforced** - Officers cannot approve high-value transfers
3. **Verification required** - Officers must ensure all verifications are complete before final approval
4. **Email notifications** - Owners are notified when applications are approved/rejected

---

## 📝 Example Workflow

### Officer Approving Vehicle Registration:

```javascript
// 1. Officer reviews application
GET /api/vehicles/id/:id

// 2. Officer verifies documents
POST /api/vehicles/:vin/verification
{ verificationType: 'insurance', status: 'APPROVED' }

// 3. Officer approves registration
PUT /api/vehicles/id/:id/status
{ status: 'APPROVED', notes: 'All documents verified' }

// OR final approval after external verifications
POST /api/lto/approve-clearance
{ vehicleId: ':id', notes: 'All verifications complete' }
```

### Officer Approving Transfer:

```javascript
// 1. Officer reviews transfer request
GET /api/transfer/requests/:id

// 2. Officer verifies documents
POST /api/transfer/requests/:id/documents/:docId/verify

// 3. Officer approves (if value < 500k)
POST /api/transfer/requests/:id/approve
{ notes: 'All documents verified, transfer approved' }

// OR rejects
POST /api/transfer/requests/:id/reject
{ reason: 'Missing required documents' }
```

---

## ✅ Conclusion

**YES - Officers CAN approve and reject applications!**

- ✅ Vehicle registration applications - **Full approval/rejection authority**
- ✅ Transfer requests - **Approval authority (with value limit), full rejection authority**

Officers have the necessary permissions to perform their core duties of processing vehicle registrations and transfers.
