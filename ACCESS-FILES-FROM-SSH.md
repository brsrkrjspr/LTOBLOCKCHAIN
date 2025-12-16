# 📁 Accessing Files on DigitalOcean Droplet

## Methods to Access Files Without Terminal

### **Option 1: VS Code Remote SSH (RECOMMENDED - Easiest)**

This lets you edit files directly in VS Code as if they were local!

#### Setup:
1. **Install VS Code Remote SSH Extension:**
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X)
   - Search: "Remote - SSH"
   - Install it

2. **Connect to Droplet:**
   - Press `F1` or `Ctrl+Shift+P`
   - Type: "Remote-SSH: Connect to Host"
   - Enter: `root@139.59.117.203` (your droplet IP)
   - Or add to SSH config:
     ```
     Host lto-droplet
         HostName 139.59.117.203
         User root
         IdentityFile ~/.ssh/your_key
     ```

3. **Open Folder:**
   - After connecting, click "Open Folder"
   - Navigate to: `/root/LTOBLOCKCHAIN`
   - Now you can edit files directly!

**Benefits:**
- ✅ Edit files like local files
- ✅ See file tree
- ✅ Syntax highlighting
- ✅ Integrated terminal
- ✅ Git integration

---

### **Option 2: SFTP/SCP (Download Files)**

#### Using WinSCP (Windows):
1. Download WinSCP: https://winscp.net/
2. Connect:
   - Host: `139.59.117.203`
   - Username: `root`
   - Password: (your SSH password) or use SSH key
3. Navigate to `/root/LTOBLOCKCHAIN`
4. Download files to edit locally
5. Upload back after editing

#### Using SCP (Command Line):
```bash
# Download .env file
scp root@139.59.117.203:/root/LTOBLOCKCHAIN/.env ./

# Upload edited file
scp ./docker-compose.unified.yml root@139.59.117.203:/root/LTOBLOCKCHAIN/
```

---

### **Option 3: Nano/Vim in Terminal (Quick Edits)**

For quick edits, you can use terminal editors:

```bash
# Edit .env file
nano .env

# Or use vim
vim .env
```

**Nano shortcuts:**
- `Ctrl+X` to exit
- `Ctrl+O` to save
- `Ctrl+W` to search

---

## 🔍 Password Verification

### **Which Passwords Are Used:**

1. **PostgreSQL Container:**
   - Uses: `POSTGRES_PASSWORD` from `.env` file
   - Or default: `lto_password` if not in .env
   - Location: `docker-compose.unified.yml` line 187

2. **Application Container:**
   - Uses: `DB_PASSWORD` environment variable
   - Should match: `POSTGRES_PASSWORD` from .env
   - Location: `docker-compose.unified.yml` line 294

### **How to Verify:**

Run the verification script:
```bash
cd ~/LTOBLOCKCHAIN
chmod +x scripts/verify-passwords.sh
bash scripts/verify-passwords.sh
```

This will show:
- ✅ What password PostgreSQL is using
- ✅ What password the application is using
- ✅ Whether they match
- ✅ Connection test result

---

## 📋 Quick Reference

### **Password Flow:**
```
.env file
  ↓
POSTGRES_PASSWORD=lyd2PrWIgsN6/RaFWLCfR0+H
  ↓
docker-compose.unified.yml reads it
  ↓
PostgreSQL container: POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-lto_password}
Application container: DB_PASSWORD=${POSTGRES_PASSWORD:-lto_password}
  ↓
Both should use: lyd2PrWIgsN6/RaFWLCfR0+H
```

### **To Fix Password Mismatch:**

1. **Check .env file:**
   ```bash
   cat .env | grep POSTGRES_PASSWORD
   ```

2. **Verify containers are using it:**
   ```bash
   docker exec postgres env | grep POSTGRES_PASSWORD
   docker exec lto-app env | grep DB_PASSWORD
   ```

3. **If they don't match, restart containers:**
   ```bash
   docker compose -f docker-compose.unified.yml restart
   ```

---

## 🎯 Recommended Approach

**For file editing:** Use VS Code Remote SSH (Option 1)
- Easiest and most convenient
- Edit files directly
- No download/upload needed

**For quick checks:** Use terminal commands
- Fast verification
- Quick edits with nano

**For bulk file transfer:** Use SFTP/SCP (Option 2)
- Good for downloading entire directories
- Useful for backups

---

## 📝 Example: Checking .env File

```bash
# View .env file
cat .env

# Edit .env file
nano .env

# Check specific variable
grep POSTGRES_PASSWORD .env
```

---

## 🔧 Troubleshooting

### **If VS Code Remote SSH doesn't work:**
- Check SSH key permissions: `chmod 600 ~/.ssh/your_key`
- Verify SSH connection works: `ssh root@139.59.117.203`
- Check firewall allows SSH (port 22)

### **If files don't sync:**
- Make sure you're editing in the right location: `/root/LTOBLOCKCHAIN`
- Restart containers after editing: `docker compose restart`

---

**Best Practice:** Use VS Code Remote SSH for regular editing, terminal for quick checks.

