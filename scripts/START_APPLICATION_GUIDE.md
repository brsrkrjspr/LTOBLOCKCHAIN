# 🚀 Starting Application Services - Complete Guide

**Question:** Should I start just `lto-app` or all services?

**Answer:** You can start just `lto-app` - Docker Compose will automatically start dependencies!

---

## ✅ **RECOMMENDED: Start Just lto-app**

Docker Compose will automatically start dependencies:

```bash
docker compose -f docker-compose.unified.yml up -d lto-app
```

**What will start automatically:**
- ✅ `postgres` (required dependency - condition: service_healthy)
- ✅ `ipfs` (required dependency - condition: service_started)
- ✅ `lto-app` (the application)

**What won't start automatically:**
- ⚠️ `nginx` (optional - only if you need reverse proxy)

---

## 🎯 **OPTION 1: Start Just Application Stack (Recommended)**

```bash
# Start lto-app and its dependencies (postgres, ipfs)
docker compose -f docker-compose.unified.yml up -d lto-app

# Wait and check logs
sleep 15
docker logs lto-app --tail 30
```

**This will start:**
- ✅ postgres (if not running)
- ✅ ipfs (if not running)
- ✅ lto-app

---

## 🎯 **OPTION 2: Start All Services (Including Nginx)**

If you also need Nginx (reverse proxy/SSL):

```bash
# Start all services including nginx
docker compose -f docker-compose.unified.yml up -d

# Or start specific services
docker compose -f docker-compose.unified.yml up -d postgres ipfs lto-app nginx
```

---

## 🔍 **Check What's Already Running**

Before starting, check what's running:

```bash
# Check all containers
docker ps

# Check specific services
docker ps | grep -E "postgres|ipfs|nginx|lto-app"
```

---

## 📋 **Dependency Chain**

```
lto-app
  ├── depends_on: postgres (service_healthy)
  └── depends_on: ipfs (service_started)

nginx
  └── depends_on: lto-app (service_started)
```

**So:**
- Starting `lto-app` → auto-starts `postgres` and `ipfs`
- Starting `nginx` → auto-starts `lto-app` (which auto-starts `postgres` and `ipfs`)

---

## ✅ **RECOMMENDED COMMAND**

**For your case (just need the application):**

```bash
docker compose -f docker-compose.unified.yml up -d lto-app && \
sleep 15 && \
docker logs lto-app --tail 30
```

**This is perfect!** Docker Compose will handle dependencies automatically.

---

## 🎯 **VERIFICATION AFTER START**

```bash
# Check all application services are running
docker ps | grep -E "postgres|ipfs|lto-app"

# Check application logs for Fabric connection
docker logs lto-app | grep -i "fabric\|connected\|error"

# Check if application is responding
curl http://localhost:3001/api/health
# Or if behind nginx:
curl http://localhost/api/health
```

---

**Answer:** ✅ **Yes, just start `lto-app`** - Docker Compose handles the rest!
