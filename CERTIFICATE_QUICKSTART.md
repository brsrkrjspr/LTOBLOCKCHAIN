# 🚀 Quick Start: New Certificate Architecture

**For: Developers, External Organizations, and Admins**

---

## 1️⃣ For External Organizations (Insurance, Emission, HPG)

### Get Your API Key
1. Contact LTO IT Department
2. Provide your organization details
3. Receive API key via secure channel
4. Keep API key confidential

### Issue a Certificate

**Insurance Company Example:**
```bash
curl -X POST http://localhost:3001/api/issuer/insurance/issue-certificate \
  -H "X-Issuer-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleVIN": "MHRVJ06P447123456",
    "ownerName": "Juan Dela Cruz",
    "policyNumber": "CTPL-2024-00123",
    "coverage": {
      "bodily_injury": "PHP 100,000",
      "property_damage": "PHP 50,000"
    },
    "effectiveDate": "2026-01-17",
    "expiryDate": "2027-01-17",
    "certificateFile": "BASE64_ENCODED_PDF"
  }'
```

**Response:**
```json
{
  "success": true,
  "certificate": {
    "id": "cert-uuid-123",
    "policyNumber": "CTPL-2024-00123",
    "verificationCode": "ABC123XYZ789",
    "blockchainTxId": "tx-id-456"
  }
}
```

### Revoke a Certificate
```bash
curl -X POST http://localhost:3001/api/issuer/certificates/CERT_ID/revoke \
  -H "X-Issuer-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Policy cancelled by request"
  }'
```

---

## 2️⃣ For Vehicle Owners

### Upload Your Certificate

**Step 1: Prepare the file**
- Format: PDF, JPG, or PNG
- Size: Max 10MB
- Quality: Clear, legible

**Step 2: Submit via browser**
1. Log in to owner dashboard
2. Click "Upload Certificate"
3. Select certificate type (Insurance, Emission, or HPG)
4. Choose your file
5. Click "Upload"

**Step 3: System automatically verifies**
- Calculates file hash
- Compares against blockchain
- Shows verification result immediately

### Check Submission Status
1. Go to "My Vehicles"
2. Select vehicle
3. View "Certificate Submissions"
4. See verification status: VERIFIED, REJECTED, or PENDING

---

## 3️⃣ For LTO Admins

### Dashboard Features

**View All Submissions:**
```bash
GET /api/certificate-uploads/vehicle/{vehicleId}
Authorization: Bearer {admin_token}
```

**Check Specific Submission:**
```bash
GET /api/certificate-uploads/submissions/{submissionId}
Authorization: Bearer {admin_token}
```

### Manual Verification (if needed)

**Approve a Certificate:**
```bash
curl -X POST http://localhost:3001/api/certificates/submissions/SUBMISSION_ID/verify \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "approve",
    "notes": "Manually verified - certificate appears legitimate"
  }'
```

**Reject a Certificate:**
```bash
curl -X POST http://localhost:3001/api/certificates/submissions/SUBMISSION_ID/verify \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "reject",
    "notes": "Document quality too poor - request new submission"
  }'
```

### Verify Certificate Authenticity (Public)

Anyone can verify a certificate using:
```bash
curl -X GET http://localhost:3001/api/issuer/certificates/verify/{compositeHash}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "certificate": {
    "certificateNumber": "CTPL-2024-00123",
    "certificateType": "insurance",
    "vehicleVIN": "MHRVJ06P447123456",
    "ownerName": "Juan Dela Cruz",
    "issuer": "LTO Insurance Services",
    "issuedAt": "2026-01-17",
    "expiresAt": "2027-01-17"
  },
  "validity": {
    "status": "VALID"
  }
}
```

---

## 🔄 Complete Flow Example

### Insurance Registration Scenario

**Day 1: Insurance Company**
1. Insurance company issues policy
2. Calls: `POST /api/issuer/insurance/issue-certificate`
3. Provides: VIN, policy number, coverage, certificate PDF
4. Receives: Certificate ID, verification code, blockchain TX ID
5. Delivers certificate PDF to customer

**Day 2: Vehicle Owner**
1. Receives insurance certificate PDF from insurance company
2. Logs into LTO owner portal
3. Uploads certificate: `POST /api/certificate-uploads/submit`
4. System automatically verifies hash against blockchain
5. Result: ✅ VERIFIED (certificate is authentic)

**Day 3: LTO Admin (if needed)**
1. Receives notification of new submission
2. Reviews submission in admin dashboard
3. Sees: VERIFIED status, issuer name, expiry date
4. Approves registration

**Anytime: Public Verification**
1. Anyone can verify certificate using public endpoint
2. Scans QR code from certificate
3. System confirms: Certificate is valid, issued by LTO Insurance Services
4. Shows: VIN, owner name, expiry date, etc.

---

## ⚙️ Technical Details

### Hash Verification Process

```
1. External org issues certificate
   ↓
2. System calculates: SHA-256(certificate_pdf)
   ↓
3. Stores hash on blockchain
   ↓
4. Owner uploads certificate to LTO
   ↓
5. System calculates: SHA-256(uploaded_pdf)
   ↓
6. Compares hashes
   ├─ If match: ✅ VERIFIED (authentic)
   └─ If no match: ❌ REJECTED (fake or tampered)
```

### Automatic Detection

System automatically detects:
- ✅ Revoked certificates (organization revoked it)
- ✅ Expired certificates (past expiry date)
- ✅ Tampered documents (hash mismatch)
- ✅ Duplicate submissions (same cert used twice)

---

## 🆘 Common Issues & Solutions

**"Certificate verification failed"**
- Certificate file was modified or corrupted
- Try uploading original PDF from issuer
- Contact issuer if no original available

**"API Key rejected"**
- Verify API key is correct (check email from LTO IT)
- Ensure API key header format: `X-Issuer-API-Key`
- Contact LTO for API key reset

**"Certificate hash already exists"**
- This exact certificate was already submitted
- Cannot reuse certificates
- Request new certificate from issuer

**"Certificate has expired"**
- Certificate passed expiry date
- Contact issuer for renewal
- Submit new certificate once renewed

---

## 📞 Support

**For External Organizations:**
- API Integration: blockchain-team@lto.gov.ph
- Issues: support@lto.gov.ph
- Documentation: See CERTIFICATE_ARCHITECTURE_MIGRATION.md

**For Vehicle Owners:**
- Technical Issues: support@lto.gov.ph
- Upload Problems: help@lto.gov.ph

**For LTO Admins:**
- System Issues: blockchain-team@lto.gov.ph
- User Support: admin-support@lto.gov.ph

---

## 📚 Full Documentation

- [CERTIFICATE_ARCHITECTURE_MIGRATION.md](CERTIFICATE_ARCHITECTURE_MIGRATION.md) - Detailed migration guide
- [backend/routes/issuer.js](backend/routes/issuer.js) - External issuer API documentation
- [backend/routes/certificate-upload.js](backend/routes/certificate-upload.js) - Owner upload API documentation
- [IMPLEMENTATION_COMPLETE_CERTIFICATE_REDESIGN.md](IMPLEMENTATION_COMPLETE_CERTIFICATE_REDESIGN.md) - Complete implementation summary

---

## ✅ Getting Started Checklist

**For External Organizations:**
- [ ] Request API key from LTO
- [ ] Receive and secure API key
- [ ] Test issuance with sample certificate
- [ ] Integrate with production system
- [ ] Train staff on new process

**For Vehicle Owners:**
- [ ] Get certificate from issuer (insurance/emission/HPG)
- [ ] Save certificate PDF
- [ ] Log in to LTO portal
- [ ] Upload certificate
- [ ] Verify it was accepted

**For LTO Admins:**
- [ ] Access admin dashboard
- [ ] Review pending submissions
- [ ] Test approval/rejection workflow
- [ ] Verify public endpoint works
- [ ] Monitor system performance

---

**Ready to get started?** Choose your role above and follow the steps! 🎉
