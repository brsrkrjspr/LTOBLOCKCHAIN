# Auto-Send Documents for Verification - Complete Analysis

**Date:** 2026-01-24  
**File:** `backend/services/clearanceService.js`  
**Trigger:** After vehicle registration submission

---

## Overview

When a vehicle registration is submitted, the system **automatically sends documents** to relevant organizations (HPG and Insurance) for verification. This happens immediately after registration, without requiring manual intervention.

---

## Entry Point

**Location:** `backend/routes/vehicles.js` (Line 1551-1569)

**Trigger:** After vehicle creation and document linking

```javascript
const clearanceService = require('../services/clearanceService');
autoSendResults = await clearanceService.autoSendClearanceRequests(
    newVehicle.id,
    registrationData.documents,
    requestedBy  // Owner user ID
);
```

**Error Handling:** If auto-send fails, registration still succeeds (non-blocking)

---

## Main Function: `autoSendClearanceRequests()`

**File:** `backend/services/clearanceService.js` (Line 17-208)

### Process Flow

#### **Step 1: Document Retrieval** (Lines 30-47)
```javascript
// Wait 100ms to ensure documents are committed to database
await new Promise(resolve => setTimeout(resolve, 100));

// Get all documents for the vehicle
let allDocuments = await db.getDocumentsByVehicle(vehicleId);

// Retry if no documents found (race condition handling)
if (allDocuments.length === 0) {
    await new Promise(resolve => setTimeout(resolve, 500));
    allDocuments = await db.getDocumentsByVehicle(vehicleId);
}
```

**Purpose:** Ensures documents are fully committed before querying

---

#### **Step 2: HPG Document Detection** (Lines 56-114)

**For New Registration:**
- **Required:** `owner_id` OR `hpg_clearance`
- **Logic:** Either document type is sufficient

**Detection Method:**
```javascript
const hasHPGDocs = allDocuments.some(d => {
    const dbType = d.document_type;
    
    // Direct database type check
    if (isNewRegistration) {
        if (dbType === 'owner_id' || dbType === 'hpg_clearance') {
            return true;
        }
    }
    
    // Fallback: check mapped logical type
    const logicalType = docTypes.mapToLogicalType(dbType);
    return logicalType === 'ownerId' || logicalType === 'hpgClearance';
});
```

**If Documents Found:**
- Calls `sendToHPG()` to create clearance request
- **Does NOT trigger full auto-verification** (manual only)

**If No Documents:**
- Skips HPG request creation
- Logs detailed diagnostic information

---

#### **Step 3: Insurance Document Detection** (Lines 116-167)

**Required:** `insurance_cert` OR `insurance`

**Detection Method:**
```javascript
const hasInsuranceDoc = allDocuments.some(d => {
    const dbType = d.document_type;
    
    // Direct database type check
    if (dbType === 'insurance_cert' || dbType === 'insurance') {
        return true;
    }
    
    // Fallback: check mapped logical type
    const logicalType = docTypes.mapToLogicalType(dbType);
    return logicalType === 'insuranceCert';
});
```

**If Document Found:**
- Calls `sendToInsurance()` to create clearance request
- **Triggers auto-verification automatically**
- If auto-approved, sets clearance request status to `APPROVED`

**If No Document:**
- Skips insurance request creation
- Logs available document types for debugging

---

#### **Step 4: Vehicle Status Update** (Lines 169-199)

**If at least one request was sent:**
```javascript
await db.updateVehicle(vehicleId, { status: 'SUBMITTED' });
```

**History Entry:**
- Action: `CLEARANCE_REQUESTS_AUTO_SENT`
- Description: Includes which organizations received requests
- Metadata: Contains request IDs and auto-verification results

---

## HPG Request Creation: `sendToHPG()`

**File:** `backend/services/clearanceService.js` (Line 213-563)

### Process

#### **Step 1: Duplicate Check** (Lines 216-231)
- Checks if HPG request already exists
- Returns early if duplicate found

#### **Step 2: Find HPG Admin** (Lines 233-238)
```javascript
const hpgAdmins = await dbModule.query(
    "SELECT id FROM users WHERE role = 'admin' AND 
     (organization = 'Highway Patrol Group' OR email LIKE '%hpg%') 
     AND is_active = true LIMIT 1"
);
const assignedTo = hpgAdmins.rows[0]?.id || null;
```

#### **Step 3: Filter HPG Documents** (Lines 253-318)

**For New Registration:**
- Filters: `ownerId`, `hpgClearance`
- Finds: Owner ID document, HPG Clearance document

**For Transfer:**
- Filters: `ownerId`, `registrationCert`
- Finds: Owner ID document, OR/CR document

#### **Step 4: Create Clearance Request** (Lines 324-364)
```javascript
const clearanceRequest = await db.createClearanceRequest({
    vehicleId,
    requestType: 'hpg',
    requestedBy,
    purpose: 'Initial Vehicle Registration - HPG Clearance',
    notes: 'Automatically sent upon vehicle registration submission',
    metadata: {
        vehicleVin, vehiclePlate, vehicleMake, vehicleModel,
        ownerIdDocId, ownerIdDocCid, ownerIdDocPath,
        hpgClearanceDocId, hpgClearanceDocCid, hpgClearanceDocPath,
        documents: hpgDocuments.map(d => ({
            id: d.id,
            type: d.document_type,
            cid: d.ipfs_cid,
            path: d.file_path,
            filename: d.original_name
        }))
    },
    assignedTo  // HPG admin user ID
});
```

#### **Step 5: Phase 1 Automation** (Lines 406-548)

**For Transfers:**
- **OCR Extraction:** Extracts data from OR/CR document
- **Data Matching:** Compares extracted data with vehicle record

**For New Registrations:**
- **Metadata Extraction:** Uses vehicle metadata (no OCR needed)

**Database Check:**
- Checks vehicle against HPG hot list database
- If flagged, adds warning to notes and creates urgent notification

**Result:**
```javascript
return {
    sent: true,
    requestId: clearanceRequest.id,
    automation: {
        phase1: {
            completed: true,
            isTransfer,
            ocrExtracted: isTransfer && Object.keys(extractedData).length > 0,
            databaseChecked: !!databaseCheckResult,
            databaseStatus: databaseCheckResult?.status || 'ERROR'
        }
    }
};
```

**Note:** HPG does NOT get full auto-verification - only Phase 1 automation (OCR + database check)

---

## Insurance Request Creation: `sendToInsurance()`

**File:** `backend/services/clearanceService.js` (Line 568-712)

### Process

#### **Step 1: Duplicate Check** (Lines 569-583)
- Checks if insurance request already exists
- Returns early if duplicate found

#### **Step 2: Find Insurance Verifier** (Lines 585-589)
```javascript
const insuranceVerifiers = await dbModule.query(
    "SELECT id FROM users WHERE role = 'insurance_verifier' 
     AND is_active = true LIMIT 1"
);
const assignedTo = insuranceVerifiers.rows[0]?.id || null;
```

#### **Step 3: Find Insurance Document** (Lines 591-606)
- Searches for `insurance_cert` or `insurance` document type
- Falls back to filename check if type not found

#### **Step 4: Create Clearance Request** (Lines 608-631)
```javascript
const clearanceRequest = await db.createClearanceRequest({
    vehicleId,
    requestType: 'insurance',
    requestedBy,
    purpose: 'Initial Vehicle Registration - Insurance Verification',
    notes: 'Automatically sent upon vehicle registration submission',
    metadata: {
        vehicleVin, vehiclePlate, vehicleMake, vehicleModel,
        documentId: insuranceDoc?.id,
        documentCid: insuranceDoc?.ipfs_cid,
        documentPath: insuranceDoc?.file_path,
        documents: insuranceDocuments
    },
    assignedTo  // Insurance verifier user ID
});
```

#### **Step 5: Auto-Verification** (Lines 658-705)

**⚠️ KEY DIFFERENCE: Insurance gets FULL auto-verification**

```javascript
if (insuranceDoc) {
    const autoVerificationService = require('./autoVerificationService');
    autoVerificationResult = await autoVerificationService.autoVerifyInsurance(
        vehicleId,
        insuranceDoc,
        vehicle
    );
    
    // If auto-approved, update clearance request status
    if (autoVerificationResult.automated && autoVerificationResult.status === 'APPROVED') {
        await db.updateClearanceRequestStatus(clearanceRequest.id, 'APPROVED', {
            verifiedBy: 'system',
            verifiedAt: new Date().toISOString(),
            notes: `Auto-verified and approved. Score: ${autoVerificationResult.score}%`,
            autoVerified: true,
            autoVerificationResult
        });
    }
}
```

**Auto-Verification Checks:**
1. Document format validation
2. Certificate number format validation (regex: `/^CTPL-\d{4}-[A-Z0-9]{6}$/`)
3. OCR extraction (policy number, expiry date, coverage)
4. Blockchain authenticity check (file hash matching)
5. Data comparison (vehicle VIN, plate number)

**Result:**
```javascript
return {
    sent: true,
    requestId: clearanceRequest.id,
    autoVerification: autoVerificationResult  // Contains status, score, confidence
};
```

---

## Key Differences: HPG vs Insurance

| Aspect | HPG | Insurance |
|--------|-----|-----------|
| **Auto-Verification** | ❌ No (Phase 1 only) | ✅ Yes (Full) |
| **Phase 1 Automation** | ✅ Yes (OCR + DB check) | ❌ No |
| **Status Update** | `PENDING` (manual) | `APPROVED` (if passes) |
| **Manual Review** | ✅ Always required | ❌ Only if fails |
| **Documents Sent** | Owner ID + HPG Clearance | Insurance Certificate |
| **Admin Assignment** | HPG admin (`role='admin'`, `org='Highway Patrol Group'`) | Insurance verifier (`role='insurance_verifier'`) |

---

## Document Detection Logic

### HPG Detection

**New Registration:**
```javascript
// Checks for EITHER:
- document_type === 'owner_id' OR
- document_type === 'hpg_clearance' OR
- logicalType === 'ownerId' OR
- logicalType === 'hpgClearance'
```

**Transfer:**
```javascript
// Checks for EITHER:
- document_type === 'owner_id' OR
- document_type === 'or_cr' OR
- document_type === 'registration_cert' OR
- logicalType === 'ownerId' OR
- logicalType === 'registrationCert'
```

### Insurance Detection

```javascript
// Checks for:
- document_type === 'insurance_cert' OR
- document_type === 'insurance' OR
- logicalType === 'insuranceCert' OR
- filename.toLowerCase().includes('insurance')
```

---

## Response Structure

**Returned to Registration Endpoint:**
```javascript
{
    hpg: {
        sent: true/false,
        requestId: 'uuid' | null,
        error: string | null,
        automation: {  // Only for HPG
            phase1: {
                completed: true,
                isTransfer: false,
                ocrExtracted: false,
                databaseChecked: true,
                databaseStatus: 'CLEAR' | 'FLAGGED' | 'ERROR'
            }
        }
    },
    insurance: {
        sent: true/false,
        requestId: 'uuid' | null,
        error: string | null,
        autoVerification: {  // Only for Insurance
            status: 'APPROVED' | 'PENDING',
            automated: true,
            score: 95,
            confidence: 0.95,
            reason: string | null
        }
    }
}
```

---

## Issues & Observations

### ✅ **Working Correctly:**

1. **Document Detection:** Robust detection using both database types and logical types
2. **Race Condition Handling:** Retry logic for document retrieval
3. **Error Handling:** Non-blocking - registration succeeds even if auto-send fails
4. **Insurance Auto-Verification:** Fully automated and working
5. **HPG Phase 1 Automation:** OCR extraction and database checks working

### ⚠️ **Potential Issues:**

1. **HPG No Auto-Verification:**
   - HPG requests always require manual review
   - Phase 1 automation only (OCR + database check)
   - No full auto-verification like Insurance

2. **Document Type Mapping:**
   - Relies on `documentTypes` config for type mapping
   - If document type is `'other'`, it won't be detected
   - Logs warning but doesn't fail

3. **Admin Assignment:**
   - If no HPG admin found, request created with `assignedTo = null`
   - If no insurance verifier found, request created with `assignedTo = null`
   - May require manual assignment later

4. **Transfer vs New Registration:**
   - Detection logic differs between transfer and new registration
   - Transfer logic may not be fully tested in auto-send context

---

## Frontend Integration

**Location:** `backend/routes/vehicles.js` (Line 1571-1602)

**Response to Frontend:**
```json
{
    "success": true,
    "vehicle": { /* vehicle data */ },
    "clearanceRequests": {
        "hpg": true/false,
        "insurance": true/false
    },
    "autoVerification": {
        "insurance": {
            "status": "APPROVED" | "PENDING",
            "automated": true,
            "score": 95,
            "confidence": 0.95,
            "reason": null
        }
    }
}
```

**Frontend Display:**
- Shows which organizations received requests
- Shows insurance auto-verification status (if available)
- HPG status always shows as "Pending" (requires manual review)

---

## Summary

### **What Happens Automatically:**

1. ✅ **Document Detection:** System detects HPG and Insurance documents
2. ✅ **Clearance Request Creation:** Creates requests in `clearance_requests` table
3. ✅ **Admin Assignment:** Assigns to HPG admin or Insurance verifier
4. ✅ **Notification:** Creates notifications for assigned admins
5. ✅ **Insurance Auto-Verification:** Fully automated verification and approval
6. ✅ **HPG Phase 1 Automation:** OCR extraction and database checks
7. ✅ **Vehicle Status Update:** Updates vehicle status to `SUBMITTED`

### **What Requires Manual Action:**

1. ❌ **HPG Verification:** Always requires manual review
2. ❌ **HPG Approval:** Must be approved by HPG admin
3. ⚠️ **Failed Auto-Verification:** Insurance that fails auto-verification requires manual review

### **Key Takeaway:**

**Insurance documents are automatically verified and can be auto-approved.**  
**HPG documents are automatically sent but always require manual verification.**

This design makes sense because:
- Insurance certificates can be fully validated (format, blockchain, OCR)
- HPG clearance requires human judgment and final approval authority
