# 🔍 How to Find CouchDB Password in .env

## Quick Answer

The CouchDB password is set in your `.env` file with the variable name:
```
COUCHDB_PASSWORD=your_password_here
```

**If it's NOT in your `.env` file, the default is:** `adminpw`

---

## How to Check

### Method 1: View .env File (Linux/Mac)

```bash
# View entire .env file
cat .env

# Search for CouchDB password specifically
grep -i "COUCHDB" .env

# Or just the password line
grep "COUCHDB_PASSWORD" .env
```

### Method 2: View .env File (Windows PowerShell)

```powershell
# View entire .env file
Get-Content .env

# Search for CouchDB password
Select-String -Path .env -Pattern "COUCHDB"
```

### Method 3: Check Docker Compose Default

If `COUCHDB_PASSWORD` is **not** in your `.env` file, Docker Compose uses the default:

```yaml
# From docker-compose.unified.yml
COUCHDB_PASSWORD=${COUCHDB_PASSWORD:-adminpw}
```

This means: **Use `COUCHDB_PASSWORD` from .env, or default to `adminpw`**

---

## Default Credentials

If you haven't changed it, the defaults are:

- **Username:** `admin`
- **Password:** `adminpw`

---

## How to Set/Change It

### Option 1: Add to .env File

```bash
# Add this line to your .env file
COUCHDB_PASSWORD=your_secure_password_here
```

### Option 2: Use Default (Not Recommended for Production)

If you don't add `COUCHDB_PASSWORD` to `.env`, it will use `adminpw` automatically.

---

## Verify Current Password

### Check What Docker Container Is Using

```bash
# Check CouchDB container environment
docker exec couchdb env | grep COUCHDB

# Or check docker-compose config
docker-compose -f docker-compose.unified.yml config | grep -A 5 "couchdb:"
```

---

## Access CouchDB Web UI

Once you know the password:

1. **Open:** `http://localhost:5984/_utils`
2. **Login with:**
   - Username: `admin`
   - Password: `adminpw` (or whatever is in your `.env`)

---

## Security Note

⚠️ **For Production:**
- Change `COUCHDB_PASSWORD` to a strong password
- Add it to `.env` file
- Never commit `.env` to git
- Use a password manager

---

## Quick Check Script

Run this to see your current CouchDB password:

```bash
# Linux/Mac
if grep -q "COUCHDB_PASSWORD" .env; then
    echo "CouchDB Password (from .env):"
    grep "COUCHDB_PASSWORD" .env
else
    echo "CouchDB Password: adminpw (default - not set in .env)"
fi
```

```powershell
# Windows PowerShell
if (Select-String -Path .env -Pattern "COUCHDB_PASSWORD") {
    Write-Host "CouchDB Password (from .env):"
    Select-String -Path .env -Pattern "COUCHDB_PASSWORD"
} else {
    Write-Host "CouchDB Password: adminpw (default - not set in .env)"
}
```

---

## Summary

✅ **Check `.env` file for:** `COUCHDB_PASSWORD`  
✅ **If not found:** Default is `adminpw`  
✅ **Username is always:** `admin`  
✅ **Access UI at:** `http://localhost:5984/_utils`
