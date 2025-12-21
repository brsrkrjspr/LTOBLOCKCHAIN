// Admin Transfer Verification - JavaScript
// Handles document verification for transfer requests

document.addEventListener('DOMContentLoaded', function() {
    initializeTransferVerification();
});

let currentTransferRequest = null;
let currentRequestId = null;
let currentDocumentId = null;
let currentZoom = 100;
let verificationHistory = [];

function initializeTransferVerification() {
    // Get request ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentRequestId = urlParams.get('id');
    currentDocumentId = urlParams.get('docId');

    if (!currentRequestId) {
        showError('Transfer request ID is required');
        setTimeout(() => {
            window.location.href = 'admin-transfer-requests.html';
        }, 2000);
        return;
    }

    // Initialize user information
    if (typeof AuthUtils !== 'undefined') {
        const user = AuthUtils.getCurrentUser();
        if (user) {
            const userNameEl = document.getElementById('userName');
            const userRoleEl = document.getElementById('userRole');
            const userAvatarEl = document.getElementById('userAvatar');
            
            if (userNameEl) userNameEl.textContent = AuthUtils.getUserDisplayName() || 'ADMIN';
            if (userRoleEl) userRoleEl.textContent = 'System Administrator';
            if (userAvatarEl) userAvatarEl.textContent = AuthUtils.getUserInitials() || 'AD';
        } else {
            window.location.href = 'login-signup.html';
        }
    }

    // Sidebar toggle
    const sidebar = document.querySelector('.dashboard-sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('adminSidebarCollapsed', sidebar.classList.contains('collapsed') ? 'true' : 'false');
        });
    }

    // Load sidebar state
    const savedSidebarState = localStorage.getItem('adminSidebarCollapsed');
    if (sidebar && savedSidebarState === 'true') {
        sidebar.classList.add('collapsed');
    }

    // Load transfer request and documents
    loadTransferRequest();
    loadVerificationHistory();
}

async function loadTransferRequest() {
    try {
        showLoading();

        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        // Get transfer request by ID
        const response = await apiClient.get(`/api/vehicles/transfer/requests/${currentRequestId}`);
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load transfer request');
        }

        currentTransferRequest = response.transferRequest;
        
        // Display transfer request info
        renderTransferRequestInfo(currentTransferRequest);

        // Load documents list
        renderDocumentsList(currentTransferRequest.documents || []);

        // Load first document if docId is provided, otherwise load first document
        if (currentDocumentId) {
            loadDocument(currentDocumentId);
        } else if (currentTransferRequest.documents && currentTransferRequest.documents.length > 0) {
            const firstDoc = currentTransferRequest.documents[0];
            const firstDocId = firstDoc.document_id || firstDoc.id;
            loadDocument(firstDocId);
        }

        hideLoading();

    } catch (error) {
        console.error('Load transfer request error:', error);
        showError(error.message || 'Failed to load transfer request');
        hideLoading();
    }
}

function renderTransferRequestInfo(request) {
    const requestIdEl = document.getElementById('requestId');
    const requestStatusEl = document.getElementById('requestStatus');
    const plateNumberEl = document.getElementById('plateNumber');
    
    if (requestIdEl) requestIdEl.textContent = request.id.substring(0, 8) + '...';
    if (requestStatusEl) {
        requestStatusEl.textContent = request.status || 'PENDING';
        requestStatusEl.className = `status-badge ${getStatusClass(request.status)}`;
    }
    if (plateNumberEl) {
        const vehicle = request.vehicle || {};
        plateNumberEl.textContent = vehicle.plate_number || vehicle.plateNumber || 'N/A';
    }
}

function renderDocumentsList(documents) {
    const documentsList = document.getElementById('documentsList');
    if (!documentsList) return;

    if (documents.length === 0) {
        documentsList.innerHTML = '<p>No documents available</p>';
        return;
    }

    documentsList.innerHTML = documents.map(doc => {
        // Use document_id from JOIN (actual document ID), fallback to id
        const docId = doc.document_id || doc.id;
        const docType = doc.document_type || doc.type || 'Document';
        // Use original_name from documents table, fallback to filename, then document_type
        const docName = doc.original_name || doc.filename || doc.document_type || 'Document';
        const isActive = docId === currentDocumentId;
        const verificationStatus = doc.verification_status || doc.status || 'PENDING';

        return `
            <div class="document-list-item ${isActive ? 'active' : ''}" onclick="loadDocument('${docId}')">
                <div class="document-list-icon">
                    <i class="fas fa-file-contract"></i>
                </div>
                <div class="document-list-info">
                    <h4>${escapeHtml(docName)}</h4>
                    <p class="document-type">${escapeHtml(getDocumentTypeLabel(docType))}</p>
                    <span class="status-badge ${getVerificationStatusClass(verificationStatus)}">${escapeHtml(verificationStatus)}</span>
                </div>
            </div>
        `;
    }).join('');
}

async function loadDocument(docId) {
    try {
        if (!docId) {
            throw new Error('Document ID is required');
        }
        
        // Validate UUID format (if using UUIDs) or numeric ID
        if (docId && !docId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) && 
            !docId.match(/^[0-9]+$/)) {
            console.warn('⚠️ Document ID format may be invalid:', docId);
        }
        
        currentDocumentId = docId;
        showLoading();

        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        // Get document details
        const response = await apiClient.get(`/api/documents/${docId}`);
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to load document');
        }

        const doc = response.document;
        
        // Update document display
        updateDocumentDisplay(doc);

        // Update documents list active state
        renderDocumentsList(currentTransferRequest.documents || []);

        // Load verification history for this document
        loadDocumentVerificationHistory(docId);

        hideLoading();

    } catch (error) {
        console.error('Load document error:', {
            documentId: docId,
            error: error.message,
            stack: error.stack
        });
        
        // Provide more specific error message
        let errorMessage = 'Failed to load document';
        if (error.message.includes('404') || error.message.includes('not found')) {
            errorMessage = `Document not found. ID: ${docId}`;
        } else if (error.message.includes('500') || error.message.includes('Internal server error')) {
            errorMessage = 'Server error while loading document. Please try again.';
        } else {
            errorMessage = error.message || 'Failed to load document';
        }
        
        showError(errorMessage);
        hideLoading();
    }
}

function updateDocumentDisplay(doc) {
    const currentDocNameEl = document.getElementById('currentDocName');
    const currentDocTypeEl = document.getElementById('currentDocType');
    const docTypeDisplayEl = document.getElementById('docTypeDisplay');
    const documentViewerEl = document.getElementById('documentViewer');

    const docType = doc.document_type || doc.type || 'Document';
    const docName = doc.name || doc.filename || docType;

    if (currentDocNameEl) currentDocNameEl.textContent = docName;
    if (currentDocTypeEl) currentDocTypeEl.textContent = getDocumentTypeLabel(docType);
    if (docTypeDisplayEl) docTypeDisplayEl.innerHTML = `<strong>${escapeHtml(getDocumentTypeLabel(docType))}</strong>`;

    // Load document content
    if (documentViewerEl && doc.file_url) {
        if (doc.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            // Image document
            documentViewerEl.innerHTML = `<img src="${doc.file_url}" alt="${escapeHtml(docName)}" style="max-width: 100%; height: auto;">`;
        } else if (doc.file_url.match(/\.(pdf)$/i)) {
            // PDF document
            documentViewerEl.innerHTML = `<iframe src="${doc.file_url}" style="width: 100%; height: 600px; border: none;"></iframe>`;
        } else {
            // Other document types
            documentViewerEl.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <i class="fas fa-file-alt" style="font-size: 3rem; color: #7f8c8d;"></i>
                    <p>Preview not available for this file type</p>
                    <a href="${doc.file_url}" target="_blank" class="btn-primary">Open Document</a>
                </div>
            `;
        }
    }

    // Reset zoom
    currentZoom = 100;
    updateZoom();
}

async function loadDocumentVerificationHistory(docId) {
    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        // Get verification history for this document
        const response = await apiClient.get(`/api/vehicles/transfer/requests/${currentRequestId}/verification-history`);
        
        if (response.success && response.verificationHistory) {
            verificationHistory = response.verificationHistory.filter(v => v.document_id === docId);
            renderVerificationHistory(verificationHistory);
        }
    } catch (error) {
        console.error('Load verification history error:', error);
        // Non-critical, don't show error
    }
}

async function loadVerificationHistory() {
    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        // Get verification history for the request
        const response = await apiClient.get(`/api/vehicles/transfer/requests/${currentRequestId}/verification-history`);
        
        if (response.success && response.verificationHistory) {
            verificationHistory = response.verificationHistory;
        }
    } catch (error) {
        console.error('Load verification history error:', error);
        // Non-critical, don't show error
    }
}

function renderVerificationHistory(history) {
    const historyTimeline = document.querySelector('.history-timeline');
    if (!historyTimeline) return;

    if (history.length === 0) {
        historyTimeline.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-history"></i>
                <p>No verification history</p>
            </div>
        `;
        return;
    }

    historyTimeline.innerHTML = history.map(item => {
        const status = item.status || item.verification_status || 'PENDING';
        const statusClass = getVerificationStatusClass(status);
        const verifiedBy = item.verified_by_name || item.verified_by || 'Admin';
        const verifiedAt = new Date(item.verified_at || item.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const notes = item.notes || '';

        return `
            <div class="history-item">
                <div class="history-icon ${statusClass}">
                    <i class="fas fa-${status === 'APPROVED' ? 'check' : status === 'REJECTED' ? 'times' : 'clock'}"></i>
                </div>
                <div class="history-content">
                    <p><strong>${escapeHtml(item.document_name || 'Document')}</strong> - ${escapeHtml(status)}</p>
                    <small>By ${escapeHtml(verifiedBy)} on ${verifiedAt}</small>
                    ${notes ? `<p style="margin-top: 0.5rem; color: #7f8c8d;">${escapeHtml(notes)}</p>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function zoomIn() {
    currentZoom = Math.min(currentZoom + 25, 200);
    updateZoom();
}

function zoomOut() {
    currentZoom = Math.max(currentZoom - 25, 50);
    updateZoom();
}

function updateZoom() {
    const zoomLevelEl = document.getElementById('zoomLevel');
    const documentViewerEl = document.getElementById('documentViewer');
    
    if (zoomLevelEl) zoomLevelEl.textContent = currentZoom + '%';
    if (documentViewerEl) {
        documentViewerEl.style.transform = `scale(${currentZoom / 100})`;
        documentViewerEl.style.transformOrigin = 'top left';
    }
}

function toggleFullscreen() {
    const viewer = document.getElementById('documentViewer');
    if (!viewer) return;

    if (!document.fullscreenElement) {
        viewer.requestFullscreen().catch(err => {
            showError('Error attempting to enable fullscreen');
        });
    } else {
        document.exitFullscreen();
    }
}

async function approveDocument() {
    if (!confirm('Approve this document?')) {
        return;
    }

    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        const response = await apiClient.post(`/api/vehicles/transfer/requests/${currentRequestId}/documents/${currentDocumentId}/verify`, {
            status: 'APPROVED',
            notes: document.getElementById('verificationNotes')?.value || '',
            checklist: getChecklistData(),
            flagged: document.getElementById('flagSuspicious')?.checked || false
        });
        
        if (response.success) {
            showSuccess('Document approved successfully');
            loadDocument(currentDocumentId); // Reload to update status
            loadVerificationHistory(); // Reload verification history
        } else {
            throw new Error(response.error || 'Failed to approve document');
        }
    } catch (error) {
        console.error('Approve document error:', error);
        showError(error.message || 'Failed to approve document');
    }
}

async function rejectDocument() {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) {
        return;
    }

    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        const response = await apiClient.post(`/api/vehicles/transfer/requests/${currentRequestId}/documents/${currentDocumentId}/verify`, {
            status: 'REJECTED',
            notes: reason + (document.getElementById('verificationNotes')?.value ? '\n\n' + document.getElementById('verificationNotes').value : ''),
            checklist: getChecklistData(),
            flagged: document.getElementById('flagSuspicious')?.checked || false
        });
        
        if (response.success) {
            showSuccess('Document rejected');
            loadDocument(currentDocumentId); // Reload to update status
            loadVerificationHistory(); // Reload verification history
        } else {
            throw new Error(response.error || 'Failed to reject document');
        }
    } catch (error) {
        console.error('Reject document error:', error);
        showError(error.message || 'Failed to reject document');
    }
}

async function saveVerification() {
    const status = document.querySelector('input[name="verificationStatus"]:checked')?.value || 'PENDING';
    const notes = document.getElementById('verificationNotes')?.value || '';
    const flagged = document.getElementById('flagSuspicious')?.checked || false;

    if (status === 'PENDING') {
        showError('Please select a verification status (Approve or Reject)');
        return;
    }

    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        const response = await apiClient.post(`/api/vehicles/transfer/requests/${currentRequestId}/documents/${currentDocumentId}/verify`, {
            status: status,
            notes: notes,
            checklist: getChecklistData(),
            flagged: flagged
        });
        
        if (response.success) {
            showSuccess('Verification saved successfully');
            loadDocument(currentDocumentId); // Reload to update status
            loadVerificationHistory(); // Reload verification history
            
            // Clear form
            document.getElementById('verificationNotes').value = '';
            document.getElementById('flagSuspicious').checked = false;
            document.querySelectorAll('#check1, #check2, #check3, #check4, #check5').forEach(cb => cb.checked = false);
        } else {
            throw new Error(response.error || 'Failed to save verification');
        }
    } catch (error) {
        console.error('Save verification error:', error);
        showError(error.message || 'Failed to save verification');
    }
}

function getChecklistData() {
    return {
        clearReadable: document.getElementById('check1')?.checked || false,
        requiredInfoPresent: document.getElementById('check2')?.checked || false,
        signaturesValid: document.getElementById('check3')?.checked || false,
        datesValid: document.getElementById('check4')?.checked || false,
        matchesRequest: document.getElementById('check5')?.checked || false
    };
}

function getDocumentTypeLabel(type) {
    const labels = {
        'DEED_OF_SALE': 'Legal Document',
        'SELLER_ID': 'Identification',
        'BUYER_ID': 'Identification',
        'OR': 'Vehicle Registration',
        'CR': 'Vehicle Registration',
        'OR_CR': 'Vehicle Registration',
        'EMISSION': 'Test Certificate'
    };
    return labels[type] || 'Document';
}

function getStatusClass(status) {
    const statusClasses = {
        'PENDING': 'pending',
        'REVIEWING': 'reviewing',
        'APPROVED': 'approved',
        'REJECTED': 'rejected',
        'COMPLETED': 'completed',
        'FORWARDED_TO_HPG': 'forwarded'
    };
    return statusClasses[status] || 'pending';
}

function getVerificationStatusClass(status) {
    const statusClasses = {
        'APPROVED': 'approved',
        'REJECTED': 'rejected',
        'PENDING': 'pending'
    };
    return statusClasses[status] || 'pending';
}

function showLoading() {
    const content = document.querySelector('.dashboard-content');
    if (content) {
        content.style.opacity = '0.5';
        content.style.pointerEvents = 'none';
    }
}

function hideLoading() {
    const content = document.querySelector('.dashboard-content');
    if (content) {
        content.style.opacity = '1';
        content.style.pointerEvents = 'auto';
    }
}

function showSuccess(message) {
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show(message, 'success');
    } else {
        alert(message);
    }
}

function showError(message) {
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show(message, 'error');
    } else {
        alert(message);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available for inline onclick handlers
window.loadDocument = loadDocument;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.toggleFullscreen = toggleFullscreen;
window.approveDocument = approveDocument;
window.rejectDocument = rejectDocument;
window.saveVerification = saveVerification;

