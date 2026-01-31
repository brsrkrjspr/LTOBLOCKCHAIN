const assert = require('assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('FabricSyncService', function () {
    let fabricSyncService;
    let dbMock;
    let integrityServiceMock;
    let gmailApiServiceMock;

    beforeEach(function () {
        // Mock dependencies
        dbMock = {
            query: sinon.stub()
        };

        integrityServiceMock = {
            checkIntegrityByVin: sinon.stub()
        };

        gmailApiServiceMock = {
            sendMail: sinon.stub().resolves({ id: 'mock-email-id' })
        };

        // Load service with mocks
        fabricSyncService = proxyquire('../fabricSyncService', {
            '../database/db.js': dbMock,
            './integrityService': integrityServiceMock,
            './gmailApiService': gmailApiServiceMock
        });
    });

    afterEach(function () {
        sinon.restore();
    });

    describe('runFullSync()', function () {
        it('should correctly identify matched vehicles', async function () {
            // Setup DB response
            const mockVehicles = [
                { vin: 'VIN1', plate_number: 'ABC-123' },
                { vin: 'VIN2', plate_number: 'XYZ-789' }
            ];
            dbMock.query.resolves({ rows: mockVehicles });

            // Setup Integrity checks - ALL VERIFIED
            integrityServiceMock.checkIntegrityByVin.callsFake(async (vin) => {
                return { status: 'VERIFIED', vin, message: 'OK' };
            });

            const result = await fabricSyncService.runFullSync();

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.totalChecked, 2);
            assert.strictEqual(result.matched, 2);
            assert.strictEqual(result.mismatched, 0);
            assert.strictEqual(result.hasDiscrepancies, false);
            assert.strictEqual(gmailApiServiceMock.sendMail.called, false, 'Should not send email if no discrepancies');
        });

        it('should identify inconsistencies and send alert email', async function () {
            // Setup DB response
            const mockVehicles = [
                { vin: 'VIN_OK', plate_number: 'OK-1' },
                { vin: 'VIN_TAMPERED', plate_number: 'BAD-1' },
                { vin: 'VIN_MISSING', plate_number: 'MISSING-1' }
            ];
            dbMock.query.resolves({ rows: mockVehicles });

            // Setup Integrity checks
            integrityServiceMock.checkIntegrityByVin.withArgs('VIN_OK').resolves({
                status: 'VERIFIED', vin: 'VIN_OK', message: 'OK'
            });
            integrityServiceMock.checkIntegrityByVin.withArgs('VIN_TAMPERED').resolves({
                status: 'TAMPERED', vin: 'VIN_TAMPERED', message: 'Engine mismatch',
                comparisons: [{ field: 'engine', matches: false }],
                dbVehicle: {}, blockchainVehicle: {}
            });
            integrityServiceMock.checkIntegrityByVin.withArgs('VIN_MISSING').resolves({
                status: 'NOT_REGISTERED', vin: 'VIN_MISSING', message: 'Not on chain',
                dbVehicle: {}
            });

            const result = await fabricSyncService.runFullSync();

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.totalChecked, 3);
            assert.strictEqual(result.matched, 1);
            assert.strictEqual(result.mismatched, 1); // TAMPERED
            assert.strictEqual(result.notOnBlockchain, 1); // NOT_REGISTERED
            assert.strictEqual(result.hasDiscrepancies, true);

            // Verify alert email
            assert.strictEqual(gmailApiServiceMock.sendMail.calledOnce, true, 'Should send alert email');
            const emailArgs = gmailApiServiceMock.sendMail.firstCall.args[0];
            assert.ok(emailArgs.subject.includes('Data Discrepancy Alert'));
            assert.ok(emailArgs.html.includes('VIN_TAMPERED'));
            assert.ok(emailArgs.html.includes('VIN_MISSING'));
        });

        it('should handle errors gracefully during sync', async function () {
            dbMock.query.resolves({ rows: [{ vin: 'VIN_ERROR' }] });
            integrityServiceMock.checkIntegrityByVin.rejects(new Error('Connection failed'));

            const result = await fabricSyncService.runFullSync();

            assert.strictEqual(result.success, true, 'Overall sync process should complete even if individual checks fail');
            assert.strictEqual(result.errors, 1);
            assert.strictEqual(gmailApiServiceMock.sendMail.called, false);
        });

        it('should prevent concurrent syncs', async function () {
            fabricSyncService.isSyncing = true;
            const result = await fabricSyncService.runFullSync();
            assert.strictEqual(result.success, false);
            assert.strictEqual(result.error, 'Sync already in progress');
        });
    });
});
