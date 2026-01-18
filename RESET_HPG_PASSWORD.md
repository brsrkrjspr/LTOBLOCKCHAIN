# Reset HPG Admin Password

## Option 1: Run Script via Docker (Recommended)

If your database is running in Docker, you can run the script inside a container that has access to the database:

```bash
# Run the script inside the backend container (or any container with Node.js and database access)
docker exec -it <backend-container-name> node scripts/reset-hpg-password.js SecurePass123!
```

Or if you need to run it from your local machine with Docker access:

```bash
# First, copy the script to the container (if needed)
docker cp scripts/reset-hpg-password.js lto-app:/app/scripts/

# Then run it
docker exec -it <backend-container-name> node /app/scripts/reset-hpg-password.js SecurePass123!
```

## Option 2: Direct SQL Commands (Via SSH)

If you prefer to run SQL directly via SSH, use these commands:

### Step 1: Generate Password Hash

First, generate the password hash using Node.js:

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('SecurePass123!', 12).then(hash => console.log(hash));"
```

This will output a hash like: `$2a$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 2: Add hpg_admin Role to Enum (if not exists)

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hpg_admin';"
```

### Step 3: Update Password and Role

Replace `<PASSWORD_HASH>` with the hash from Step 1:

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "UPDATE users SET password_hash = '<PASSWORD_HASH>', role = 'hpg_admin', updated_at = CURRENT_TIMESTAMP WHERE email = 'hpgadmin@hpg.gov.ph'; SELECT email, first_name, last_name, role, organization, is_active FROM users WHERE email = 'hpgadmin@hpg.gov.ph';"
```

### Step 4: Verify Update

```bash
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT email, role, organization, is_active, updated_at FROM users WHERE email = 'hpgadmin@hpg.gov.ph';"
```

## Option 3: All-in-One SQL Script

Create a file `reset-hpg-password.sql` with:

```sql
-- Step 1: Add hpg_admin role to enum (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'hpg_admin' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
    ) THEN
        ALTER TYPE user_role ADD VALUE 'hpg_admin';
    END IF;
END $$;

-- Step 2: Generate password hash (you need to replace this with actual hash)
-- Use: node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('SecurePass123!', 12).then(hash => console.log(hash));"
-- Then replace <PASSWORD_HASH> below with the output

UPDATE users 
SET password_hash = '<PASSWORD_HASH>',
    role = 'hpg_admin',
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'hpgadmin@hpg.gov.ph';

-- Step 3: Verify
SELECT email, first_name, last_name, role, organization, is_active, updated_at 
FROM users 
WHERE email = 'hpgadmin@hpg.gov.ph';
```

Then run:

```bash
# Generate hash first
PASSWORD_HASH=$(node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('SecurePass123!', 12).then(hash => console.log(hash));")

# Replace <PASSWORD_HASH> in the SQL file with the actual hash, then:
docker exec -i postgres psql -U lto_user -d lto_blockchain < reset-hpg-password.sql
```

## Quick One-Liner (If you have Node.js on server)

```bash
# Generate hash and update in one command
HASH=$(node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('SecurePass123!', 12).then(hash => console.log(hash));") && \
docker exec postgres psql -U lto_user -d lto_blockchain -c "ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hpg_admin';" && \
docker exec postgres psql -U lto_user -d lto_blockchain -c "UPDATE users SET password_hash = '$HASH', role = 'hpg_admin', updated_at = CURRENT_TIMESTAMP WHERE email = 'hpgadmin@hpg.gov.ph'; SELECT email, role, organization FROM users WHERE email = 'hpgadmin@hpg.gov.ph';"
```

## After Reset

Login credentials:
- **Email:** `hpgadmin@hpg.gov.ph`
- **Password:** `SecurePass123!` (or whatever password you used)

## Troubleshooting

If you get "invalid credentials" after reset:
1. Verify the password hash was updated: `docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT email, LEFT(password_hash, 20) as hash_preview FROM users WHERE email = 'hpgadmin@hpg.gov.ph';"`
2. Check if role was updated: `docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT email, role FROM users WHERE email = 'hpgadmin@hpg.gov.ph';"`
3. Ensure user is active: `docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT email, is_active FROM users WHERE email = 'hpgadmin@hpg.gov.ph';"`
4. Check backend logs for authentication errors
