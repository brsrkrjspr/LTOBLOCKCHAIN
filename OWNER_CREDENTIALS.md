# Vehicle Owner Login Credentials

## 🔐 Login Information for Owner Dashboard

### Primary Test Account
**Email:** `owner@example.com`  
**Password:** `owner123`  
**Role:** `Vehicle Owner`  
**Name:** John Doe

### Alternative Test Account
**Email:** `vehicle@example.com`  
**Password:** `vehicle123`  
**Role:** `Vehicle Owner`  
**Name:** Jane Smith

## 📋 How to Login

### Method 1: Direct Login
1. Go to `login-signup.html`
2. Enter one of the credentials above:
   - Email: `owner@example.com`
   - Password: `owner123`
3. Click "Login"
4. You will be redirected to `owner-dashboard.html`

### Method 2: Quick Login Button (if available)
1. Go to `index.html`
2. Look for "Login as Vehicle Owner" button
3. Click the button to auto-fill credentials
4. Click "Login"

### Method 3: Demo Credentials Section
1. Go to `login-signup.html`
2. In the "Test Login Credentials" section, click on:
   - **Vehicle Owner:** owner@example.com / owner123
   - OR **Vehicle Owner (Alt):** vehicle@example.com / vehicle123
3. The form will auto-fill
4. Click "Login"

## ✅ All Available Test Credentials

| Role | Email | Password | Dashboard |
|------|-------|----------|-----------|
| **Vehicle Owner** | `owner@example.com` | `owner123` | `owner-dashboard.html` |
| **Vehicle Owner (Alt)** | `vehicle@example.com` | `vehicle123` | `owner-dashboard.html` |
| HPG Admin | `hpgadmin@hpg.gov.ph` | `hpg123456` | `hpg-admin-dashboard.html` |
| LTO Admin | `admin@lto.gov.ph` | `admin123` | `admin-dashboard.html` |
| Insurance Verifier | `insurance@example.com` | `insurance123` | `insurance-verifier-dashboard.html` |
| Emission Verifier | `emission@example.com` | `emission123` | `verifier-dashboard.html` |

## 🎯 Features Available to Vehicle Owner

Once logged in, Vehicle Owner can access:

1. **Owner Dashboard** (`owner-dashboard.html`)
   - View registered vehicles count
   - Track pending applications
   - See approved applications
   - View notifications
   - Quick actions for registration, document upload, etc.

2. **Registration Wizard** (`registration-wizard.html`)
   - Start new vehicle registration
   - Fill out vehicle information
   - Upload required documents
   - Submit registration application

3. **My Applications**
   - View all submitted applications
   - Track application status
   - View application details
   - Download certificates (when approved)

4. **Document Viewer** (`document-viewer.html`)
   - View uploaded documents
   - Check document status
   - Download registration papers

5. **Progress Timeline**
   - Track registration progress
   - See which steps are completed
   - Monitor pending verifications

## 🔄 Authentication Flow

1. User enters credentials (`owner@example.com` / `owner123`)
2. System validates credentials (frontend demo authentication)
3. User data stored in `localStorage` as `currentUser`:
   ```json
   {
     "id": "demo-user-...",
     "email": "owner@example.com",
     "role": "vehicle_owner",
     "firstName": "John",
     "lastName": "Doe",
     "name": "Vehicle Owner",
     "organization": "Individual",
     "phone": "+63 912 345 6789",
     "isActive": true,
     "emailVerified": true
   }
   ```
4. Auth token stored in `localStorage` as `authToken`
5. Redirect to `owner-dashboard.html`
6. Dashboard loads user info from `localStorage` and displays personalized welcome message

## 📝 Notes

- These are **test/demo credentials** for development purposes
- In production, credentials should be stored securely in a database
- The system supports both frontend demo authentication and backend API authentication
- All Owner Dashboard pages check for authentication and redirect to login if not authenticated
- You can also create a new account using the "Sign Up" tab on the login page
- New accounts created via signup will have the `vehicle_owner` role by default

## 🆕 Creating a New Account

If you prefer to create your own account:

1. Go to `login-signup.html`
2. Click the "Sign Up" tab
3. Fill in the form:
   - First Name
   - Last Name
   - Email Address
   - Phone Number
   - Password (minimum 8 characters)
   - Confirm Password
4. Accept Terms of Service
5. Click "Create Account"
6. You'll be automatically logged in and redirected to the owner dashboard

## 🔒 Security Notes

- These demo credentials are for testing only
- Never use these credentials in production
- Always use strong, unique passwords in production
- The system uses JWT tokens for authentication
- Tokens expire after 24 hours (configurable)

