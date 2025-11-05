# TrustChain LTO System - Environment Setup Guide

## Quick Start for Laptop Deployment

This system is configured to run in **mock blockchain mode** by default, which is perfect for laptop deployment and development. No Hyperledger Fabric setup is required!

## Environment Variables

Create a `.env` file in the root directory with the following configuration:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3001

# Blockchain Configuration
# Set to 'mock' for laptop deployment (default)
BLOCKCHAIN_MODE=mock

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Password Hashing
BCRYPT_ROUNDS=12

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png

# Document Storage
ENCRYPT_FILES=false
ENCRYPTION_KEY=default-encryption-key-32-chars-change-in-production
```

## Minimum System Requirements (Your Laptop Specs)

✅ **Your System:**
- Processor: AMD Ryzen 5 7535HS with Radeon Graphics (3.30 GHz) ✅
- RAM: 16.0 GB (15.2 GB usable) ✅
- Storage: 477 GB (244 GB used) ✅
- Graphics: 4 GB VRAM ✅

**Verdict:** Your laptop exceeds the minimum requirements! The system will run smoothly.

## Installation Steps

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org/
   - Required: Node.js >= 16.0.0

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Create Environment File**
   ```bash
   # Copy the example (or create manually)
   # The system will work with default values if .env is not created
   ```

4. **Start the Server**
   ```bash
   npm start
   # Or for development with auto-reload:
   npm run dev
   ```

5. **Access the Application**
   - Open browser: http://localhost:3001
   - Default login credentials:
     - Admin: admin@lto.gov.ph / admin123
     - Owner: owner@example.com / admin123

## Features Available in Mock Mode

✅ **All core features work:**
- Vehicle registration
- Document upload and verification
- User authentication and authorization
- Multi-step approval workflows
- Real-time status tracking
- Blockchain ledger (simulated)
- Transaction history
- Audit trails

## What's Different in Mock Mode?

- **Blockchain:** Uses a local file-based ledger instead of Hyperledger Fabric
- **Storage:** Documents stored locally instead of IPFS
- **Performance:** Faster startup, lower resource usage
- **Perfect for:** Development, testing, demos, and laptop deployment

## Production Deployment

For production deployment with real Hyperledger Fabric:
1. Set `BLOCKCHAIN_MODE=fabric` in `.env`
2. Configure Hyperledger Fabric network
3. Set up IPFS cluster (optional)
4. Configure production email/SMS services

## Troubleshooting

**Port already in use:**
- Change `PORT` in `.env` to a different port (e.g., 3002)

**File upload issues:**
- Ensure `uploads/` directory has write permissions
- Check `MAX_FILE_SIZE` in `.env`

**Authentication errors:**
- Ensure `JWT_SECRET` is set in `.env`

## Support

For issues or questions, refer to the project documentation or contact the development team.

