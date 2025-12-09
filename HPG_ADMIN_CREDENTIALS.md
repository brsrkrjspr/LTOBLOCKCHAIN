# HPG Admin Login Credentials

## 🔐 Login Information

**Email:** `hpgadmin@hpg.gov.ph`  
**Password:** `hpg123456`  
**Role:** `HPG Admin`

## 📋 How to Login

### Method 1: Direct Login
1. Go to `login-signup.html`
2. Enter the credentials above
3. Select "HPG Admin" from the Role dropdown
4. Click "Login"
5. You will be redirected to `hpg-admin-dashboard.html`

### Method 2: Quick Login Button
1. Go to `index.html`
2. Scroll to the "Access Your Dashboard" section
3. Click the "Login as HPG Admin" button (red border)
4. The login form will auto-fill with HPG Admin credentials
5. Click "Login"

### Method 3: Demo Credentials Section
1. Go to `login-signup.html`
2. In the "Test Login Credentials" section, click on "HPG Admin: hpgadmin@hpg.gov.ph / hpg123456"
3. The form will auto-fill
4. Click "Login"

## ✅ All Test Credentials

| Role | Email | Password | Dashboard |
|------|-------|----------|-----------|
| **HPG Admin** | `hpgadmin@hpg.gov.ph` | `hpg123456` | `hpg-admin-dashboard.html` |
| LTO Admin | `admin@lto.gov.ph` | `admin123` | `admin-dashboard.html` |
| Insurance Verifier | `insurance@example.com` | `insurance123` | `insurance-verifier-dashboard.html` |
| Emission Verifier | `emission@example.com` | `emission123` | `verifier-dashboard.html` |
| Dealership | `dealer@example.com` | `dealer123` | `dashboard_dealership.html` |
| Police | `police@example.com` | `police123` | `dashboard_police.html` |
| Bank | `bank@example.com` | `bank123` | `dashboard_bank.html` |

## 🎯 Features Available to HPG Admin

Once logged in, HPG Admin can access:

1. **Dashboard** (`hpg-admin-dashboard.html`)
   - View request summary cards
   - Quick action buttons
   - Notifications panel
   - Activity log preview

2. **LTO Requests** (`hpg-requests-list.html`)
   - View all clearance requests from LTO
   - Filter by status, purpose, search
   - Start verification process

3. **Vehicle Verification** (`hpg-verification-form.html`)
   - Perform vehicle inspection
   - Enter engine/chassis numbers
   - Upload inspection photos and stencil
   - Approve or reject verification

4. **Release Certificate** (`hpg-release-certificate.html`)
   - Generate MV Clearance Certificate
   - Release certificate to LTO Admin

5. **Activity Logs** (`hpg-activity-logs.html`)
   - View complete activity history
   - Filter and search logs

## 🔄 Authentication Flow

1. User enters credentials
2. System validates credentials (frontend demo or backend API)
3. User data stored in `localStorage` as `currentUser`
4. Auth token stored in `localStorage` as `authToken`
5. Redirect to `hpg-admin-dashboard.html`
6. Dashboard loads user info from `localStorage`

## 📝 Notes

- These are **test/demo credentials** for development purposes
- In production, credentials should be stored securely in a database
- The system supports both frontend demo authentication and backend API authentication
- All HPG Admin pages check for authentication and redirect to login if not authenticated

