// Insurance Verifier Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // SECURITY: Require authentication before initializing dashboard
    if (typeof AuthUtils !== 'undefined') {
        const isAuthDisabled = typeof window !== 'undefined' && window.DISABLE_AUTH === true;
        
        if (!isAuthDisabled) {
            // Production mode: Require authentication
            if (!AuthUtils.requireAuth()) {
                return; // Redirect to login page
            }
            
            // Verify insurance_verifier role
            if (!AuthUtils.hasRole('insurance_verifier')) {
                console.warn('❌ Access denied: Insurance verifier role required');
                showNotification('Access denied. Insurance verifier role required. Redirecting to login...', 'error');
                setTimeout(() => {
                    window.location.href = 'login-signup.html?message=Insurance verifier access required';
                }, 2000);
                return;
            }
        }
    }
    
    initializeInsuranceVerifierDashboard();
});

function initializeInsuranceVerifierDashboard() {
    // Initialize dashboard functionality
    updateInsuranceStats();
    loadInsuranceVerificationTasks();
    
    // Set up auto-refresh
    setInterval(updateInsuranceStats, 60000); // Update every minute
    setInterval(loadInsuranceVerificationTasks, 30000); // Update tasks every 30 seconds
}

async function updateInsuranceStats() {
    try {
        // Call API to get insurance dashboard statistics
        let stats = {
            assignedTasks: 0,
            completedToday: 0,
            completedThisWeek: 0
        };

        if (typeof APIClient !== 'undefined') {
            const apiClient = new APIClient();
            const response = await apiClient.get('/api/insurance/stats');
            
            if (response && response.success && response.stats) {
                stats = response.stats;
            }
        } else if (typeof window.apiClient !== 'undefined') {
            const response = await window.apiClient.get('/api/insurance/stats');
            
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
                // Accuracy Rate stays as is (98%)
            }
        });
    } catch (error) {
        console.error('Error loading insurance stats:', error);
        // Fallback: show dashes on error
        const statCards = document.querySelectorAll('.stat-card .stat-number');
        statCards.forEach((card, index) => {
            if (index < 3) { // Don't change accuracy rate
                card.textContent = '-';
            }
        });
    }
}

let allInsuranceRequests = [];
let currentInsuranceStatusFilter = 'all';

async function loadInsuranceVerificationTasks() {
    const tbody = document.getElementById('insuranceVerificationTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading verification requests...</td></tr>';
    
    try {
        if (typeof APIClient !== 'undefined') {
            const apiClient = new APIClient();
            // load all statuses to enable filtering
            const response = await apiClient.get('/api/insurance/requests');
            
            if (response && response.success && response.requests) {
                allInsuranceRequests = response.requests;
                renderFilteredInsuranceRequests();
            } else {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #e74c3c;">Failed to load requests. Please try again.</td></tr>';
            }
        } else {
            const applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
            const applicationsWithInsurance = applications.filter(app => app.documents && app.documents.insuranceCert);
            allInsuranceRequests = applicationsWithInsurance;
            renderFilteredInsuranceRequests();
        }
    } catch (error) {
        console.error('Error loading insurance verification tasks:', error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #e74c3c;">Error: ${error.message || 'Failed to load requests'}</td></tr>`;
    }
}

function renderFilteredInsuranceRequests() {
    const tbody = document.getElementById('insuranceVerificationTableBody');
    if (!tbody) return;

    let filtered = allInsuranceRequests;
    if (currentInsuranceStatusFilter !== 'all') {
        filtered = allInsuranceRequests.filter(r => (r.status || '').toLowerCase() === currentInsuranceStatusFilter.toLowerCase());
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
                    No ${currentInsuranceStatusFilter === 'all' ? '' : currentInsuranceStatusFilter} requests found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';
    filtered.forEach(req => {
        const row = createInsuranceVerificationRowFromRequest(req);
        tbody.appendChild(row);
    });
}

function filterInsuranceByStatus(status, btn) {
    currentInsuranceStatusFilter = status;
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderFilteredInsuranceRequests();
}

window.filterInsuranceByStatus = filterInsuranceByStatus;

function createInsuranceVerificationRowFromRequest(request) {
    const row = document.createElement('tr');
    const vehicle = request.vehicle || {};
    const owner = request.owner || {};
    const metadata = typeof request.metadata === 'string' ? JSON.parse(request.metadata) : (request.metadata || {});
    const requestDate = request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A';
    const status = (request.status || 'PENDING').toUpperCase();
    const docs = metadata.documents || request.documents || [];
    const docCount = docs.length;
    const isProcessed = ['APPROVED', 'COMPLETED', 'REJECTED'].includes(status);
    
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
                <button class="btn-success btn-sm" onclick="approveInsurance('${request.id}')">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn-danger btn-sm" onclick="rejectInsurance('${request.id}')">
                    <i class="fas fa-times"></i> Reject
                </button>
            `;
        } else {
            // Not auto-verified - show normal buttons
            actionButtons = `
                <button class="btn-success btn-sm" onclick="approveInsurance('${request.id}')">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="btn-danger btn-sm" onclick="rejectInsurance('${request.id}')">
                    <i class="fas fa-times"></i> Reject
                </button>
            `;
        }
    }

    row.innerHTML = `
        <td><code style="font-size: 0.85rem;">${request.id.substring(0, 8)}...</code></td>
        <td>${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.year || ''}</td>
        <td>${vehicle.plate_number || 'N/A'}</td>
        <td>${owner.first_name || ''} ${owner.last_name || 'Unknown'}</td>
        <td>${requestDate}</td>
        <td><span class="status-badge status-${status.toLowerCase()}">${status}</span></td>
        <td>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                <button class="btn-secondary btn-sm" onclick="viewInsuranceRequestDetails('${request.id}')" title="View Request Details">
                    <i class="fas fa-info-circle"></i> Details
                </button>
                ${docCount > 0 ? `
                    <button class="btn-info btn-sm" onclick="viewInsuranceDocuments('${request.id}')" title="View ${docCount} document(s)">
                        <i class="fas fa-file-shield"></i> Cert
                    </button>
                ` : ''}
                ${actionButtons}
            </div>
        </td>
    `;
    return row;
}

async function viewInsuranceDocuments(requestId) {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/insurance/requests/${requestId}`);
        if (response.success && response.request) {
            const docs = response.request.documents || [];
            if (!docs.length) {
                alert('No documents available for this request');
                return;
            }
            const prepared = docs.map(doc => ({
                id: doc.id,
                filename: doc.filename || doc.original_name || 'Insurance Certificate',
                type: doc.type || doc.document_type || 'insurance_cert',
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
        console.error('Error viewing insurance documents:', error);
        alert('Failed to load documents: ' + error.message);
    }
}

window.viewInsuranceDocuments = viewInsuranceDocuments;

async function viewInsuranceRequestDetails(requestId) {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/insurance/requests/${requestId}`);
        if (response.success && response.request) {
            showInsuranceRequestDetailsModal(response.request);
        } else {
            throw new Error(response.error || 'Failed to load request');
        }
    } catch (error) {
        console.error('Error viewing insurance request:', error);
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Failed to load request: ' + error.message, 'error');
        } else {
            alert('Failed to load request: ' + error.message);
        }
    }
}

function showInsuranceRequestDetailsModal(request) {
    const vehicle = request.vehicle || {};
    const metadata = typeof request.metadata === 'string' ? JSON.parse(request.metadata) : (request.metadata || {});
    const status = (request.status || 'PENDING').toUpperCase();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';

    modal.innerHTML = `
        <div class="modal-content" style="background: white; border-radius: 16px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
            <div class="modal-header" style="padding: 1.5rem; border-bottom: 2px solid #e9ecef; display: flex; align-items: center; justify-content: space-between; background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); border-radius: 16px 16px 0 0;">
                <h3 style="margin: 0; color: white; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-file-shield"></i> Insurance Request Details
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
                ${(request.documents?.length > 0 || metadata.documents?.length > 0) ? `
                    <button onclick="viewInsuranceDocuments('${request.id}'); this.closest('.modal').remove();" class="btn-primary">
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

window.viewInsuranceRequestDetails = viewInsuranceRequestDetails;


async function approveInsurance(requestId) {
    if (!confirm('Are you sure you want to approve this insurance certificate?')) {
        return;
    }
    
    try {
        const apiClient = typeof APIClient !== 'undefined' ? new APIClient() : window.apiClient;
        if (!apiClient) {
            throw new Error('API client not available');
        }

        const response = await apiClient.post('/api/insurance/verify/approve', {
            requestId: requestId,
            notes: 'Insurance certificate approved by verifier'
        });
        
        if (response && response.success) {
            if (typeof ToastNotification !== 'undefined') {
                ToastNotification.show('Insurance verification approved successfully!', 'success');
            } else {
                showNotification('Insurance verification approved successfully!', 'success');
            }
            
            // Reload the verification tasks
            loadInsuranceVerificationTasks();
        } else {
            throw new Error(response?.error || 'Failed to approve');
        }
    } catch (error) {
        console.error('Error approving insurance:', error);
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Failed to approve insurance: ' + error.message, 'error');
        } else {
            showNotification('Failed to approve insurance: ' + error.message, 'error');
        }
    }
}

async function rejectInsurance(requestId) {
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason || !reason.trim()) {
        return;
    }
    
    try {
        const apiClient = typeof APIClient !== 'undefined' ? new APIClient() : window.apiClient;
        if (!apiClient) {
            throw new Error('API client not available');
        }

        const response = await apiClient.post('/api/insurance/verify/reject', {
            requestId: requestId,
            reason: reason
        });
        
        if (response && response.success) {
            if (typeof ToastNotification !== 'undefined') {
                ToastNotification.show('Insurance verification rejected.', 'warning');
            } else {
                showNotification('Insurance verification rejected.', 'warning');
            }
            
            // Reload the verification tasks
            loadInsuranceVerificationTasks();
        } else {
            throw new Error(response?.error || 'Failed to reject');
        }
    } catch (error) {
        console.error('Error rejecting insurance:', error);
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Failed to reject insurance: ' + error.message, 'error');
        } else {
            showNotification('Failed to reject insurance: ' + error.message, 'error');
        }
    }
}


// Insurance Workflow Functions
let insuranceWorkflowState = {
    requestReceived: false,
    papersUploaded: false,
    papersSent: false
};

function checkInsuranceWorkflowState() {
    const savedState = localStorage.getItem('insuranceWorkflowState');
    if (savedState) {
        insuranceWorkflowState = JSON.parse(savedState);
    }
    updateInsuranceWorkflowUI();
}

function updateInsuranceWorkflowUI() {
    const requestItem = document.getElementById('ltoInsuranceRequestItem');
    const noRequestsMsg = document.getElementById('noInsuranceRequestsMsg');
    const uploadedPreview = document.getElementById('uploadedInsurancePreview');
    const sendBtn = document.getElementById('sendInsuranceToLTOBtn');
    
    if (insuranceWorkflowState.requestReceived) {
        if (requestItem) requestItem.style.display = 'flex';
        if (noRequestsMsg) noRequestsMsg.style.display = 'none';
    } else {
        if (requestItem) requestItem.style.display = 'none';
        if (noRequestsMsg) noRequestsMsg.style.display = 'block';
    }
    
    if (insuranceWorkflowState.papersUploaded) {
        if (uploadedPreview) uploadedPreview.style.display = 'flex';
        if (sendBtn) sendBtn.disabled = false;
    } else {
        if (uploadedPreview) uploadedPreview.style.display = 'none';
        if (sendBtn) sendBtn.disabled = true;
    }
}

function saveInsuranceWorkflowState() {
    localStorage.setItem('insuranceWorkflowState', JSON.stringify(insuranceWorkflowState));
    updateInsuranceWorkflowUI();
}

function receiveInsuranceRequest() {
    insuranceWorkflowState.requestReceived = true;
    saveInsuranceWorkflowState();
    
    showNotification('Request received from LTO for Proof of Insurance', 'success');
    const btn = document.getElementById('receiveInsuranceRequestBtn');
    if (btn) {
        btn.textContent = 'Request Received';
        btn.disabled = true;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success');
    }
}

function uploadInsurancePapers(event) {
    event.preventDefault();
    const fileInput = document.getElementById('insuranceFile');
    const notes = document.getElementById('insuranceNotes').value;
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showNotification('Please select a file to upload', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    insuranceWorkflowState.papersUploaded = true;
    insuranceWorkflowState.uploadedFileName = file.name;
    insuranceWorkflowState.uploadedFileDate = new Date().toLocaleString();
    saveInsuranceWorkflowState();
    
    // Update preview
    const previewName = document.getElementById('previewInsuranceFileName');
    const previewDate = document.getElementById('previewInsuranceFileDate');
    if (previewName) previewName.textContent = file.name;
    if (previewDate) previewDate.textContent = `Uploaded: ${insuranceWorkflowState.uploadedFileDate}`;
    
    showNotification('Insurance papers uploaded successfully', 'success');
    document.getElementById('insuranceUploadForm').reset();
}

function sendInsuranceToLTO() {
    if (!insuranceWorkflowState.papersUploaded) {
        showNotification('Please upload insurance papers first', 'error');
        return;
    }
    
    insuranceWorkflowState.papersSent = true;
    saveInsuranceWorkflowState();
    
    showNotification('Insurance papers sent to LTO successfully', 'success');
    const statusMsg = document.getElementById('sendInsuranceStatusMsg');
    const sendBtn = document.getElementById('sendInsuranceToLTOBtn');
    if (statusMsg) statusMsg.textContent = 'Papers sent to LTO on ' + new Date().toLocaleString();
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sent to LTO';
        sendBtn.classList.remove('btn-success');
        sendBtn.classList.add('btn-secondary');
    }
}

// Initialize workflow state on page load
document.addEventListener('DOMContentLoaded', function() {
    checkInsuranceWorkflowState();
});

// Notification system
function showNotification(message, type = 'info') {
    // Use ToastNotification if available, otherwise fallback
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show(message, type);
    } else {
        // Fallback notification
        alert(message);
    }
}
