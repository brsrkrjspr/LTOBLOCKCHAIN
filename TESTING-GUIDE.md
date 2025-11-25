# 🧪 Testing Guide - TrustChain LTO System

## ✅ **Server Status**

The application is now running! Here's how to test it:

---

## 🌐 **Access the Application**

### **Frontend:**
Open your browser and go to:
```
http://localhost:3001
```

### **API Health Check:**
```
http://localhost:3001/api/health
```

---

## 🔐 **Test Credentials**

### **Admin User:**
- **Email:** `admin@lto.gov.ph`
- **Password:** `admin123`

### **Vehicle Owner:**
- **Email:** `owner@example.com`
- **Password:** `admin123`

### **Insurance Verifier:**
- **Email:** `insurance@lto.gov.ph`
- **Password:** `admin123`

### **Emission Verifier:**
- **Email:** `emission@lto.gov.ph`
- **Password:** `admin123`

---

## 🧪 **Testing Checklist**

### **1. Frontend Pages** ✅
- [ ] Landing page loads (`http://localhost:3001`)
- [ ] Login page works (`http://localhost:3001/login.html`)
- [ ] Can login with test credentials
- [ ] Dashboard loads after login

### **2. Authentication** ✅
- [ ] Can register new user
- [ ] Can login with existing user
- [ ] Token is stored in localStorage
- [ ] Protected pages require authentication

### **3. Vehicle Registration** ✅
- [ ] Registration wizard loads
- [ ] Can fill out vehicle information
- [ ] Can upload documents
- [ ] Can submit registration
- [ ] Registration appears in dashboard

### **4. Document Management** ✅
- [ ] Can upload documents
- [ ] Documents are stored (IPFS or local)
- [ ] Can view documents
- [ ] Can download documents
- [ ] Document verification works

### **5. Dashboard Features** ✅
- [ ] Owner dashboard shows vehicles
- [ ] Admin dashboard shows system stats
- [ ] Verifier dashboards show tasks
- [ ] Notifications work

### **6. API Endpoints** ✅
- [ ] Health check: `/api/health`
- [ ] Authentication: `/api/auth/login`
- [ ] Vehicles: `/api/vehicles`
- [ ] Documents: `/api/documents`
- [ ] Blockchain: `/api/blockchain`

---

## 🔍 **Manual Testing Steps**

### **Step 1: Test Login**
1. Go to `http://localhost:3001/login.html`
2. Select "Vehicle Owner" role
3. Enter email: `owner@example.com`
4. Enter password: `admin123`
5. Click "Login"
6. Should redirect to owner dashboard

### **Step 2: Test Registration**
1. From owner dashboard, click "Register New Vehicle"
2. Fill out vehicle information:
   - Make: Toyota
   - Model: Vios
   - Year: 2020
   - Color: White
   - VIN: (auto-generated or enter manually)
3. Fill out owner details
4. Upload documents (registration cert, insurance, etc.)
5. Review and submit
6. Should see success message

### **Step 3: Test Document Upload**
1. Go to registration wizard
2. Upload a PDF or image file
3. Check if upload succeeds
4. Check if document appears in review

### **Step 4: Test Admin Dashboard**
1. Logout and login as admin
2. Email: `admin@lto.gov.ph`
3. Password: `admin123`
4. Check if admin dashboard loads
5. Check system statistics
6. Check user management

### **Step 5: Test Search/Verification**
1. Go to `http://localhost:3001/search.html`
2. Enter a VIN or plate number
3. Check if search works
4. Check if results display

---

## 🐛 **Troubleshooting**

### **Server Not Starting:**
```powershell
# Check if port 3001 is in use
netstat -ano | Select-String ":3001"

# Check Node.js version
node --version

# Check if dependencies are installed
Test-Path node_modules
```

### **Database Connection Issues:**
```powershell
# Check if PostgreSQL is running
docker ps | Select-String "postgres"

# Test database connection
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT version();"
```

### **IPFS Not Working:**
- IPFS is optional - system will fallback to local storage
- Check `.env` for `STORAGE_MODE=auto` (will try IPFS, fallback to local)

### **Fabric Not Connecting:**
- Fabric is optional - system will fallback to mock mode
- Check `.env` for `BLOCKCHAIN_MODE=fabric` or `mock`

---

## 📊 **Expected Behavior**

### **✅ What Should Work:**
- All frontend pages load
- Login/registration works
- Vehicle registration works
- Document uploads work
- Dashboards display data
- API endpoints respond

### **⚠️ What Might Need Setup:**
- IPFS (optional - falls back to local storage)
- Fabric chaincode (optional - uses mock if not available)
- Email/SMS (uses mock - logs to console)

---

## 🎯 **Quick Test Commands**

### **Test API Health:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing
```

### **Test Database:**
```powershell
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT COUNT(*) FROM users;"
```

### **Test Login API:**
```powershell
$body = @{
    email = "admin@lto.gov.ph"
    password = "admin123"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
```

---

## 🚀 **Next Steps**

1. **Open Browser:** Go to `http://localhost:3001`
2. **Test Login:** Use test credentials above
3. **Test Registration:** Register a new vehicle
4. **Test Features:** Explore all dashboards and features
5. **Check Logs:** Monitor server console for any errors

---

**Server is running on:** `http://localhost:3001`  
**Status:** ✅ **Ready for Testing**

