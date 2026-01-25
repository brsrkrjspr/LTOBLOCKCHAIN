// TrustChain LTO - Action Constants
// Single source of truth for all action names used in vehicle_history table
// These values ensure consistency across all modules and enable proper audit trail reconstruction

/**
 * Vehicle Registration Actions
 * Used when action relates to vehicle registration workflow
 */
const REGISTRATION_ACTIONS = {
    SUBMITTED: 'REGISTRATION_SUBMITTED',
    BLOCKCHAIN_REGISTERED: 'BLOCKCHAIN_REGISTERED',
    APPROVED: 'REGISTRATION_APPROVED',
    REJECTED: 'REGISTRATION_REJECTED',
    PENDING_REVIEW: 'REGISTRATION_PENDING_REVIEW'
};

/**
 * Transfer of Ownership Actions
 * Used when action relates to ownership transfer workflow
 */
const TRANSFER_ACTIONS = {
    REQUESTED: 'TRANSFER_REQUESTED',
    BUYER_ACCEPTED: 'TRANSFER_BUYER_ACCEPTED',
    APPROVED: 'TRANSFER_APPROVED',
    REJECTED: 'TRANSFER_REJECTED',
    BLOCKCHAIN_TRANSFERRED: 'BLOCKCHAIN_TRANSFERRED',
    COMPLETED: 'TRANSFER_COMPLETED',
    EXPIRED: 'TRANSFER_EXPIRED',
    FORWARDED_TO_HPG: 'TRANSFER_FORWARDED_TO_HPG'
};

/**
 * HPG Clearance Actions
 * Used when action relates to HPG clearance workflow
 */
const HPG_ACTIONS = {
    REQUESTED: 'HPG_CLEARANCE_REQUESTED',
    AUTO_VERIFIED: 'HPG_AUTO_VERIFY',
    APPROVED: 'HPG_CLEARANCE_APPROVED',
    REJECTED: 'HPG_CLEARANCE_REJECTED',
    CERTIFICATE_RELEASED: 'HPG_CERTIFICATE_RELEASED',
    TRANSFER_APPROVED: 'TRANSFER_HPG_APPROVED',
    TRANSFER_REJECTED: 'TRANSFER_HPG_REJECTED'
};

/**
 * Insurance Verification Actions
 * Used when action relates to insurance verification workflow
 */
const INSURANCE_ACTIONS = {
    REQUESTED: 'INSURANCE_VERIFICATION_REQUESTED',
    AUTO_VERIFIED_APPROVED: 'INSURANCE_AUTO_VERIFIED_APPROVED',
    AUTO_VERIFIED_PENDING: 'INSURANCE_AUTO_VERIFIED_PENDING',
    APPROVED: 'INSURANCE_VERIFICATION_APPROVED',
    REJECTED: 'INSURANCE_VERIFICATION_REJECTED',
    MANUAL_VERIFICATION: 'INSURANCE_MANUAL_VERIFICATION',
    TRANSFER_APPROVED: 'TRANSFER_INSURANCE_APPROVED',
    TRANSFER_REJECTED: 'TRANSFER_INSURANCE_REJECTED'
};

/**
 * Emission Verification Actions
 * Used when action relates to emission verification workflow
 */
const EMISSION_ACTIONS = {
    REQUESTED: 'EMISSION_VERIFICATION_REQUESTED',
    AUTO_VERIFIED_APPROVED: 'EMISSION_AUTO_VERIFIED_APPROVED',
    AUTO_VERIFIED_PENDING: 'EMISSION_AUTO_VERIFIED_PENDING',
    APPROVED: 'EMISSION_VERIFICATION_APPROVED',
    REJECTED: 'EMISSION_VERIFICATION_REJECTED',
    MANUAL_VERIFICATION: 'EMISSION_MANUAL_VERIFICATION',
    TRANSFER_APPROVED: 'TRANSFER_EMISSION_APPROVED',
    TRANSFER_REJECTED: 'TRANSFER_EMISSION_REJECTED'
};

/**
 * Vehicle Status Change Actions
 * Used when action relates to vehicle status changes
 */
const VEHICLE_STATUS_ACTIONS = {
    SUSPENDED: 'VEHICLE_SUSPENDED',
    REACTIVATED: 'VEHICLE_REACTIVATED',
    SCRAPPED: 'VEHICLE_SCRAPPED',
    STOLEN: 'VEHICLE_STOLEN',
    RECOVERED: 'VEHICLE_RECOVERED',
    VIOLATION_REPORTED: 'VIOLATION_REPORTED'
};

/**
 * All Actions - Combined for validation
 */
const ALL_ACTIONS = {
    ...REGISTRATION_ACTIONS,
    ...TRANSFER_ACTIONS,
    ...HPG_ACTIONS,
    ...INSURANCE_ACTIONS,
    ...EMISSION_ACTIONS,
    ...VEHICLE_STATUS_ACTIONS
};

/**
 * Validate action name
 * @param {string} action - Action name to validate
 * @returns {boolean} True if valid
 */
function isValidAction(action) {
    if (!action || typeof action !== 'string') return false;
    return Object.values(ALL_ACTIONS).includes(action.toUpperCase());
}

/**
 * Normalize action name to standard format
 * @param {string} action - Action name (any case)
 * @returns {string} Normalized action name
 */
function normalizeAction(action) {
    if (!action || typeof action !== 'string') return '';
    const upperAction = action.toUpperCase().trim();
    
    // Check if it's already a valid action
    if (Object.values(ALL_ACTIONS).includes(upperAction)) {
        return upperAction;
    }
    
    // Try to match common variations
    const actionMap = {
        'HPG_VERIFICATION_APPROVED': HPG_ACTIONS.APPROVED,
        'HPG_VERIFICATION_REJECTED': HPG_ACTIONS.REJECTED,
        'INSURANCE_VERIFICATION_APPROVED': INSURANCE_ACTIONS.APPROVED,
        'INSURANCE_VERIFICATION_REJECTED': INSURANCE_ACTIONS.REJECTED,
        'EMISSION_VERIFICATION_APPROVED': EMISSION_ACTIONS.APPROVED,
        'EMISSION_VERIFICATION_REJECTED': EMISSION_ACTIONS.REJECTED,
        'OWNERSHIP_TRANSFERRED': TRANSFER_ACTIONS.BLOCKCHAIN_TRANSFERRED
    };
    
    return actionMap[upperAction] || upperAction;
}

module.exports = {
    REGISTRATION_ACTIONS,
    TRANSFER_ACTIONS,
    HPG_ACTIONS,
    INSURANCE_ACTIONS,
    EMISSION_ACTIONS,
    VEHICLE_STATUS_ACTIONS,
    ALL_ACTIONS,
    isValidAction,
    normalizeAction
};
