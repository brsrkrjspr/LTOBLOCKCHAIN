# Document Reupload and Email Reminder System - Complete Trace

## Overview
This document traces the complete workflow for document reupload functionality and automatic email reminders when documents have issues (rejected, pending, discrepancies).

---

## 1. Document Reupload Feature

### 1.1 Frontend Implementation

#### A. Registration Application Document Updates
**File:** `js/owner-dashboard.js`

**Entry Point:**
- User views their applications in `owner-dashboard.html`
- For applications with status: `SUBMITTED`, `PROCESSING`, `REJECTED`, `PENDING`, `UNDER_REVIEW`
- System checks if documents can be updated using `StatusUtils.canUpdateDocuments(status)`

**Document Update Modal:**
- **Function:** `showDocumentUpdateModal(docKey, docLabel, docId, applicationId, isTransferRequest = false, transferRequestId = null, vehicleId = null)`
- **Location:** Lines 3061-3121
- **Features:**
  - Opens modal with document type label
  - File input for PDF, JPG, JPEG, PNG (max 10MB)
  - Shows selected filename
  - Error display area
  - Submit and Cancel buttons

**Document Update Submission:**
- **Function:** `submitDocumentUpdate()`
- **Location:** Lines 3133-3319
- **Workflow:**
  1. Validates file (size, type)
  2. Gets vehicle ID from application context
  3. Maps document key to logical type (e.g., `registrationCert`, `insuranceCert`, `ownerId`)
  4. Uploads new document via `POST /api/documents/upload`
  5. If transfer request context: Links document to transfer request via `POST /api/vehicles/transfer/requests/:id/link-document`
  6. Shows success message
  7. Reloads application list
  8. Optionally reopens application details modal

**Status Check:**
- **File:** `js/status-utils.js`
- **Function:** `canUpdateDocuments(status)`
- **Location:** Lines 116-119
- **Allowed Statuses:** `submitted`, `processing`, `rejected`, `pending`, `under_review`, `awaiting_buyer_docs`
- **Usage:** Determines if "Update Document" button should be shown

#### B. Transfer Request Document Updates
**File:** `js/my-vehicle-ownership.js`

**Entry Point:**
- User views transfer requests in `my-vehicle-ownership.html`
- Shows transfer requests with status that allows updates
- **Function:** `loadMyTransferRequests()` (Lines 758-1102)

**Document Update Integration:**
- **Function:** `updateTransferDocument(docType, docLabel, docId, requestId, vehicleId)`
- **Location:** Lines 1080-1102
- **Workflow:**
  1. Reuses `showDocumentUpdateModal()` from `owner-dashboard.js`
  2. Sets transfer request context (`window.currentTransferRequestId`, `window.currentTransferVehicleId`)
  3. Modal handles both registration and transfer contexts

**Transfer Document Linking:**
- After upload, frontend calls `POST /api/vehicles/transfer/requests/:id/link-document`
- Maps document keys to transfer roles:
  - `deedOfSale` → `DEED_OF_SALE`
  - `sellerId` → `SELLER_ID`
  - `buyerId` → `BUYER_ID`
  - `buyerTin` → `BUYER_TIN`
  - `buyerCtpl` → `BUYER_CTPL`
  - `buyerHpgClearance` → `BUYER_HPG_CLEARANCE`
  - `buyerMvir` → `BUYER_MVIR`

### 1.2 Backend Implementation

#### A. Document Upload Endpoint
**File:** `backend/routes/documents.js`
**Endpoint:** `POST /api/documents/upload`
**Auth:** `authenticateToken`

**Workflow:**
1. Receives file via `multipart/form-data`
2. Validates file (size, type)
3. Calculates file hash (SHA-256)
4. Stores file using `storageService.storeDocument()`
5. Creates document record in `documents` table
6. Returns document ID and metadata

**Key Fields Stored:**
- `vehicle_id` - Links document to vehicle
- `document_type` - Enum type (e.g., `registration_cert`, `insurance_cert`, `owner_id`)
- `file_path` - Local file path
- `ipfs_cid` - IPFS Content ID (if IPFS enabled)
- `file_hash` - SHA-256 hash
- `uploaded_by` - User ID who uploaded

#### B. Transfer Document Linking Endpoint
**File:** `backend/routes/transfer.js`
**Endpoint:** `POST /api/vehicles/transfer/requests/:id/link-document`
**Auth:** `authenticateToken`, `authorizeRole(['vehicle_owner', 'admin'])`
**Location:** Lines 3604-3653

**Workflow:**
1. Validates transfer request exists
2. Checks permissions (seller or admin only)
3. Uses `linkTransferDocuments()` function to link documents
4. Maps document keys to transfer roles
5. Inserts into `transfer_documents` table
6. Returns success confirmation

**Function:** `linkTransferDocuments({ transferRequestId, documents, uploadedBy })`
- **Location:** Lines 65-126
- Maps document keys to `TRANSFER_ROLES` enum values
- Creates entries in `transfer_documents` table linking document to transfer request with specific role

---

## 2. Email Reminder System

### 2.1 Immediate Email Notifications (On Rejection/Issue)

#### A. Registration Document Rejection
**File:** `backend/routes/admin.js`
**Endpoint:** `POST /api/admin/vehicles/:vehicleId/verification/:verificationType/manual`
**Location:** Lines 532-847

**Trigger:**
- Admin manually reviews document verification
- Sets `decision = 'REJECTED'`
- Provides `notes` (rejection reason)

**Email Sending:**
- **Function:** Embedded in manual verification handler (Lines 714-804)
- **Recipient:** Vehicle owner email
- **Subject:** `Document Verification Rejected - {VERIFICATION_TYPE} - TrustChain LTO`
- **Content:**
  - Vehicle details (VIN, plate, make, model)
  - **Reason for rejection** (from `notes` parameter)
  - **Instructions on how to fix:**
    1. Log into TrustChain account
    2. Go to vehicle dashboard
    3. Find application with "Rejected" or "Pending" status
    4. Click "Update Document" button next to the document
    5. Upload corrected document
  - Dashboard link (`${appUrl}/owner-dashboard.html`)

**In-App Notification:**
- **Location:** Lines 811-824
- Creates notification in `notifications` table
- Title: `{VERIFICATION_TYPE} Document Rejected`
- Message: Includes rejection reason
- Type: `error`

#### B. Transfer Request Rejection
**File:** `backend/routes/transfer.js`
**Endpoint:** `POST /api/vehicles/transfer/requests/:id/reject`
**Location:** Lines 2936-3200

**Trigger:**
- Admin rejects transfer request
- Provides `reason` (rejection reason)

**Email Sending:**
- **Recipients:**
  1. Seller email (always)
  2. Buyer email (if different from seller)
- **Subject:** `Transfer Request Rejected - TrustChain LTO`
- **Content:**
  - Vehicle details
  - **Reason for rejection**
  - **Instructions:**
    1. Review rejection reason
    2. Log into TrustChain account
    3. Go to vehicle dashboard
    4. Click "Update Document" button if documents need updating
    5. Upload corrected documents
    6. Contact LTO if questions
  - Dashboard link

**In-App Notification:**
- **Location:** Lines 2983-2992
- Creates notification for seller
- Title: `Transfer Request Rejected`
- Message: Includes rejection reason
- Type: `error`

#### C. Buyer Rejection of Transfer Request
**File:** `backend/routes/transfer.js`
**Endpoint:** `POST /api/vehicles/transfer/requests/:id/reject-by-buyer`
**Location:** Lines 2068-2173

**Email Function:** `sendTransferBuyerRejectionEmail()`
- **Location:** Lines 461-594
- **Recipient:** Seller email
- **Subject:** `Transfer Request Rejected by Buyer - TrustChain LTO`
- **Content:** Informs seller that buyer rejected the transfer request

**In-App Notification:**
- **Location:** Lines 2146-2162
- Creates notification for seller
- Title: `Transfer Request Rejected by Buyer`

### 2.2 Scheduled Email Reminders

#### A. Registration Expiry Reminders
**File:** `backend/services/expiryService.js`
**Scheduled Task:** Daily at 9:00 AM (via `server.js`)

**Function:** `checkExpiringRegistrations()`
- **Location:** Lines 12-76
- **Workflow:**
  1. Queries vehicles with registration expiring in next 30 days
  2. Checks notification flags (`expiry_notified_30d`, `expiry_notified_7d`, `expiry_notified_1d`)
  3. Sends reminder at appropriate window:
     - **30 days before:** First reminder
     - **7 days before:** Important reminder
     - **1 day before:** URGENT reminder
  4. Marks notification flag to prevent duplicates

**Email Function:** `sendExpiryNotification(vehicle, notificationType, daysUntilExpiry)`
- **Location:** Lines 78-336
- **Subject:** `{Urgency}: Vehicle Registration Expiring - TrustChain LTO`
- **Content:**
  - Days until expiry
  - Expiry date
  - Vehicle details
  - Urgency level (Reminder/Important/URGENT)
  - Renewal link
- **In-App Notification:** Also creates notification in `notifications` table

**Scheduling:**
- **File:** `server.js`
- **Location:** Lines 385-463
- **Initialization:** Runs on server startup (after 30 seconds)
- **Daily Schedule:** Checks every hour, runs at 9:00 AM
- **Condition:** Only runs if `NODE_ENV === 'production'` or `ENABLE_SCHEDULED_TASKS === 'true'`

#### B. Transfer Request Deadline Reminders
**Location:** `backend/routes/transfer.js` (Transfer Invite Email)
**Function:** `sendTransferInviteEmail()`
- **Location:** Lines 158-323

**Initial Reminder:**
- Sent when transfer request is created
- **Content:** Includes reminder that buyer must upload required documents within **3 days**
- **Line 270:** `<p style="font-weight: 600; color: #b45309;">Reminder: You must upload the required buyer documents (HPG clearance, MVIR, CTPL, IDs, TIN) within <strong>3 days</strong> of this invitation.</p>`

**Note:** Currently, there is **no scheduled reminder system** for transfer request deadlines. The reminder is only in the initial invite email.

---

## 3. Complete Workflow Traces

### 3.1 Registration Document Rejection → Reupload Flow

```
1. Admin Reviews Document
   ↓
   POST /api/admin/vehicles/:vehicleId/verification/:type/manual
   Body: { decision: 'REJECTED', notes: 'Reason here' }
   ↓
2. Backend Updates Verification Status
   - Updates vehicle_verifications.status = 'REJECTED'
   - Stores notes in verification_metadata
   ↓
3. Email Sent Immediately
   - To: Vehicle owner email
   - Subject: "Document Verification Rejected - {TYPE} - TrustChain LTO"
   - Content: Rejection reason + instructions to update
   ↓
4. In-App Notification Created
   - Stored in notifications table
   - User sees notification in dashboard
   ↓
5. User Views Dashboard
   - owner-dashboard.html loads applications
   - Status check: canUpdateDocuments('rejected') = true
   - "Update Document" button shown next to rejected document
   ↓
6. User Clicks "Update Document"
   - showDocumentUpdateModal() opens
   - User selects new file
   - submitDocumentUpdate() called
   ↓
7. New Document Uploaded
   - POST /api/documents/upload
   - New document record created
   - Linked to same vehicle
   ↓
8. Application Reloaded
   - Updated document appears in application
   - Status may change back to 'PENDING' or 'SUBMITTED'
   ↓
9. Admin Reviews Again
   - Process repeats if still issues
```

### 3.2 Transfer Request Rejection → Reupload Flow

```
1. Admin Rejects Transfer Request
   ↓
   POST /api/vehicles/transfer/requests/:id/reject
   Body: { reason: 'Documents incomplete' }
   ↓
2. Backend Updates Transfer Status
   - Updates transfer_requests.status = 'REJECTED'
   - Stores rejection_reason
   ↓
3. Emails Sent Immediately
   - To: Seller email
   - To: Buyer email (if different)
   - Subject: "Transfer Request Rejected - TrustChain LTO"
   - Content: Rejection reason + update instructions
   ↓
4. In-App Notifications Created
   - For seller
   - For buyer (if different)
   ↓
5. User Views Transfer Requests
   - my-vehicle-ownership.html loads transfer requests
   - Status check: canUpdateDocuments('rejected') = true
   - "Update Document" button shown
   ↓
6. User Clicks "Update Document"
   - updateTransferDocument() called
   - showDocumentUpdateModal() opens with transfer context
   - User selects new file
   ↓
7. New Document Uploaded & Linked
   - POST /api/documents/upload (creates document)
   - POST /api/vehicles/transfer/requests/:id/link-document (links to transfer)
   - Document linked with appropriate transfer role
   ↓
8. Transfer Request Updated
   - New document appears in transfer request
   - Status may change back to 'PENDING' or 'UNDER_REVIEW'
```

### 3.3 Registration Expiry Reminder Flow

```
1. Scheduled Task Runs (Daily at 9:00 AM)
   ↓
   expiryService.checkExpiringRegistrations()
   ↓
2. Database Query
   - Finds vehicles expiring in next 30 days
   - Checks notification flags
   ↓
3. For Each Vehicle in Window
   - Calculates days until expiry
   - Determines notification type (30d/7d/1d)
   - Checks if already notified for this window
   ↓
4. If Should Notify
   - sendExpiryNotification() called
   - Email sent via Gmail API
   - In-app notification created
   - Notification flag marked (expiry_notified_30d/7d/1d)
   ↓
5. User Receives Reminder
   - Email with urgency level
   - In-app notification
   - Dashboard link to renew
```

---

## 4. Email Templates and Content

### 4.1 Document Rejection Email Template

**Structure:**
1. **Header:** "Document Verification Rejected" (red styling)
2. **Vehicle Details Box:** VIN, plate, make, model
3. **Rejection Reason Box:** Admin-provided notes (red border)
4. **Action Instructions Box:** Step-by-step guide (blue border)
   - Log into account
   - Go to dashboard
   - Find application
   - Click "Update Document" button
   - Upload corrected document
5. **Dashboard Link Button:** Direct link to owner dashboard
6. **Footer:** Contact information

**Key Features:**
- HTML and plain text versions
- Responsive design
- Clear call-to-action
- Includes specific document type in subject

### 4.2 Transfer Rejection Email Template

**Structure:**
1. **Header:** "Transfer Request Rejected" (red styling)
2. **Vehicle Details Box:** VIN, plate, make, model
3. **Rejection Reason Box:** Admin-provided reason
4. **Action Instructions Box:** 
   - Review rejection reason
   - Log into account
   - Update documents if needed
   - Contact LTO if questions
5. **Dashboard Link Button**
6. **Footer:** Contact information

**Key Features:**
- Sent to both seller and buyer (if different)
- Includes transfer-specific context
- Clear instructions for document updates

### 4.3 Expiry Reminder Email Template

**Structure:**
1. **Header:** Urgency-based title (Reminder/Important/URGENT)
2. **Urgency Banner:** (For URGENT only) "⚠️ URGENT ACTION REQUIRED"
3. **Expiry Warning Box:** 
   - Days remaining (large number)
   - Expiry date
4. **Vehicle Details Box:** Plate, VIN, expiry date
5. **Renewal Button:** "Renew Registration Now"
6. **Footer:** Contact information

**Urgency Levels:**
- **30 days:** Blue styling, "Reminder"
- **7 days:** Orange styling, "Important"
- **1 day:** Red styling, "URGENT" with banner

---

## 5. Database Schema

### 5.1 Documents Table
**Table:** `documents`
**Key Fields:**
- `id` (UUID) - Primary key
- `vehicle_id` (UUID) - Links to vehicle
- `document_type` (ENUM) - Type of document
- `file_path` (TEXT) - Local file path
- `ipfs_cid` (TEXT) - IPFS Content ID
- `file_hash` (VARCHAR) - SHA-256 hash
- `uploaded_by` (UUID) - User who uploaded
- `uploaded_at` (TIMESTAMP) - Upload timestamp

**Note:** Multiple documents of same type can exist for same vehicle (allows updates)

### 5.2 Transfer Documents Table
**Table:** `transfer_documents`
**Key Fields:**
- `id` (UUID) - Primary key
- `transfer_request_id` (UUID) - Links to transfer request
- `document_type` (VARCHAR) - Transfer role (e.g., `deed_of_sale`, `seller_id`, `buyer_id`)
- `document_id` (UUID) - Links to `documents` table
- `uploaded_by` (UUID) - User who uploaded

**Purpose:** Links documents to specific transfer requests with roles

### 5.3 Notifications Table
**Table:** `notifications`
**Key Fields:**
- `id` (UUID) - Primary key
- `user_id` (UUID) - Recipient user
- `title` (VARCHAR) - Notification title
- `message` (TEXT) - Notification message
- `type` (VARCHAR) - Type: `info`, `error`, `warning`, `success`
- `read` (BOOLEAN) - Read status
- `created_at` (TIMESTAMP) - Creation timestamp

### 5.4 Vehicle Expiry Tracking
**Table:** `vehicles`
**Key Fields:**
- `registration_expiry_date` (DATE) - Expiry date
- `expiry_notified_30d` (BOOLEAN) - 30-day reminder sent
- `expiry_notified_7d` (BOOLEAN) - 7-day reminder sent
- `expiry_notified_1d` (BOOLEAN) - 1-day reminder sent

**Purpose:** Prevents duplicate expiry reminders

---

## 6. API Endpoints Summary

### Document Management
- `POST /api/documents/upload` - Upload new document
- `GET /api/documents/:documentId/view` - View document
- `GET /api/documents/ipfs/:cid` - View document by IPFS CID
- `PUT /api/documents/:id/type` - Update document type (admin only)

### Transfer Document Linking
- `POST /api/vehicles/transfer/requests/:id/link-document` - Link uploaded document to transfer request

### Verification/Rejection
- `POST /api/admin/vehicles/:vehicleId/verification/:type/manual` - Manual verification (can reject)
- `POST /api/vehicles/transfer/requests/:id/reject` - Reject transfer request

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read

---

## 7. Current Limitations and Gaps

### 7.1 Missing Features

1. **Scheduled Reminders for Pending Documents:**
   - ❌ No scheduled reminders for documents pending review
   - ❌ No reminders for rejected documents if user doesn't update
   - ❌ No reminders for transfer request deadlines (only initial invite mentions 3 days)

2. **Transfer Request Deadline Tracking:**
   - ⚠️ Initial email mentions 3-day deadline
   - ❌ No scheduled reminder if deadline approaching
   - ❌ No automatic expiration of transfer requests

3. **Document Update Tracking:**
   - ⚠️ System allows multiple documents of same type
   - ❌ No clear indication which document is "current" vs "old"
   - ❌ No history of document updates

### 7.2 Recommendations

1. **Add Scheduled Reminder Service:**
   - Create `documentReminderService.js`
   - Check for pending/rejected documents daily
   - Send reminders if no update after X days

2. **Transfer Request Expiration:**
   - Add expiration check to scheduled tasks
   - Auto-expire transfer requests after deadline
   - Send expiration notification

3. **Document Versioning:**
   - Add `is_current` flag to `documents` table
   - Mark old documents as `is_current = false` when new one uploaded
   - Track document update history

---

## 8. Files Involved

### Frontend
- `js/owner-dashboard.js` - Registration document updates
- `js/my-vehicle-ownership.js` - Transfer document updates
- `js/status-utils.js` - Status checking utilities
- `owner-dashboard.html` - Registration dashboard UI
- `my-vehicle-ownership.html` - Transfer requests UI

### Backend
- `backend/routes/documents.js` - Document upload/view endpoints
- `backend/routes/transfer.js` - Transfer document linking, rejection emails
- `backend/routes/admin.js` - Manual verification, rejection emails
- `backend/services/expiryService.js` - Registration expiry reminders
- `backend/services/gmailApiService.js` - Email sending service
- `server.js` - Scheduled task initialization

### Database
- `documents` table - Document storage (line 448 in dump.sql)
  - Fields: `id`, `vehicle_id`, `document_type`, `file_path`, `ipfs_cid`, `file_hash`, `uploaded_by`, `uploaded_at`
  - **Note:** Multiple documents of same type allowed (enables reupload)
- `transfer_documents` table - Transfer document linking (line 568 in dump.sql)
  - Fields: `id`, `transfer_request_id`, `document_type`, `document_id`, `uploaded_by`, `uploaded_at`
  - Links documents to transfer requests with roles
- `notifications` table - In-app notifications (line 497 in dump.sql)
  - Fields: `id`, `user_id`, `title`, `message`, `type`, `read`, `sent_at`, `read_at`
- `expiry_notifications` table - Expiry reminder tracking (line 480 in dump.sql)
  - Fields: `id`, `vehicle_id`, `user_id`, `notification_type`, `sent_at`, `email_sent`, `sms_sent`
  - Tracks which expiry reminders have been sent
- `vehicles` table - Expiry tracking fields (lines 325-329 in dump.sql)
  - Fields: `registration_expiry_date`, `expiry_notified_30d`, `expiry_notified_7d`, `expiry_notified_1d`
  - Prevents duplicate expiry reminders
- `vehicle_verifications` table - Verification status and notes
  - Stores rejection reasons and verification metadata

---

## 9. Testing Checklist

### Document Reupload
- [ ] User can see "Update Document" button for rejected applications
  - **Location:** `js/owner-dashboard.js` line 1681 - Button rendered when `canUpdateDocuments(status)` returns true
- [ ] User can see "Update Document" button for pending applications
  - **Location:** Same as above - Status check allows `pending`, `submitted`, `processing`
- [ ] Modal opens correctly with document type label
  - **Location:** `js/owner-dashboard.js` lines 1835-1886 - Modal HTML created dynamically
  - **Location:** `js/owner-dashboard.js` lines 3061-3121 - `showDocumentUpdateModal()` function
- [ ] File validation works (size, type)
  - **Location:** `js/owner-dashboard.js` lines 3148-3165 - Validates 10MB limit and file types
- [ ] Upload succeeds and document is linked to vehicle
  - **Location:** `js/owner-dashboard.js` lines 3205-3216 - Calls `POST /api/documents/upload`
- [ ] Transfer document linking works correctly
  - **Location:** `js/owner-dashboard.js` lines 3219-3259 - Links document to transfer request
  - **Backend:** `backend/routes/transfer.js` lines 3604-3653 - `/link-document` endpoint
- [ ] Application reloads after update
  - **Location:** `js/owner-dashboard.js` lines 3272-3301 - Reloads application list after update
- [ ] Updated document appears in application
  - **Verification:** Check `documents` table for new document with same `vehicle_id` and `document_type`

### Email Notifications
- [ ] Rejection email sent when admin rejects document
  - **Backend:** `backend/routes/admin.js` lines 714-804 - Email sent via Gmail API
- [ ] Rejection email includes correct reason
  - **Backend:** `backend/routes/admin.js` line 736 - `notes` parameter included in email
- [ ] Rejection email includes dashboard link
  - **Backend:** `backend/routes/admin.js` line 717 - `dashboardUrl` included in email
- [ ] Transfer rejection email sent to seller
  - **Backend:** `backend/routes/transfer.js` lines 3086-3093 - Email sent to seller
- [ ] Transfer rejection email sent to buyer (if different)
  - **Backend:** `backend/routes/transfer.js` lines 3100-3200 - Email sent to buyer if different
- [ ] Expiry reminder sent at 30 days
  - **Service:** `backend/services/expiryService.js` lines 53-56 - Checks `expiry_notified_30d` flag
- [ ] Expiry reminder sent at 7 days
  - **Service:** `backend/services/expiryService.js` lines 50-52 - Checks `expiry_notified_7d` flag
- [ ] Expiry reminder sent at 1 day
  - **Service:** `backend/services/expiryService.js` lines 47-49 - Checks `expiry_notified_1d` flag
- [ ] No duplicate expiry reminders sent
  - **Database:** `vehicles.expiry_notified_30d/7d/1d` flags prevent duplicates
  - **Service:** `backend/services/expiryService.js` lines 338-344 - Marks notification sent

### In-App Notifications
- [ ] Notification created when document rejected
  - **Backend:** `backend/routes/admin.js` lines 811-824 - Creates notification in `notifications` table
- [ ] Notification created when transfer rejected
  - **Backend:** `backend/routes/transfer.js` lines 2983-2992 - Creates notification for seller
- [ ] Notification created for expiry reminders
  - **Service:** `backend/services/expiryService.js` lines 308-317 - Creates notification
- [ ] Notifications appear in user dashboard
  - **Frontend:** Notifications loaded via `GET /api/notifications` endpoint
  - **Backend:** `backend/routes/notifications.js` - Handles notification retrieval

---

## 10. Summary

### What Works (Verified)
✅ **Document reupload:** Fully functional for both registration and transfer requests
  - Frontend: `js/owner-dashboard.js` (lines 3061-3319) - `showDocumentUpdateModal()`, `submitDocumentUpdate()`
  - Frontend: `js/my-vehicle-ownership.js` (lines 1079-1102) - `updateTransferDocument()`
  - Backend: `POST /api/documents/upload` - Document upload endpoint
  - Backend: `POST /api/vehicles/transfer/requests/:id/link-document` - Transfer document linking
  - Database: `documents` table supports multiple documents of same type (enables reupload)

✅ **Immediate email notifications:** Sent when documents are rejected
  - Registration: `backend/routes/admin.js` (lines 714-804) - Sends email with rejection reason
  - Transfer: `backend/routes/transfer.js` (lines 3000-3098) - Sends email to seller and buyer
  - Database: `notifications` table stores in-app notifications (line 497 in dump.sql)

✅ **In-app notifications:** Created for rejections and expiry
  - Registration rejection: Creates notification (lines 811-824 in admin.js)
  - Transfer rejection: Creates notification (lines 2983-2992 in transfer.js)
  - Expiry reminders: Creates notification (lines 308-317 in expiryService.js)

✅ **Registration expiry reminders:** Scheduled daily at 9 AM
  - Service: `backend/services/expiryService.js` - `checkExpiringRegistrations()`
  - Scheduling: `server.js` (lines 385-463) - Initializes scheduled tasks
  - Database: `vehicles.expiry_notified_30d/7d/1d` flags prevent duplicates
  - Database: `expiry_notifications` table tracks sent reminders (line 480 in dump.sql)

✅ **Status-based UI:** Update buttons shown only when allowed
  - Utility: `js/status-utils.js` (lines 116-119) - `canUpdateDocuments(status)`
  - Allowed statuses: `submitted`, `processing`, `rejected`, `pending`, `under_review`, `awaiting_buyer_docs`

### What's Missing (Verified)
❌ **Scheduled reminders for pending documents:** No automatic reminders if documents pending review
  - **Gap:** No service checks for documents pending review and sends reminders
  - **Recommendation:** Create `documentReminderService.js` similar to `expiryService.js`

❌ **Scheduled reminders for rejected documents:** No follow-up if user doesn't update
  - **Gap:** Email sent once on rejection, but no follow-up if user doesn't update after X days
  - **Recommendation:** Add scheduled check for rejected documents older than X days

❌ **Transfer request deadline reminders:** Only mentioned in initial invite, no scheduled reminders
  - **Current:** Initial email mentions 3-day deadline (line 270 in transfer.js)
  - **Gap:** No scheduled reminder if deadline approaching (e.g., 1 day remaining)
  - **Recommendation:** Add scheduled check for transfer requests approaching deadline

❌ **Document versioning:** No clear tracking of document update history
  - **Current:** System allows multiple documents of same type (all stored in `documents` table)
  - **Gap:** No `is_current` flag or `replaced_by` field to track which document is active
  - **Recommendation:** Add `is_current` boolean and `replaced_by` UUID to `documents` table

### Key Workflows
1. **Rejection → Reupload:** Admin rejects → Email sent → User updates → Document reuploaded
2. **Expiry Reminders:** Scheduled task → Check expiring vehicles → Send reminders at 30d/7d/1d
3. **Transfer Updates:** User uploads → Document linked to transfer → Status updated
