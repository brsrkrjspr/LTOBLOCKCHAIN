# Codespace Testing Guide
## Transfer Ownership & Enhanced Features

**Purpose:** Step-by-step guide for testing the new backend implementation in Codespace

---

## 🚀 Quick Start Testing Workflow

### **When to Test in Codespace:**

1. **After pulling new backend changes** - Test immediately to catch issues early
2. **Before frontend integration** - Verify backend APIs work correctly
3. **After database schema changes** - Ensure tables are created properly
4. **Before committing** - Final verification before pushing to repo

---

## 📋 Pre-Testing Checklist

- [ ] Codespace is running and accessible
- [ ] Docker containers are up (`docker ps` shows all services)
- [ ] PostgreSQL container is running
- [ ] Node.js server is running (`npm start`)

---

## 🔧 Step 1: Apply Database Schema

**Run this FIRST before testing any APIs:**

```bash
# In Codespace terminal:
bash scripts/apply-transfer-schema.sh

# Or if you have execute permissions:
./scripts/apply-transfer-schema.sh
```

**Note:** If you're on Windows, the scripts will work fine in Codespace (Linux environment).

**What it does:**
- Checks if PostgreSQL container is running
- Applies `database/add-transfer-ownership.sql`
- Verifies all 3 tables were created:
  - `transfer_requests`
  - `transfer_documents`
  - `transfer_verifications`

**Expected output:**
```
✅ PostgreSQL container is running
✅ Schema applied successfully!
✅ Table 'transfer_requests' exists
✅ Table 'transfer_documents' exists
✅ Table 'transfer_verifications' exists
```

**If tables already exist:** The script will show warnings but continue (IF NOT EXISTS in SQL).

---

## 🧪 Step 2: Test Backend APIs

**Automated Testing:**

```bash
bash scripts/test-transfer-apis.sh
```

**What it tests:**
1. ✅ Server health check
2. ✅ Admin login
3. ✅ `GET /api/admin/stats` - Enhanced admin statistics
4. ✅ `GET /api/vehicles/transfer/requests` - List transfer requests
5. ✅ `GET /api/vehicles/transfer/requests/stats` - Transfer statistics
6. ✅ `GET /api/documents/search` - Document search
7. ✅ `GET /api/vehicles/:vin/ownership-history` - Ownership history

**Expected output:**
```
✅ Server is running
✅ Logged in successfully
✅ Admin stats endpoint working
✅ Transfer requests list endpoint working
✅ Transfer stats endpoint working
✅ Document search endpoint working
✅ Ownership history endpoint working
```

---

## 🔍 Step 3: Manual API Testing

### **Option A: Using curl (Terminal)**

#### **1. Get Admin Token:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lto.gov.ph","password":"admin123"}'
```

**Save the token from response:**
```bash
export TOKEN="your-token-here"
```

#### **2. Test Transfer Requests List:**
```bash
curl -X GET http://localhost:3001/api/vehicles/transfer/requests \
  -H "Authorization: Bearer $TOKEN" | jq
```

#### **3. Test Admin Stats:**
```bash
curl -X GET http://localhost:3001/api/admin/stats \
  -H "Authorization: Bearer $TOKEN" | jq
```

#### **4. Test Document Search:**
```bash
curl -X GET "http://localhost:3001/api/documents/search?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq
```

#### **5. Test Ownership History:**
```bash
# First, get a vehicle VIN
curl -X GET "http://localhost:3001/api/vehicles?limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.vehicles[0].vin'

# Then test ownership history (replace VIN)
curl -X GET "http://localhost:3001/api/vehicles/ABC123/ownership-history" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### **Option B: Using Browser DevTools**

1. **Open browser:** Navigate to `http://localhost:3001/login-signup.html`
2. **Login as admin:** `admin@lto.gov.ph` / `admin123`
3. **Open DevTools:** Press `F12` → Go to `Console` tab
4. **Test in console:**
```javascript
// Get token
const token = localStorage.getItem('authToken');

// Test admin stats
fetch('http://localhost:3001/api/admin/stats', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(console.log);

// Test transfer requests
fetch('http://localhost:3001/api/vehicles/transfer/requests', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(console.log);
```

---

## 📊 Step 4: Verify Database Tables

**Check if tables exist:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt transfer*"
```

**Expected output:**
```
                    List of relations
 Schema |         Name          | Type  |  Owner   
--------+-----------------------+-------+----------
 public | transfer_documents    | table | lto_user
 public | transfer_requests     | table | lto_user
 public | transfer_verifications| table | lto_user
```

**Check table structure:**
```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "\d transfer_requests"
```

---

## 🐛 Troubleshooting

### **Issue: "PostgreSQL container is not running"**

**Solution:**
```bash
docker-compose -f docker-compose.unified.yml up -d postgres
sleep 5
bash scripts/apply-transfer-schema.sh
```

### **Issue: "Server is not running"**

**Solution:**
```bash
npm start
# Wait for "Server running on port 3001"
```

### **Issue: "401 Unauthorized" or "403 Forbidden"**

**Solution:**
- Make sure you're logged in as admin
- Check token is valid: `localStorage.getItem('authToken')`
- Re-login if token expired

### **Issue: "Table already exists" errors**

**Solution:**
- This is normal! The SQL uses `IF NOT EXISTS`
- The script will continue even with these warnings
- Check if tables exist: `docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt transfer*"`

### **Issue: "Cannot find module" errors**

**Solution:**
```bash
npm install
npm start
```

---

## ✅ Success Criteria

**Backend is working correctly if:**

1. ✅ Schema script completes without errors
2. ✅ All 3 tables exist in database
3. ✅ Test script passes all API checks
4. ✅ Manual API calls return `{"success": true}`
5. ✅ Admin stats shows transfer counts
6. ✅ Transfer requests list returns empty array (no errors)

---

## 🎯 Next Steps After Testing

Once backend is verified:

1. **Frontend Integration:**
   - Update `js/admin-transfer-requests.js` to call APIs
   - Update `js/admin-transfer-details.js` to call APIs
   - Update `js/admin-transfer-verification.js` to call APIs

2. **End-to-End Testing:**
   - Create a transfer request via UI
   - Approve/reject via UI
   - Verify documents via UI
   - Check ownership history

3. **Production Readiness:**
   - Test with real data
   - Verify blockchain integration
   - Check error handling

---

## 📝 Testing Checklist

Use this checklist for each testing session:

- [ ] Database schema applied
- [ ] All tables exist
- [ ] Server running
- [ ] Admin login works
- [ ] `GET /api/admin/stats` returns data
- [ ] `GET /api/vehicles/transfer/requests` returns list
- [ ] `GET /api/vehicles/transfer/requests/stats` returns stats
- [ ] `GET /api/documents/search` works
- [ ] `GET /api/vehicles/:vin/ownership-history` works
- [ ] No console errors
- [ ] No server errors in logs

---

## 🔄 Recommended Testing Schedule

**After each backend change:**
1. Run `apply-transfer-schema.sh` (if schema changed)
2. Run `test-transfer-apis.sh`
3. Manual spot checks on critical endpoints

**Before frontend integration:**
1. Full test suite
2. Test with sample data
3. Verify error handling

**Before committing:**
1. Quick smoke test
2. Verify no breaking changes
3. Check logs for errors

---

**Happy Testing! 🚀**

