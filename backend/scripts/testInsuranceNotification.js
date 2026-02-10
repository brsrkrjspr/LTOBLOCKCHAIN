// Set dummy env vars to bypass initial checks
process.env.GMAIL_CLIENT_ID = 'mock_id';
process.env.GMAIL_CLIENT_SECRET = 'mock_secret';
process.env.GMAIL_REFRESH_TOKEN = 'mock_token';
process.env.GMAIL_USER = 'mock@example.com';

const gmailApi = require('../services/gmailApiService');

// Save original for cleanup
const originalSendMail = gmailApi.sendMail;

// Mock sendMail to avoid actually sending emails during test
gmailApi.sendMail = async (params) => {
    console.log(`   [MOCK EMAIL] To: ${params.to} | Sub: ${params.subject.substring(0, 30)}...`);
    return { id: 'mock_tx_id_' + Date.now(), threadId: 'mock_thread_' + Date.now() };
};

const service = require('../services/insuranceNotificationService');

async function runTest() {
    console.log('🚀 Starting Insurance Notification Service Test...\n');

    try {
        console.log('1. Testing Registration (Multiple reasons)...');
        await service.sendInsuranceIssueEmail({
            to: 'owner@example.com',
            recipientName: 'Juan Dela Cruz',
            vehicleLabel: 'ABC-1234',
            reasons: ['Policy expired', 'Invalid document format'],
            applicationType: 'registration'
        });
        console.log('✅ Registration test passed\n');

        console.log('2. Testing Transfer (Single reason)...');
        await service.sendInsuranceIssueEmail({
            to: 'buyer@example.com',
            recipientName: 'Maria Clara',
            vehicleLabel: 'XYZ-9876',
            reasons: 'Document already used (hash collision)',
            applicationType: 'transfer'
        });
        console.log('✅ Transfer test passed\n');

        console.log('🎉 All notification service tests completed successfully (MOCK).');
    } catch (error) {
        console.error('❌ Test failed with error:');
        console.error(error);
        process.exit(1);
    } finally {
        gmailApi.sendMail = originalSendMail;
    }
}

runTest().catch(err => {
    console.error('FATAL ERROR:', err);
    process.exit(1);
});
