## Document Upload Feature Implementation - Deployment Guide

### Overview
This document provides instructions for deploying the document upload feature for LTO vehicle inspections. The feature allows LTO officers to upload:
- MVIR (Motor Vehicle Inspection Report) documents
- Vehicle inspection photos
- Additional supporting documents

---

## Part 1: Database Setup

### SSH Commands to Apply Database Schema Migration

#### 1. Connect to the PostgreSQL database via SSH
```bash
# SSH into the server
ssh user@your-server-ip

# Connect to PostgreSQL
psql -U postgres -h localhost -d lto_system
```

#### 2. Create the MVIR sequence (if not exists)
```sql
-- Create MVIR number sequence for inspection tracking
CREATE SEQUENCE IF NOT EXISTS mvir_number_seq START WITH 1 INCREMENT BY 1;
```

#### 3. Add inspection columns to vehicles table
```sql
-- Add inspection-related columns to vehicles table
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS mvir_number VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS inspection_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS inspection_result VARCHAR(20),
ADD COLUMN IF NOT EXISTS roadworthiness_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS emission_compliance VARCHAR(20),
ADD COLUMN IF NOT EXISTS inspection_officer VARCHAR(100),
ADD COLUMN IF NOT EXISTS inspection_notes TEXT,
ADD COLUMN IF NOT EXISTS inspection_documents JSONB;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_vehicles_mvir ON vehicles(mvir_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_inspection_date ON vehicles(inspection_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_inspection_result ON vehicles(inspection_result);
```

#### 4. Update documents table to track inspection documents
```sql
-- Add tracking columns for inspection documents
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS is_inspection_document BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inspection_document_type VARCHAR(50);

-- Create indexes for inspection documents
CREATE INDEX IF NOT EXISTS idx_documents_inspection ON documents(is_inspection_document);
CREATE INDEX IF NOT EXISTS idx_documents_inspection_type ON documents(inspection_document_type);
```

#### 5. Verify the schema changes
```sql
-- Check if the columns were added successfully
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name IN ('mvir_number', 'inspection_date', 'inspection_result', 'inspection_officer');

-- Check if the sequence exists
SELECT * FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'mvir_number_seq';
```

#### 6. Exit PostgreSQL
```bash
\q
```

---

## Part 2: File System Setup

### 1. Create uploads directory
```bash
# SSH into the server
ssh user@your-server-ip

# Navigate to the backend directory
cd /path/to/LTO/backend

# Create the uploads/inspection-documents directory
mkdir -p uploads/inspection-documents

# Set proper permissions (755 for directory, 644 for files)
chmod 755 uploads/inspection-documents

# Verify the directory was created
ls -la uploads/
```

### 2. Configure file permissions (production environment)
```bash
# Make directory writable by the application user (if running as different user)
sudo chown -R app-user:app-user uploads/inspection-documents
sudo chmod -R 755 uploads/inspection-documents
```

---

## Part 3: Application Updates

### Files Modified:

#### 1. **lto-inspection-form.html**
- Added MVIR document upload field (accepts PDF, JPG, PNG)
- Added vehicle photos upload field (accepts multiple images)
- Added additional documents upload field (optional)
- Added photo preview display on file selection
- Added CSS styling for file upload inputs

#### 2. **js/lto-inspection-form.js**
- Updated `submitInspection()` function to handle file uploads
- Added file validation (size limits, file types)
- Added FormData construction for multipart requests
- Updated to call new `/api/lto/inspect-documents` endpoint before submitting inspection results
- Added photo preview functionality with FileReader API

#### 3. **backend/routes/lto.js**
- Added multer configuration for file upload handling
- Created new endpoint: `POST /api/lto/inspect-documents`
  - Accepts multipart/form-data
  - Supports MVIR document upload
  - Supports multiple vehicle photo uploads
  - Supports additional documents
  - Returns document references
- Created new endpoint: `GET /api/lto/inspect-documents/:vehicleId`
  - Retrieves uploaded document references for a vehicle
  - Returns paths to uploaded files

#### 4. **server.js**
- Added static file serving for inspection documents
- Route: `/uploads/inspection-documents` → serves from `backend/uploads/inspection-documents`

#### 5. **js/admin-dashboard.js**
- Updated `viewInspectionDocument(docType, applicationId)` function
  - Now fetches documents from new `/api/lto/inspect-documents` endpoint
  - Supports viewing MVIR documents, photos, and additional files
- Added `showInspectionPhotoGallery(photos)` function
  - Displays vehicle inspection photos in a gallery modal
- Added `showInspectionDocumentsGallery(documents)` function
  - Displays additional documents as downloadable files
- Updated inspection evidence cards layout (2x2 grid → 3 columns)
- Added "Additional Documents" card to inspection evidence section

#### 6. **backend/migrations/add-inspection-columns.sql**
- Migration file for database schema updates
- Contains SQL statements for adding inspection columns
- Can be manually applied or run via migration runner

---

## Part 4: Testing the Feature

### Step 1: Start the application
```bash
# Navigate to project root
cd /path/to/LTO

# Install dependencies (if needed)
npm install

# Start the server
npm start
```

### Step 2: Test LTO Inspection Form
1. Navigate to admin-dashboard.html
2. Select a vehicle from the vehicle list
3. Click "Vehicle Inspection" in the sidebar
4. Select a vehicle that needs inspection
5. Fill in inspection details:
   - Select inspection result (Pass/Fail)
   - Select roadworthiness status
   - Select emission compliance
   - Enter inspection officer name
   - Enter inspection notes (optional)
6. Upload files:
   - Select MVIR document (required)
   - Select vehicle photos (required, multiple allowed)
   - Select additional documents (optional)
7. Click "Submit Inspection"
8. Verify success message with MVIR number

### Step 3: Test Admin Inspection Tab
1. Navigate to admin-dashboard.html
2. View an application with completed inspection
3. Click the application to view details
4. Switch to "Inspection & Emission" tab
5. Click "View Document" to see MVIR document
6. Click "View Gallery" to see vehicle photos
7. Click "View Files" to see additional documents

---

## Part 5: Troubleshooting

### Issue: "Failed to upload inspection documents"

**Solution 1: Check directory permissions**
```bash
# SSH into the server
ssh user@your-server-ip

# Check if directory exists
ls -la /path/to/LTO/backend/uploads/inspection-documents/

# If not, create it
mkdir -p /path/to/LTO/backend/uploads/inspection-documents
chmod 755 /path/to/LTO/backend/uploads/inspection-documents
```

**Solution 2: Check file size limits**
- Maximum file size per file: 10MB
- Multer configuration in lto.js: `limits: { fileSize: 10 * 1024 * 1024 }`

**Solution 3: Check allowed file types**
- Allowed MIME types: PDF, JPEG, PNG, GIF, Word docs, Excel files
- Update MIME types array in lto.js if needed

### Issue: Photos not showing in gallery

**Solution 1: Check file paths**
- Verify files are accessible at `/uploads/inspection-documents/[filename]`
- Check server configuration in server.js for static file serving

**Solution 2: Check CORS headers**
- Ensure DocumentModal or image tags can access the files
- Verify Content-Security-Policy allows image sources

### Issue: Database columns not found

**Solution 1: Run migration**
```sql
-- Run the migration manually
psql -U postgres -h localhost -d lto_system < backend/migrations/add-inspection-columns.sql
```

**Solution 2: Verify columns exist**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'vehicles' 
ORDER BY ordinal_position;
```

---

## Part 6: API Endpoint Documentation

### Upload Inspection Documents
**Endpoint:** `POST /api/lto/inspect-documents`

**Authentication:** Required (Bearer token)
**Authorization:** Admin role required

**Request:**
```
Content-Type: multipart/form-data

Parameters:
- vehicleId (required): UUID of the vehicle
- mvirDocument (required): PDF/Image file
- vehiclePhotos (required): Multiple image files
- additionalDocuments (optional): Multiple files
```

**Response:**
```json
{
  "success": true,
  "message": "Inspection documents uploaded successfully",
  "documentReferences": {
    "mvirDocument": {
      "filename": "unique-filename-123.pdf",
      "originalName": "MVIR.pdf",
      "mimetype": "application/pdf",
      "size": 1024000,
      "uploadedAt": "2025-01-20T10:30:00Z",
      "path": "/uploads/inspection-documents/unique-filename-123.pdf"
    },
    "vehiclePhotos": [
      {
        "filename": "photo-001.jpg",
        "originalName": "vehicle-front.jpg",
        "mimetype": "image/jpeg",
        "size": 2048000,
        "uploadedAt": "2025-01-20T10:30:00Z",
        "path": "/uploads/inspection-documents/photo-001.jpg"
      }
    ],
    "additionalDocuments": []
  }
}
```

### Retrieve Inspection Documents
**Endpoint:** `GET /api/lto/inspect-documents/:vehicleId`

**Authentication:** Required (Bearer token)
**Authorization:** Admin or Vehicle Owner

**Response:**
```json
{
  "success": true,
  "documentReferences": {
    "mvirDocument": { /* file reference */ },
    "vehiclePhotos": [ /* array of file references */ ],
    "additionalDocuments": [ /* array of file references */ ]
  }
}
```

---

## Part 7: Future Enhancements

1. **IPFS Integration**
   - Store documents on IPFS for decentralization
   - Update file paths to IPFS CID references
   - Maintain local cache for performance

2. **Document Verification**
   - Calculate SHA-256 hash for uploaded documents
   - Store hash in database for integrity verification
   - Enable document tampering detection

3. **OCR Processing**
   - Extract text from uploaded MVIR documents
   - Auto-fill inspection form fields
   - Enable searchability of scanned documents

4. **Email Notifications**
   - Send inspection completion notifications
   - Include document links in emails
   - Update vehicle owner on inspection status

5. **Document Expiry**
   - Track document expiry dates
   - Alert on approaching expiry
   - Require re-inspection for expired documents

---

## Support & Questions

For issues or questions regarding the document upload feature:
1. Check the troubleshooting section above
2. Review logs: `tail -f /path/to/LTO/logs/app.log`
3. Check browser console for JavaScript errors
4. Verify database connectivity: `psql -U postgres -d lto_system -c "SELECT VERSION()"`

---

**Last Updated:** 2025-01-20
**Version:** 1.0
**Status:** Ready for Deployment
