# Login Flow Trace

This document traces the complete login flow from user input to authenticated session.

## Overview

The login system uses:
- **JWT Access Tokens** (short-lived, 10 minutes) - stored in memory via AuthManager
- **JWT Refresh Tokens** (long-lived, 7 days) - stored as HttpOnly cookie
- **CSRF Protection** - XSRF-TOKEN cookie + header validation
- **Session Tracking** - database records for active sessions
- **Token Blacklisting** - JTI-based revocation for logout

---

## 1. Frontend: User Submits Login Form

**File:** `js/login-signup.js`

### Entry Point
- Form submission triggers `handleLogin()` (line 75)
- Which calls `validateLogin()` (line 138)

### Validation Steps (lines 138-207)
1. **Extract credentials** from form inputs:
   - `loginEmail` input field
   - `loginPassword` input field

2. **Basic validation**:
   - Check fields are not empty
   - Validate email format with regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

3. **Session check** (lines 157-180):
   - Uses `AuthUtils.checkExistingSession()` to detect if user is already logged in
   - If different account, prompts user to switch accounts
   - If same account, redirects based on role

### API Call (lines 212-219)
```javascript
const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
});
```

---

## 2. Backend: Login Endpoint

**File:** `backend/routes/auth.js`  
**Route:** `POST /api/auth/login` (line 365)

### Request Processing

#### Step 1: Input Validation (lines 367-375)
```javascript
const { email: rawEmail, password } = req.body;

if (!rawEmail || !password) {
    return res.status(400).json({
        success: false,
        error: 'Email and password are required'
    });
}
```

#### Step 2: Email Normalization (line 378)
```javascript
const email = rawEmail.trim().toLowerCase();
```
- Prevents case-sensitivity attacks
- Ensures consistent email lookup

#### Step 3: User Lookup (line 381)
```javascript
const user = await db.getUserByEmail(email);
```
- **Database Service:** `backend/database/services.js` → `getUserByEmail()` (line 10)
- **Query:** `SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND is_active = true`
- Returns user object or `null`

#### Step 4: Password Verification (line 390)
```javascript
const isValidPassword = await bcrypt.compare(password, user.password_hash);
```
- Uses `bcryptjs` to compare plaintext password with stored hash
- Returns `true` if password matches, `false` otherwise
- If invalid, returns 401 with "Invalid credentials" (prevents user enumeration)

#### Step 5: Email Verification Check (lines 398-407)
```javascript
if (!user.email_verified) {
    console.warn('⚠️ Login with unverified email (allowed)', {...});
    // Continue with login - don't block
}
```
- **Note:** Email verification is logged but doesn't block login
- Verification is only required for new signups

#### Step 6: Update Last Login (line 410)
```javascript
await db.updateUserLastLogin(user.id);
```
- **Database Service:** `backend/database/services.js` → `updateUserLastLogin()` (line 41)
- **Query:** `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1`

---

## 3. Token Generation

### Access Token (lines 413-417)
```javascript
const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role
});
```

**File:** `backend/config/jwt.js` → `generateAccessToken()` (line 23)

**Token Structure:**
- **Payload:** `{ userId, email, role, jti, type: 'access' }`
- **JTI (JWT ID):** Unique UUID for blacklisting
- **Expiry:** 10 minutes (configurable via `JWT_ACCESS_EXPIRY`)
- **Secret:** `JWT_SECRET` from environment

**Example Token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3OCIsImVtYWlsIjoi...
```

### Refresh Token (lines 420-424)
```javascript
const refreshToken = generateRefreshToken({
    userId: user.id,
    email: user.email,
    role: user.role
});
```

**File:** `backend/config/jwt.js` → `generateRefreshToken()` (line 40)

**Token Structure:**
- **Payload:** `{ userId, email, role, type: 'refresh' }`
- **Expiry:** 7 days (configurable via `JWT_REFRESH_EXPIRY`)
- **Secret:** `JWT_REFRESH_SECRET` (or `JWT_SECRET + '_refresh'`)

---

## 4. Token Storage

### Refresh Token Storage (lines 427-435)

#### Database Storage
```javascript
const refreshTokenRecord = await refreshTokenService.createRefreshToken(user.id, refreshToken);
```

**File:** `backend/services/refreshToken.js` → `createRefreshToken()` (line 18)

**Process:**
1. Hash token using SHA-256: `crypto.createHash('sha256').update(token).digest('hex')`
2. Calculate expiry: 7 days from now
3. Insert into `refresh_tokens` table:
   ```sql
   INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
   VALUES ($1, $2, $3)
   ```

**Database Table:** `refresh_tokens`
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, FOREIGN KEY → users.id)
- `token_hash` (VARCHAR(255), UNIQUE) - **Hashed token, not plaintext**
- `expires_at` (TIMESTAMP)
- `created_at` (TIMESTAMP)

#### Cookie Storage (lines 442-447)
```javascript
res.cookie('refreshToken', refreshToken, {
    httpOnly: true,        // Prevents JavaScript access (XSS protection)
    secure: isProduction,  // HTTPS only in production
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});
```

### Session Creation (lines 430-435)
```javascript
await refreshTokenService.createOrUpdateSession(
    user.id,
    refreshTokenRecord.id,
    req.ip || req.connection.remoteAddress,
    req.get('user-agent') || ''
);
```

**File:** `backend/services/refreshToken.js` → `createOrUpdateSession()` (line 127)

**Database Table:** `sessions`
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, FOREIGN KEY → users.id)
- `refresh_token_id` (UUID, FOREIGN KEY → refresh_tokens.id)
- `ip_address` (INET)
- `user_agent` (TEXT)
- `created_at` (TIMESTAMP)
- `last_activity` (TIMESTAMP)
- `expires_at` (TIMESTAMP)

### CSRF Token (lines 438, 450-455)
```javascript
const csrfToken = crypto.randomBytes(32).toString('hex');

res.cookie('XSRF-TOKEN', csrfToken, {
    httpOnly: false,      // Readable by JavaScript (needed for header)
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
});
```

---

## 5. Response to Frontend

**Response (lines 463-479):**
```json
{
    "success": true,
    "message": "Login successful",
    "user": {
        "id": "uuid",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "vehicle_owner",
        "organization": "Individual",
        "phone": "+1234567890",
        "isActive": true,
        "emailVerified": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Cookies Set:**
- `refreshToken` (HttpOnly, Secure in production)
- `XSRF-TOKEN` (Readable, for CSRF protection)

**Headers:**
- `Cache-Control: no-store, no-cache, must-revalidate, private`
- `Pragma: no-cache`
- `Expires: 0`

---

## 6. Frontend: Token Storage

**File:** `js/login-signup.js` (lines 224-245)

### User Data Storage
```javascript
if (result.user) {
    localStorage.setItem('currentUser', JSON.stringify(result.user));
}
```
- Stored in `localStorage` for page reloads
- Contains non-sensitive user information

### Access Token Storage
```javascript
if (result.token && typeof window !== 'undefined' && window.authManager) {
    // Clear any demo tokens first
    if (localStorage.getItem('authToken')?.startsWith('demo-token-')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('token');
    }
    // Store in AuthManager memory
    window.authManager.setAccessToken(result.token);
    // Keep localStorage for backward compatibility
    localStorage.setItem('authToken', result.token);
}
```

**File:** `js/auth-manager.js` → `setAccessToken()` (line 104)

**Storage Strategy:**
1. **Primary:** In-memory (`this.accessToken`) - more secure, cleared on page close
2. **Backup:** `localStorage` - for page reloads, backward compatibility

**Token Refresh Scheduling:**
- `scheduleTokenRefresh()` (line 155) schedules automatic refresh
- Refreshes at 80% of token lifetime OR 1 minute before expiry (whichever is longer)

---

## 7. Role-Based Redirect

**File:** `js/login-signup.js` (lines 279-314)

After successful login, user is redirected based on role:

```javascript
const userRole = result.user?.role;
switch(userRole) {
    case 'hpg_admin':
        window.location.href = 'hpg-admin-dashboard.html';
        break;
    case 'admin':
    case 'lto_admin':
        window.location.href = 'admin-dashboard.html';
        break;
    case 'lto_officer':
        window.location.href = 'lto-officer-dashboard.html';
        break;
    case 'insurance_verifier':
        window.location.href = 'insurance-verifier-dashboard.html';
        break;
    case 'emission_verifier':
        window.location.href = 'verifier-dashboard.html';
        break;
    case 'vehicle_owner':
    default:
        window.location.href = 'owner-dashboard.html';
        break;
}
```

---

## 8. Subsequent API Requests

### AuthManager Integration

**File:** `js/auth-manager.js` → `fetchWithAuth()` (line 242)

**Process:**
1. Get access token from memory: `this.getAccessToken()`
2. Get CSRF token from cookie: `this.getCsrfToken()`
3. Add headers:
   ```javascript
   headers['Authorization'] = `Bearer ${token}`;
   headers['X-XSRF-TOKEN'] = csrfToken;
   ```
4. If 401 response, automatically refresh token and retry once

### Backend Authentication Middleware

**File:** `backend/middleware/auth.js` → `authenticateToken()` (line 12)

**Process:**
1. Extract token from `Authorization: Bearer <token>` header
2. Block demo tokens in production
3. Verify token signature: `verifyAccessToken(token)`
4. Check blacklist by JTI: `isBlacklistedByJTI(decoded.jti)`
5. Set `req.user` with decoded payload
6. Set `req.tokenJti` for potential blacklisting

**Token Verification:**
- **File:** `backend/config/jwt.js` → `verifyAccessToken()` (line 54)
- Uses `jwt.verify()` with `JWT_SECRET`
- Validates signature and expiration

---

## 9. Token Refresh Flow

### Automatic Refresh

**File:** `js/auth-manager.js` → `refreshAccessToken()` (line 188)

**Triggered:**
- On page load if token is expired or expiring soon
- Scheduled refresh at 80% of token lifetime
- Automatic retry on 401 responses

**Process:**
1. Get CSRF token from cookie
2. POST to `/api/auth/refresh`:
   ```javascript
   fetch('/api/auth/refresh', {
       method: 'POST',
       headers: {
           'Content-Type': 'application/json',
           'X-XSRF-TOKEN': csrfToken
       },
       credentials: 'include'  // Sends refreshToken cookie
   });
   ```

### Backend Refresh Endpoint

**File:** `backend/routes/auth.js` → `POST /api/auth/refresh` (line 668)

**Process:**
1. Extract `refreshToken` from cookie
2. Verify refresh token:
   - **JWT Verification:** `verifyRefreshToken(refreshToken)`
   - **Database Lookup:** Find token hash in `refresh_tokens` table
   - **Expiry Check:** Ensure `expires_at > CURRENT_TIMESTAMP`
3. Generate new access token
4. Update session `last_activity`
5. Return new access token

**File:** `backend/services/refreshToken.js` → `verifyRefreshToken()` (line 38)

---

## 10. Logout Flow

### Frontend Logout

**File:** `js/auth-manager.js` → `logout()` (line 299)

**Process:**
1. Call `/api/auth/logout` with CSRF token
2. Clear in-memory access token
3. Clear localStorage
4. Redirect to login page

### Backend Logout

**File:** `backend/routes/auth.js` → `POST /api/auth/logout` (line 720)

**Process:**
1. Revoke refresh token:
   - Hash token: `hashToken(refreshToken)`
   - Update `refresh_tokens` table: `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1`
2. Blacklist access token:
   - Extract JTI from token
   - Add to blacklist with expiry time
3. Clear cookies: `refreshToken`, `XSRF-TOKEN`

**Token Blacklisting:**
- **File:** `backend/config/blacklist.js`
- Uses Redis or in-memory store
- Key: `blacklist:jti:<jti>`
- Value: Token hash
- TTL: Token expiration time

---

## Security Features

### 1. Password Security
- **Hashing:** bcrypt with 12 rounds (configurable)
- **Comparison:** Constant-time comparison via `bcrypt.compare()`
- **Storage:** Only hashed passwords stored in database

### 2. Token Security
- **Access Tokens:** Short-lived (10 minutes), stored in memory
- **Refresh Tokens:** Long-lived (7 days), HttpOnly cookies
- **JTI Blacklisting:** Revocation support via unique token IDs
- **CSRF Protection:** Double-submit cookie pattern

### 3. Email Normalization
- **Lowercase:** Prevents case-sensitivity attacks
- **Trim:** Removes whitespace

### 4. Session Management
- **Database Tracking:** All sessions stored in `sessions` table
- **IP & User-Agent:** Logged for security monitoring
- **Last Activity:** Updated on each refresh

### 5. Error Handling
- **Generic Messages:** "Invalid credentials" prevents user enumeration
- **Rate Limiting:** Signup limiter (3 attempts per 15 minutes)
- **Logging:** Security events logged for monitoring

---

## Database Schema

### users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50),
    organization VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

### refresh_tokens Table
```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);
```

### sessions Table
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_id UUID REFERENCES refresh_tokens(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);
```

---

## Flow Diagram

```
┌─────────────────┐
│  User enters    │
│  email/password │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ validateLogin() │
│ (frontend)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ POST /api/auth/ │
│ login           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Email normalize │
│ & lookup user   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ bcrypt.compare()│
│ verify password │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate tokens │
│ (access+refresh)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Store refresh   │
│ token in DB     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create session  │
│ record          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Set cookies     │
│ (refresh+CSRF)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Return response │
│ with access     │
│ token           │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Frontend stores │
│ token in memory │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Redirect based  │
│ on role         │
└─────────────────┘
```

---

## Key Files Reference

| Component | File | Purpose |
|-----------|------|---------|
| **Frontend Login** | `js/login-signup.js` | Form validation, API call, token storage |
| **Auth Manager** | `js/auth-manager.js` | Token management, refresh, logout |
| **Login Endpoint** | `backend/routes/auth.js` | Login handler, token generation |
| **Auth Middleware** | `backend/middleware/auth.js` | Token verification, user extraction |
| **JWT Config** | `backend/config/jwt.js` | Token generation/verification |
| **Refresh Service** | `backend/services/refreshToken.js` | Refresh token DB operations |
| **Database Service** | `backend/database/services.js` | User lookup, last login update |

---

## Testing Login Flow

### Manual Test Steps

1. **Open login page:** `login-signup.html`
2. **Enter credentials:** Email and password
3. **Submit form:** Click login button
4. **Check Network tab:**
   - POST `/api/auth/login` → 200 OK
   - Response contains `token` and `user` object
   - Cookies: `refreshToken`, `XSRF-TOKEN`
5. **Check Application tab:**
   - `localStorage`: `currentUser`, `authToken`
   - `Cookies`: `refreshToken` (HttpOnly), `XSRF-TOKEN`
6. **Verify redirect:** Should redirect to dashboard based on role
7. **Check subsequent requests:**
   - All API calls include `Authorization: Bearer <token>`
   - All POST/PUT/DELETE include `X-XSRF-TOKEN` header

### Common Issues

1. **"Invalid credentials"**
   - Check email/password in database
   - Verify `is_active = true` in users table
   - Check password hash matches bcrypt format

2. **"Token has been revoked"**
   - Token was blacklisted (logout or security event)
   - Check blacklist store (Redis or in-memory)

3. **"CSRF token required"**
   - Missing `XSRF-TOKEN` cookie
   - Missing `X-XSRF-TOKEN` header in request

4. **Token refresh fails**
   - Refresh token expired (7 days)
   - Refresh token revoked in database
   - CSRF token missing

---

## Environment Variables

Required for login to work:

```bash
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here  # Optional, defaults to JWT_SECRET + '_refresh'
JWT_ACCESS_EXPIRY=10m                        # Optional, defaults to 10 minutes
JWT_REFRESH_EXPIRY=7d                        # Optional, defaults to 7 days
BCRYPT_ROUNDS=12                             # Optional, defaults to 12
NODE_ENV=production                          # Optional, affects cookie security
FRONTEND_URL=http://localhost:3000           # For email verification links
```

---

## Summary

The login flow is a secure, multi-layered authentication system:

1. **Frontend** validates input and calls API
2. **Backend** verifies credentials and generates tokens
3. **Tokens** are stored securely (memory + HttpOnly cookies)
4. **Sessions** are tracked in database
5. **Subsequent requests** use tokens for authentication
6. **Automatic refresh** keeps users logged in
7. **Logout** revokes tokens and clears session

The system follows security best practices:
- Password hashing (bcrypt)
- Token expiration and refresh
- CSRF protection
- HttpOnly cookies
- Token blacklisting
- Session tracking
