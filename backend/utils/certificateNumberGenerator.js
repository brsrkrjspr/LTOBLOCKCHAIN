/**
 * Certificate Number Generator Utility
 * Centralized certificate number generation with consistent format
 * 
 * Standard Format: TYPE-YYYY-XXXXXX
 * - TYPE: Certificate type prefix (CTPL, HPG, CSR, INV)
 * - YYYY: 4-digit year
 * - XXXXXX: 6 alphanumeric characters (random or sequence)
 * 
 * This ensures all certificate numbers match auto-verification regex patterns:
 * - Insurance: /^CTPL-\d{4}-[A-Z0-9]{6}$/
 * - HPG: /^HPG-\d{4}-[A-Z0-9]{6}$/
 */

/**
 * Generate a random 6-character alphanumeric suffix
 * @returns {string} 6 uppercase alphanumeric characters
 */
function generateRandomSuffix() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Generate certificate number with standard format
 * @param {string} type - Certificate type: 'insurance', 'hpg', 'csr', 'sales_invoice'
 * @param {Object} options - Generation options
 * @param {number} options.year - Year (defaults to current year)
 * @param {number} options.sequence - Sequence number (if provided, uses padded sequence instead of random)
 * @param {string} options.customNumber - Custom certificate number (if provided, validates format)
 * @returns {string} Certificate number in format TYPE-YYYY-XXXXXX
 */
function generateCertificateNumber(type, options = {}) {
    const year = options.year || new Date().getFullYear();
    
    // Type prefix mapping
    const typePrefix = {
        'insurance': 'CTPL',
        'ctpl': 'CTPL',
        'ctpl_cert': 'CTPL',
        'hpg': 'HPG',
        'hpg_clearance': 'HPG',
        'csr': 'CSR',
        'sales_invoice': 'INV',
        'inv': 'INV'
    };
    
    const prefix = typePrefix[type.toLowerCase()];
    if (!prefix) {
        throw new Error(`Unknown certificate type: ${type}. Supported types: insurance, hpg, csr, sales_invoice`);
    }
    
    // If custom number provided, validate format
    if (options.customNumber) {
        const custom = options.customNumber.trim().toUpperCase();
        // Validate format matches standard pattern
        const pattern = new RegExp(`^${prefix}-\\d{4}-[A-Z0-9]{6}$`);
        if (pattern.test(custom)) {
            return custom;
        } else {
            console.warn(`[Certificate Number] Custom number "${custom}" doesn't match standard format, generating new one`);
        }
    }
    
    // Generate suffix (sequence or random)
    let suffix;
    if (options.sequence !== undefined && options.sequence !== null) {
        // Use sequence number (padded to 6 digits)
        suffix = String(options.sequence).padStart(6, '0');
    } else {
        // Use random alphanumeric (6 characters)
        suffix = generateRandomSuffix();
    }
    
    return `${prefix}-${year}-${suffix}`;
}

/**
 * Generate certificate number for insurance/CTPL
 * @param {Object} options - Generation options
 * @returns {string} CTPL certificate number
 */
function generateInsuranceNumber(options = {}) {
    return generateCertificateNumber('insurance', options);
}

/**
 * Generate certificate number for HPG clearance
 * @param {Object} options - Generation options
 * @returns {string} HPG certificate number
 */
function generateHpgNumber(options = {}) {
    return generateCertificateNumber('hpg', options);
}

/**
 * Generate certificate number for CSR
 * @param {Object} options - Generation options
 * @returns {string} CSR certificate number
 */
function generateCsrNumber(options = {}) {
    return generateCertificateNumber('csr', options);
}

/**
 * Generate invoice number for sales invoice
 * Note: Sales invoice uses date prefix format: INV-YYYYMMDD-XXXXXX
 * This is different from other certificates but documented here for consistency
 * @param {Object} options - Generation options
 * @param {Date} options.date - Date to use (defaults to today)
 * @returns {string} Sales invoice number
 */
function generateSalesInvoiceNumber(options = {}) {
    const date = options.date || new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const suffix = options.sequence !== undefined 
        ? String(options.sequence).padStart(6, '0')
        : generateRandomSuffix();
    
    return `INV-${year}${month}${day}-${suffix}`;
}

/**
 * Validate certificate number format
 * @param {string} certificateNumber - Certificate number to validate
 * @param {string} type - Expected certificate type
 * @returns {Object} Validation result
 */
function validateCertificateNumber(certificateNumber, type) {
    if (!certificateNumber || !type) {
        return {
            valid: false,
            reason: 'Certificate number or type is missing'
        };
    }
    
    const normalized = certificateNumber.trim().toUpperCase();
    
    // Standard format pattern: TYPE-YYYY-XXXXXX
    const standardPattern = /^([A-Z]+)-\d{4}-[A-Z0-9]{6}$/;
    
    // Sales invoice pattern: INV-YYYYMMDD-XXXXXX
    const invoicePattern = /^INV-\d{8}-[A-Z0-9]{6}$/;
    
    if (type.toLowerCase() === 'sales_invoice' || type.toLowerCase() === 'inv') {
        return {
            valid: invoicePattern.test(normalized),
            normalized,
            reason: invoicePattern.test(normalized) 
                ? 'Valid sales invoice format' 
                : 'Invalid format. Expected: INV-YYYYMMDD-XXXXXX'
        };
    }
    
    const matches = standardPattern.test(normalized);
    return {
        valid: matches,
        normalized,
        reason: matches 
            ? 'Valid certificate number format' 
            : 'Invalid format. Expected: TYPE-YYYY-XXXXXX'
    };
}

module.exports = {
    generateCertificateNumber,
    generateInsuranceNumber,
    generateHpgNumber,
    generateCsrNumber,
    generateSalesInvoiceNumber,
    validateCertificateNumber,
    generateRandomSuffix
};
