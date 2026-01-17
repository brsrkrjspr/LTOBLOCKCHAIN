# 🚀 Certificate Architecture Migration Guide

**Effective Date:** January 17, 2026  
**Migration Deadline:** February 17, 2026  
**Status:** All new functionality deployed and ready for use

---

## 📋 Overview

The LTO blockchain system has been updated to implement the **correct certificate architecture** where:

- **Insurance Companies** issue insurance certificates
- **Emission Testing Centers** issue emission test certificates
- **HPG (Philippine National Police)** issues motor vehicle clearances
- **LTO** receives and verifies certificates from vehicle owners

This document guides developers through migrating from the old (deprecated) system to the new one.

---

## ⚠️ Deprecation Summary

### What's Deprecated

| Component | Status | Deadline |
|-----------|--------|----------|
| `POST /api/certificates/generate` | ❌ Deprecated | 2026-02-17 |
| `certificateGeneratorService.generateInsuranceCertificate()` | ❌ Deprecated | 2026-02-17 |
| `certificateGeneratorService.generateEmissionCertificate()` | ❌ Deprecated | 2026-02-17 |
| `certificateGeneratorService.generateHPGClearance()` | ❌ Deprecated | 2026-02-17 |

### Why These Were Deprecated

LTO cannot legally generate third-party credentials. This violates:
1. **Authority model** - Only authorized organizations can issue their own certificates
2. **Compliance** - Government agencies cannot fabricate insurance/emission/HPG documents
3. **Real-world standards** - No government system generates third-party certificates
4. **Security** - Certificates issued by LTO have no legal weight or verification source

---

## 🔄 Migration Path

### Phase 1: External Organizations Issue Certificates

**For Insurance Companies:**
```bash
POST /api/issuer/insurance/issue-certificate
Headers:
  X-Issuer-API-Key: {insurance_company_api_key}

Body:
{
  "vehicleVIN": "MHRVJ06P447123456",
  "ownerName": "John Doe",
  "policyNumber": "CTPL-2024-0001",
  "coverage": {
    "bodily_injury": "PHP 100,000",
    "property_damage": "PHP 50,000"
  },
  "effectiveDate": "2026-01-17",
  "expiryDate": "2027-01-17",
  "certificateFile": "<base64_encoded_pdf>"
}

Response:
{
  "success": true,
  "certificate": {
    "id": "uuid",
    "policyNumber": "CTPL-2024-0001",
    "verificationCode": "ABC123DEF456",
    "blockchainTxId": "transaction_id"
  }
}
```

**For Emission Testing Centers:**
```bash
POST /api/issuer/emission/issue-certificate
Headers:
  X-Issuer-API-Key: {emission_center_api_key}

Body:
{
  "vehicleVIN": "MHRVJ06P447123456",
  "ownerName": "John Doe",
  "testResults": {
    "result": "PASS",
    "co_level": "0.20",
    "hc_level": "120",
    "nox_level": "0.25",
    "smoke_opacity": "18"
  },
  "testDate": "2026-01-17",
  "expiryDate": "2027-01-17",
  "inspectorName": "Engr. Juan Santos",
  "certificateFile": "<base64_encoded_pdf>"
}

Response:
{
  "success": true,
  "certificate": {
    "id": "uuid",
    "certificateNumber": "ETC-20260117-ABC123",
    "testResult": "PASS",
    "verificationCode": "XYZ789ABC123"
  }
}
```

**For HPG Office:**
```bash
POST /api/issuer/hpg/issue-clearance
Headers:
  X-Issuer-API-Key: {hpg_api_key}

Body:
{
  "vehicleVIN": "MHRVJ06P447123456",
  "ownerName": "John Doe",
  "engineNumber": "3MB123456",
  "chassisNumber": "A1B2C3D4E5F6",
  "inspectionDetails": {
    "engine_condition": "Good",
    "chassis_condition": "Good"
  },
  "clearanceFile": "<base64_encoded_pdf>"
}

Response:
{
  "success": true,
  "certificate": {
    "id": "uuid",
    "certificateNumber": "HPG-2026-ABC123",
    "verificationCode": "PQR456STU789"
  }
}
```

### Phase 2: Vehicle Owners Upload Certificates

**Owner submits certificate to LTO:**
```bash
POST /api/certificate-uploads/submit
Headers:
  Authorization: Bearer {owner_jwt_token}

Body: (form-data)
  vehicleId: "vehicle-uuid"
  certificateType: "insurance" | "emission" | "hpg_clearance"
  file: <PDF/JPG/PNG file>

Response:
{
  "success": true,
  "submission": {
    "id": "submission-uuid",
    "submittedAt": "2026-01-17T10:30:00Z"
  },
  "verification": {
    "status": "VERIFIED",
    "notes": "Certificate verified. Issued by: LTO Insurance Services. Hash matched on blockchain.",
    "matched": true,
    "matchedCertificateId": "cert-uuid"
  }
}
```

### Phase 3: LTO Verifies and Processes

**Automatic verification happens on upload:**
- System calculates hash of uploaded file
- System compares against blockchain records
- If hash matches → Certificate is VERIFIED
- If hash doesn't match → Certificate is REJECTED (fake/tampered)
- Admin can manually review and approve/reject

**Admin verification endpoint:**
```bash
POST /api/certificates/submissions/{submissionId}/verify
Headers:
  Authorization: Bearer {admin_jwt_token}

Body:
{
  "action": "approve" | "reject",
  "notes": "Optional verification notes"
}
```

---

## 🔧 Code Migration Examples

### OLD CODE (❌ Deprecated)

```javascript
// Admin generating certificate - WRONG!
const response = await fetch('/api/certificates/generate', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
        vehicleId: 'vehicle-uuid',
        types: ['insurance', 'emission', 'hpg']
    })
});
```

### NEW CODE (✅ Correct)

```javascript
// Step 1: Insurance company issues certificate (via separate system)
const issueResponse = await fetch('/api/issuer/insurance/issue-certificate', {
    method: 'POST',
    headers: {
        'X-Issuer-API-Key': 'insurance-api-key',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        vehicleVIN: 'MHRVJ06P447123456',
        ownerName: 'John Doe',
        policyNumber: 'CTPL-2024-0001',
        coverage: { /* ... */ },
        effectiveDate: '2026-01-17',
        expiryDate: '2027-01-17',
        certificateFile: base64EncodedPDF
    })
});

// Step 2: Owner receives certificate and uploads to LTO
const uploadResponse = await fetch('/api/certificate-uploads/submit', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${ownerToken}`
    },
    body: formData // Contains vehicleId, certificateType, file
});

// Step 3: System automatically verifies
// No admin action needed unless manual review required
```

---

## 📊 Database Tables

### New Tables Created

#### `external_issuers`
Tracks authorized organizations that issue certificates.

```sql
SELECT * FROM external_issuers;

id                                  | issuer_type | company_name                 | license_number | is_active
3f2b1c4a-5e6d-7f8g-9h0i-j1k2l3m4n5  | insurance   | LTO Insurance Services       | INS-2026-001   | true
4g3c2d5b-6f7e-8g9h-0i1j-k2l3m4n5o6  | emission    | LTO Emission Testing Center  | EMIT-2026-001  | true
5h4d3e6c-7g8f-9h0i-1j2k-l3m4n5o6p7  | hpg         | PNP-HPG National Office      | HPG-2026-001   | true
```

#### `issued_certificates`
Stores certificates issued by external organizations.

```sql
SELECT * FROM issued_certificates;

id                | issuer_id           | certificate_type | certificate_number | vehicle_vin          | file_hash        | composite_hash   | is_revoked
cert-uuid-1       | issuer-uuid-1       | insurance        | CTPL-2024-0001     | MHRVJ06P447123456   | hash123...       | composite_hash1  | false
cert-uuid-2       | issuer-uuid-2       | emission         | ETC-20260117-ABC   | MHRVJ06P447123456   | hash456...       | composite_hash2  | false
```

#### `certificate_submissions`
Tracks when vehicle owners upload certificates.

```sql
SELECT * FROM certificate_submissions;

id              | vehicle_id   | certificate_type | verification_status | matched_certificate_id | verification_notes
submit-uuid-1   | vehicle-uuid | insurance        | VERIFIED           | cert-uuid-1           | Certificate verified...
submit-uuid-2   | vehicle-uuid | emission         | VERIFIED           | cert-uuid-2           | Certificate verified...
submit-uuid-3   | vehicle-uuid | hpg_clearance    | PENDING            | NULL                  | Manual verification required
```

---

## 🔐 Security Features

### Hash-Based Verification

```
Certificate Issued
    ↓
Calculate Hash(certificate_pdf)
    ↓
Store hash on blockchain
    ↓
Owner uploads certificate to LTO
    ↓
LTO calculates Hash(uploaded_pdf)
    ↓
Compare hashes
    ↓
Match? → VERIFIED (authentic)
No match? → REJECTED (fake/tampered)
```

### Duplicate Detection

System prevents same certificate from being used twice:
- File hash uniqueness constraint
- Composite hash uniqueness constraint
- Prevents certificate reuse across vehicles

### Revocation Support

Organizations can revoke issued certificates:
```bash
POST /api/issuer/certificates/{certificateId}/revoke

Body:
{
  "reason": "Certificate mistakenly issued"
}
```

---

## 📅 Timeline

### Current Phase (Completed)
- ✅ Database tables created
- ✅ External issuer APIs implemented
- ✅ Certificate upload system implemented
- ✅ Auto-verification trigger deployed
- ✅ Deprecation warnings added to old system

### Phase 2: Testing & Validation (Jan 24 - Feb 3)
- [ ] Test external issuer APIs
- [ ] Validate hash verification
- [ ] Integration testing with external systems
- [ ] User training materials

### Phase 3: Production Migration (Feb 4 - Feb 14)
- [ ] Gradually redirect requests to new endpoints
- [ ] Monitor old endpoint deprecation warnings
- [ ] Support period for external organizations

### Phase 4: Cleanup (Feb 17 onwards)
- ❌ Old `/api/certificates/generate` endpoint disabled
- ❌ Deprecated certificate generation methods removed
- ✅ New system fully operational

---

## 🆘 Support & Questions

For migration assistance:

1. **Review this document** - Check examples for your use case
2. **Check endpoint documentation** - See `/backend/routes/issuer.js` and `/backend/routes/certificate-upload.js`
3. **Contact LTO IT** - For API key provisioning
4. **Integration issues** - Reach out to blockchain team

---

## ✅ Verification Checklist

Before going live with new system:

- [ ] All external organizations have API keys
- [ ] Test certificate issuance for all three types
- [ ] Verify hash calculation and blockchain storage
- [ ] Test owner upload and verification
- [ ] Validate admin approval workflow
- [ ] Test certificate revocation
- [ ] Performance load testing
- [ ] Rollback procedure tested

---

**Status:** Ready for implementation  
**Last Updated:** 2026-01-17  
**Next Review:** 2026-02-10
