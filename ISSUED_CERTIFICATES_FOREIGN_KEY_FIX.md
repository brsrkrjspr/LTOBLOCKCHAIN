# Foreign Key Constraint Fix for issued_certificates Table

## Root Cause

The `issued_certificates` table has a foreign key constraint `issued_certificates_issuer_id_fkey` that references `users(id)`, but the code queries `external_issuers` table and uses those IDs. This causes foreign key constraint violations (error code `23503`) because:

1. **Schema Mismatch**: The foreign key constraint references `users(id)`
2. **Code Implementation**: All certificate generation code queries `external_issuers` table
3. **Result**: When inserting certificates, the `issuer_id` from `external_issuers` doesn't exist in `users` table, causing the insert to fail

## Impact

- **Certificates fail to save** to `issued_certificates` table
- **Auto-verification fails** because it can't find certificates in the database
- **Certificate authenticity checks fail** because certificates aren't stored
- **Auto-verification marks certificates as PENDING** instead of APPROVED

## Solution

### 1. Database Migration (`database/fix-issued-certificates-foreign-key.sql`)

The migration script:
- Drops the existing foreign key constraint that references `users(id)`
- Ensures `external_issuers` table exists
- Adds a new foreign key constraint referencing `external_issuers(id)`
- Makes `issuer_id` nullable (for cases where no issuer is found)
- Creates default external issuers for testing/development

### 2. Code Updates (`backend/routes/certificate-generation.js`)

Enhanced error handling with fallback logic:
- **Primary**: Try to insert with `issuer_id` from `external_issuers`
- **Fallback**: If foreign key constraint fails (code `23503`), retry with `issuer_id = NULL`
- **Logging**: Clear error messages indicating when fallback is used

Updated locations:
1. Individual Insurance Certificate generation (line ~180)
2. Individual HPG Clearance generation (line ~330)
3. Individual CSR Certificate generation (line ~540)
4. Individual Sales Invoice generation (line ~725)
5. Batch Insurance Certificate generation (line ~1038)
6. Batch HPG Clearance generation (line ~1118)
7. Batch CSR Certificate generation (line ~1195)
8. Batch Sales Invoice generation (line ~1289)
9. Transfer workflow `writeIssuedCertificate` function (line ~2165)

## Migration Command

Run the migration script on your server:

```bash
cat database/fix-issued-certificates-foreign-key.sql | docker exec -i postgres psql -U lto_user -d lto_blockchain
```

Or if running directly on the server:

```bash
psql -U lto_user -d lto_blockchain -f database/fix-issued-certificates-foreign-key.sql
```

## Testing

After applying the migration:

1. **Generate certificates** (batch or individual)
2. **Check logs** for:
   - `✅ Written to issued_certificates` (success)
   - `Saved with NULL issuer_id (fallback)` (fallback used)
   - `Foreign key constraint violation` (should not appear after migration)
3. **Verify certificates are saved**:
   ```sql
   SELECT certificate_number, certificate_type, issuer_id 
   FROM issued_certificates 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```
4. **Test auto-verification** - certificates should now be found and auto-verification should work

## Benefits

- ✅ **Certificates are saved** to `issued_certificates` table
- ✅ **Auto-verification works** because certificates are findable
- ✅ **Graceful degradation** - fallback to NULL issuer_id if constraint still fails
- ✅ **Better error messages** - clear indication of what went wrong
- ✅ **Default issuers created** - system works out of the box

## Notes

- The fallback logic (saving with `issuer_id = NULL`) ensures certificates are still saved even if the foreign key constraint fails
- This allows the system to continue functioning while the migration is being applied
- After migration, certificates should save with proper `issuer_id` values
- Default external issuers are created for each certificate type (insurance, hpg, csr, sales_invoice)
