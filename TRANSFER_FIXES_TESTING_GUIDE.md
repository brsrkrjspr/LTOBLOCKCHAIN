# Transfer Ownership Fixes - Testing Guide

**Date:** Current  
**Purpose:** Test the buyer validation and OR/CR validation fixes

---

## Test Setup

### Prerequisites
1. Backend server running (`npm start` or `node server.js`)
2. Frontend accessible (`transfer-ownership.html`)
3. At least 2 user accounts:
   - **Seller Account:** User who owns a vehicle
   - **Buyer Account:** User who will receive the transfer

### Test Accounts Setup

**Option 1: Create Test Accounts**
1. Register Seller: `seller@test.com` / Password: `test123`
2. Register Buyer: `buyer@test.com` / Password: `test123`
3. Register Buyer with Full Name: `john.michael.smith@test.com` / Password: `test123`
   - First Name: `John Michael`
   - Last Name: `Smith`

**Option 2: Use Existing Accounts**
- Note the email and names of existing accounts

---

## Test 1: OR/CR Number Validation (Frontend)

### Test Case 1.1: Missing OR/CR Number
**Steps:**
1. Log in as seller
2. Navigate to `transfer-ownership.html`
3. Complete Step 1 (Seller Info) → Click "Next"
4. Complete Step 2 (Buyer Info) → Click "Next"
5. In Step 3 (Vehicle Details):
   - Select a vehicle
   - Fill Plate Number: `ABC-1234`
   - Fill Chassis Number: `CH123456`
   - **Leave OR/CR Number EMPTY**
   - Click "Next"

**Expected Result:**
- ❌ Cannot proceed to next step
- Error message: "Please complete all required fields: OR/CR Number"
- OR/CR field highlighted in red
- Form stays on Step 3

**Pass/Fail:** [ ]

---

### Test Case 1.2: OR/CR Number with Whitespace Only
**Steps:**
1. In Step 3, enter only spaces: `   ` in OR/CR field
2. Click "Next"

**Expected Result:**
- ❌ Cannot proceed (treated as empty)
- Error message includes "OR/CR Number"

**Pass/Fail:** [ ]

---

### Test Case 1.3: Valid OR/CR Number
**Steps:**
1. In Step 3, fill all fields including OR/CR: `OR-123456`
2. Click "Next"

**Expected Result:**
- ✅ Proceeds to Step 4 (Documents)
- No error message

**Pass/Fail:** [ ]

---

## Test 2: Buyer Information Validation (Backend)

### Test Case 2.1: Name Variations - Should Pass

#### Test 2.1a: Nickname Match
**Setup:**
- Buyer account: `buyer@test.com`
  - First Name: `John Michael`
  - Last Name: `Smith`
- Seller enters:
  - Email: `buyer@test.com`
  - Name: `John Smith`

**Steps:**
1. Log in as seller
2. Create transfer request with buyer email `buyer@test.com`
3. Enter buyer name: `John Smith` (nickname/shortened)

**Expected Result:**
- ✅ Transfer request created successfully
- No "Buyer information mismatch" error
- Console shows: Request submitted successfully

**Pass/Fail:** [ ]

---

#### Test 2.1b: Middle Name Variation
**Setup:**
- Buyer account: `john.michael.smith@test.com`
  - First Name: `John Michael`
  - Last Name: `Smith`
- Seller enters:
  - Email: `john.michael.smith@test.com`
  - Name: `John Smith`

**Steps:**
1. Create transfer with buyer email `john.michael.smith@test.com`
2. Enter buyer name: `John Smith`

**Expected Result:**
- ✅ Transfer request created successfully
- Fuzzy matching allows "John" to match "John Michael"

**Pass/Fail:** [ ]

---

#### Test 2.1c: Full Name Match
**Setup:**
- Buyer account: `buyer@test.com`
  - First Name: `Maria`
  - Last Name: `Santos`
- Seller enters:
  - Email: `buyer@test.com`
  - Name: `Maria Santos`

**Steps:**
1. Create transfer with buyer email `buyer@test.com`
2. Enter buyer name: `Maria Santos`

**Expected Result:**
- ✅ Transfer request created successfully
- Exact match works

**Pass/Fail:** [ ]

---

### Test Case 2.2: Name Mismatch - Should Fail

#### Test 2.2a: Both Names Don't Match
**Setup:**
- Buyer account: `buyer@test.com`
  - First Name: `John`
  - Last Name: `Smith`
- Seller enters:
  - Email: `buyer@test.com`
  - Name: `Jane Doe`

**Steps:**
1. Create transfer with buyer email `buyer@test.com`
2. Enter buyer name: `Jane Doe`

**Expected Result:**
- ❌ Returns 400 error
- Error: "Buyer information mismatch"
- Message: "The entered buyer name does not match the account owner for email buyer@test.com"
- Details show both account owner info and entered info

**Pass/Fail:** [ ]

---

#### Test Case 2.2b: Last Name Mismatch (First Name Matches)
**Setup:**
- Buyer account: `buyer@test.com`
  - First Name: `John`
  - Last Name: `Smith`
- Seller enters:
  - Email: `buyer@test.com`
  - Name: `John Doe`

**Steps:**
1. Create transfer with buyer email `buyer@test.com`
2. Enter buyer name: `John Doe`

**Expected Result:**
- ✅ Should pass (only last name differs, first name matches)
- Fuzzy matching allows this

**Pass/Fail:** [ ]

---

### Test Case 2.3: Phone Number Variations - Should Pass

#### Test 2.3a: Format Differences
**Setup:**
- Buyer account: `buyer@test.com`
  - Phone: `09171234567`
- Seller enters:
  - Email: `buyer@test.com`
  - Phone: `+63 917 123 4567`

**Steps:**
1. Create transfer with buyer email `buyer@test.com`
2. Enter phone: `+63 917 123 4567`

**Expected Result:**
- ✅ Transfer request created successfully
- Phone format differences are allowed
- Warning may be logged but doesn't block

**Pass/Fail:** [ ]

---

#### Test 2.3b: Different Phone Number
**Setup:**
- Buyer account: `buyer@test.com`
  - Phone: `09171234567`
- Seller enters:
  - Email: `buyer@test.com`
  - Phone: `09189999999`

**Steps:**
1. Create transfer with buyer email `buyer@test.com`
2. Enter phone: `09189999999`

**Expected Result:**
- ✅ Transfer request created successfully
- Phone mismatch is logged as warning but doesn't block
- Console shows: `⚠️ Phone number mismatch for buyer buyer@test.com`

**Pass/Fail:** [ ]

---

### Test Case 2.4: New Buyer (No Account)
**Setup:**
- Email: `newbuyer@test.com` (doesn't exist in system)

**Steps:**
1. Create transfer with buyer email `newbuyer@test.com`
2. Enter buyer name: `New Buyer`
3. Enter buyer phone: `09171234567`

**Expected Result:**
- ✅ Transfer request created successfully
- Buyer info stored as provisional buyer_info
- No validation errors (email doesn't exist, so no mismatch check)

**Pass/Fail:** [ ]

---

## Test 3: Complete Transfer Flow

### Test Case 3.1: End-to-End Transfer
**Steps:**
1. Log in as seller
2. Navigate to `transfer-ownership.html`
3. **Step 1:** Fill seller info → Next
4. **Step 2:** Fill buyer info (use existing buyer email with name variation) → Next
5. **Step 3:** 
   - Select vehicle
   - Fill Plate Number
   - Fill Chassis Number
   - Fill OR/CR Number: `OR-123456` → Next
6. **Step 4:** Upload required documents → Next
7. **Step 5:** Review and submit

**Expected Result:**
- ✅ All steps complete without errors
- ✅ Transfer request submitted successfully
- ✅ No "Buyer information mismatch" error
- ✅ Success message displayed

**Pass/Fail:** [ ]

---

## Test 4: API Testing (Optional - Advanced)

### Test Case 4.1: Direct API Call - Name Variation
**Command:**
```bash
curl -X POST http://localhost:3001/api/vehicles/transfer/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SELLER_TOKEN" \
  -d '{
    "vehicleId": "VEHICLE_ID",
    "buyerEmail": "buyer@test.com",
    "buyerName": "John Smith",
    "buyerPhone": "09171234567"
  }'
```

**Expected Response (if buyer account has "John Michael Smith"):**
```json
{
  "success": true,
  "message": "Transfer request created successfully",
  "transferRequest": {
    "id": "...",
    "status": "PENDING"
  }
}
```

**Pass/Fail:** [ ]

---

### Test Case 4.2: Direct API Call - Name Mismatch
**Command:**
```bash
curl -X POST http://localhost:3001/api/vehicles/transfer/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SELLER_TOKEN" \
  -d '{
    "vehicleId": "VEHICLE_ID",
    "buyerEmail": "buyer@test.com",
    "buyerName": "Jane Doe",
    "buyerPhone": "09171234567"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Buyer information mismatch",
  "message": "The entered buyer name does not match the account owner for email buyer@test.com...",
  "details": {
    "email": "buyer@test.com",
    "accountOwner": {
      "firstName": "John",
      "lastName": "Smith",
      "phone": "09171234567"
    },
    "enteredInfo": {
      "firstName": "Jane",
      "lastName": "Doe",
      "phone": "09171234567"
    },
    "mismatches": ["name"]
  }
}
```

**Pass/Fail:** [ ]

---

## Testing Checklist

### Frontend Tests
- [ ] OR/CR field validation prevents empty submission
- [ ] OR/CR field validation prevents whitespace-only submission
- [ ] OR/CR field validation allows valid input
- [ ] Error message clearly shows missing fields

### Backend Tests
- [ ] Name variations work (nickname, middle name)
- [ ] Exact name match works
- [ ] Complete name mismatch fails correctly
- [ ] Phone format differences allowed
- [ ] Phone number differences logged but don't block
- [ ] New buyer (no account) works

### Integration Tests
- [ ] Complete transfer flow works end-to-end
- [ ] No console errors
- [ ] Success messages display correctly

---

## Troubleshooting

### Issue: "Buyer information mismatch" still appears
**Check:**
1. Verify buyer account exists in database
2. Check console for exact error details
3. Verify name parsing (first name vs last name split)

### Issue: OR/CR validation not working
**Check:**
1. Open browser console (F12)
2. Check for JavaScript errors
3. Verify `toOrCrNumber` element exists in DOM
4. Check if validation function is called

### Issue: Transfer request not submitting
**Check:**
1. Check browser console for errors
2. Verify all required documents uploaded
3. Check network tab for API response
4. Verify authentication token is valid

---

## Expected Console Output

### Successful Transfer:
```
📤 Submitting transfer request with explicit document roles: {...}
✅ Transfer request submitted successfully!
```

### Name Mismatch Error:
```
❌ Error: Buyer information mismatch
Details: {...}
```

### Phone Mismatch Warning:
```
⚠️ Phone number mismatch for buyer buyer@test.com: Account has 09171234567, entered 09189999999. Proceeding anyway.
```

---

## Test Results Summary

**Date:** _____________  
**Tester:** _____________  

| Test Case | Status | Notes |
|-----------|--------|-------|
| OR/CR Validation - Empty | [ ] Pass / [ ] Fail | |
| OR/CR Validation - Whitespace | [ ] Pass / [ ] Fail | |
| OR/CR Validation - Valid | [ ] Pass / [ ] Fail | |
| Name Variation - Nickname | [ ] Pass / [ ] Fail | |
| Name Variation - Middle Name | [ ] Pass / [ ] Fail | |
| Name Mismatch - Both Names | [ ] Pass / [ ] Fail | |
| Phone Format Difference | [ ] Pass / [ ] Fail | |
| Phone Number Difference | [ ] Pass / [ ] Fail | |
| New Buyer (No Account) | [ ] Pass / [ ] Fail | |
| Complete Flow | [ ] Pass / [ ] Fail | |

**Overall Status:** [ ] All Tests Pass / [ ] Issues Found

**Issues Found:**
1. 
2. 
3. 

---

**Ready to test!** Follow the test cases above and mark each as Pass/Fail.

