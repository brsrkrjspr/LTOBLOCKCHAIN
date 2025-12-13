# Quick Start: Testing in Codespace
## Transfer Ownership Backend Implementation

**TL;DR:** Apply schema → Test APIs → Ready for frontend!

---

## 🚀 3-Step Process

### **Step 1: Apply Database Schema** (2 minutes)

```bash
bash scripts/apply-transfer-schema.sh
```

**What happens:**
- Creates 3 new tables: `transfer_requests`, `transfer_documents`, `transfer_verifications`
- Verifies tables exist
- Ready for API testing

---

### **Step 2: Test Backend APIs** (1 minute)

```bash
bash scripts/test-transfer-apis.sh
```

**What happens:**
- Tests all new endpoints
- Verifies authentication
- Shows success/error for each API

---

### **Step 3: Verify in Browser** (Optional)

1. Open: `http://localhost:3001/admin-dashboard.html`
2. Login: `admin@lto.gov.ph` / `admin123`
3. Check browser console for any errors

---

## ✅ Success Indicators

**You're ready when:**
- ✅ Schema script shows "All tables verified successfully!"
- ✅ Test script shows all endpoints working
- ✅ No errors in server logs
- ✅ Admin dashboard loads without errors

---

## 🐛 Quick Fixes

**"PostgreSQL not running":**
```bash
docker-compose -f docker-compose.unified.yml up -d postgres
```

**"Server not running":**
```bash
npm start
```

**"401 Unauthorized":**
- Re-login at `/login-signup.html`
- Check token: `localStorage.getItem('authToken')`

---

## 📋 When to Test

**Test immediately:**
- ✅ After pulling backend changes
- ✅ Before frontend integration
- ✅ After database changes

**Test later:**
- ⏰ After frontend is connected
- ⏰ Before production deployment

---

## 🎯 Next: Frontend Integration

Once backend is verified:
1. Update `js/admin-transfer-requests.js`
2. Update `js/admin-transfer-details.js`
3. Update `js/admin-transfer-verification.js`

See `BACKEND_IMPLEMENTATION_SUMMARY.md` for API details.

---

**Ready to test? Run the 2 scripts above! 🚀**

