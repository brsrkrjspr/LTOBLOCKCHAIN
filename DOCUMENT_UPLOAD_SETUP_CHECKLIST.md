# Document Upload Feature - Quick Setup Checklist

## Pre-Deployment Verification

### Code Changes ✅
- [x] `lto-inspection-form.html` - Added file upload inputs with preview
- [x] `js/lto-inspection-form.js` - Updated submitInspection() to handle files
- [x] `backend/routes/lto.js` - Added multer and new endpoints
- [x] `server.js` - Added static file serving for uploads
- [x] `js/admin-dashboard.js` - Updated document viewing functions

### Database Setup 🔧
- [ ] Connect to PostgreSQL database
- [ ] Create MVIR sequence: `CREATE SEQUENCE IF NOT EXISTS mvir_number_seq`
- [ ] Run migration: `backend/migrations/add-inspection-columns.sql`
- [ ] Verify columns exist in vehicles table
- [ ] Verify columns exist in documents table

### File System Setup 📁
- [ ] Create directory: `backend/uploads/inspection-documents/`
- [ ] Set permissions: `chmod 755 backend/uploads/inspection-documents/`
- [ ] Verify directory is writable by application user
- [ ] Test file write capability

### Application Deployment 🚀
- [ ] Update server.js with static file route
- [ ] Restart Node.js server: `npm start`
- [ ] Verify no errors in console
- [ ] Check that uploads directory is accessible

### Feature Testing ✅
- [ ] Navigate to LTO Inspection form
- [ ] Select a vehicle for inspection
- [ ] Upload MVIR document
- [ ] Upload vehicle photos (multiple)
- [ ] Verify success message with MVIR number
- [ ] View uploaded files in admin dashboard inspection tab
- [ ] Click "View Document" to view MVIR
- [ ] Click "View Gallery" to see photos
- [ ] Verify all files are accessible

---

## SSH Commands Quick Reference

### 1. Database Connection
```bash
psql -U postgres -h localhost -d lto_system
```

### 2. Create MVIR Sequence
```bash
psql -U postgres -h localhost -d lto_system -c "CREATE SEQUENCE IF NOT EXISTS mvir_number_seq START WITH 1 INCREMENT BY 1;"
```

### 3. Run Migration
```bash
psql -U postgres -h localhost -d lto_system < backend/migrations/add-inspection-columns.sql
```

### 4. Verify Schema
```bash
psql -U postgres -h localhost -d lto_system -c "\d vehicles"
```

### 5. Create Uploads Directory
```bash
mkdir -p backend/uploads/inspection-documents
chmod 755 backend/uploads/inspection-documents
```

### 6. Check Directory Permissions
```bash
ls -la backend/uploads/inspection-documents
```

### 7. Restart Application
```bash
# Stop current process (Ctrl+C or kill process)
# Then restart:
cd /path/to/LTO
npm start
```

---

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| MVIR sequence not found | Run: `CREATE SEQUENCE mvir_number_seq` |
| Upload fails | Check directory exists: `mkdir -p backend/uploads/inspection-documents` |
| Photos not showing | Verify static route in server.js |
| Permission denied | Run: `chmod 755 backend/uploads/inspection-documents` |
| File too large | Max size is 10MB per file |
| Wrong file type | Allowed: PDF, JPEG, PNG, GIF, DOCX, XLSX |

---

## File Locations

```
Backend API:
- POST /api/lto/inspect-documents
- GET /api/lto/inspect-documents/:vehicleId

Frontend Forms:
- lto-inspection-form.html (LTO Officer upload)
- admin-dashboard.html (Admin viewing)

Uploads Directory:
- backend/uploads/inspection-documents/

Served At:
- http://localhost:3001/uploads/inspection-documents/[filename]
```

---

## Database Schema Changes

### New Columns Added to `vehicles` Table:
- `mvir_number` (VARCHAR 20, UNIQUE) - Motor Vehicle Inspection Report number
- `inspection_date` (TIMESTAMP) - Date of inspection
- `inspection_result` (VARCHAR 20) - PASS/FAIL/PENDING
- `roadworthiness_status` (VARCHAR 20) - ROADWORTHY/NOT_ROADWORTHY
- `emission_compliance` (VARCHAR 20) - COMPLIANT/NON_COMPLIANT
- `inspection_officer` (VARCHAR 100) - Officer name
- `inspection_notes` (TEXT) - Additional notes
- `inspection_documents` (JSONB) - File references

### New Columns Added to `documents` Table:
- `is_inspection_document` (BOOLEAN) - Flag for inspection docs
- `inspection_document_type` (VARCHAR 50) - MVIR/PHOTO/OTHER

### New Sequence:
- `mvir_number_seq` - Auto-increment for MVIR numbers

---

## Implementation Summary

### What Was Added:
1. **Frontend**: File upload form with photo preview capability
2. **Backend API**: Multer-based file upload endpoint with validation
3. **Database**: Inspection tracking columns and sequences
4. **Admin UI**: Document viewing with galleries and modals
5. **File Storage**: Local file system storage with URL serving

### How It Works:
1. LTO officer fills inspection form and uploads files
2. Files are validated (size, type) and uploaded to server
3. Document references are stored in JSON file
4. Inspection results are saved to database
5. Admin can view uploaded documents via inspection tab

### File Flow:
```
LTO Officer → Upload Form → Multer Handler → File System
                                ↓
                         Document Reference JSON
                                ↓
                         Admin Inspection Tab
                                ↓
                         View/Download Files
```

---

## Post-Deployment Verification

Run these tests after deployment:

```bash
# 1. Verify migrations applied
psql -U postgres -h localhost -d lto_system << EOF
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name LIKE 'inspection_%' OR column_name = 'mvir_number'
ORDER BY ordinal_position;
EOF

# 2. Verify uploads directory
ls -la backend/uploads/inspection-documents

# 3. Test upload (requires authentication token)
curl -X POST http://localhost:3001/api/lto/inspect-documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "vehicleId=YOUR_VEHICLE_ID" \
  -F "mvirDocument=@test.pdf"
```

---

## Rollback Instructions (if needed)

```bash
# 1. Stop the application
# 2. Restore previous version from git
git revert HEAD
# 3. Restart application
npm start
```

Note: Database columns remain (backward compatible). To fully revert:
```bash
psql -U postgres -h localhost -d lto_system << EOF
ALTER TABLE vehicles DROP COLUMN IF EXISTS inspection_documents;
DROP SEQUENCE IF EXISTS mvir_number_seq;
EOF
```

---

**Ready to Deploy?** ✅ Yes!

All components are ready. Follow the SSH commands and testing steps above to deploy successfully.

---

Last Updated: 2025-01-20
