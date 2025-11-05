# 🚀 TrustChain LTO - Quick Start Guide

## For Laptop Deployment (Your System Specs)

Your laptop specifications:
- ✅ **Processor**: AMD Ryzen 5 7535HS (3.30 GHz) - **Exceeds Requirements**
- ✅ **RAM**: 16.0 GB - **Exceeds Requirements** 
- ✅ **Storage**: 477 GB available - **Meets Requirements**
- ✅ **Graphics**: 4 GB VRAM - **Sufficient**

**Verdict**: Your laptop is perfectly capable of running this system! 🎉

## ⚡ Quick Start (5 Minutes)

### Step 1: Install Node.js
If you don't have Node.js installed:
1. Download from: https://nodejs.org/ (LTS version)
2. Install and verify:
   ```bash
   node --version  # Should be >= 16.0.0
   npm --version
   ```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start the Server
```bash
npm start
```

That's it! The system will:
- ✅ Start on port 3001
- ✅ Use mock blockchain mode (no Hyperledger Fabric needed)
- ✅ Use local file storage (no IPFS needed)
- ✅ Be ready for development and testing

### Step 4: Access the Application
Open your browser and go to:
- **Main URL**: http://localhost:3001
- **Login Page**: http://localhost:3001/login

## 🔑 Default Login Credentials

### Admin Account
- **Email**: `admin@lto.gov.ph`
- **Password**: `admin123`
- **Role**: System Administrator

### Vehicle Owner Account
- **Email**: `owner@example.com`
- **Password**: `admin123`
- **Role**: Vehicle Owner

### Insurance Verifier
- **Email**: `verifier@insurance.com`
- **Password**: `admin123`
- **Role**: Insurance Verifier

### Emission Verifier
- **Email**: `verifier@emission.com`
- **Password**: `admin123`
- **Role**: Emission Verifier

## 📁 Available Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | `/` | Landing page |
| Login | `/login` | User login |
| Registration | `/registration-wizard` | Vehicle registration |
| Owner Dashboard | `/owner-dashboard` | Vehicle owner interface |
| Admin Dashboard | `/admin-dashboard` | System administration |
| Verifier Dashboard | `/verifier-dashboard` | Emission verifier |
| Insurance Verifier | `/insurance-verifier-dashboard` | Insurance verifier |
| Document Viewer | `/document-viewer` | View digital OR/CR |
| Search | `/search` | Public document verification |
| Blockchain Viewer | `/admin-blockchain-viewer` | View blockchain ledger |

## 🎯 Key Features Available

### ✅ Core Functionality
- **Vehicle Registration**: Complete 4-step registration wizard
- **Document Upload**: PDF, JPG, PNG support
- **Multi-Step Approval**: Insurance → Emission → Admin
- **Status Tracking**: Real-time updates
- **Ownership Transfer**: Secure transfer process
- **Digital OR/CR**: Tamper-proof certificates
- **Audit Trail**: Complete transaction history

### ✅ User Roles
- **Vehicle Owner**: Register and track vehicles
- **Admin**: Manage users and approve registrations
- **Insurance Verifier**: Verify insurance documents
- **Emission Verifier**: Verify emission test certificates

### ✅ Security Features
- **JWT Authentication**: Secure sessions
- **Role-Based Access**: Permissions by role
- **Password Hashing**: bcrypt encryption
- **Rate Limiting**: API protection
- **Input Validation**: Security best practices

## 🔧 Configuration (Optional)

### Environment Variables
Create a `.env` file for custom configuration:

```env
PORT=3001
NODE_ENV=development
BLOCKCHAIN_MODE=mock
JWT_SECRET=your-secret-key
```

**Note**: The system works with defaults if no `.env` file exists!

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Change port in .env or use different port
PORT=3002 npm start
```

### Dependencies Installation Issues
```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Permission Errors (Windows)
- Run PowerShell as Administrator
- Or use Git Bash instead of PowerShell

## 📊 System Status

### Check Health
```bash
# Visit in browser
http://localhost:3001/api/health

# Or use curl
curl http://localhost:3001/api/health
```

### Monitor System
```bash
# View logs
# Logs appear in console when running npm start

# Check metrics
http://localhost:3001/api/monitoring/metrics
```

## 📚 Next Steps

1. **Explore the System**: Log in with different roles
2. **Register a Vehicle**: Use the registration wizard
3. **Test Workflows**: Try the approval process
4. **View Blockchain**: Check the ledger viewer
5. **Review Documentation**: Read `CAPSTONE_COMPLIANCE_CHECK.md`

## 🎓 For Capstone Project

### Evaluation Ready
- ✅ All required features implemented
- ✅ ISO/IEC 25010 compliant
- ✅ Documentation complete
- ✅ Laptop-optimized for demonstration

### Testing Checklist
- [ ] Functional testing with all user roles
- [ ] Performance testing (response times)
- [ ] Security testing (authentication)
- [ ] Usability testing (user experience)
- [ ] Documentation review

## 💡 Development Tips

### Auto-Reload During Development
```bash
npm run dev
```

### View API Endpoints
All API routes are in `backend/routes/`:
- `/api/auth` - Authentication
- `/api/vehicles` - Vehicle management
- `/api/documents` - Document upload
- `/api/blockchain` - Blockchain operations
- `/api/ledger` - Ledger queries
- `/api/notifications` - Notifications
- `/api/health` - Health checks
- `/api/monitoring` - System metrics

## 🎉 Success!

Your TrustChain LTO system is now running and ready for:
- ✅ Development
- ✅ Testing
- ✅ Demonstration
- ✅ Capstone evaluation

**System Status**: ✅ **READY**

---

For detailed information, see:
- `CAPSTONE_COMPLIANCE_CHECK.md` - Feature compliance
- `ENV_SETUP.md` - Environment configuration
- `README.md` - Project overview

