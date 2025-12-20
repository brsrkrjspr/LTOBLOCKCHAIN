# Schema Alignment Verification

## ✅ Verified Schema Alignment

### 1. **transfer_requests Table**

#### Schema Definition (from `database/add-transfer-ownership.sql`):
```sql
CREATE TABLE IF NOT EXISTS transfer_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES users(id) NOT NULL,
    buyer_id UUID REFERENCES users(id),
    buyer_info JSONB,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'COMPLETED', 'FORWARDED_TO_HPG')),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    forwarded_to_hpg BOOLEAN DEFAULT false,
    hpg_clearance_request_id UUID REFERENCES clearance_requests(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Code Alignment:

✅ **INSERT Statement** (`backend/database/services.js:643-654`):
- Uses correct column names: `vehicle_id`, `seller_id`, `buyer_id`, `buyer_info`, `metadata`
- Explicitly casts JSONB fields: `$4::jsonb`, `$5::jsonb`
- Does not specify `submitted_at` (uses DEFAULT value) ✅
- Does not specify `created_at` (uses DEFAULT value) ✅
- Does not specify `updated_at` (uses DEFAULT value) ✅

✅ **SELECT Queries** (`backend/database/services.js:732-746`):
- Uses `SELECT tr.*` which includes all columns (including `submitted_at` if it exists)
- Orders by `tr.created_at` (which definitely exists) ✅
- Uses `LEFT JOIN` for optional `buyer` relationship ✅

✅ **JSONB Field Access**:
- **Fixed**: `(tr.buyer_info::jsonb)->>'email'` in `backend/routes/transfer.js:541` - now explicitly casts to JSONB
- All JSONB parsing in JavaScript uses proper type checking ✅

### 2. **transfer_documents Table**

#### Schema Definition:
```sql
CREATE TABLE IF NOT EXISTS transfer_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_request_id UUID REFERENCES transfer_requests(id) ON DELETE CASCADE NOT NULL,
    document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('deed_of_sale', 'seller_id', 'buyer_id', 'or_cr', 'emission_cert', 'insurance_cert', 'other')),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES users(id) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);
```

#### Code Alignment:

✅ **INSERT Statement** (`backend/routes/transfer.js:280-345`):
- Uses correct column names: `transfer_request_id`, `document_type`, `document_id`, `uploaded_by`
- Checks for existing documents before INSERT (no `ON CONFLICT` needed) ✅
- Uses valid `document_type` values from `docTypes.TRANSFER_ROLES` ✅

### 3. **Route Path Alignment**

✅ **Route Order** (`backend/routes/transfer.js`):
1. `GET /requests` (line 776) - General query endpoint
2. `GET /requests/stats` (line 858) - Statistics endpoint **BEFORE** `:id` route ✅
3. `GET /requests/:id` (line 902) - Specific request by ID

**Critical Fix Applied**: `/requests/stats` is now defined **before** `/requests/:id` to prevent "stats" from being parsed as an ID parameter.

### 4. **Status Values Alignment**

✅ **Valid Status Values** (from schema CHECK constraint):
- `PENDING` ✅
- `REVIEWING` ✅
- `APPROVED` ✅
- `REJECTED` ✅
- `COMPLETED` ✅
- `FORWARDED_TO_HPG` ✅

All code uses these exact status values.

### 5. **JSONB Field Handling**

✅ **buyer_info Structure**:
- Expected fields: `firstName`, `lastName`, `email`, `phone`, `address`, `id_type`, `id_number`
- Code properly extracts: `buyerInfo.firstName`, `buyerInfo.lastName`, `buyerInfo.email` ✅
- Fallback logic handles missing fields gracefully ✅

✅ **metadata Structure**:
- Default: `{}` (empty object)
- Code uses `JSON.stringify(metadata || {})` ✅
- Explicitly cast to JSONB in INSERT: `$5::jsonb` ✅

## 🔧 Fixes Applied

1. **JSONB Casting in Queries**: Added explicit `::jsonb` cast when accessing JSONB fields with `->>` operator
   - Fixed: `(tr.buyer_info::jsonb)->>'email'` in `backend/routes/transfer.js:541`

2. **JSONB Casting in INSERT**: Added explicit `::jsonb` cast in INSERT statement
   - Fixed: `$4::jsonb, $5::jsonb` in `backend/database/services.js:643`

3. **Documentation Updates**: Updated `VERIFY_TRANSFER_REQUESTS.md` to use proper JSONB casting and handle missing `submitted_at` column

## ⚠️ Potential Database Mismatches

If you encounter errors like:
- `ERROR: column tr.submitted_at does not exist` - The database might not have this column yet. Run the migration: `database/add-transfer-ownership.sql`
- `ERROR: operator does not exist: text ->> unknown` - The `buyer_info` column might be TEXT instead of JSONB. The code now explicitly casts to JSONB to handle this.

## ✅ Verification Checklist

- [x] INSERT statements use correct column names
- [x] INSERT statements explicitly cast JSONB fields
- [x] SELECT queries use correct column names
- [x] JSONB field access uses explicit casting
- [x] Route order is correct (stats before :id)
- [x] Status values match schema CHECK constraint
- [x] Document types match schema CHECK constraint
- [x] Foreign key relationships are correct
- [x] Timestamp columns use DEFAULT values correctly

## 📝 Notes

- The code uses `created_at` for ordering, which is guaranteed to exist
- `submitted_at` is included via `tr.*` but not explicitly used in ordering
- All JSONB fields are now explicitly cast to prevent type errors
- The route order fix ensures `/requests/stats` works correctly

