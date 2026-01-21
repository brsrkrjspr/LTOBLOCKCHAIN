// TrustChain LTO - Document Type Configuration
// Single source of truth for document types across the system

/**
 * Logical document types (used in frontend and API)
 * These are the canonical names that should be used throughout the application
 */
const LOGICAL_TYPES = {
    REGISTRATION_CERT: 'registrationCert',
    INSURANCE_CERT: 'insuranceCert',
    CTPL: 'ctpl',
    MVIR: 'mvir',
    TIN_ID: 'tinId',
    OWNER_ID: 'ownerId',
    DEED_OF_SALE: 'deedOfSale',
    SELLER_ID: 'sellerId',
    BUYER_ID: 'buyerId',
    CSR: 'csr',
    HPG_CLEARANCE: 'hpgClearance',
    SALES_INVOICE: 'salesInvoice',
    TRANSFER_PACKAGE: 'transferPackage',
    TRANSFER_CERTIFICATE: 'transferCertificate',
    OTHER: 'other'
};

/**
 * Database document_type enum values
 * These match the database schema
 */
const DB_TYPES = {
    REGISTRATION_CERT: 'registration_cert',
    INSURANCE_CERT: 'insurance_cert',
    CTPL: 'ctpl_cert',
    MVIR: 'mvir_cert',
    TIN_ID: 'tin_id',
    OWNER_ID: 'owner_id',
    DEED_OF_SALE: 'deed_of_sale',
    SELLER_ID: 'seller_id',
    BUYER_ID: 'buyer_id',
    CSR: 'csr',
    HPG_CLEARANCE: 'hpg_clearance',
    SALES_INVOICE: 'sales_invoice',
    TRANSFER_PACKAGE: 'transfer_package_pdf',
    TRANSFER_CERTIFICATE: 'transfer_certificate',
    OTHER: 'other'
};

/**
 * Transfer-specific document roles
 * These are used in transfer_documents table to specify the role of a document in a transfer
 */
const TRANSFER_ROLES = {
    DEED_OF_SALE: 'deed_of_sale',
    SELLER_ID: 'seller_id',
    BUYER_ID: 'buyer_id',
    OR_CR: 'or_cr', // Original Registration Certificate / Certificate of Registration
    BUYER_TIN: 'buyer_tin',
    BUYER_CTPL: 'buyer_ctpl',
    BUYER_MVIR: 'buyer_mvir',
    BUYER_HPG_CLEARANCE: 'buyer_hpg_clearance',
    TRANSFER_PACKAGE: 'transfer_package_pdf',
    TRANSFER_CERTIFICATE: 'transfer_certificate'
};

/**
 * Map logical type to database type
 * @param {string} logicalType - Logical document type (e.g., 'registrationCert')
 * @returns {string} Database document type (e.g., 'registration_cert')
 */
function mapToDbType(logicalType) {
    const mapping = {
        [LOGICAL_TYPES.REGISTRATION_CERT]: DB_TYPES.REGISTRATION_CERT,
        [LOGICAL_TYPES.INSURANCE_CERT]: DB_TYPES.INSURANCE_CERT,
        [LOGICAL_TYPES.CTPL]: DB_TYPES.CTPL,
        [LOGICAL_TYPES.MVIR]: DB_TYPES.MVIR,
        [LOGICAL_TYPES.TIN_ID]: DB_TYPES.TIN_ID,
        [LOGICAL_TYPES.OWNER_ID]: DB_TYPES.OWNER_ID,
        [LOGICAL_TYPES.DEED_OF_SALE]: DB_TYPES.DEED_OF_SALE,
        [LOGICAL_TYPES.SELLER_ID]: DB_TYPES.SELLER_ID,
        [LOGICAL_TYPES.BUYER_ID]: DB_TYPES.BUYER_ID,
        [LOGICAL_TYPES.CSR]: DB_TYPES.CSR,
        [LOGICAL_TYPES.HPG_CLEARANCE]: DB_TYPES.HPG_CLEARANCE,
        [LOGICAL_TYPES.SALES_INVOICE]: DB_TYPES.SALES_INVOICE,
        [LOGICAL_TYPES.TRANSFER_PACKAGE]: DB_TYPES.TRANSFER_PACKAGE,
        [LOGICAL_TYPES.TRANSFER_CERTIFICATE]: DB_TYPES.TRANSFER_CERTIFICATE,
        [LOGICAL_TYPES.OTHER]: DB_TYPES.OTHER
    };
    
    return mapping[logicalType] || DB_TYPES.OTHER;
}

/**
 * Map database type to logical type
 * @param {string} dbType - Database document type (e.g., 'registration_cert')
 * @returns {string} Logical document type (e.g., 'registrationCert')
 */
function mapToLogicalType(dbType) {
    const mapping = {
        [DB_TYPES.REGISTRATION_CERT]: LOGICAL_TYPES.REGISTRATION_CERT,
        [DB_TYPES.INSURANCE_CERT]: LOGICAL_TYPES.INSURANCE_CERT,
        [DB_TYPES.CTPL]: LOGICAL_TYPES.CTPL,
        [DB_TYPES.MVIR]: LOGICAL_TYPES.MVIR,
        [DB_TYPES.TIN_ID]: LOGICAL_TYPES.TIN_ID,
        [DB_TYPES.OWNER_ID]: LOGICAL_TYPES.OWNER_ID,
        [DB_TYPES.DEED_OF_SALE]: LOGICAL_TYPES.DEED_OF_SALE,
        [DB_TYPES.SELLER_ID]: LOGICAL_TYPES.SELLER_ID,
        [DB_TYPES.BUYER_ID]: LOGICAL_TYPES.BUYER_ID,
        [DB_TYPES.CSR]: LOGICAL_TYPES.CSR,
        [DB_TYPES.HPG_CLEARANCE]: LOGICAL_TYPES.HPG_CLEARANCE,
        [DB_TYPES.SALES_INVOICE]: LOGICAL_TYPES.SALES_INVOICE,
        [DB_TYPES.TRANSFER_PACKAGE]: LOGICAL_TYPES.TRANSFER_PACKAGE,
        [DB_TYPES.TRANSFER_CERTIFICATE]: LOGICAL_TYPES.TRANSFER_CERTIFICATE,
        [DB_TYPES.OTHER]: LOGICAL_TYPES.OTHER
    };
    
    return mapping[dbType] || LOGICAL_TYPES.OTHER;
}

/**
 * Get all valid logical types
 * @returns {string[]} Array of valid logical document types
 */
function getValidLogicalTypes() {
    return Object.values(LOGICAL_TYPES);
}

/**
 * Get all valid database types
 * @returns {string[]} Array of valid database document types
 */
function getValidDbTypes() {
    return Object.values(DB_TYPES);
}

/**
 * Get all valid transfer roles
 * @returns {string[]} Array of valid transfer document roles
 */
function getValidTransferRoles() {
    return Object.values(TRANSFER_ROLES);
}

/**
 * Validate logical type
 * @param {string} type - Document type to validate
 * @returns {boolean} True if valid
 */
function isValidLogicalType(type) {
    return getValidLogicalTypes().includes(type);
}

/**
 * Validate database type
 * @param {string} type - Database document type to validate
 * @returns {boolean} True if valid
 */
function isValidDbType(type) {
    return getValidDbTypes().includes(type);
}

/**
 * Validate transfer role
 * @param {string} role - Transfer document role to validate
 * @returns {boolean} True if valid
 */
function isValidTransferRole(role) {
    return getValidTransferRoles().includes(role);
}

/**
 * Get required document types for auto-send workflows
 * @returns {Object} Map of organization to required logical types
 */
function getRequiredTypesForAutoSend() {
    return {
        insurance: [LOGICAL_TYPES.INSURANCE_CERT],
        hpg: [LOGICAL_TYPES.OWNER_ID, LOGICAL_TYPES.HPG_CLEARANCE]
    };
}

/**
 * Check if document type is required for auto-send
 * @param {string} logicalType - Logical document type
 * @returns {boolean} True if required for any auto-send workflow
 */
function isRequiredForAutoSend(logicalType) {
    const requiredTypes = getRequiredTypesForAutoSend();
    const allRequired = Object.values(requiredTypes).flat();
    return allRequired.includes(logicalType);
}

/**
 * Validate document type with context awareness
 * @param {string} logicalType - Logical document type
 * @param {Object} options - Validation options
 * @param {boolean} options.allowOther - Allow 'other' type (default: false)
 * @returns {{valid: boolean, error?: string}}
 */
function validateDocumentTypeForUpload(logicalType, options = {}) {
    const { allowOther = false } = options;
    
    // Check if it's a valid logical type
    if (!isValidLogicalType(logicalType)) {
        return {
            valid: false,
            error: `Invalid document type: ${logicalType}. Valid types: ${getValidLogicalTypes().join(', ')}`
        };
    }
    
    // Reject 'other' type unless explicitly allowed
    if (logicalType === LOGICAL_TYPES.OTHER && !allowOther) {
        return {
            valid: false,
            error: 'Document type "other" is not allowed for uploads. Please specify the correct document type.'
        };
    }
    
    // Warn if required type is being set to 'other'
    if (isRequiredForAutoSend(logicalType) && logicalType === LOGICAL_TYPES.OTHER) {
        return {
            valid: false,
            error: 'Document type "other" cannot be used for required documents (insurance, HPG). Please specify the correct document type.'
        };
    }
    
    return { valid: true };
}

/**
 * Map transfer role to database type for transfer_documents table
 * Note: This is different from regular document types - transfer roles are specific to transfer context
 * @param {string} transferRole - Transfer role (e.g., 'deed_of_sale', 'seller_id')
 * @returns {string} Database type for transfer_documents.document_type
 */
function mapTransferRoleToDbType(transferRole) {
    // Transfer roles map directly to database types in transfer_documents table
    return transferRole; // They're already in the correct format
}

/**
 * Legacy compatibility: Map old document type names to new logical types
 * This ensures backward compatibility with existing code
 * @param {string} oldType - Old document type name
 * @returns {string} Logical document type
 */
function mapLegacyType(oldType) {
    const legacyMapping = {
        'general': LOGICAL_TYPES.REGISTRATION_CERT,
        'registration': LOGICAL_TYPES.REGISTRATION_CERT,
        'insurance': LOGICAL_TYPES.INSURANCE_CERT,
        'insuranceCertificate': LOGICAL_TYPES.INSURANCE_CERT,
        'owner_id': LOGICAL_TYPES.OWNER_ID,
        'ownerId': LOGICAL_TYPES.OWNER_ID,
        'ownerValidId': LOGICAL_TYPES.OWNER_ID,
        'deed_of_sale': LOGICAL_TYPES.DEED_OF_SALE,
        'deedOfSale': LOGICAL_TYPES.DEED_OF_SALE,
        'seller_id': LOGICAL_TYPES.SELLER_ID,
        'sellerId': LOGICAL_TYPES.SELLER_ID,
        'buyer_id': LOGICAL_TYPES.BUYER_ID,
        'buyerId': LOGICAL_TYPES.BUYER_ID,
        'csr': LOGICAL_TYPES.CSR,
        'certificateOfStockReport': LOGICAL_TYPES.CSR,
        'hpg_clearance': LOGICAL_TYPES.HPG_CLEARANCE,
        'hpgClearance': LOGICAL_TYPES.HPG_CLEARANCE,
        'pnpHpgClearance': LOGICAL_TYPES.HPG_CLEARANCE,
        'sales_invoice': LOGICAL_TYPES.SALES_INVOICE,
        'salesInvoice': LOGICAL_TYPES.SALES_INVOICE
    };
    
    return legacyMapping[oldType] || oldType;
}

module.exports = {
    // Constants
    LOGICAL_TYPES,
    DB_TYPES,
    TRANSFER_ROLES,
    
    // Mapping functions
    mapToDbType,
    mapToLogicalType,
    mapTransferRoleToDbType,
    mapLegacyType,
    
    // Validation functions
    isValidLogicalType,
    isValidDbType,
    isValidTransferRole,
    getRequiredTypesForAutoSend,
    isRequiredForAutoSend,
    validateDocumentTypeForUpload,
    
    // Getter functions
    getValidLogicalTypes,
    getValidDbTypes,
    getValidTransferRoles
};
