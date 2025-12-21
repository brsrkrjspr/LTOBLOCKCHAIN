// Admin Transfer Verification - JavaScript
// Handles document verification for transfer requests

// Prevent duplicate declaration of currentZoom
if (typeof window.currentZoom === 'undefined') {
    window.currentZoom = 100;
}

document.addEventListener('DOMContentLoaded', function() {
    initializeTransferVerification();
});

let currentTransferRequest = null;
let currentRequestId = null;
let currentDocumentId = null;
let currentZoom = window.currentZoom || 100; // Use existing or default
let verificationHistory = [];

// Map document type identifiers to database types
function mapDocumentTypeIdentifier(identifier) {
    const typeMap = {
        'deed-of-sale': 'deed_of_sale',
        'seller-id': 'seller_id',
        'buyer-id': 'buyer_id',
        'or-cr': 'or_cr',
        'emission': 'emission_cert'
    };
    return typeMap[identifier] || identifier;
}

// Find document by type from transfer request documents
function findDocumentByType(docType) {
    if (!currentTransferRequest || !currentTransferRequest.documents) {
        return null;
    }
    
    const mappedType = mapDocumentTypeIdentifier(docType);
    const documents = currentTransferRequest.documents;
    
    // Try exact match first
    let doc = documents.find(d => {
        const dbType = (d.document_type || d.type || '').toLowerCase();
        return dbType === mappedType.toLowerCase();
    });
    
    // If not found, try partial match (e.g., 'or_cr' matches 'OR_CR')
    if (!doc) {
        doc = documents.find(d => {
            const dbType = (d.document_type || d.type || '').toLowerCase();
            return dbType.includes(mappedType.toLowerCase()) || mappedType.toLowerCase().includes(dbType);
        });
    }
    
    return doc ? (doc.document_id || doc.id) : null;
}

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
        
        // Populate document selector with actual document IDs
        populateDocumentSelector(currentTransferRequest.documents || []);

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

// Populate document selector with actual document IDs
function populateDocumentSelector(documents) {
    const selector = document.getElementById('documentSelector');
    if (!selector) return;
    
    // Clear existing options except the first one
    while (selector.options.length > 1) {
        selector.remove(1);
    }
    
    // Create a map of document types to document IDs
    const typeToDocMap = {};
    documents.forEach(doc => {
        const docId = doc.document_id || doc.id;
        const docType = (doc.document_type || doc.type || '').toLowerCase();
        if (docId && docType) {
            // Map various type formats
            if (docType.includes('deed') || docType.includes('sale')) {
                typeToDocMap['deed-of-sale'] = docId;
            }
            if (docType.includes('seller') && docType.includes('id')) {
                typeToDocMap['seller-id'] = docId;
            }
            if (docType.includes('buyer') && docType.includes('id')) {
                typeToDocMap['buyer-id'] = docId;
            }
            if (docType.includes('or') || docType.includes('cr')) {
                typeToDocMap['or-cr'] = docId;
            }
            if (docType.includes('emission')) {
                typeToDocMap['emission'] = docId;
            }
        }
    });
    
    // Add options for available documents
    const optionLabels = {
        'deed-of-sale': 'Deed of Sale',
        'seller-id': 'Seller Valid ID',
        'buyer-id': 'Buyer Valid ID',
        'or-cr': 'Latest OR/CR',
        'emission': 'Emission Test Certificate (Optional)'
    };
    
    Object.entries(optionLabels).forEach(([value, label]) => {
        if (typeToDocMap[value]) {
            const option = document.createElement('option');
            option.value = typeToDocMap[value]; // Use actual document ID
            option.textContent = label;
            selector.appendChild(option);
        }
    });
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

async function loadDocument(docIdOrType) {
    try {
        if (!docIdOrType) {
            throw new Error('Document ID or type is required');
        }
        
        // Check if it's a document type identifier (not a UUID or numeric ID)
        let docId = docIdOrType;
        const isUUID = docId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        const isNumeric = docId.match(/^[0-9]+$/);
        
        // If it's not a UUID or numeric ID, treat it as a document type identifier
        if (!isUUID && !isNumeric) {
            docId = findDocumentByType(docIdOrType);
            if (!docId) {
                throw new Error(`Document of type "${docIdOrType}" not found in this transfer request`);
            }
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
        
        // Update document selector to show current selection
        const selector = document.getElementById('documentSelector');
        if (selector) {
            selector.value = docId;
        }

        // Load verification history for this document
        await loadDocumentVerificationHistory(docId);

        // Pre-select radio button based on existing verification
        const existingVerification = verificationHistory.find(v => v.document_id === docId);
        if (existingVerification) {
            const status = existingVerification.status;
            if (status === 'APPROVED') {
                const approvedRadio = document.getElementById('statusApproved');
                if (approvedRadio) {
                    approvedRadio.checked = true;
                }
            } else if (status === 'REJECTED') {
                const rejectedRadio = document.getElementById('statusRejected');
                if (rejectedRadio) {
                    rejectedRadio.checked = true;
                }
            }
        }

        hideLoading();

    } catch (error) {
        console.error('Load document error:', {
            documentId: docIdOrType,
            error: error.message,
            stack: error.stack
        });
        
        // Provide more specific error message
        let errorMessage = 'Failed to load document';
        if (error.message.includes('404') || error.message.includes('not found')) {
            errorMessage = `Document not found. ${docIdOrType}`;
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

    const docType = doc.document_type || doc.type || doc.documentType || 'Document';
    const docName = doc.originalName || doc.original_name || doc.name || doc.filename || docType;

    if (currentDocNameEl) currentDocNameEl.textContent = docName;
    if (currentDocTypeEl) currentDocTypeEl.textContent = getDocumentTypeLabel(docType);
    if (docTypeDisplayEl) docTypeDisplayEl.innerHTML = `<strong>${escapeHtml(getDocumentTypeLabel(docType))}</strong>`;

    if (!documentViewerEl) return;

    // Always use the authenticated view endpoint
    const viewUrl = `/api/documents/${doc.id}/view`;
    const mimeType = doc.mime_type || doc.mimeType || '';
    const fileName = (doc.original_name || doc.filename || '').toLowerCase();

    // Determine file type
    const isImage = mimeType.startsWith('image/') || 
                   fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    const isPdf = mimeType === 'application/pdf' || 
                 fileName.endsWith('.pdf');

    if (isImage) {
        // For images - load via fetch with auth, then display
        documentViewerEl.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #3498db;"></i>
                <p>Loading image...</p>
            </div>
        `;
        loadAuthenticatedImage(doc.id, docName, documentViewerEl);
    } else if (isPdf) {
        // For PDFs - load via fetch with auth, then display
        documentViewerEl.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #3498db;"></i>
                <p>Loading PDF...</p>
            </div>
        `;
        loadAuthenticatedPdf(doc.id, docName, documentViewerEl);
    } else {
        // Other types - show download button with authenticated handler
        documentViewerEl.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <i class="fas fa-file-alt" style="font-size: 3rem; color: #7f8c8d;"></i>
                <p>Preview not available for this file type</p>
                <p style="color: #7f8c8d; font-size: 0.9rem;">${escapeHtml(mimeType || 'Unknown type')}</p>
                <button onclick="openDocumentAuthenticated('${doc.id}', '${escapeHtml(docName)}')" class="btn-primary" style="margin-top: 1rem;">
                    <i class="fas fa-external-link-alt"></i> Open Document
                </button>
                <button onclick="downloadDocumentAuthenticated('${doc.id}', '${escapeHtml(docName)}')" class="btn-secondary" style="margin-top: 0.5rem;">
                    <i class="fas fa-download"></i> Download
                </button>
            </div>
        `;
    }

    // Reset zoom
    currentZoom = 100;
    updateZoom();
}

// Load image with authentication
async function loadAuthenticatedImage(documentId, docName, containerEl) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`/api/documents/${documentId}/view`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Failed to load image: ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        containerEl.innerHTML = `
            <img src="${blobUrl}" alt="${escapeHtml(docName)}" 
                 style="max-width: 100%; height: auto; display: block; margin: 0 auto;"
                 onload="URL.revokeObjectURL(this.src)">
        `;
    } catch (error) {
        console.error('Error loading image:', error);
        containerEl.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #e74c3c;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem;"></i>
                <p>Failed to load image: ${escapeHtml(error.message)}</p>
                <button onclick="openDocumentAuthenticated('${documentId}', '${escapeHtml(docName)}')" class="btn-primary" style="margin-top: 1rem;">
                    Try Opening in New Tab
                </button>
            </div>
        `;
    }
}

// Load PDF with authentication
async function loadAuthenticatedPdf(documentId, docName, containerEl) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch(`/api/documents/${documentId}/view`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Failed to load PDF: ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        containerEl.innerHTML = `
            <iframe src="${blobUrl}" 
                    style="width: 100%; height: 600px; border: none;"
                    onload="setTimeout(() => URL.revokeObjectURL('${blobUrl}'), 60000)"></iframe>
        `;
    } catch (error) {
        console.error('Error loading PDF:', error);
        containerEl.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #e74c3c;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem;"></i>
                <p>Failed to load PDF: ${escapeHtml(error.message)}</p>
                <button onclick="openDocumentAuthenticated('${documentId}', '${escapeHtml(docName)}')" class="btn-primary" style="margin-top: 1rem;">
                    Open in New Tab
                </button>
            </div>
        `;
    }
}

// Open document in new tab with authentication
async function openDocumentAuthenticated(documentId, docName) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        if (!token) {
            showError('Please log in to view documents');
            return;
        }

        showLoading();

        const response = await fetch(`/api/documents/${documentId}/view`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to load document');
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // Open in new tab
        window.open(blobUrl, '_blank');
        
        // Clean up blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

        hideLoading();
    } catch (error) {
        console.error('Error opening document:', error);
        showError(error.message || 'Failed to open document');
        hideLoading();
    }
}

// Download document with authentication
async function downloadDocumentAuthenticated(documentId, docName) {
    try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        if (!token) {
            showError('Please log in to download documents');
            return;
        }

        showLoading();

        const response = await fetch(`/api/documents/${documentId}/view`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Failed to download document');
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = docName || 'document';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(blobUrl);
        hideLoading();
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Document downloaded', 'success');
        }
    } catch (error) {
        console.error('Error downloading document:', error);
        showError(error.message || 'Failed to download document');
        hideLoading();
    }
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

function setStatusAndSave(status) {
    // Set the radio button
    const radio = document.getElementById(status === 'APPROVED' ? 'statusApproved' : 'statusRejected');
    if (radio) {
        radio.checked = true;
    }
    
    // If rejecting, prompt for reason
    if (status === 'REJECTED') {
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) {
            radio.checked = false;
            return;
        }
        // Add reason to notes if notes field is empty
        const notesField = document.getElementById('verificationNotes');
        if (notesField && !notesField.value.trim()) {
            notesField.value = reason;
        }
    }
    
    // Call saveVerification
    saveVerification();
}

async function approveDocument() {
    if (!confirm('Approve this document?')) {
        return;
    }
    setStatusAndSave('APPROVED');
}

async function rejectDocument() {
    setStatusAndSave('REJECTED');
}

async function saveVerification() {
    if (!currentDocumentId) {
        showError('Please select a document to verify');
        return;
    }
    
    const statusRadio = document.querySelector('input[name="verificationStatus"]:checked');
    if (!statusRadio) {
        showError('Please select a verification status (Approve or Reject)');
        return;
    }
    
    const status = statusRadio.value;
    const notes = document.getElementById('verificationNotes')?.value || '';
    const flagged = document.getElementById('flagSuspicious')?.checked || false;

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
            // Clear radio buttons
            document.querySelectorAll('input[name="verificationStatus"]').forEach(radio => radio.checked = false);
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
window.openDocumentAuthenticated = openDocumentAuthenticated;
window.downloadDocumentAuthenticated = downloadDocumentAuthenticated;
window.loadAuthenticatedImage = loadAuthenticatedImage;
window.loadAuthenticatedPdf = loadAuthenticatedPdf;

