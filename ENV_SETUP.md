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

# Email Verification Configuration
VERIFICATION_EMAIL_EXPIRY=24h
VERIFICATION_LINK_EXPIRY_HOURS=24
ALLOW_UNVERIFIED_LOGIN=false
ENABLE_SCHEDULED_TASKS=false
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

## Email Verification System

The application includes a magic link email verification system to prevent disposable email abuse and ensure communication reliability.

### How It Works

1. **User Registration:**
   - User creates account via signup
   - Verification email sent with 24-hour magic link
   - Account created with `email_verified = false`

2. **Email Verification:**
   - User clicks link in email
   - Redirected to email-verification.html
   - Token validated (one-time use)
   - Email marked verified in database

3. **Login Behavior:**
   - Unverified users can login (logged with warning)
   - Optional enforcement: Set `ALLOW_UNVERIFIED_LOGIN=false` to block unverified logins
   - Frontend can show banner prompting verification

### Configuration

```env
# Email Verification Settings
VERIFICATION_EMAIL_EXPIRY=24h              # Token expiry time
VERIFICATION_LINK_EXPIRY_HOURS=24         # Same as above (in hours)
ALLOW_UNVERIFIED_LOGIN=false              # Set to true to block unverified users
ENABLE_SCHEDULED_TASKS=false              # Enable auto-cleanup of expired tokens
```

### Gmail API Configuration (Required for emails)

```env
GMAIL_USER=your-email@gmail.com
GMAIL_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-oauth-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
FRONTEND_URL=http://localhost:3001        # Used for verification links
```

### Database Migration Required

Before using email verification, run the migration:

```bash
# Run all migrations (includes email verification schema)
npm run migrate
# Or manually execute: backend/migrations/add_email_verification.sql
```

### Testing Email Verification

1. **Development (without real Gmail):**
   - Set `ALLOW_UNVERIFIED_LOGIN=true` in `.env`
   - Verification emails will fail but registration still works
   - Users can login without email verification

2. **Testing with real emails:**
   - Configure Gmail API (see above)
   - Register new user
   - Check email inbox for verification link
   - Click link to verify

3. **Resend verification link:**
   - User can request new link via `/api/auth/resend-verification-email`
   - Rate limited: 1 per 5 minutes per user

### Cleanup & Maintenance

Expired verification tokens are automatically cleaned up:
- **Hourly check** at 9:00 AM if `ENABLE_SCHEDULED_TASKS=true`
- **Manual cleanup**: Call `cleanup_expired_verification_tokens()` function
- **Tokens expire** after 24 hours (configurable)

## Production Deployment

For production deployment with real Hyperledger Fabric:
1. Set `BLOCKCHAIN_MODE=fabric` in `.env`
2. Configure Hyperledger Fabric network
3. Set up IPFS cluster (optional)
4. Configure production email/SMS services
5. Set `ENABLE_SCHEDULED_TASKS=true` for automatic token cleanup
6. Set `ALLOW_UNVERIFIED_LOGIN=false` to enforce email verification

## Troubleshooting

**Port already in use:**
- Change `PORT` in `.env` to a different port (e.g., 3002)

**File upload issues:**
- Ensure `uploads/` directory has write permissions
- Check `MAX_FILE_SIZE` in `.env`

**Authentication errors:**
- Ensure `JWT_SECRET` is set in `.env`

**Email verification not working:**
- Check Gmail API credentials (see above)
- Ensure `FRONTEND_URL` is set correctly in `.env`
- Check server logs for email sending errors
- Verify database has `email_verification_tokens` table (run migration)

## Support

For issues or questions, refer to the project documentation or contact the development team.

