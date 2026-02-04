// TrustChain LTO - Unified Document Upload Utility
// Single upload function used across registration, transfer, and admin tools

/**
 * Document type constants (matches backend config)
 * These should be the only document type strings used in the frontend
 */
const DOCUMENT_TYPES = {
    REGISTRATION_CERT: 'registrationCert',
    INSURANCE_CERT: 'insuranceCert',
    OWNER_ID: 'ownerId',
    DEED_OF_SALE: 'deedOfSale',
    SELLER_ID: 'sellerId',
    BUYER_ID: 'buyerId',
    BUYER_TIN: 'buyerTin',
    BUYER_CTPL: 'buyerCtpl',
    BUYER_HPG_CLEARANCE: 'buyerHpgClearance',
    HPG_CLEARANCE: 'hpgClearance', // HPG Clearance certificate
    OTHER: 'other'
};

/**
 * Transfer document roles (for transfer of ownership)
 */
const TRANSFER_ROLES = {
    DEED_OF_SALE: 'deedOfSale',
    SELLER_ID: 'sellerId',
    BUYER_ID: 'buyerId',
    BUYER_TIN: 'buyerTin',
    BUYER_CTPL: 'buyerCtpl',
    BUYER_HPG_CLEARANCE: 'buyerHpgClearance',
    OR_CR: 'orCr'
};

/**
 * File validation configuration
 */
const FILE_CONFIG = {
    MAX_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_TYPES: ['pdf', 'jpg', 'jpeg', 'png'],
    ALLOWED_MIME_TYPES: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
};

/**
 * Validate file before upload
 * @param {File} file - File to validate
 * @returns {{valid: boolean, error?: string}} Validation result
 */
function validateFile(file) {
    if (!file) {
        return { valid: false, error: 'No file selected' };
    }
    
    // Check file size
    if (file.size > FILE_CONFIG.MAX_SIZE) {
        const maxSizeMB = (FILE_CONFIG.MAX_SIZE / (1024 * 1024)).toFixed(0);
        return { 
            valid: false, 
            error: `File size exceeds ${maxSizeMB}MB limit. Please choose a smaller file.` 
        };
    }
    
    // Check file type
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !FILE_CONFIG.ALLOWED_TYPES.includes(fileExt)) {
        return { 
            valid: false, 
            error: `File type .${fileExt} is not allowed. Allowed types: ${FILE_CONFIG.ALLOWED_TYPES.join(', ')}` 
        };
    }
    
    // Check MIME type
    if (!FILE_CONFIG.ALLOWED_MIME_TYPES.includes(file.type)) {
        return { 
            valid: false, 
            error: `File type ${file.type} is not allowed.` 
        };
    }
    
    return { valid: true };
}

/**
 * Upload a document to the server
 * @param {string} docType - Document type (logical type, e.g., 'registrationCert')
 * @param {File} file - File to upload
 * @param {Object} options - Upload options
 * @param {string} options.vehicleId - Optional vehicle ID to link document
 * @param {Function} options.onProgress - Optional progress callback
 * @returns {Promise<{success: boolean, document?: Object, error?: string}>}
 */
async function uploadDocument(docType, file, options = {}) {
    const { vehicleId, onProgress } = options;
    
    // Validate file first (client-side validation)
    const validation = validateFile(file);
    if (!validation.valid) {
        return {
            success: false,
            error: validation.error
        };
    }
    
    // Validate document type
    const validTypes = Object.values(DOCUMENT_TYPES);
    if (!validTypes.includes(docType)) {
        return {
            success: false,
            error: `Invalid document type: ${docType}. Valid types: ${validTypes.join(', ')}`
        };
    }
    
    // Reject 'other' type - it should never be used for uploads
    if (docType === DOCUMENT_TYPES.OTHER) {
        return {
            success: false,
            error: 'Document type "other" is not allowed. Please specify the correct document type.'
        };
    }
    
    // Create form data
    const formData = new FormData();
    formData.append('document', file);
    formData.append('type', docType); // Use 'type' for consistency
    
    if (vehicleId) {
        formData.append('vehicleId', vehicleId);
    }
    
    try {
        // Get API client
        const apiClient = window.apiClient || new APIClient();
        
        // Upload file
        const response = await apiClient.post('/api/documents/upload', formData, {
            headers: {
                // Don't set Content-Type - browser will set it with boundary for FormData
            },
            onUploadProgress: onProgress
        });
        
        if (!response.success) {
            return {
                success: false,
                error: response.error || response.message || 'Upload failed'
            };
        }
        
        return {
            success: true,
            document: response.document || response
        };
        
    } catch (error) {
        console.error('Document upload error:', error);
        
        // Handle specific error cases
        if (error.response) {
            const status = error.response.status;
            const errorData = error.response.data;
            
            if (status === 400) {
                // Bad request - invalid document type or validation error
                return {
                    success: false,
                    error: errorData.message || errorData.error || 'Invalid document type or file'
                };
            } else if (status === 413) {
                // File too large
                return {
                    success: false,
                    error: 'File size exceeds server limit. Please choose a smaller file.'
                };
            } else if (status === 503) {
                // Service unavailable (e.g., IPFS down)
                return {
                    success: false,
                    error: errorData.message || 'Document storage service is temporarily unavailable. Please try again later.'
                };
            }
        }
        
        return {
            success: false,
            error: error.message || 'Failed to upload document. Please try again.'
        };
    }
}

/**
 * Upload multiple documents
 * @param {Array<{docType: string, file: File, vehicleId?: string}>} uploads - Array of uploads
 * @param {Function} onProgress - Optional progress callback (receives {index, total, current})
 * @returns {Promise<Array<{success: boolean, docType: string, document?: Object, error?: string}>>}
 */
async function uploadDocuments(uploads, onProgress) {
    const results = [];
    
    for (let i = 0; i < uploads.length; i++) {
        const { docType, file, vehicleId } = uploads[i];
        
        if (onProgress) {
            onProgress({ index: i, total: uploads.length, current: docType });
        }
        
        const result = await uploadDocument(docType, file, { vehicleId });
        results.push({
            ...result,
            docType
        });
        
        // Small delay between uploads to avoid overwhelming the server
        if (i < uploads.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return results;
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.DocumentUploadUtils = {
        uploadDocument,
        uploadDocuments,
        validateFile,
        DOCUMENT_TYPES,
        TRANSFER_ROLES,
        FILE_CONFIG
    };
}

// Also export for module systems (if used)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        uploadDocument,
        uploadDocuments,
        validateFile,
        DOCUMENT_TYPES,
        TRANSFER_ROLES,
        FILE_CONFIG
    };
}
