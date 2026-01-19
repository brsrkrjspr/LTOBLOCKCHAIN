// Emission Verifier Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // SECURITY: Require authentication before initializing dashboard
    if (typeof AuthUtils !== 'undefined') {
        const isAuthDisabled = typeof window !== 'undefined' && window.DISABLE_AUTH === true;
        
        if (!isAuthDisabled) {
            // Production mode: Require authentication
            if (!AuthUtils.requireAuth()) {
                return; // Redirect to login page
            }
            
            // Verify emission_verifier role
            if (!AuthUtils.hasRole('emission_verifier')) {
                console.warn('❌ Access denied: Emission verifier role required');
                showNotification('Access denied. Emission verifier role required. Redirecting to login...', 'error');
                setTimeout(() => {
                    window.location.href = 'login-signup.html?message=Emission verifier access required';
                }, 2000);
                return;
            }
        }
    }
    
    initializeVerifierDashboard();
    initializeKeyboardShortcuts();
});

// Add utils script to HTML
if (!document.querySelector('script[src="js/utils.js"]')) {
    const script = document.createElement('script');
    script.src = 'js/utils.js';
    document.head.appendChild(script);
}

function initializeVerifierDashboard() {
    // Initialize dashboard functionality
    updateVerifierStats();
    initializeTaskManagement();
    
    // Set up auto-refresh
    setInterval(updateVerifierStats, 60000); // Update every minute
}

async function updateVerifierStats() {
    try {
        // Call API to get emission dashboard statistics
        let stats = {
            assignedTasks: 0,
            completedToday: 0,
            completedThisWeek: 0
        };

        if (typeof APIClient !== 'undefined') {
            const apiClient = new APIClient();
            const response = await apiClient.get('/api/emission/stats');
            
            if (response && response.success && response.stats) {
                stats = response.stats;
            }
        } else if (typeof window.apiClient !== 'undefined') {
            const response = await window.apiClient.get('/api/emission/stats');
            
            if (response && response.success && response.stats) {
                stats = response.stats;
            }
        }

        // Update stat cards - find by label text since IDs may not exist
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach(card => {
            const label = card.querySelector('.stat-label');
            const number = card.querySelector('.stat-number');
            
            if (label && number) {
                const labelText = label.textContent.trim();
                if (labelText === 'Assigned Tasks') {
                    number.textContent = stats.assignedTasks || 0;
                } else if (labelText === 'Completed Today') {
                    number.textContent = stats.completedToday || 0;
                } else if (labelText === 'This Week') {
                    number.textContent = stats.completedThisWeek || 0;
                }
                // Accuracy Rate stays as is (if present)
            }
        });
    } catch (error) {
        console.error('Error loading emission stats:', error);
        // Fallback: show dashes on error
        const statCards = document.querySelectorAll('.stat-card .stat-number');
        statCards.forEach((card, index) => {
            if (index < 3) { // Don't change accuracy rate if present
                card.textContent = '-';
            }
        });
    }
}

function initializeTaskManagement() {
    // Load emission verification requests
    loadEmissionVerificationTasks();
}

let allEmissionRequests = [];
let currentEmissionStatusFilter = 'all';

async function loadEmissionVerificationTasks() {
    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading verification requests...</td></tr>';
    
    try {
        if (typeof APIClient !== 'undefined') {
            const apiClient = new APIClient();
            // Load all requests (not only pending) for filtering
            const response = await apiClient.get('/api/emission/requests');
            
            if (response && response.success && response.requests) {
                allEmissionRequests = response.requests;
                renderFilteredEmissionRequests();
            } else {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #e74c3c;">Failed to load requests. Please try again.</td></tr>';
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">API client not available</td></tr>';
        }
    } catch (error) {
        console.error('Error loading emission verification tasks:', error);
        const tbody = document.querySelector('.table tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #e74c3c;">Error: ${error.message || 'Failed to load requests'}</td></tr>`;
        }
    }
}

function renderFilteredEmissionRequests() {
    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;

    let filtered = allEmissionRequests;
    if (currentEmissionStatusFilter !== 'all') {
        filtered = allEmissionRequests.filter(r => (r.status || '').toUpperCase() === currentEmissionStatusFilter.toUpperCase());
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    No ${currentEmissionStatusFilter === 'all' ? '' : currentEmissionStatusFilter.toLowerCase()} requests found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';
    filtered.forEach(req => {
        const row = createEmissionVerificationRow(req);
        tbody.appendChild(row);
    });

    // Update pending badge if present
    const badge = document.getElementById('pendingRequestsBadge');
    if (badge) {
        const pendingCount = allEmissionRequests.filter(r => (r.status || '').toUpperCase() === 'PENDING').length;
        badge.textContent = pendingCount;
        badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }
}

function filterEmissionByStatus(status, btn) {
    currentEmissionStatusFilter = status;
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderFilteredEmissionRequests();
}

window.filterEmissionByStatus = filterEmissionByStatus;

function createEmissionVerificationRow(request) {
    const row = document.createElement('tr');
    const vehicle = request.vehicle || {};
    const owner = request.owner || {};
    const metadata = typeof request.metadata === 'string' ? JSON.parse(request.metadata) : (request.metadata || {});
    const requestDate = request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A';
    const status = (request.status || 'PENDING').toUpperCase();

    const isProcessed = ['APPROVED', 'COMPLETED', 'REJECTED'].includes(status);
    const docs = metadata.documents || request.documents || [];
    const docCount = docs.length;
    
    // Check if auto-verified
    const autoVerified = metadata.autoVerified === true || 
                        (metadata.autoVerificationResult && metadata.autoVerificationResult.automated === true);
    const autoVerificationStatus = metadata.autoVerificationResult?.status || null;
    const autoVerificationScore = metadata.autoVerificationResult?.score || null;

    let actionButtons = '';
    if (isProcessed) {
        // Already processed - show status badge only
        if (status === 'APPROVED' || status === 'COMPLETED') {
            const badgeText = autoVerified && status === 'APPROVED' 
                ? `<i class="fas fa-robot"></i> Auto-Verified` 
                : `<i class="fas fa-check-circle"></i> Verified`;
            const badgeTitle = autoVerified && status === 'APPROVED' && autoVerificationScore
                ? `Auto-verified with score: ${autoVerificationScore}%`
                : 'Verified';
            actionButtons = `
                <span class="status-badge status-approved" style="cursor: default; display: inline-flex; align-items: center; gap: 0.25rem;" title="${badgeTitle}">
                    ${badgeText}
                </span>
            `;
        } else if (status === 'REJECTED') {
            actionButtons = `
                <span class="status-badge status-rejected" style="cursor: default; display: inline-flex; align-items: center; gap: 0.25rem;">
                    <i class="fas fa-times-circle"></i> Rejected
                </span>
            `;
        }
    } else {
        // PENDING status - check if auto-verified
        if (autoVerified && autoVerificationStatus === 'APPROVED') {
            // Auto-approved but status might not be updated yet - show auto-verified badge
            actionButtons = `
                <span class="status-badge status-approved" style="cursor: default; display: inline-flex; align-items: center; gap: 0.25rem;" title="Auto-verified and approved">
                    <i class="fas fa-robot"></i> Auto-Verified
                </span>
            `;
        } else if (autoVerified && autoVerificationStatus === 'PENDING') {
            // Auto-verified but flagged for manual review - show buttons with info
            actionButtons = `
                <span class="status-badge status-warning" style="margin-right: 0.5rem; font-size: 0.75rem;" title="Auto-verification flagged for review. Score: ${autoVerificationScore || 'N/A'}%">
                    <i class="fas fa-exclamation-triangle"></i> Review Needed
                </span>
                <button class="btn-success btn-sm" onclick="handleEmissionApproveFromRequest('${request.id}')">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn-danger btn-sm" onclick="handleEmissionRejectFromRequest('${request.id}')">
                    <i class="fas fa-times"></i> Reject
                </button>
            `;
        } else {
            // Not auto-verified - show normal buttons
            actionButtons = `
                <button class="btn-success btn-sm" onclick="handleEmissionApproveFromRequest('${request.id}')">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn-danger btn-sm" onclick="handleEmissionRejectFromRequest('${request.id}')">
                    <i class="fas fa-times"></i> Reject
                </button>
            `;
        }
    }

    row.innerHTML = `
        <td><code style="font-size: 0.85rem;">${request.id.substring(0, 8)}...</code></td>
        <td>
            <div class="vehicle-info">
                <strong>${vehicle.plate_number || metadata.vehiclePlate || 'N/A'}</strong><br>
                <small style="color: #7f8c8d;">${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.year || ''}</small>
            </div>
        </td>
        <td>${metadata.ownerName || (owner.first_name ? owner.first_name + ' ' + (owner.last_name || '') : 'Unknown')}</td>
        <td>${requestDate}</td>
        <td><span class="status-badge status-${status.toLowerCase()}">${status}</span></td>
        <td>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                <button class="btn-secondary btn-sm" onclick="viewEmissionRequestDetails('${request.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                ${docCount > 0 ? `
                    <button class="btn-info btn-sm" onclick="viewEmissionDocuments('${request.id}')">
                        <i class="fas fa-leaf"></i> Cert
                    </button>
                ` : ''}
                ${actionButtons}
            </div>
        </td>
    `;
    return row;
}

async function viewEmissionRequestDetails(requestId) {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/emission/requests/${requestId}`);
        if (response.success && response.request) {
            showEmissionDetailsModal(response.request);
        } else {
            throw new Error(response.error || 'Failed to load request');
        }
    } catch (error) {
        console.error('Error viewing emission request:', error);
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Failed to load request: ' + error.message, 'error');
        } else {
            alert('Failed to load request: ' + error.message);
        }
    }
}

async function viewEmissionDocuments(requestId) {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/emission/requests/${requestId}`);
        if (response.success && response.request) {
            const docs = response.request.documents || [];
            if (!docs.length) {
                alert('No documents available for this request');
                return;
            }
            const prepared = docs.map(doc => ({
                id: doc.id,
                filename: doc.filename || doc.original_name || 'Emission Certificate',
                type: doc.type || doc.document_type || 'emission_cert',
                document_type: doc.type || doc.document_type,
                cid: doc.cid || doc.ipfs_cid,
                url: doc.id ? `/api/documents/${doc.id}/view` :
                     (doc.cid || doc.ipfs_cid) ? `/api/documents/ipfs/${doc.cid || doc.ipfs_cid}` :
                     doc.path || doc.file_path
            }));
            if (typeof DocumentModal !== 'undefined') {
                DocumentModal.viewMultiple(prepared, 0);
            } else {
                // Strict: never open new tabs for viewing documents
                alert('Document viewer modal is not available. Please refresh the page.');
            }
        }
    } catch (error) {
        console.error('Error viewing emission documents:', error);
        alert('Failed to load documents: ' + error.message);
    }
}

function showEmissionDetailsModal(request) {
    const vehicle = request.vehicle || {};
    const metadata = typeof request.metadata === 'string' ? JSON.parse(request.metadata) : (request.metadata || {});
    const status = (request.status || 'PENDING').toUpperCase();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div class="modal-content" style="background: white; border-radius: 16px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
            <div class="modal-header" style="padding: 1.5rem; border-bottom: 2px solid #e9ecef; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #16a085 0%, #1abc9c 100%); border-radius: 16px 16px 0 0;">
                <h3 style="margin: 0; color: white; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-leaf"></i> Emission Request Details
                </h3>
                <button onclick="this.closest('.modal').remove()" style="background: rgba(255,255,255,0.2); border: none; font-size: 1.25rem; cursor: pointer; color: white; width: 36px; height: 36px; border-radius: 50%;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <div style="display: grid; gap: 1.25rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <label style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; font-weight: 600;">Request ID</label>
                            <div style="font-weight: 600; font-family: monospace; font-size: 0.9rem;">${request.id.substring(0, 12)}...</div>
                        </div>
                        <div>
                            <label style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; font-weight: 600;">Status</label>
                            <div><span class="status-badge status-${status.toLowerCase()}">${status}</span></div>
                        </div>
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; font-weight: 600;">Vehicle</label>
                        <div style="font-weight: 600; font-size: 1.1rem;">${vehicle.plate_number || metadata.vehiclePlate || 'N/A'}</div>
                        <div style="color: #7f8c8d;">${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.year || ''}</div>
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; font-weight: 600;">Owner</label>
                        <div>${metadata.ownerName || 'N/A'}</div>
                    </div>
                    <div>
                        <label style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; font-weight: 600;">Created</label>
                        <div>${request.created_at ? new Date(request.created_at).toLocaleString() : 'N/A'}</div>
                    </div>
                    ${metadata.autoVerificationResult || metadata.autoVerified ? `
                    <div style="padding: 1rem; background: ${(metadata.autoVerificationResult?.status === 'APPROVED' || metadata.autoVerified) ? '#e8f5e9' : '#fff3e0'}; border-left: 4px solid ${(metadata.autoVerificationResult?.status === 'APPROVED' || metadata.autoVerified) ? '#4caf50' : '#ff9800'}; border-radius: 4px;">
                        <label style="font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 0.5rem;">
                            <i class="fas fa-robot"></i> Auto-Verification Status
                        </label>
                        ${metadata.autoVerificationResult ? `
                            <div style="display: grid; gap: 0.5rem;">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span class="status-badge status-${metadata.autoVerificationResult.status === 'APPROVED' ? 'approved' : metadata.autoVerificationResult.status === 'REJECTED' ? 'rejected' : 'pending'}" style="font-size: 0.875rem;">
                                        ${metadata.autoVerificationResult.status === 'APPROVED' ? '<i class="fas fa-check-circle"></i> Verified' : metadata.autoVerificationResult.status === 'REJECTED' ? '<i class="fas fa-times-circle"></i> Rejected' : '<i class="fas fa-clock"></i> Pending Review'}
                                    </span>
                                    ${metadata.autoVerificationResult.score !== undefined ? `
                                        <span style="font-weight: 600; color: ${metadata.autoVerificationResult.score >= 80 ? '#4caf50' : metadata.autoVerificationResult.score >= 60 ? '#ff9800' : '#f44336'};">
                                            Score: ${metadata.autoVerificationResult.score}%
                                        </span>
                                    ` : ''}
                                </div>
                                ${metadata.autoVerificationResult.reason ? `
                                    <div style="font-size: 0.875rem; color: #666;">
                                        <strong>Reason:</strong> ${metadata.autoVerificationResult.reason}
                                    </div>
                                ` : ''}
                                ${metadata.autoVerificationResult.compositeHash ? `
                                    <div style="font-size: 0.75rem; color: #999; font-family: monospace; word-break: break-all;">
                                        Hash: ${metadata.autoVerificationResult.compositeHash.substring(0, 32)}...
                                    </div>
                                ` : ''}
                                ${metadata.autoVerificationResult.blockchainTxId ? `
                                    <div style="font-size: 0.75rem; color: #2196f3;">
                                        <i class="fas fa-link"></i> Blockchain TX: ${metadata.autoVerificationResult.blockchainTxId.substring(0, 16)}...
                                    </div>
                                ` : ''}
                            </div>
                        ` : metadata.autoVerified ? `
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span class="status-badge status-approved">
                                    <i class="fas fa-check-circle"></i> Auto-Verified & Approved
                                </span>
                                ${metadata.notes ? `
                                    <span style="font-size: 0.875rem; color: #666;">${metadata.notes}</span>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 2px solid #e9ecef; display: flex; gap: 0.5rem; justify-content: flex-end;">
                ${(request.documents?.length > 0) ? `
                    <button onclick="viewEmissionDocuments('${request.id}'); this.closest('.modal').remove();" class="btn-primary">
                        <i class="fas fa-file-image"></i> View Certificate
                    </button>
                ` : ''}
                <button onclick="this.closest('.modal').remove()" class="btn-secondary">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

window.viewEmissionRequestDetails = viewEmissionRequestDetails;
window.viewEmissionDocuments = viewEmissionDocuments;

// Wrapper functions for API-based approval/rejection
async function handleEmissionApproveFromRequest(requestId) {
    try {
        if (typeof APIClient !== 'undefined') {
            const apiClient = new APIClient();
            const response = await apiClient.post('/api/emission/verify/approve', {
                requestId: requestId,
                notes: 'Emission test approved by verifier'
            });
            
            if (response && response.success) {
                ToastNotification.show('Emission test approved successfully!', 'success');
                loadEmissionVerificationTasks(); // Reload tasks
            } else {
                throw new Error(response?.error || 'Failed to approve');
            }
        }
    } catch (error) {
        console.error('Error approving emission test:', error);
        ToastNotification.show('Failed to approve emission test: ' + error.message, 'error');
    }
}

async function handleEmissionRejectFromRequest(requestId) {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    
    try {
        if (typeof APIClient !== 'undefined') {
            const apiClient = new APIClient();
            const response = await apiClient.post('/api/emission/verify/reject', {
                requestId: requestId,
                reason: reason,
                notes: reason
            });
            
            if (response && response.success) {
                ToastNotification.show('Emission test rejected.', 'warning');
                loadEmissionVerificationTasks(); // Reload tasks
            } else {
                throw new Error(response?.error || 'Failed to reject');
            }
        }
    } catch (error) {
        console.error('Error rejecting emission test:', error);
        ToastNotification.show('Failed to reject emission test: ' + error.message, 'error');
    }
}

async function handleEmissionReviewFromRequest(requestId) {
    // Use DocumentModal instead of redirecting to new page
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/emission/requests/${requestId}`);
        if (response.success && response.request) {
            const docs = response.request.documents || [];
            if (!docs.length) {
                alert('No documents available for this request');
                return;
            }
            const prepared = docs.map(doc => ({
                id: doc.id,
                filename: doc.filename || doc.original_name || 'Emission Certificate',
                type: doc.type || doc.document_type || 'emission_cert',
                document_type: doc.type || doc.document_type,
                cid: doc.cid || doc.ipfs_cid,
                url: doc.id ? `/api/documents/${doc.id}/view` :
                     (doc.cid || doc.ipfs_cid) ? `/api/documents/ipfs/${doc.cid || doc.ipfs_cid}` :
                     doc.path || doc.file_path
            }));
            if (typeof DocumentModal !== 'undefined') {
                DocumentModal.viewMultiple(prepared, 0);
            } else {
                // Strict: never redirect/open full-page document viewers
                alert('Document viewer modal is not available. Please refresh the page.');
            }
        }
    } catch (error) {
        console.error('Error loading emission documents:', error);
        alert('Failed to load emission documents: ' + (error.message || error));
    }
}

function showNotification(message, type = 'info') {
    ToastNotification.show(message, type);
}
    const appId = row.querySelector('td:first-child').textContent;
    const vehicleInfo = row.querySelector('.vehicle-info strong')?.textContent || 'Vehicle';
    const emissionTest = row.querySelector('td:nth-child(3)')?.textContent || 'N/A';
    
    const confirmed = await ConfirmationDialog.show({
        title: 'Approve Emission Test',
        message: `Approve emission test for ${vehicleInfo} (${appId})? Test result: ${emissionTest}`,
        confirmText: 'Approve',
        cancelText: 'Cancel',
        confirmColor: '#27ae60',
        type: 'question'
    });
    
    if (confirmed) {
        const button = e.target;
        LoadingManager.show(button, 'Approving...');
        
        try {
            await new Promise(resolve => setTimeout(resolve, 800));
            
            ToastNotification.show('Emission test approved successfully!', 'success');
            
            // Update row status
            row.style.backgroundColor = '#f0f9ff';
            const approveBtn = row.querySelector('.btn-primary');
            if (approveBtn) {
                approveBtn.textContent = 'Approved';
                approveBtn.classList.remove('btn-primary');
                approveBtn.classList.add('btn-success');
                approveBtn.disabled = true;
            }
            
            // Update status badge
            const statusBadge = row.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.textContent = 'Approved';
                statusBadge.className = 'status-badge status-approved';
            }
            
            // Update stats
            updateTaskStats('approved');
        } catch (error) {
            ToastNotification.show('Failed to approve emission test. Please try again.', 'error');
        } finally {
            LoadingManager.hide(button);
        }
    }
}

async function handleEmissionReject(e) {
    const row = e.target.closest('tr');
    const appId = row.querySelector('td:first-child').textContent;
    const vehicleInfo = row.querySelector('.vehicle-info strong')?.textContent || 'Vehicle';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>Reject Emission Test</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 1rem;">Please provide a reason for rejecting emission test for ${vehicleInfo} (${appId}):</p>
                <textarea id="rejectionReason" style="width: 100%; min-height: 100px; padding: 0.75rem; border: 2px solid #ecf0f1; border-radius: 5px;" placeholder="Enter rejection reason..."></textarea>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn-danger" id="confirmReject">Reject</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    return new Promise((resolve) => {
        modal.querySelector('#confirmReject').onclick = async function() {
            const reason = document.getElementById('rejectionReason').value.trim();
            if (!reason) {
                ToastNotification.show('Please provide a reason for rejection', 'error');
                return;
            }
            
            const button = this;
            LoadingManager.show(button, 'Rejecting...');
            
            try {
                await new Promise(resolve => setTimeout(resolve, 800));
                
                ToastNotification.show(`Emission test rejected: ${reason}`, 'warning');
                
                // Update row status
                row.style.backgroundColor = '#fef2f2';
                const rejectBtn = row.querySelector('.btn-danger');
                if (rejectBtn) {
                    rejectBtn.textContent = 'Rejected';
                    rejectBtn.classList.remove('btn-danger');
                    rejectBtn.classList.add('btn-warning');
                    rejectBtn.disabled = true;
                }
                
                // Update status badge
                const statusBadge = row.querySelector('.status-badge');
                if (statusBadge) {
                    statusBadge.textContent = 'Rejected';
                    statusBadge.className = 'status-badge status-rejected';
                }
                
                // Update stats
                updateTaskStats('rejected');
                
                modal.remove();
                resolve();
            } catch (error) {
                ToastNotification.show('Failed to reject emission test. Please try again.', 'error');
            } finally {
                LoadingManager.hide(button);
            }
        };
        
        modal.querySelector('.modal-close').onclick = () => {
            modal.remove();
            resolve();
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve();
            }
        };
    });
}

async function handleEmissionReview(e) {
    const row = e.target.closest('tr');
    const appId = row.querySelector('td:first-child').textContent;
    const emissionTest = row.querySelector('td:nth-child(3)').textContent;
    
    showNotification(`Opening emission test documents for review (${appId})...`, 'info');
    
    // Try to find the request ID from the row or fetch documents directly
    // If we can't use DocumentModal, fall back to redirect
    try {
        // Try to get request ID from data attribute or find it from the appId
        const requestId = row.dataset.requestId || appId;
        
        // Try to fetch and display using DocumentModal
        if (typeof DocumentModal !== 'undefined') {
            const apiClient = window.apiClient || new APIClient();
            try {
                const response = await apiClient.get(`/api/emission/requests/${requestId}`);
                if (response.success && response.request && response.request.documents) {
                    const docs = response.request.documents.map(doc => ({
                        id: doc.id,
                        filename: doc.filename || doc.original_name || 'Emission Certificate',
                        type: doc.type || doc.document_type || 'emission_cert',
                        document_type: doc.type || doc.document_type,
                        cid: doc.cid || doc.ipfs_cid,
                        url: doc.id ? `/api/documents/${doc.id}/view` :
                             (doc.cid || doc.ipfs_cid) ? `/api/documents/ipfs/${doc.cid || doc.ipfs_cid}` :
                             doc.path || doc.file_path
                    }));
                    if (docs.length > 0) {
                        DocumentModal.viewMultiple(docs, 0);
                        return;
                    }
                }
            } catch (apiError) {
                console.warn('Could not fetch emission request, falling back to redirect:', apiError);
            }
        }
        
        // Strict: never redirect/open full-page document viewers
        alert('Document viewer modal is not available. Please refresh the page.');
    } catch (error) {
        console.error('Error in handleEmissionReview:', error);
        alert('Failed to load emission documents: ' + (error.message || error));
    }
}

function initializeEmissionReports() {
    // Initialize emission report generation
    const reportButton = document.querySelector('.dashboard-card:nth-child(2) .btn-secondary');
    if (reportButton) {
        reportButton.addEventListener('click', handleGenerateReport);
    }
}

function handleGenerateReport() {
    showNotification('Generating emission compliance report...', 'info');
    
    // Simulate report generation
    setTimeout(() => {
        showNotification('Emission compliance report generated successfully!', 'success');
        
        // In a real app, this would download the report or show it in a modal
        showReportModal();
    }, 2000);
}

function showReportModal() {
    // Create modal for emission report
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Emission Compliance Report</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="report-summary">
                    <div class="report-item">
                        <span class="report-label">Total Tests Reviewed:</span>
                        <span class="report-value">-</span>
                    </div>
                    <div class="report-item">
                        <span class="report-label">Passed Tests:</span>
                        <span class="report-value">-</span>
                    </div>
                    <div class="report-item">
                        <span class="report-label">Failed Tests:</span>
                        <span class="report-value">-</span>
                    </div>
                    <div class="report-item">
                        <span class="report-label">Average CO2 Level:</span>
                        <span class="report-value">-</span>
                    </div>
                </div>
                <div class="report-actions">
                    <button class="btn-primary" onclick="downloadReport()">Download PDF</button>
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function downloadReport() {
    showNotification('Downloading emission compliance report...', 'info');
    
    // Simulate download
    setTimeout(() => {
        showNotification('Report downloaded successfully!', 'success');
    }, 1500);
}

function updateTaskStats(action) {
    // Update task statistics based on action
    const statCards = document.querySelectorAll('.stat-card .stat-number');
    if (statCards.length >= 3) {
        if (action === 'approved' || action === 'rejected') {
            // Decrease assigned tasks
            const assignedTasks = parseInt(statCards[0].textContent);
            if (assignedTasks > 0) {
                statCards[0].textContent = assignedTasks - 1;
            }
            
            // Increase completed today
            const completedToday = parseInt(statCards[1].textContent);
            statCards[1].textContent = completedToday + 1;
        }
    }
}

function showNotification(message, type = 'info') {
    ToastNotification.show(message, type);
}

function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            window.print();
        }
    });
}

// Emission Workflow Functions
let emissionWorkflowState = {
    requestReceived: false,
    resultUploaded: false,
    resultSent: false
};

function checkEmissionWorkflowState() {
    const savedState = localStorage.getItem('emissionWorkflowState');
    if (savedState) {
        emissionWorkflowState = JSON.parse(savedState);
    }
    updateEmissionWorkflowUI();
}

function updateEmissionWorkflowUI() {
    const requestItem = document.getElementById('ltoRequestItem');
    const noRequestsMsg = document.getElementById('noRequestsMsg');
    const uploadedPreview = document.getElementById('uploadedResultPreview');
    const sendBtn = document.getElementById('sendToLTOBtn');
    
    if (emissionWorkflowState.requestReceived) {
        if (requestItem) requestItem.style.display = 'flex';
        if (noRequestsMsg) noRequestsMsg.style.display = 'none';
    } else {
        if (requestItem) requestItem.style.display = 'none';
        if (noRequestsMsg) noRequestsMsg.style.display = 'block';
    }
    
    if (emissionWorkflowState.resultUploaded) {
        if (uploadedPreview) uploadedPreview.style.display = 'flex';
        if (sendBtn) sendBtn.disabled = false;
    } else {
        if (uploadedPreview) uploadedPreview.style.display = 'none';
        if (sendBtn) sendBtn.disabled = true;
    }
}

function saveEmissionWorkflowState() {
    localStorage.setItem('emissionWorkflowState', JSON.stringify(emissionWorkflowState));
    updateEmissionWorkflowUI();
}

function receiveLTORequest() {
    emissionWorkflowState.requestReceived = true;
    saveEmissionWorkflowState();
    
    ToastNotification.show('Request received from LTO', 'success');
    document.getElementById('receiveRequestBtn').textContent = 'Request Received';
    document.getElementById('receiveRequestBtn').disabled = true;
    document.getElementById('receiveRequestBtn').classList.remove('btn-primary');
    document.getElementById('receiveRequestBtn').classList.add('btn-success');
}

function uploadEmissionResult(event) {
    event.preventDefault();
    const fileInput = document.getElementById('testResultFile');
    const notes = document.getElementById('testResultNotes').value;
    
    if (!fileInput.files || fileInput.files.length === 0) {
        ToastNotification.show('Please select a file to upload', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    emissionWorkflowState.resultUploaded = true;
    emissionWorkflowState.uploadedFileName = file.name;
    emissionWorkflowState.uploadedFileDate = new Date().toLocaleString();
    saveEmissionWorkflowState();
    
    // Update preview
    document.getElementById('previewFileName').textContent = file.name;
    document.getElementById('previewFileDate').textContent = `Uploaded: ${emissionWorkflowState.uploadedFileDate}`;
    
    ToastNotification.show('Emission test result uploaded successfully', 'success');
    document.getElementById('emissionUploadForm').reset();
}

function sendResultToLTO() {
    if (!emissionWorkflowState.resultUploaded) {
        ToastNotification.show('Please upload test result first', 'error');
        return;
    }
    
    emissionWorkflowState.resultSent = true;
    saveEmissionWorkflowState();
    
    ToastNotification.show('Emission test result sent to LTO successfully', 'success');
    document.getElementById('sendStatusMsg').textContent = 'Result sent to LTO on ' + new Date().toLocaleString();
    document.getElementById('sendToLTOBtn').disabled = true;
    document.getElementById('sendToLTOBtn').textContent = 'Sent to LTO';
    document.getElementById('sendToLTOBtn').classList.remove('btn-success');
    document.getElementById('sendToLTOBtn').classList.add('btn-secondary');
}

// Initialize workflow state on page load
document.addEventListener('DOMContentLoaded', function() {
    checkEmissionWorkflowState();
});

// Export functions for potential external use
window.VerifierDashboard = {
    updateVerifierStats,
    showNotification,
    receiveLTORequest,
    uploadEmissionResult,
    sendResultToLTO
};
