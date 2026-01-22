// TrustChain LTO - Status Constants
// Single source of truth for all status values across the system
// These values match the database schema constraints and ENUMs

/**
 * Vehicle Status (matches vehicle_status ENUM)
 * Used in vehicles.status column
 */
const VEHICLE_STATUS = {
    SUBMITTED: 'SUBMITTED',
    PENDING_BLOCKCHAIN: 'PENDING_BLOCKCHAIN',
    REGISTERED: 'REGISTERED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    SUSPENDED: 'SUSPENDED',
    TRANSFER_IN_PROGRESS: 'TRANSFER_IN_PROGRESS',
    TRANSFER_COMPLETED: 'TRANSFER_COMPLETED',
    PROCESSING: 'PROCESSING'
};

/**
 * Verification Status (matches verification_status ENUM)
 * Used in vehicle_verifications.status column
 */
const VERIFICATION_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
};

/**
 * Transfer Request Status (matches transfer_requests.status CHECK constraint)
 * Used in transfer_requests.status column
 * NOTE: AWAITING_LTO_INSPECTION is not in database CHECK constraint - use UNDER_REVIEW instead
 */
const TRANSFER_STATUS = {
    PENDING: 'PENDING',
    AWAITING_BUYER_DOCS: 'AWAITING_BUYER_DOCS',
    UNDER_REVIEW: 'UNDER_REVIEW',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    EXPIRED: 'EXPIRED',
    COMPLETED: 'COMPLETED',
    FORWARDED_TO_HPG: 'FORWARDED_TO_HPG'
};

/**
 * Clearance Request Status (matches clearance_requests.status CHECK constraint)
 * Used in clearance_requests.status column
 */
const CLEARANCE_STATUS = {
    PENDING: 'PENDING',
    SENT: 'SENT',
    IN_PROGRESS: 'IN_PROGRESS',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    COMPLETED: 'COMPLETED'
};

/**
 * Normalize status to uppercase (database format)
 * @param {string} status - Status value (any case)
 * @returns {string} Uppercase status
 */
function normalizeStatus(status) {
    if (!status || typeof status !== 'string') return '';
    return status.toUpperCase().trim();
}

/**
 * Normalize status to lowercase (for comparisons)
 * @param {string} status - Status value (any case)
 * @returns {string} Lowercase status
 */
function normalizeStatusLower(status) {
    if (!status || typeof status !== 'string') return '';
    return status.toLowerCase().trim();
}

/**
 * Check if status is valid for vehicle
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid
 */
function isValidVehicleStatus(status) {
    return Object.values(VEHICLE_STATUS).includes(normalizeStatus(status));
}

/**
 * Check if status is valid for verification
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid
 */
function isValidVerificationStatus(status) {
    return Object.values(VERIFICATION_STATUS).includes(normalizeStatus(status));
}

/**
 * Check if status is valid for transfer request
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid
 */
function isValidTransferStatus(status) {
    return Object.values(TRANSFER_STATUS).includes(normalizeStatus(status));
}

/**
 * Check if status is valid for clearance request
 * @param {string} status - Status to validate
 * @returns {boolean} True if valid
 */
function isValidClearanceStatus(status) {
    return Object.values(CLEARANCE_STATUS).includes(normalizeStatus(status));
}

module.exports = {
    // Status constants
    VEHICLE_STATUS,
    VERIFICATION_STATUS,
    TRANSFER_STATUS,
    CLEARANCE_STATUS,
    
    // Normalization functions
    normalizeStatus,
    normalizeStatusLower,
    
    // Validation functions
    isValidVehicleStatus,
    isValidVerificationStatus,
    isValidTransferStatus,
    isValidClearanceStatus
};
