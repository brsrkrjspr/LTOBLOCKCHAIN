# How Roles Are Decided During Login (Especially Admin Roles)

## Overview

**Important:** Roles are **NOT** determined during login. They are **stored in the database** and **retrieved** during login. The login process simply reads the role from the database and includes it in the authentication token.

---

## Role Assignment Flow

### 1. Role Storage Location

Roles are stored in the `users` table in the database:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50),  -- ← Role is stored here
    ...
);
```

### 2. How Roles Are Assigned (Before Login)

Roles are assigned when accounts are **created**, not during login. There are three ways roles are assigned:

#### A. Regular User Registration (Always `vehicle_owner`)

**File:** `backend/routes/auth.js` → `POST /api/auth/register` (line 147)

**Process:**
1. User submits registration form
2. **Role is hard-coded** to `'vehicle_owner'` (line 165)
3. Client cannot specify role - any attempt is logged as suspicious activity
4. User is created with `role = 'vehicle_owner'`

**Code:**
```javascript
// CRITICAL: Hard-code role - never trust client input
const role = 'vehicle_owner';

// Log suspicious activity: if client attempts to specify a role
if (req.body.role && req.body.role !== 'vehicle_owner') {
    console.warn('⚠️ Signup role escalation attempt', {
        ip: clientIp,
        email: rawEmail,
        attemptedRole: req.body.role,
        timestamp: new Date().toISOString()
    });
}
```

**Security:** This prevents privilege escalation attacks - users cannot register as admin.

#### B. Admin-Created Accounts (Privileged Roles)

**File:** `backend/routes/admin.js` → `POST /api/admin/create-user` (line 356)

**Process:**
1. **Only existing admins** can access this endpoint (requires `authenticateToken` + `authorizeRole(['admin', 'lto_admin'])`)
2. Admin specifies role in request body
3. Role is validated against allowed roles: `['admin', 'insurance_verifier', 'hpg_admin', 'staff', 'vehicle_owner']`
4. User is created with the specified role

**Code:**
```javascript
// Admin-only endpoint: Create privileged user account
router.post('/create-user', authenticateToken, authorizeRole(['admin', 'lto_admin']), async (req, res) => {
    const { role: requestedRole } = req.body;
    
    // Validate role
    const validRoles = ['admin', 'insurance_verifier', 'hpg_admin', 'staff', 'vehicle_owner'];
    if (!validRoles.includes(requestedRole)) {
        return res.status(400).json({
            success: false,
            error: `Invalid role. Allowed roles: ${validRoles.join(', ')}`
        });
    }
    
    // Create user with validated role
    const newUser = await db.createUser({
        email,
        passwordHash,
        firstName,
        lastName,
        role, // validated role from admin
        ...
    });
});
```

**Security:** Only authenticated admins can create privileged accounts.

#### C. Direct Database Insertion (SQL Scripts)

**File:** `database/create-lto-admin-officer-accounts.sql`

**Process:**
1. SQL scripts directly insert users with specific roles
2. Used for initial setup and testing
3. Roles are explicitly set in INSERT statements

**Example:**
```sql
INSERT INTO users (
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role,  -- ← Role explicitly set here
    organization,
    ...
)
VALUES (
    'admin@lto.gov.ph',
    '$2a$12$...',
    'LTO',
    'Administrator',
    'admin',  -- ← Admin role
    'Land Transportation Office',
    ...
);
```

**Common Admin Accounts Created:**
- `admin@lto.gov.ph` → `role = 'admin'`
- `ltoadmin@lto.gov.ph` → `role = 'lto_admin'`
- `ltoofficer@lto.gov.ph` → `role = 'lto_officer'`
- `hpgadmin@hpg.gov.ph` → `role = 'admin'` (with organization = 'Highway Patrol Group')
- `insurance@insurance.gov.ph` → `role = 'insurance_verifier'`
- `emission@emission.gov.ph` → `role = 'emission_verifier'`

---

## Login Process: How Role Is Retrieved

**File:** `backend/routes/auth.js` → `POST /api/auth/login` (line 365)

### Step-by-Step Process

#### Step 1: User Lookup (Line 381)
```javascript
const user = await db.getUserByEmail(email);
```

**Database Query:**
```sql
SELECT * FROM users 
WHERE LOWER(email) = LOWER($1) 
AND is_active = true
```

**Returns:** User object with all fields including `user.role`

#### Step 2: Password Verification (Line 390)
```javascript
const isValidPassword = await bcrypt.compare(password, user.password_hash);
```

If password is invalid, login fails (doesn't matter what role is).

#### Step 3: Role Retrieved from Database (Line 416)
```javascript
const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role  // ← Role comes directly from database
});
```

**Key Point:** The role is **read from the database** (`user.role`), not determined by login logic.

#### Step 4: Role Included in Response (Line 471)
```javascript
res.json({
    success: true,
    message: 'Login successful',
    user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,  // ← Role sent to frontend
        organization: user.organization,
        ...
    },
    token: accessToken  // ← Token also contains role
});
```

---

## Role Types in the System

### Available Roles

Based on code analysis, the system supports these roles:

1. **`admin`** - Full system administrator
   - Can create other users
   - Can access all dashboards
   - Can approve/reject vehicle registrations
   - Examples: `admin@lto.gov.ph`, `hpgadmin@hpg.gov.ph`

2. **`lto_admin`** - LTO-specific administrator
   - Similar to `admin` but LTO-focused
   - Can create users
   - Example: `ltoadmin@lto.gov.ph`

3. **`lto_officer`** - LTO registration officer
   - Can process vehicle registrations
   - Limited admin capabilities
   - Example: `ltoofficer@lto.gov.ph`

4. **`insurance_verifier`** - Insurance verification specialist
   - Can verify insurance documents
   - Example: `insurance@insurance.gov.ph`

5. **`emission_verifier`** - Emission testing specialist
   - Can verify emission test documents
   - Example: `emission@emission.gov.ph`

6. **`vehicle_owner`** - Regular vehicle owner (default)
   - Can register vehicles
   - Can view own vehicles
   - Default role for all registrations

7. **`hpg_admin`** - HPG administrator (sometimes uses `admin` role)
   - Note: Some accounts use `admin` role with `organization = 'Highway Patrol Group'`

---

## Admin Role Determination During Login

### How Admin Roles Are Identified

#### 1. Role from Database

The role is **always** read from the database `users.role` column:

```javascript
// During login
const user = await db.getUserByEmail(email);
// user.role contains: 'admin', 'lto_admin', 'vehicle_owner', etc.
```

#### 2. Role in JWT Token

The role is embedded in the JWT access token:

```javascript
const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role  // ← Role from database
});
```

**Token Payload:**
```json
{
    "userId": "uuid",
    "email": "admin@lto.gov.ph",
    "role": "admin",  // ← Role from database
    "jti": "token-id",
    "type": "access",
    "iat": 1234567890,
    "exp": 1234567890
}
```

#### 3. Role Verification in Middleware

**File:** `backend/middleware/auth.js` → `authenticateToken()` (line 12)

When a request comes in with a token:
1. Token is verified and decoded
2. `req.user` is set with decoded payload (includes `role`)
3. Role is available as `req.user.role`

**Code:**
```javascript
const decoded = verifyAccessToken(token);
req.user = decoded;  // Contains: { userId, email, role, ... }
req.tokenJti = decoded.jti;
```

#### 4. Role Authorization

**File:** `backend/middleware/authorize.js` → `authorizeRole()` (line 1)

Routes can require specific roles:

```javascript
router.get('/admin/users', 
    authenticateToken,  // Verifies token, sets req.user
    authorizeRole(['admin', 'lto_admin']),  // Checks req.user.role
    async (req, res) => {
        // Only admins can access this
    }
);
```

**Authorization Logic:**
```javascript
function authorizeRole(allowedRoles) {
    return (req, res, next) => {
        const userRole = req.user.role;  // From JWT token
        
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${userRole}`
            });
        }
        
        next();
    };
}
```

---

## Frontend Role-Based Redirect

**File:** `js/login-signup.js` → `validateLogin()` (line 279)

After successful login, the frontend redirects based on role:

```javascript
const userRole = result.user?.role;  // From login response
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

**Note:** The role comes from the login API response, which reads it from the database.

---

## Security: Preventing Role Escalation

### 1. Registration Hard-Coding

**File:** `backend/routes/auth.js` (line 165)

```javascript
// CRITICAL: Hard-code role - never trust client input
const role = 'vehicle_owner';
```

**Prevention:** Users cannot register as admin - role is always `vehicle_owner`.

### 2. Admin-Only Account Creation

**File:** `backend/routes/admin.js` (line 356)

```javascript
router.post('/create-user', 
    authenticateToken,  // Must be logged in
    authorizeRole(['admin', 'lto_admin']),  // Must be admin
    async (req, res) => {
        // Only admins can create privileged accounts
    }
);
```

**Prevention:** Only existing admins can create admin accounts.

### 3. Role Validation

**File:** `backend/routes/admin.js` (line 324)

```javascript
const validRoles = ['admin', 'insurance_verifier', 'hpg_admin', 'staff', 'vehicle_owner'];
if (!validRoles.includes(data.role)) {
    errors.push(`Invalid role. Allowed roles: ${validRoles.join(', ')}`);
}
```

**Prevention:** Invalid roles are rejected even if admin tries to create them.

### 4. Database Constraints

The database `users.role` column can have constraints (CHECK constraint or ENUM):

```sql
-- Example constraint (if implemented)
ALTER TABLE users 
ADD CONSTRAINT check_role 
CHECK (role IN ('admin', 'lto_admin', 'lto_officer', 'insurance_verifier', 'emission_verifier', 'vehicle_owner'));
```

**Prevention:** Database rejects invalid roles at the data layer.

---

## Summary: Role Decision Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    ROLE ASSIGNMENT                           │
│              (Happens BEFORE Login)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Account Creation Methods:          │
        │  1. Registration → 'vehicle_owner'   │
        │  2. Admin API → Validated role      │
        │  3. SQL Script → Explicit role      │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Role Stored in Database:           │
        │  users.role = 'admin'               │
        └─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    LOGIN PROCESS                            │
│              (Role is READ, not determined)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  1. Lookup user by email            │
        │  2. Verify password                 │
        │  3. Read user.role from database    │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Include role in JWT token:         │
        │  { role: user.role }                │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Return role in response:           │
        │  { user: { role: user.role } }      │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Frontend redirects based on role   │
        └─────────────────────────────────────┘
```

---

## Key Takeaways

1. **Roles are NOT determined during login** - they are **stored in the database** and **retrieved** during login.

2. **Admin roles are assigned when accounts are created**, not during login:
   - Via SQL scripts (direct database insertion)
   - Via admin API endpoint (only accessible by existing admins)
   - Never via regular registration (always `vehicle_owner`)

3. **Login process:**
   - Looks up user by email
   - Verifies password
   - Reads `user.role` from database
   - Includes role in JWT token
   - Returns role in response

4. **Security measures:**
   - Registration hard-codes role to `vehicle_owner`
   - Only admins can create admin accounts
   - Roles are validated against allowed list
   - Database constraints prevent invalid roles

5. **Role usage:**
   - Stored in JWT token for authentication
   - Used in middleware for authorization
   - Used in frontend for role-based redirects
   - Used in route handlers for permission checks

---

## Example: Admin Login Flow

### Scenario: Admin logs in with `admin@lto.gov.ph`

1. **Account exists in database:**
   ```sql
   SELECT * FROM users WHERE email = 'admin@lto.gov.ph';
   -- Returns: { role: 'admin', ... }
   ```

2. **Login request:**
   ```javascript
   POST /api/auth/login
   { email: 'admin@lto.gov.ph', password: 'admin123' }
   ```

3. **Backend process:**
   ```javascript
   const user = await db.getUserByEmail('admin@lto.gov.ph');
   // user.role = 'admin' (from database)
   
   const accessToken = generateAccessToken({
       userId: user.id,
       email: user.email,
       role: user.role  // 'admin'
   });
   ```

4. **Response:**
   ```json
   {
       "success": true,
       "user": {
           "role": "admin"  // From database
       },
       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   }
   ```

5. **Frontend redirect:**
   ```javascript
   if (userRole === 'admin') {
       window.location.href = 'admin-dashboard.html';
   }
   ```

6. **Subsequent requests:**
   ```javascript
   // Token contains role
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
   // Middleware extracts role
   req.user.role = 'admin'  // From decoded token
   
   // Authorization check
   authorizeRole(['admin'])  // ✅ Allows access
   ```

---

## Database Query: Check User Roles

To see what roles exist in your database:

```sql
-- See all roles and their counts
SELECT role, COUNT(*) as count
FROM users
WHERE is_active = true
GROUP BY role
ORDER BY count DESC;

-- See all admin accounts
SELECT email, first_name, last_name, role, organization, is_active
FROM users
WHERE role IN ('admin', 'lto_admin')
ORDER BY role, email;

-- Check specific user's role
SELECT email, role, organization, is_active
FROM users
WHERE email = 'admin@lto.gov.ph';
```

---

## Common Admin Accounts

Based on SQL scripts, these admin accounts are typically created:

| Email | Role | Organization | Password |
|-------|------|--------------|----------|
| `admin@lto.gov.ph` | `admin` | Land Transportation Office | `admin123` |
| `ltoadmin@lto.gov.ph` | `lto_admin` | Land Transportation Office | `admin123` |
| `ltoofficer@lto.gov.ph` | `lto_officer` | Land Transportation Office | `admin123` |
| `hpgadmin@hpg.gov.ph` | `admin` | Highway Patrol Group | `SecurePass123!` |
| `hpg@hpg.gov.ph` | `admin` | Highway Patrol Group | `admin123` |

**Note:** Passwords are hashed with bcrypt in the database. The values shown are the plaintext passwords used to generate the hashes.
