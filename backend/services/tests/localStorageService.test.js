const fs = require('fs');
const path = require('path');

// We need to access the class directly, not the singleton
// Import the module to get access to the class constructor
const LocalStorageServiceModule = require('../localStorageService');

describe('LocalStorageService', () => {
    const testMetadataPath = path.join(process.cwd(), 'uploads', 'test-metadata');
    
    // Create a fresh instance for testing
    const createTestService = () => {
        // Create a new instance by calling the constructor
        const service = Object.create(Object.getPrototypeOf(LocalStorageServiceModule));
        service.uploadsPath = path.join(process.cwd(), 'uploads');
        service.documentsPath = path.join(service.uploadsPath, 'documents');
        service.metadataPath = testMetadataPath;
        service.encryptionKey = 'test-encryption-key-32-chars-xx';
        return service;
    };

    beforeEach(() => {
        // Clean up test directory before each test
        if (fs.existsSync(testMetadataPath)) {
            fs.rmSync(testMetadataPath, { recursive: true });
        }
    });

    afterAll(() => {
        // Cleanup after all tests
        if (fs.existsSync(testMetadataPath)) {
            fs.rmSync(testMetadataPath, { recursive: true });
        }
    });

    describe('saveMetadata', () => {
        test('creates directory if missing', async () => {
            const service = createTestService();
            
            // Ensure the directory doesn't exist
            expect(fs.existsSync(testMetadataPath)).toBe(false);
            
            const metadata = { id: 'test-doc-1', name: 'test' };
            await service.saveMetadata(metadata);
            
            // Directory should now exist
            expect(fs.existsSync(testMetadataPath)).toBe(true);
            // File should be created
            expect(fs.existsSync(path.join(testMetadataPath, 'test-doc-1.json'))).toBe(true);
            
            // Verify content
            const savedContent = JSON.parse(
                fs.readFileSync(path.join(testMetadataPath, 'test-doc-1.json'), 'utf8')
            );
            expect(savedContent).toEqual(metadata);
        });

        test('works when directory already exists', async () => {
            const service = createTestService();
            
            // Create the directory first
            fs.mkdirSync(testMetadataPath, { recursive: true });
            
            const metadata = { id: 'test-doc-2', name: 'test2' };
            await service.saveMetadata(metadata);
            
            expect(fs.existsSync(path.join(testMetadataPath, 'test-doc-2.json'))).toBe(true);
        });
    });

    describe('getDocumentsByVehicle', () => {
        test('returns empty array when metadata path missing', async () => {
            const service = createTestService();
            service.metadataPath = '/nonexistent/path/that/does/not/exist';
            
            const result = await service.getDocumentsByVehicle('VIN123');
            
            expect(result.success).toBe(true);
            expect(result.documents).toEqual([]);
            expect(result.count).toBe(0);
        });

        test('returns matching documents when directory exists', async () => {
            const service = createTestService();
            
            // Create directory and add test data
            fs.mkdirSync(testMetadataPath, { recursive: true });
            
            const doc1 = { id: 'doc1', vehicleVin: 'VIN123', name: 'Doc 1' };
            const doc2 = { id: 'doc2', vehicleVin: 'VIN456', name: 'Doc 2' };
            const doc3 = { id: 'doc3', vehicleVin: 'VIN123', name: 'Doc 3' };
            
            fs.writeFileSync(path.join(testMetadataPath, 'doc1.json'), JSON.stringify(doc1));
            fs.writeFileSync(path.join(testMetadataPath, 'doc2.json'), JSON.stringify(doc2));
            fs.writeFileSync(path.join(testMetadataPath, 'doc3.json'), JSON.stringify(doc3));
            
            const result = await service.getDocumentsByVehicle('VIN123');
            
            expect(result.success).toBe(true);
            expect(result.count).toBe(2);
            expect(result.documents).toHaveLength(2);
            expect(result.documents.map(d => d.id).sort()).toEqual(['doc1', 'doc3']);
        });
    });

    describe('getDocumentsByOwner', () => {
        test('returns empty array when metadata path missing', async () => {
            const service = createTestService();
            service.metadataPath = '/nonexistent/path/that/does/not/exist';
            
            const result = await service.getDocumentsByOwner('test@example.com');
            
            expect(result.success).toBe(true);
            expect(result.documents).toEqual([]);
            expect(result.count).toBe(0);
        });
    });

    describe('getStorageStats', () => {
        test('returns empty stats when metadata path missing', async () => {
            const service = createTestService();
            service.metadataPath = '/nonexistent/path/that/does/not/exist';
            
            const result = await service.getStorageStats();
            
            expect(result.success).toBe(true);
            expect(result.stats.totalDocuments).toBe(0);
            expect(result.stats.totalSize).toBe(0);
        });
    });

    describe('cleanupOldFiles', () => {
        test('returns cleanedCount 0 when metadata path missing', async () => {
            const service = createTestService();
            service.metadataPath = '/nonexistent/path/that/does/not/exist';
            
            const result = await service.cleanupOldFiles(30);
            
            expect(result.success).toBe(true);
            expect(result.cleanedCount).toBe(0);
        });
    });
});

