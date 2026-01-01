#!/usr/bin/env node
/**
 * TrustChain LTO - Expiry Notification Checker
 * 
 * This script checks for vehicles with expiring registrations and sends notifications.
 * Run manually: node backend/scripts/check-expiry-notifications.js
 * Or set up as a cron job to run daily.
 * 
 * Environment variables required:
 * - DB_HOST (default: localhost)
 * - DB_PORT (default: 5432)
 * - DB_NAME (default: lto_blockchain)
 * - DB_USER (default: lto_user)
 * - DB_PASSWORD or POSTGRES_PASSWORD
 */

// Load environment variables first
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// Map POSTGRES_PASSWORD to DB_PASSWORD if needed
if (process.env.POSTGRES_PASSWORD && !process.env.DB_PASSWORD) {
    process.env.DB_PASSWORD = process.env.POSTGRES_PASSWORD;
}

const expiryService = require('../services/expiryService');

async function main() {
    console.log('🔔 Starting expiry notification check...');
    console.log(`📊 Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'lto_blockchain'}`);
    console.log(`   User: ${process.env.DB_USER}`);
    console.log(`   Time: ${new Date().toISOString()}\n`);
    
    try {
        const results = await expiryService.checkExpiringRegistrations();
        
        console.log('\n📊 Results:');
        console.log(`   ✅ Checked: ${results.checked} vehicles`);
        console.log(`   📧 Notifications sent: ${results.notificationsSent}`);
        
        if (results.errors.length > 0) {
            console.log(`   ⚠️  Errors: ${results.errors.length}`);
            results.errors.forEach((err, index) => {
                console.log(`      ${index + 1}. ${err.vehicleId || 'General'}: ${err.error}`);
            });
        }
        
        console.log('\n✅ Expiry check complete');
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { main };

