// TrustChain LTO - Status Validation Middleware
// Validates status transitions to prevent illegal or out-of-order changes

const { VEHICLE_STATUS, VERIFICATION_STATUS, TRANSFER_STATUS, CLEARANCE_STATUS } = require('../config/statusConstants');

/**
 * Valid status transitions for vehicles
 * Maps current status to array of valid next statuses
 */
const VEHICLE_STATUS_TRANSITIONS = {
    [VEHICLE_STATUS.SUBMITTED]: [VEHICLE_STATUS.PENDING_BLOCKCHAIN, VEHICLE_STATUS.REJECTED, VEHICLE_STATUS.PROCESSING],
    [VEHICLE_STATUS.PENDING_BLOCKCHAIN]: [VEHICLE_STATUS.REGISTERED, VEHICLE_STATUS.REJECTED],
    [VEHICLE_STATUS.REGISTERED]: [VEHICLE_STATUS.APPROVED, VEHICLE_STATUS.REJECTED, VEHICLE_STATUS.SUSPENDED],
    [VEHICLE_STATUS.APPROVED]: [VEHICLE_STATUS.SUSPENDED, VEHICLE_STATUS.TRANSFER_IN_PROGRESS],
    [VEHICLE_STATUS.REJECTED]: [VEHICLE_STATUS.SUBMITTED], // Can resubmit
    [VEHICLE_STATUS.SUSPENDED]: [VEHICLE_STATUS.APPROVED, VEHICLE_STATUS.REGISTERED], // Can reactivate
    [VEHICLE_STATUS.TRANSFER_IN_PROGRESS]: [VEHICLE_STATUS.TRANSFER_COMPLETED, VEHICLE_STATUS.APPROVED], // Transfer can be cancelled
    [VEHICLE_STATUS.TRANSFER_COMPLETED]: [VEHICLE_STATUS.APPROVED], // New owner's vehicle status
    [VEHICLE_STATUS.PROCESSING]: [VEHICLE_STATUS.SUBMITTED, VEHICLE_STATUS.REJECTED]
};

/**
 * Valid status transitions for verifications
 */
const VERIFICATION_STATUS_TRANSITIONS = {
    [VERIFICATION_STATUS.PENDING]: [VERIFICATION_STATUS.APPROVED, VERIFICATION_STATUS.REJECTED],
    [VERIFICATION_STATUS.APPROVED]: [VERIFICATION_STATUS.REJECTED], // Can be revoked
    [VERIFICATION_STATUS.REJECTED]: [VERIFICATION_STATUS.PENDING, VERIFICATION_STATUS.APPROVED] // Can resubmit
};

/**
 * Valid status transitions for transfer requests
 */
const TRANSFER_STATUS_TRANSITIONS = {
    [TRANSFER_STATUS.PENDING]: [TRANSFER_STATUS.AWAITING_BUYER_DOCS, TRANSFER_STATUS.REJECTED, TRANSFER_STATUS.EXPIRED],
    [TRANSFER_STATUS.AWAITING_BUYER_DOCS]: [TRANSFER_STATUS.UNDER_REVIEW, TRANSFER_STATUS.REJECTED, TRANSFER_STATUS.EXPIRED],
    [TRANSFER_STATUS.UNDER_REVIEW]: [TRANSFER_STATUS.APPROVED, TRANSFER_STATUS.REJECTED, TRANSFER_STATUS.FORWARDED_TO_HPG],
    [TRANSFER_STATUS.FORWARDED_TO_HPG]: [TRANSFER_STATUS.UNDER_REVIEW, TRANSFER_STATUS.APPROVED, TRANSFER_STATUS.REJECTED],
    [TRANSFER_STATUS.APPROVED]: [TRANSFER_STATUS.COMPLETED, TRANSFER_STATUS.REJECTED], // Can be cancelled before completion
    [TRANSFER_STATUS.REJECTED]: [], // Terminal state
    [TRANSFER_STATUS.EXPIRED]: [], // Terminal state
    [TRANSFER_STATUS.COMPLETED]: [] // Terminal state
};

/**
 * Valid status transitions for clearance requests
 */
const CLEARANCE_STATUS_TRANSITIONS = {
    [CLEARANCE_STATUS.PENDING]: [CLEARANCE_STATUS.SENT, CLEARANCE_STATUS.IN_PROGRESS, CLEARANCE_STATUS.REJECTED],
    [CLEARANCE_STATUS.SENT]: [CLEARANCE_STATUS.IN_PROGRESS, CLEARANCE_STATUS.APPROVED, CLEARANCE_STATUS.REJECTED],
    [CLEARANCE_STATUS.IN_PROGRESS]: [CLEARANCE_STATUS.APPROVED, CLEARANCE_STATUS.REJECTED, CLEARANCE_STATUS.COMPLETED],
    [CLEARANCE_STATUS.APPROVED]: [CLEARANCE_STATUS.COMPLETED, CLEARANCE_STATUS.REJECTED], // Can be revoked
    [CLEARANCE_STATUS.REJECTED]: [CLEARANCE_STATUS.PENDING], // Can resubmit
    [CLEARANCE_STATUS.COMPLETED]: [] // Terminal state
};

/**
 * Validate vehicle status transition
 * @param {string} currentStatus - Current vehicle status
 * @param {string} newStatus - Proposed new status
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateVehicleStatusTransition(currentStatus, newStatus) {
    const normalizedCurrent = currentStatus?.toUpperCase();
    const normalizedNew = newStatus?.toUpperCase();

    if (!normalizedCurrent || !normalizedNew) {
        return { valid: false, error: 'Status values are required' };
    }

    const validTransitions = VEHICLE_STATUS_TRANSITIONS[normalizedCurrent];
    if (!validTransitions) {
        return { valid: false, error: `Unknown current status: ${normalizedCurrent}` };
    }

    if (!validTransitions.includes(normalizedNew)) {
        return {
            valid: false,
            error: `Invalid status transition: ${normalizedCurrent} → ${normalizedNew}. Valid transitions: ${validTransitions.join(', ')}`
        };
    }

    return { valid: true };
}

/**
 * Validate verification status transition
 * @param {string} currentStatus - Current verification status
 * @param {string} newStatus - Proposed new status
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateVerificationStatusTransition(currentStatus, newStatus) {
    const normalizedCurrent = currentStatus?.toUpperCase();
    const normalizedNew = newStatus?.toUpperCase();

    if (!normalizedCurrent || !normalizedNew) {
        return { valid: false, error: 'Status values are required' };
    }

    const validTransitions = VERIFICATION_STATUS_TRANSITIONS[normalizedCurrent];
    if (!validTransitions) {
        return { valid: false, error: `Unknown current status: ${normalizedCurrent}` };
    }

    if (!validTransitions.includes(normalizedNew)) {
        return {
            valid: false,
            error: `Invalid status transition: ${normalizedCurrent} → ${normalizedNew}. Valid transitions: ${validTransitions.join(', ')}`
        };
    }

    return { valid: true };
}

/**
 * Validate transfer request status transition
 * @param {string} currentStatus - Current transfer status
 * @param {string} newStatus - Proposed new status
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateTransferStatusTransition(currentStatus, newStatus) {
    const normalizedCurrent = currentStatus?.toUpperCase();
    const normalizedNew = newStatus?.toUpperCase();

    if (!normalizedCurrent || !normalizedNew) {
        return { valid: false, error: 'Status values are required' };
    }

    const validTransitions = TRANSFER_STATUS_TRANSITIONS[normalizedCurrent];
    if (!validTransitions) {
        return { valid: false, error: `Unknown current status: ${normalizedCurrent}` };
    }

    if (validTransitions.length === 0) {
        return { valid: false, error: `Status ${normalizedCurrent} is terminal and cannot be changed` };
    }

    if (!validTransitions.includes(normalizedNew)) {
        return {
            valid: false,
            error: `Invalid status transition: ${normalizedCurrent} → ${normalizedNew}. Valid transitions: ${validTransitions.join(', ')}`
        };
    }

    return { valid: true };
}

/**
 * Validate clearance request status transition
 * @param {string} currentStatus - Current clearance status
 * @param {string} newStatus - Proposed new status
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateClearanceStatusTransition(currentStatus, newStatus) {
    const normalizedCurrent = currentStatus?.toUpperCase();
    const normalizedNew = newStatus?.toUpperCase();

    if (!normalizedCurrent || !normalizedNew) {
        return { valid: false, error: 'Status values are required' };
    }

    const validTransitions = CLEARANCE_STATUS_TRANSITIONS[normalizedCurrent];
    if (!validTransitions) {
        return { valid: false, error: `Unknown current status: ${normalizedCurrent}` };
    }

    if (validTransitions.length === 0) {
        return { valid: false, error: `Status ${normalizedCurrent} is terminal and cannot be changed` };
    }

    if (!validTransitions.includes(normalizedNew)) {
        return {
            valid: false,
            error: `Invalid status transition: ${normalizedCurrent} → ${normalizedNew}. Valid transitions: ${validTransitions.join(', ')}`
        };
    }

    return { valid: true };
}

/**
 * Express middleware to validate vehicle status transitions
 */
function validateVehicleStatus(req, res, next) {
    const { currentStatus, newStatus } = req.body;

    if (!newStatus) {
        return next(); // No status change requested
    }

    const validation = validateVehicleStatusTransition(currentStatus, newStatus);
    if (!validation.valid) {
        return res.status(400).json({
            success: false,
            error: 'Invalid status transition',
            message: validation.error,
            currentStatus,
            newStatus
        });
    }

    next();
}

/**
 * Express middleware to validate verification status transitions
 */
function validateVerificationStatus(req, res, next) {
    const { currentStatus, newStatus } = req.body;

    if (!newStatus) {
        return next(); // No status change requested
    }

    const validation = validateVerificationStatusTransition(currentStatus, newStatus);
    if (!validation.valid) {
        return res.status(400).json({
            success: false,
            error: 'Invalid status transition',
            message: validation.error,
            currentStatus,
            newStatus
        });
    }

    next();
}

module.exports = {
    validateVehicleStatusTransition,
    validateVerificationStatusTransition,
    validateTransferStatusTransition,
    validateClearanceStatusTransition,
    validateVehicleStatus,
    validateVerificationStatus,
    VEHICLE_STATUS_TRANSITIONS,
    VERIFICATION_STATUS_TRANSITIONS,
    TRANSFER_STATUS_TRANSITIONS,
    CLEARANCE_STATUS_TRANSITIONS
};
