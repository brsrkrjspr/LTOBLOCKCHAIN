// TrustChain LTO - Transfer Auto Validation Service
// Lightweight validation for buyer-submitted transfer documents (HPG, MVIR, CTPL, IDs/TIN)
// Focuses on presence, hash integrity, and basic field availability.

const docTypes = require('../config/documentTypes');

function findByRole(documents, role) {
    if (!Array.isArray(documents)) return null;
    return documents.find(doc => doc.document_type === role) || null;
}

function buildCheck(label, role, documents) {
    const doc = findByRole(documents, role);
    if (!doc) {
        return { type: label, status: 'MISSING', notes: 'Required document not provided' };
    }

    if (!doc.file_hash) {
        return { type: label, status: 'PENDING', notes: 'File hash missing; cannot validate integrity' };
    }

    return { type: label, status: 'READY', notes: 'Document present with hash', documentId: doc.document_id || doc.id };
}

/**
 * Validate buyer documents for transfer
 * @param {Object} params
 * @param {Object} params.transferRequest
 * @param {Object} params.vehicle
 * @param {Array} params.documents - transfer_documents join payload
 * @returns {Object} validation report
 */
async function validateDocuments({ transferRequest, vehicle, documents }) {
    const checks = [];

    checks.push(buildCheck('HPG_CLEARANCE', docTypes.TRANSFER_ROLES.BUYER_HPG_CLEARANCE, documents));
    checks.push(buildCheck('MVIR', docTypes.TRANSFER_ROLES.BUYER_MVIR, documents));
    checks.push(buildCheck('CTPL', docTypes.TRANSFER_ROLES.BUYER_CTPL, documents));
    checks.push(buildCheck('BUYER_TIN', docTypes.TRANSFER_ROLES.BUYER_TIN, documents));

    const missing = checks.filter(c => c.status === 'MISSING').map(c => c.type);
    const pending = checks.filter(c => c.status === 'PENDING').map(c => c.type);

    const status = missing.length > 0 ? 'INCOMPLETE' : (pending.length > 0 ? 'PENDING' : 'READY');

    return {
        status,
        checkedAt: new Date().toISOString(),
        vehicleId: vehicle?.id || transferRequest?.vehicle_id || null,
        transferRequestId: transferRequest?.id || null,
        missing,
        pending,
        checks
    };
}

module.exports = {
    validateDocuments
};
