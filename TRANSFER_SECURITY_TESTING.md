# Transfer of Ownership - Security Testing Plan

## Overview
This document outlines security testing procedures for the email-based ownership transfer flow (Option A) implemented in the TrustChain LTO system.

## Test Categories

### 1. Authentication & Authorization

#### 1.1 Endpoint Authentication
**Test:** All transfer-related endpoints require valid JWT authentication.

**Endpoints to Test:**
- `POST /api/vehicles/transfer/requests` (Seller creates request)
- `GET /api/vehicles/transfer/requests/pending-for-buyer` (Buyer views pending)
- `POST /api/vehicles/transfer/requests/:id/accept` (Buyer accepts)
- `POST /api/vehicles/transfer/requests/:id/reject-by-buyer` (Buyer rejects)
- `POST /api/vehicles/transfer/requests/:id/approve` (Admin approves)
- `POST /api/vehicles/transfer/requests/:id/reject` (Admin rejects)

**Test Cases:**
1. ✅ Request without token → Should return 401 Unauthorized
2. ✅ Request with invalid token → Should return 401 Unauthorized
3. ✅ Request with expired token → Should return 401 Unauthorized
4. ✅ Request with valid token → Should succeed

**Commands:**
```bash
# Test without token
curl -X POST http://localhost:3000/api/vehicles/transfer/requests \
  -H "Content-Type: application/json" \
  -d '{"vehicleId": "test"}'

# Test with invalid token
curl -X POST http://localhost:3000/api/vehicles/transfer/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token" \
  -d '{"vehicleId": "test"}'
```

#### 1.2 Role-Based Authorization
**Test:** Endpoints enforce correct role requirements.

**Test Cases:**
1. ✅ Seller creates request → Requires `vehicle_owner` or `admin` role
2. ✅ Buyer views/accepts/rejects → Requires `vehicle_owner` or `admin` role
3. ✅ Admin approves/rejects → Requires `admin` role only
4. ✅ Non-owner cannot create transfer for another's vehicle
5. ✅ Non-buyer cannot accept/reject transfer request

**Commands:**
```bash
# Test as vehicle_owner (should succeed)
curl -X POST http://localhost:3000/api/vehicles/transfer/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <vehicle_owner_token>" \
  -d '{"vehicleId": "<owner_vehicle_id>", "buyerEmail": "buyer@example.com"}'

# Test as non-owner (should fail with 403)
curl -X POST http://localhost:3000/api/vehicles/transfer/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <other_user_token>" \
  -d '{"vehicleId": "<someone_elses_vehicle_id>", "buyerEmail": "buyer@example.com"}'
```

### 2. Token Security (Email Invite Tokens)

#### 2.1 Token Validation
**Test:** Transfer invite tokens are properly validated.

**Endpoints:**
- `GET /api/vehicles/transfer/requests/preview-from-token` (Public preview)

**Test Cases:**
1. ✅ Valid token → Returns preview data
2. ✅ Invalid token → Returns 400 Bad Request
3. ✅ Expired token → Returns 400 Bad Request
4. ✅ Token with mismatched buyerEmail → Returns 403 Forbidden
5. ✅ Token for non-existent request → Returns 404 Not Found

**Commands:**
```bash
# Test with valid token
curl "http://localhost:3000/api/vehicles/transfer/requests/preview-from-token?token=<valid_token>"

# Test with invalid token
curl "http://localhost:3000/api/vehicles/transfer/requests/preview-from-token?token=invalid"

# Test with expired token (wait 3+ days or modify expiry)
curl "http://localhost:3000/api/vehicles/transfer/requests/preview-from-token?token=<expired_token>"
```

#### 2.2 Token Payload Security
**Test:** Token payload contains minimal, non-sensitive data.

**Expected Token Payload:**
```json
{
  "type": "transfer_invite",
  "transferRequestId": "uuid",
  "buyerEmail": "buyer@example.com",
  "exp": 1234567890
}
```

**Test Cases:**
1. ✅ Token does not contain sensitive PII (license numbers, full addresses)
2. ✅ Token buyerEmail matches database buyer_info.email
3. ✅ Token cannot be reused after transfer is completed/rejected

### 3. Data Exposure & Privacy

#### 3.1 Preview Endpoint (Public)
**Test:** Public preview endpoint exposes minimal data.

**Endpoint:** `GET /api/vehicles/transfer/requests/preview-from-token`

**Test Cases:**
1. ✅ Returns only vehicle summary (plate, make, model, year, partial VIN)
2. ✅ Returns seller name and masked email only
3. ✅ Does NOT return full user profiles
4. ✅ Does NOT return document IDs or IPFS hashes
5. ✅ Does NOT return buyer PII beyond what's already known

**Expected Response:**
```json
{
  "success": true,
  "preview": {
    "transferRequestId": "uuid",
    "status": "PENDING",
    "vehicle": {
      "vin": "4T1BF1FK...",
      "plateNumber": "ABC-1234",
      "make": "Toyota",
      "model": "Vios",
      "year": "2020"
    },
    "seller": {
      "name": "John Doe",
      "emailMasked": "jo***@example.com"
    }
  }
}
```

#### 3.2 Buyer Identity Matching
**Test:** Buyer can only access transfers intended for them.

**Test Cases:**
1. ✅ Buyer can view transfers where `buyer_id` matches their user ID
2. ✅ Buyer can view transfers where `buyer_info.email` matches their email
3. ✅ Buyer cannot view transfers intended for other users
4. ✅ Email matching is case-insensitive

**Commands:**
```bash
# Test buyer viewing their own pending transfers
curl -X GET http://localhost:3000/api/vehicles/transfer/requests/pending-for-buyer \
  -H "Authorization: Bearer <buyer_token>"

# Should only return transfers where buyer_id or buyer_info.email matches
```

### 4. Rate Limiting & Abuse Prevention

#### 4.1 Transfer Creation Rate Limiting
**Test:** Prevent spam/abuse of transfer creation.

**Test Cases:**
1. ⚠️ **TODO:** Implement rate limiting (e.g., max 10 transfers per seller per hour)
2. ⚠️ **TODO:** Log all transfer creation attempts with IP and user ID
3. ⚠️ **TODO:** Alert on suspicious patterns (many transfers to same email)

**Implementation Notes:**
- Consider using `express-rate-limit` middleware
- Store rate limit counters in Redis or memory
- Configure limits per endpoint:
  - Transfer creation: 10/hour per seller
  - Preview-from-token: 20/hour per IP
  - Accept/reject: 50/hour per buyer

#### 4.2 Email Invite Abuse Prevention
**Test:** Prevent email spam/abuse.

**Test Cases:**
1. ⚠️ **TODO:** Throttle email sending (max 5 invites per seller per hour)
2. ⚠️ **TODO:** Prevent duplicate invites to same email for same vehicle
3. ⚠️ **TODO:** Log all email send attempts

**Implementation Notes:**
- Check for existing pending transfer for vehicle + buyerEmail
- Store email send timestamps in database or cache
- Implement exponential backoff for failed sends

### 5. Input Validation & Sanitization

#### 5.1 Transfer Request Creation
**Test:** Input validation prevents invalid data.

**Endpoint:** `POST /api/vehicles/transfer/requests`

**Test Cases:**
1. ✅ Missing `vehicleId` → Returns 400 Bad Request
2. ✅ Missing `buyerEmail` → Returns 400 Bad Request
3. ✅ Invalid email format → Returns 400 Bad Request
4. ✅ Non-existent `vehicleId` → Returns 404 Not Found
5. ✅ Vehicle not owned by seller → Returns 403 Forbidden
6. ✅ Duplicate pending request for same vehicle → Returns 409 Conflict
7. ✅ Invalid document IDs → Skips invalid docs, continues with valid ones

**Commands:**
```bash
# Test missing vehicleId
curl -X POST http://localhost:3000/api/vehicles/transfer/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"buyerEmail": "buyer@example.com"}'

# Test invalid email
curl -X POST http://localhost:3000/api/vehicles/transfer/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"vehicleId": "123", "buyerEmail": "not-an-email"}'
```

#### 5.2 Document Role Validation
**Test:** Document roles are validated against allowed types.

**Test Cases:**
1. ✅ Valid roles (deedOfSale, sellerId, buyerId, orCr) → Accepted
2. ✅ Invalid roles → Rejected or mapped to OTHER
3. ✅ Missing required documents → Request still created (validation at LTO review)

### 6. Status Transition Security

#### 6.1 Status Flow Validation
**Test:** Status transitions follow correct flow.

**Expected Flow:**
```
PENDING → REVIEWING (buyer accepts) → APPROVED (admin approves) → COMPLETED
PENDING → REJECTED (buyer rejects OR admin rejects)
REVIEWING → APPROVED (admin approves) → COMPLETED
REVIEWING → REJECTED (admin rejects)
```

**Test Cases:**
1. ✅ Buyer can only accept/reject when status is PENDING or REVIEWING
2. ✅ Admin can only approve when status is PENDING or REVIEWING
3. ✅ Cannot accept/reject already APPROVED/COMPLETED/REJECTED requests
4. ✅ Status changes are logged with timestamps and user IDs

**Commands:**
```bash
# Test accepting already approved request (should fail)
curl -X POST http://localhost:3000/api/vehicles/transfer/requests/<approved_id>/accept \
  -H "Authorization: Bearer <buyer_token>"
```

### 7. Database & Data Integrity

#### 7.1 Buyer Identity Resolution
**Test:** Buyer identity is correctly resolved and stored.

**Test Cases:**
1. ✅ Existing user email → Sets `buyer_id` immediately
2. ✅ New user email → Stores `buyer_info` JSONB, sets `buyer_id` on acceptance
3. ✅ Buyer acceptance updates `buyer_id` if previously NULL
4. ✅ Buyer info is cleared of sensitive data after `buyer_id` is set

**SQL Verification:**
```sql
-- Check buyer resolution
SELECT id, buyer_id, buyer_info, status 
FROM transfer_requests 
WHERE id = '<request_id>';

-- Verify buyer_id is set after acceptance
SELECT id, buyer_id, buyer_info->>'email' as buyer_email, status
FROM transfer_requests
WHERE status = 'REVIEWING';
```

#### 7.2 Document Linking
**Test:** Documents are correctly linked with proper roles.

**Test Cases:**
1. ✅ Documents linked with explicit roles (deedOfSale, sellerId, etc.)
2. ✅ Document IDs exist in `documents` table
3. ✅ Transfer documents stored in `transfer_documents` table
4. ✅ Document roles match `TRANSFER_ROLES` enum

**SQL Verification:**
```sql
-- Check linked documents
SELECT td.*, d.document_type, d.original_name
FROM transfer_documents td
JOIN documents d ON td.document_id = d.id
WHERE td.transfer_request_id = '<request_id>';
```

### 8. Email Security

#### 8.1 Email Content
**Test:** Email content is secure and non-revealing.

**Test Cases:**
1. ✅ Email does not contain full VIN (only partial)
2. ✅ Email does not contain sensitive buyer PII
3. ✅ Email contains secure, time-limited token
4. ✅ Email link uses HTTPS in production

**Email Template Check:**
- Subject: "Vehicle Ownership Transfer Request - TrustChain LTO"
- Body: Contains vehicle summary, seller name, secure link
- Link format: `https://ltoblockchain.duckdns.org/transfer-confirmation.html?token=<JWT>`

### 9. Frontend Security

#### 9.1 Token Handling
**Test:** Frontend securely handles tokens.

**Test Cases:**
1. ✅ Token stored in `sessionStorage` (not `localStorage`)
2. ✅ Token cleared after use or logout
3. ✅ Token not exposed in URLs after initial load
4. ✅ Token not logged to console in production

#### 9.2 XSS Prevention
**Test:** User input is sanitized to prevent XSS.

**Test Cases:**
1. ✅ Vehicle/seller names are escaped in HTML
2. ✅ Email addresses are validated and sanitized
3. ✅ Document filenames are sanitized before display

### 10. Integration Testing

#### 10.1 End-to-End Flow
**Test:** Complete transfer flow works securely.

**Test Flow:**
1. Seller creates transfer request with buyer email
2. Email sent to buyer (mock in dev)
3. Buyer clicks link, sees preview (no login required)
4. Buyer logs in, redirected to pending transfers
5. Buyer accepts transfer
6. Admin reviews and approves
7. Ownership transferred in DB and Fabric

**Test Cases:**
1. ✅ Each step requires correct authentication
2. ✅ Status transitions are correct
3. ✅ Buyer cannot accept after admin rejection
4. ✅ Admin cannot approve before buyer acceptance (if required)

## Test Execution

### Manual Testing Checklist

- [ ] Test seller creates transfer request
- [ ] Test buyer receives email (check logs)
- [ ] Test preview-from-token endpoint
- [ ] Test buyer login and redirect
- [ ] Test buyer views pending transfers
- [ ] Test buyer accepts transfer
- [ ] Test buyer rejects transfer
- [ ] Test admin views pending transfers
- [ ] Test admin approves transfer
- [ ] Test admin rejects transfer
- [ ] Test status transitions
- [ ] Test duplicate request prevention
- [ ] Test unauthorized access attempts

### Automated Testing (Future)

**Recommended Test Framework:** Jest + Supertest

**Test Files:**
- `backend/tests/transfer-auth.test.js`
- `backend/tests/transfer-authorization.test.js`
- `backend/tests/transfer-validation.test.js`
- `backend/tests/transfer-status-flow.test.js`
- `backend/tests/transfer-token-security.test.js`

## Security Monitoring

### Logging Requirements

All transfer-related actions should log:
- User ID and email
- IP address
- Timestamp
- Action type (create, accept, reject, approve)
- Transfer request ID
- Vehicle ID
- Status changes

### Alert Conditions

Alert on:
- Multiple failed authentication attempts
- Unusual transfer patterns (many transfers to same email)
- Token validation failures
- Status transition violations
- Database constraint violations

## Remediation Notes

### Current Gaps

1. ⚠️ **Rate limiting not implemented** - Add `express-rate-limit` middleware
2. ⚠️ **Email throttling not implemented** - Add send tracking
3. ⚠️ **Automated tests not written** - Create Jest test suite
4. ⚠️ **Security monitoring not configured** - Set up alerts

### Priority Fixes

1. **High:** Implement rate limiting on transfer creation
2. **High:** Add email send throttling
3. **Medium:** Write automated security tests
4. **Medium:** Configure security monitoring/alerts
5. **Low:** Add CSRF protection (if needed)

## References

- Backend Routes: `backend/routes/transfer.js`
- Frontend Pages: `transfer-ownership.html`, `transfer-confirmation.html`, `my-vehicle-ownership.html`
- Database Schema: `database/add-transfer-ownership.sql`
- Document Types: `backend/config/documentTypes.js`
