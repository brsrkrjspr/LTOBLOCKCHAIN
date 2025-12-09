# HPG Module Workflow

## Complete System Workflow: User → LTO → HPG Admin → LTO Admin → User

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VEHICLE CLEARANCE WORKFLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────┐
│  USER   │
│ (Owner) │
└────┬────┘
     │
     │ Step 1: User submits vehicle clearance request
     │ Action: Fill out application form
     │ Page: registration-wizard.html
     │ Status: Application Submitted → Pending LTO Review
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LTO ADMIN                                      │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     │ Step 2: LTO Admin reviews application
     │ Action: Review documents and vehicle information
     │ Page: admin-dashboard.html
     │ Status: Pending LTO Review → Under Review
     │
     │ Step 3: LTO Admin sends clearance request to HPG
     │ Action: Click "Send to HPG for Verification"
     │ Page: admin-dashboard.html (Vehicle Details)
     │ Status: Under Review → Sent to HPG
     │ API Call: POST /api/lto/send-to-hpg
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            HPG ADMIN                                        │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     │ Step 4: HPG Admin receives clearance request
     │ Action: View request in dashboard
     │ Page: hpg-admin-dashboard.html
     │ Status: Sent to HPG → Pending Verification
     │ Notification: New request received
     │
     │ Step 5: HPG Admin views LTO requests list
     │ Action: Navigate to "LTO Requests"
     │ Page: hpg-requests-list.html
     │ Status: Pending Verification
     │
     │ Step 6: HPG Admin starts vehicle verification
     │ Action: Click "Verify" button on request
     │ Page: hpg-verification-form.html
     │ Status: Pending Verification → In Verification
     │
     │ Step 7: HPG Admin performs inspection
     │ Actions:
     │   - Enter Engine Number
     │   - Enter Chassis Number
     │   - Verify Macro-etching (checkbox)
     │   - Upload Inspection Photos
     │   - Upload Stencil Image
     │   - Add Remarks/Findings
     │ Page: hpg-verification-form.html
     │
     │ Step 8: HPG Admin approves or rejects verification
     │ Options:
     │   A) Approve Verification
     │      Action: Click "Approve Verification"
     │      Status: In Verification → Verified
     │      API Call: POST /api/hpg/verify/approve
     │      Log: Activity logged as "Verified"
     │
     │   B) Reject Verification
     │      Action: Click "Reject Verification" → Enter reason
     │      Status: In Verification → Rejected
     │      API Call: POST /api/hpg/verify/reject
     │      Log: Activity logged as "Rejected"
     │      Notification: Sent to LTO Admin
     │
     │ Step 9: (If Approved) HPG Admin releases MV Clearance Certificate
     │ Action: Navigate to "Release Certificate"
     │ Page: hpg-release-certificate.html
     │ Status: Verified → Certificate Ready
     │
     │ Step 10: HPG Admin generates/uploads certificate
     │ Actions:
     │   - Select verified request
     │   - Choose: Auto-generate OR Upload template
     │   - Preview certificate
     │ Page: hpg-release-certificate.html
     │
     │ Step 11: HPG Admin releases certificate to LTO
     │ Action: Click "Release and Send to LTO Admin"
     │ Status: Certificate Ready → Certificate Released
     │ API Call: POST /api/hpg/certificate/release
     │ Log: Activity logged as "Released Certificate"
     │ Notification: Sent to LTO Admin
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LTO ADMIN                                      │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     │ Step 12: LTO Admin receives certificate
     │ Action: View notification
     │ Page: admin-dashboard.html
     │ Status: Certificate Released → Certificate Received
     │ Notification: "HPG Certificate Received"
     │
     │ Step 13: LTO Admin reviews certificate
     │ Action: View certificate details
     │ Page: admin-dashboard.html (Certificate Viewer)
     │ Status: Certificate Received → Under Final Review
     │
     │ Step 14: LTO Admin approves and completes clearance
     │ Action: Click "Approve Clearance"
     │ Page: admin-dashboard.html
     │ Status: Under Final Review → Clearance Approved
     │ API Call: POST /api/lto/approve-clearance
     │ Notification: Sent to User
     │
     ▼
┌─────────┐
│  USER   │
│ (Owner) │
└─────────┘
     │
     │ Step 15: User receives notification
     │ Action: View notification in dashboard
     │ Page: owner-dashboard.html
     │ Status: Clearance Approved → Completed
     │ Notification: "Vehicle Clearance Approved"
     │
     │ Step 16: User downloads certificate
     │ Action: Download MV Clearance Certificate
     │ Page: owner-dashboard.html
     │ Status: Completed
     │
     └─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         STATUS TRANSITION SUMMARY                           │
└─────────────────────────────────────────────────────────────────────────────┘

User Side:
  Application Submitted → Pending LTO Review → Clearance Approved → Completed

LTO Admin Side:
  Pending LTO Review → Under Review → Sent to HPG → Certificate Received 
  → Under Final Review → Clearance Approved

HPG Admin Side:
  Pending Verification → In Verification → Verified → Certificate Ready 
  → Certificate Released

Alternative Flow (Rejection):
  In Verification → Rejected → (Notification to LTO) → (LTO notifies User)


┌─────────────────────────────────────────────────────────────────────────────┐
│                         KEY PAGES AND ACTIONS                               │
└─────────────────────────────────────────────────────────────────────────────┘

USER PAGES:
  - registration-wizard.html: Submit clearance request
  - owner-dashboard.html: View status, download certificate

LTO ADMIN PAGES:
  - admin-dashboard.html: Review applications, send to HPG, receive certificate
  - admin-blockchain-viewer.html: View blockchain records

HPG ADMIN PAGES:
  - hpg-admin-dashboard.html: View summary, notifications, quick actions
  - hpg-requests-list.html: View all LTO requests, filter, search
  - hpg-verification-form.html: Perform vehicle inspection and verification
  - hpg-release-certificate.html: Generate and release MV Clearance Certificate
  - hpg-activity-logs.html: View complete activity history


┌─────────────────────────────────────────────────────────────────────────────┐
│                         API ENDPOINTS (Placeholder)                         │
└─────────────────────────────────────────────────────────────────────────────┘

LTO → HPG:
  POST /api/lto/send-to-hpg
  Body: { requestId, vehicleId, purpose, ownerInfo }

HPG Verification:
  POST /api/hpg/verify/approve
  Body: { requestId, engineNumber, chassisNumber, macroEtching, photos, stencil, remarks }
  
  POST /api/hpg/verify/reject
  Body: { requestId, reason }

HPG Certificate:
  POST /api/hpg/certificate/release
  Body: { requestId, certificateNumber, certificateFile }

LTO Final Approval:
  POST /api/lto/approve-clearance
  Body: { requestId, certificateId }


┌─────────────────────────────────────────────────────────────────────────────┐
│                         NOTIFICATION FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

1. User submits → LTO Admin notified
2. LTO sends to HPG → HPG Admin notified
3. HPG rejects → LTO Admin notified → User notified
4. HPG releases certificate → LTO Admin notified
5. LTO approves → User notified


┌─────────────────────────────────────────────────────────────────────────────┐
│                         ACTIVITY LOGGING                                     │
└─────────────────────────────────────────────────────────────────────────────┘

All actions are logged in hpg-activity-logs.html:
  - Date & Time
  - Action Type (Verified, Rejected, Released, Received)
  - Request ID
  - Admin Name
  - Details
  - Status

