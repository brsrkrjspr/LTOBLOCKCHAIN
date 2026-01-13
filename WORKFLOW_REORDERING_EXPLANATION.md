# Registration Wizard Workflow Reordering

## Problem Identified

The original workflow was:
1. **Step 1:** Vehicle Info (manual entry)
2. **Step 2:** Owner Details (auto-filled from profile)
3. **Step 3:** Documents Upload
4. **Step 4:** Review & Submit

**Issue:** Auto-filling owner info from profile doesn't save much time if users still have to manually fill vehicle info first. For OCR auto-fill to be useful, documents should be uploaded first, then data extracted to auto-fill everything.

## New Workflow (Optimized for OCR)

1. **Step 1:** Documents Upload ⬅️ **MOVED TO FIRST**
   - Upload documents first
   - OCR extracts data from documents (when Task 4 is implemented)
   - Auto-fills vehicle and owner information

2. **Step 2:** Vehicle Information
   - Pre-filled from OCR extraction
   - User verifies and completes missing fields

3. **Step 3:** Owner Details
   - Pre-filled from OCR extraction + user profile
   - User verifies and completes missing fields

4. **Step 4:** Review & Submit
   - Review all information
   - Submit application

## Benefits

✅ **Better UX:** Users upload documents once, system extracts everything
✅ **Less Manual Entry:** OCR does the heavy lifting
✅ **Faster Registration:** Auto-fill from documents is more accurate than manual entry
✅ **Fallback Support:** Still works with profile auto-fill if OCR unavailable

## Implementation Status

- ✅ HTML structure reordered
- ✅ Progress indicator labels updated
- ✅ OCR auto-fill function structure created
- ⏳ OCR backend service (Task 4) - pending
- ✅ Profile auto-fill still works as fallback

## Next Steps

1. Implement OCR backend service (Task 4)
2. Test OCR extraction with real documents
3. Fine-tune field mappings based on document formats
