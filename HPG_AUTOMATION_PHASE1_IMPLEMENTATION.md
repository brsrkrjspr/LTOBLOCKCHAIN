# HPG Verification Automation - Phase 1 Implementation

## Overview
Phase 1 automation for HPG verification process has been implemented. This includes:
1. **OCR Extraction** (for Transfer of Ownership only)
2. **Automated Database Check** (for both New Registrations and Transfers)

## What Was Implemented

### 1. HPG Database Service (`backend/services/hpgDatabaseService.js`)
- New service for automated checking against HPG hot list
- Checks vehicle by plate number, engine number, chassis number, and VIN
- Returns status: `CLEAN`, `FLAGGED`, or `ERROR`
- Stores check results in clearance request metadata
- **Note**: Currently uses mock data. Replace `checkHotList()` method with actual HPG API call in production.

### 2. Enhanced Clearance Service (`backend/services/clearanceService.js`)
- **For New Registrations:**
  - Uses vehicle metadata (engine/chassis numbers already in system)
  - Runs automated database check
  - Stores results in metadata
  
- **For Transfer of Ownership:**
  - Extracts engine/chassis numbers from OR/CR document using OCR
  - Compares extracted data with vehicle record
  - Runs automated database check
  - Stores OCR results and database check in metadata

### 3. Transfer Route Enhancement (`backend/routes/transfer.js`)
- Added Phase 1 automation when forwarding transfer requests to HPG
- OCR extraction from OR/CR documents
- Automated database check
- Stores automation results in clearance request metadata

### 4. HPG Routes Enhancement (`backend/routes/hpg.js`)
- Updated `/api/hpg/requests/:id` endpoint to include:
  - Extracted OCR data
  - Database check results
  - Automation phase 1 status

### 5. Frontend Updates (`js/hpg-admin.js`)
- Auto-fills engine/chassis numbers from OCR-extracted data (for transfers)
- Visual indicators for OCR-extracted fields (green background)
- Displays database check results in Step 3 (Database Check section)
- Shows data match results (OCR vs vehicle record) in Step 2
- Color-coded status indicators:
  - 🟢 CLEAN: Vehicle not in hot list
  - 🔴 FLAGGED: Vehicle found in hot list
  - ⚠️ Data mismatch: OCR data doesn't match vehicle record

## How It Works

### For New Vehicle Registration:
1. Vehicle registration submitted → Clearance request created
2. **Automated Database Check** runs immediately
3. Results stored in `clearance_request.metadata.hpgDatabaseCheck`
4. If flagged, urgent notification sent to HPG admin
5. HPG admin sees pre-filled form with vehicle metadata
6. Database check result displayed automatically

### For Transfer of Ownership:
1. Transfer request forwarded to HPG → Clearance request created
2. **OCR Extraction** runs on OR/CR document:
   - Extracts engine number
   - Extracts chassis number
   - Compares with vehicle record
3. **Automated Database Check** runs
4. Results stored in metadata
5. HPG admin sees:
   - Pre-filled engine/chassis from OCR (highlighted in green)
   - Data match indicators (✓ match or ✗ mismatch)
   - Database check results (CLEAN or FLAGGED)

## Database Schema
No schema changes required. All automation data stored in existing `clearance_requests.metadata` JSONB column:

```json
{
  "extractedData": {
    "engineNumber": "2NR-FE123456",
    "chassisNumber": "JT1234567890",
    "ocrExtracted": true,
    "dataMatch": {
      "engineNumber": true,
      "chassisNumber": true
    }
  },
  "hpgDatabaseCheck": {
    "status": "CLEAN",
    "details": "Vehicle not found in HPG hot list",
    "checkedAt": "2024-01-15T10:30:00Z"
  },
  "automationPhase1": {
    "completed": true,
    "isTransfer": true,
    "ocrExtracted": true,
    "databaseChecked": true
  }
}
```

## Configuration

### Environment Variables
No new environment variables required. Uses existing OCR service configuration.

### HPG Database API Integration
To connect to real HPG database, update `backend/services/hpgDatabaseService.js`:

```javascript
async checkHotList(vehicleData) {
    // Replace mock implementation with actual API call
    const response = await fetch('https://hpg-api.gov.ph/hotlist/check', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.HPG_API_KEY}` },
        body: JSON.stringify(vehicleData)
    });
    return await response.json();
}
```

## Benefits

1. **Reduced Manual Entry**: Engine/chassis numbers auto-filled from OCR (transfers)
2. **Faster Processing**: Database check happens automatically
3. **Early Warning**: Flagged vehicles identified immediately
4. **Data Validation**: OCR data compared with vehicle record
5. **Audit Trail**: All automation steps logged in vehicle history

## Next Steps (Future Phases)

- **Phase 2**: Smart auto-approval for low-risk cases
- **Phase 3**: Image processing automation
- **Phase 4**: Machine learning for risk scoring

## Testing

1. **Test New Registration:**
   - Submit new vehicle registration
   - Check clearance request metadata for `hpgDatabaseCheck`
   - Verify HPG form shows database check result

2. **Test Transfer:**
   - Submit transfer of ownership
   - Forward to HPG
   - Check metadata for `extractedData` and `hpgDatabaseCheck`
   - Verify HPG form shows OCR-extracted data with green highlight

3. **Test Flagged Vehicle:**
   - Use test vehicle in mock hot list (ABC-1234, STOLEN001)
   - Verify urgent notification sent
   - Verify warning displayed in HPG form

## Files Modified

- `backend/services/hpgDatabaseService.js` (NEW)
- `backend/services/clearanceService.js` (ENHANCED)
- `backend/routes/transfer.js` (ENHANCED)
- `backend/routes/hpg.js` (ENHANCED)
- `js/hpg-admin.js` (ENHANCED)

## Notes

- OCR extraction only works for transfers (they have existing OR/CR documents)
- New registrations use vehicle metadata (no OCR needed)
- Database check works for both new registrations and transfers
- All automation is non-blocking (errors don't fail the request)
- Mock database check can be replaced with real HPG API
