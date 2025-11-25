# 📍 PostgreSQL Database Location

## **Where is the Database Located?**

### **Physical Location:**

The PostgreSQL database is stored in a **Docker volume** on your computer.

**Location on Windows:**
```
C:\Users\Jasper\AppData\Local\Docker\wsl\data\ext4.vhdx
```

Or more specifically, the volume is managed by Docker at:
```
\\wsl$\docker-desktop-data\data\docker\volumes\ltoblockchain_postgres-data\_data
```

### **How to Access:**

#### **1. Via Docker Container (Recommended):**
```powershell
# Connect to database
docker exec -it postgres psql -U lto_user -d lto_blockchain

# Run SQL commands
SELECT * FROM users;
\q  # to exit
```

#### **2. Via Docker Volume:**
The data is stored in Docker volume: `ltoblockchain_postgres-data`

**View volume location:**
```powershell
docker volume inspect ltoblockchain_postgres-data
```

#### **3. Via Application:**
Your application connects to:
- **Host:** `localhost`
- **Port:** `5432`
- **Database:** `lto_blockchain`
- **User:** `lto_user`
- **Password:** `lto_password`

---

## **Database Structure:**

### **Connection Details:**
- **Container Name:** `postgres`
- **Image:** `postgres:15-alpine`
- **Port:** `5432` (mapped to host)
- **Volume:** `ltoblockchain_postgres-data`

### **Data Persistence:**
✅ **Data persists** even if you:
- Stop the container
- Restart your computer
- Update Docker

❌ **Data is deleted** only if you:
- Remove the Docker volume: `docker volume rm ltoblockchain_postgres-data`
- Delete the container with `-v` flag

---

## **Important Notes:**

1. **Docker Volume = Persistent Storage**
   - Data is stored in Docker's volume system
   - Survives container restarts
   - Located in Docker's internal storage

2. **Not in Project Folder**
   - Database files are NOT in your project directory
   - They're managed by Docker
   - This is normal and correct!

3. **Backup Location:**
   - To backup: `docker exec postgres pg_dump -U lto_user lto_blockchain > backup.sql`
   - Backup file will be in your current directory

4. **Access Methods:**
   - ✅ Command-line (psql) - Already available
   - ✅ Your application - Via connection string
   - ✅ GUI tools (pgAdmin, DBeaver) - Optional

---

## **Quick Commands:**

```powershell
# Check if database is running
docker ps | Select-String "postgres"

# View database tables
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt"

# View all data in users table
docker exec postgres psql -U lto_user -d lto_blockchain -c "SELECT * FROM users;"

# Backup database
docker exec postgres pg_dump -U lto_user lto_blockchain > backup.sql

# View volume location
docker volume inspect ltoblockchain_postgres-data
```

---

**Summary:** The database is stored in a Docker volume, which is managed by Docker Desktop. You don't need to access the files directly - use Docker commands or your application to interact with the database.

