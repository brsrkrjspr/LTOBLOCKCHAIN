// TrustChain LTO - Status Utility Functions
// Frontend utility for consistent status handling and display

/**
 * Normalize status to lowercase for consistent comparisons
 * @param {string} status - Status value (any case)
 * @returns {string} Lowercase status
 */
function normalizeStatus(status) {
    if (!status || typeof status !== 'string') return '';
    return status.toLowerCase().trim();
}

/**
 * Normalize status to uppercase for display
 * @param {string} status - Status value (any case)
 * @returns {string} Uppercase status
 */
function normalizeStatusUpper(status) {
    if (!status || typeof status !== 'string') return '';
    return status.toUpperCase().trim();
}

/**
 * Get human-readable status text
 * @param {string} status - Status value
 * @returns {string} Human-readable status text
 */
function getStatusText(status) {
    const normalizedStatus = normalizeStatus(status);
    const statusMap = {
        // Vehicle statuses
        'submitted': 'Pending Review',
        'pending_blockchain': 'Pending Blockchain',
        'registered': 'Registered',
        'approved': 'Approved',
        'rejected': 'Rejected',
        'suspended': 'Suspended',
        'transfer_in_progress': 'Transfer In Progress',
        'transfer_completed': 'Transfer Completed',
        'processing': 'Processing',
        'pending': 'Pending',
        
        // Transfer statuses
        'reviewing': 'Under Review',
        'awaiting_buyer_docs': 'Awaiting Buyer Documents',
        'under_review': 'Under Review',
        'expired': 'Expired',
        'completed': 'Completed',
        'forwarded_to_hpg': 'Forwarded to HPG',
        
        // Clearance statuses
        'sent': 'Sent',
        'in_progress': 'In Progress',
    };
    
    return statusMap[normalizedStatus] || status;
}

/**
 * Get status badge CSS class
 * @param {string} status - Status value
 * @returns {string} CSS class name
 */
function getStatusBadgeClass(status) {
    const normalizedStatus = normalizeStatus(status);
    
    // Approved/Completed statuses
    if (['approved', 'registered', 'completed'].includes(normalizedStatus)) {
        return 'status-approved';
    }
    
    // Rejected statuses
    if (['rejected', 'expired'].includes(normalizedStatus)) {
        return 'status-rejected';
    }
    
    // Pending/In Progress statuses
    if (['pending', 'submitted', 'processing', 'under_review', 'awaiting_buyer_docs', 'sent', 'in_progress', 'pending_blockchain'].includes(normalizedStatus)) {
        return 'status-pending';
    }
    
    // Transfer statuses
    if (['transfer_in_progress', 'forwarded_to_hpg'].includes(normalizedStatus)) {
        return 'status-processing';
    }
    
    // Default
    return 'status-unknown';
}

/**
 * Check if status indicates approval/registration
 * @param {string} status - Status value
 * @returns {boolean} True if approved or registered
 */
function isApprovedOrRegistered(status) {
    const normalized = normalizeStatusUpper(status);
    return normalized === 'APPROVED' || normalized === 'REGISTERED';
}

/**
 * Check if status indicates pending/submitted
 * @param {string} status - Status value
 * @returns {boolean} True if pending or submitted
 */
function isPendingOrSubmitted(status) {
    const normalized = normalizeStatusUpper(status);
    return ['SUBMITTED', 'PENDING', 'PENDING_BLOCKCHAIN', 'PROCESSING'].includes(normalized);
}

/**
 * Check if status allows document updates
 * @param {string} status - Status value
 * @returns {boolean} True if documents can be updated
 */
function canUpdateDocuments(status) {
    const normalized = normalizeStatus(status);
    return ['submitted', 'processing', 'rejected', 'pending', 'under_review', 'awaiting_buyer_docs'].includes(normalized);
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeStatus,
        normalizeStatusUpper,
        getStatusText,
        getStatusBadgeClass,
        isApprovedOrRegistered,
        isPendingOrSubmitted,
        canUpdateDocuments
    };
}

// Make available globally
window.StatusUtils = {
    normalizeStatus,
    normalizeStatusUpper,
    getStatusText,
    getStatusBadgeClass,
    isApprovedOrRegistered,
    isPendingOrSubmitted,
    canUpdateDocuments
};
