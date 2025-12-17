// Admin Transfer Details - JavaScript
// Handles viewing detailed transfer request information

document.addEventListener('DOMContentLoaded', function() {
    initializeTransferDetails();
});

let currentTransferRequest = null;
let currentRequestId = null;

function initializeTransferDetails() {
    // Get request ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentRequestId = urlParams.get('id');

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

    // Logout
    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                if (typeof AuthUtils !== 'undefined') {
                    AuthUtils.logout();
                } else {
                    localStorage.clear();
                    window.location.href = 'index.html';
                }
            }
        });
    }

    // Load transfer request details
    loadTransferRequestDetails();
}

async function loadTransferRequestDetails() {
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
        
        // Display transfer request details
        renderTransferRequestDetails(currentTransferRequest);

        hideLoading();

    } catch (error) {
        console.error('Load transfer request details error:', error);
        showError(error.message || 'Failed to load transfer request details');
        hideLoading();
    }
}

function renderTransferRequestDetails(request) {
    // Update request header
    const requestIdEl = document.getElementById('requestId');
    const requestStatusEl = document.getElementById('requestStatus');
    const requestDateEl = document.getElementById('requestDate');
    
    if (requestIdEl) requestIdEl.textContent = request.id.substring(0, 8) + '...';
    if (requestStatusEl) {
        requestStatusEl.textContent = request.status || 'PENDING';
        requestStatusEl.className = `status-badge ${getStatusClass(request.status)}`;
    }
    if (requestDateEl) {
        requestDateEl.textContent = new Date(request.submitted_at || request.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Update seller information
    renderSellerInfo(request);

    // Update buyer information
    renderBuyerInfo(request);

    // Update vehicle information
    renderVehicleInfo(request);

    // Update documents
    renderDocuments(request.documents || []);

    // Update action buttons
    updateActionButtons(request);
}

function renderSellerInfo(request) {
    const sellerNameEl = document.querySelector('[data-field="seller-name"]');
    const sellerContactEl = document.querySelector('[data-field="seller-contact"]');
    const sellerEmailEl = document.querySelector('[data-field="seller-email"]');
    const sellerAddressEl = document.querySelector('[data-field="seller-address"]');
    const sellerIdEl = document.querySelector('[data-field="seller-id"]');

    const seller = request.seller || request.seller_info || {};
    const sellerName = seller.name || seller.first_name + ' ' + seller.last_name || 'N/A';
    const sellerContact = seller.phone || seller.contact_number || 'N/A';
    const sellerEmail = seller.email || 'N/A';
    const sellerAddress = seller.address || 'N/A';

    if (sellerNameEl) sellerNameEl.textContent = sellerName;
    if (sellerContactEl) sellerContactEl.textContent = sellerContact;
    if (sellerEmailEl) sellerEmailEl.textContent = sellerEmail;
    if (sellerAddressEl) sellerAddressEl.textContent = sellerAddress;

    // Find seller ID document
    const sellerIdDoc = (request.documents || []).find(doc => 
        doc.document_type === 'SELLER_ID' || doc.type === 'seller_id'
    );
    if (sellerIdEl && sellerIdDoc) {
        sellerIdEl.innerHTML = `
            <button class="btn-secondary btn-sm" onclick="viewDocument('${sellerIdDoc.id}')">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn-secondary btn-sm" onclick="downloadDocument('${sellerIdDoc.id}')">
                <i class="fas fa-download"></i> Download
            </button>
        `;
    }
}

function renderBuyerInfo(request) {
    const buyerNameEl = document.querySelector('[data-field="buyer-name"]');
    const buyerContactEl = document.querySelector('[data-field="buyer-contact"]');
    const buyerEmailEl = document.querySelector('[data-field="buyer-email"]');
    const buyerAddressEl = document.querySelector('[data-field="buyer-address"]');
    const buyerIdEl = document.querySelector('[data-field="buyer-id"]');

    const buyer = request.buyer || request.buyer_info || {};
    const buyerName = buyer.name || buyer.first_name + ' ' + buyer.last_name || 'N/A';
    const buyerContact = buyer.phone || buyer.contact_number || 'N/A';
    const buyerEmail = buyer.email || 'N/A';
    const buyerAddress = buyer.address || 'N/A';

    if (buyerNameEl) buyerNameEl.textContent = buyerName;
    if (buyerContactEl) buyerContactEl.textContent = buyerContact;
    if (buyerEmailEl) buyerEmailEl.textContent = buyerEmail;
    if (buyerAddressEl) buyerAddressEl.textContent = buyerAddress;

    // Find buyer ID document
    const buyerIdDoc = (request.documents || []).find(doc => 
        doc.document_type === 'BUYER_ID' || doc.type === 'buyer_id'
    );
    if (buyerIdEl && buyerIdDoc) {
        buyerIdEl.innerHTML = `
            <button class="btn-secondary btn-sm" onclick="viewDocument('${buyerIdDoc.id}')">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn-secondary btn-sm" onclick="downloadDocument('${buyerIdDoc.id}')">
                <i class="fas fa-download"></i> Download
            </button>
        `;
    }
}

function renderVehicleInfo(request) {
    const vehicle = request.vehicle || {};
    const plateNumberEl = document.querySelector('[data-field="plate-number"]');
    const engineNumberEl = document.querySelector('[data-field="engine-number"]');
    const chassisNumberEl = document.querySelector('[data-field="chassis-number"]');
    const vehicleTypeEl = document.querySelector('[data-field="vehicle-type"]');
    const makeModelEl = document.querySelector('[data-field="make-model"]');
    const yearModelEl = document.querySelector('[data-field="year-model"]');
    const orDocEl = document.querySelector('[data-field="or-doc"]');
    const crDocEl = document.querySelector('[data-field="cr-doc"]');

    if (plateNumberEl) plateNumberEl.textContent = vehicle.plate_number || vehicle.plateNumber || 'N/A';
    if (engineNumberEl) engineNumberEl.textContent = vehicle.engine_number || vehicle.engineNumber || 'N/A';
    if (chassisNumberEl) chassisNumberEl.textContent = vehicle.chassis_number || vehicle.chassisNumber || 'N/A';
    if (vehicleTypeEl) vehicleTypeEl.textContent = vehicle.vehicle_type || vehicle.vehicleType || 'N/A';
    if (makeModelEl) makeModelEl.textContent = `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'N/A';
    if (yearModelEl) yearModelEl.textContent = vehicle.year || 'N/A';

    // Find OR/CR documents
    const orDoc = (request.documents || []).find(doc => 
        doc.document_type === 'OR' || doc.type === 'or'
    );
    const crDoc = (request.documents || []).find(doc => 
        doc.document_type === 'CR' || doc.type === 'cr'
    );

    if (orDocEl && orDoc) {
        orDocEl.innerHTML = `
            <button class="btn-secondary btn-sm" onclick="viewDocument('${orDoc.id}')">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn-secondary btn-sm" onclick="downloadDocument('${orDoc.id}')">
                <i class="fas fa-download"></i> Download
            </button>
        `;
    }

    if (crDocEl && crDoc) {
        crDocEl.innerHTML = `
            <button class="btn-secondary btn-sm" onclick="viewDocument('${crDoc.id}')">
                <i class="fas fa-eye"></i> View
            </button>
            <button class="btn-secondary btn-sm" onclick="downloadDocument('${crDoc.id}')">
                <i class="fas fa-download"></i> Download
            </button>
        `;
    }
}

function renderDocuments(documents) {
    const documentsContainer = document.querySelector('.documents-grid');
    if (!documentsContainer) return;

    if (documents.length === 0) {
        documentsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-alt"></i>
                <p>No documents uploaded</p>
            </div>
        `;
        return;
    }

    documentsContainer.innerHTML = documents.map(doc => {
        const docType = doc.document_type || doc.type || 'Document';
        const docName = doc.name || doc.filename || docType;
        const docTypeLabel = getDocumentTypeLabel(docType);

        return `
            <div class="document-card">
                <div class="document-icon">
                    <i class="fas fa-file-contract"></i>
                </div>
                <div class="document-info">
                    <h4>${escapeHtml(docName)}</h4>
                    <p class="document-type">${escapeHtml(docTypeLabel)}</p>
                </div>
                <div class="document-actions">
                    <button class="btn-secondary btn-sm" onclick="viewDocument('${doc.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-secondary btn-sm" onclick="downloadDocument('${doc.id}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        `;
    }).join('');
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

function updateActionButtons(request) {
    const status = request.status || 'PENDING';
    const actionButtons = document.querySelector('.action-buttons');
    
    if (!actionButtons) return;

    // Clear existing buttons
    actionButtons.innerHTML = '';

    if (status === 'PENDING' || status === 'REVIEWING') {
        actionButtons.innerHTML = `
            <button class="btn-success" onclick="approveTransfer()">
                <i class="fas fa-check"></i> Approve Transfer
            </button>
            <button class="btn-danger" onclick="rejectTransfer()">
                <i class="fas fa-times"></i> Reject Transfer
            </button>
            <a href="admin-transfer-verification.html?id=${currentRequestId}" class="btn-primary">
                <i class="fas fa-clipboard-check"></i> Verify Documents
            </a>
        `;
    } else {
        actionButtons.innerHTML = `
            <a href="admin-transfer-verification.html?id=${currentRequestId}" class="btn-secondary">
                <i class="fas fa-clipboard-check"></i> View Verification
            </a>
        `;
    }
}

async function viewDocument(docId) {
    try {
        // Use DocumentModal if available for better in-page viewing
        if (typeof DocumentModal !== 'undefined') {
            DocumentModal.view({ id: docId });
            return;
        }
        
        // Fallback: Open document viewer in new tab
        window.open(`document-viewer.html?id=${docId}`, '_blank');

    } catch (error) {
        console.error('View document error:', error);
        showError(error.message || 'Failed to view document');
    }
}

async function downloadDocument(docId) {
    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        // Download document
        const response = await apiClient.get(`/api/documents/${docId}/download`, {
            responseType: 'blob'
        });
        
        if (!response.success) {
            throw new Error(response.error || 'Failed to download document');
        }

        // Create download link
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.filename || 'document';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showSuccess('Document downloaded successfully');

    } catch (error) {
        console.error('Download document error:', error);
        showError(error.message || 'Failed to download document');
    }
}

async function approveTransfer() {
    if (!confirm('Are you sure you want to approve this transfer request?')) {
        return;
    }

    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        const response = await apiClient.post(`/api/vehicles/transfer/requests/${currentRequestId}/approve`, {});
        
        if (response.success) {
            showSuccess('Transfer request approved successfully');
            loadTransferRequestDetails(); // Reload to update status
        } else {
            throw new Error(response.error || 'Failed to approve transfer request');
        }
    } catch (error) {
        console.error('Approve transfer error:', error);
        showError(error.message || 'Failed to approve transfer request');
    }
}

async function rejectTransfer() {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) {
        return;
    }

    try {
        // Get apiClient instance
        const apiClient = window.apiClient || new APIClient();

        const response = await apiClient.post(`/api/vehicles/transfer/requests/${currentRequestId}/reject`, {
            reason: reason
        });
        
        if (response.success) {
            showSuccess('Transfer request rejected');
            loadTransferRequestDetails(); // Reload to update status
        } else {
            throw new Error(response.error || 'Failed to reject transfer request');
        }
    } catch (error) {
        console.error('Reject transfer error:', error);
        showError(error.message || 'Failed to reject transfer request');
    }
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
window.viewDocument = viewDocument;
window.downloadDocument = downloadDocument;
window.approveTransfer = approveTransfer;
window.rejectTransfer = rejectTransfer;

