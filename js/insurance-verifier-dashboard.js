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
    initializeSummaryUpdates();
    
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
                updateInsuranceSummary(allInsuranceRequests);
            } else {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #e74c3c;">Failed to load requests. Please try again.</td></tr>';
            }
        } else {
            const applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
            const applicationsWithInsurance = applications.filter(app => app.documents && app.documents.insuranceCert);
            allInsuranceRequests = applicationsWithInsurance;
            renderFilteredInsuranceRequests();
            updateInsuranceSummary(applicationsWithInsurance);
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

    let actionButtons = '';
    if (isProcessed) {
        if (status === 'APPROVED' || status === 'COMPLETED') {
            actionButtons = `
                <span class="status-badge status-approved" style="cursor: default; display: inline-flex; align-items: center; gap: 0.25rem;">
                    <i class="fas fa-check-circle"></i> Verified
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
        actionButtons = `
            <button class="btn-success btn-sm" onclick="approveInsurance('${request.id}')">
                <i class="fas fa-check"></i> Approve
            </button>
            <button class="btn-danger btn-sm" onclick="rejectInsurance('${request.id}')">
                <i class="fas fa-times"></i> Reject
            </button>
        `;
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

function createInsuranceVerificationRow(application) {
    const row = document.createElement('tr');
    
    // Get insurance status
    const insuranceStatus = application.insuranceStatus || 'pending';
    const statusText = getInsuranceStatusText(insuranceStatus);
    const statusClass = getInsuranceStatusClass(insuranceStatus);
    
    row.innerHTML = `
        <td class="app-id-cell">${application.id}</td>
        <td class="user-info-cell">
            <div class="user-info">
                <strong>${application.owner.firstName} ${application.owner.lastName}</strong>
                <small>${application.owner.email}</small>
                <small>${application.owner.phone}</small>
            </div>
        </td>
        <td class="vehicle-info-cell">
            <div class="vehicle-info">
                <strong>${application.vehicle.make} ${application.vehicle.model}</strong>
                <small>${application.vehicle.year} • ${application.vehicle.plateNumber}</small>
                <small>Engine: ${application.vehicle.engineNumber}</small>
            </div>
        </td>
        <td class="document-info-cell">
            <div class="document-info">
                <div class="document-item">
                    <span class="document-icon">🛡️</span>
                    <span class="document-name">${application.documents.insuranceCert}</span>
                </div>
                <button class="btn-primary btn-sm" onclick="viewInsuranceDocument('${application.id}')">View Document</button>
            </div>
        </td>
        <td class="date-cell">${new Date(application.submittedDate).toLocaleDateString()}</td>
        <td class="status-cell"><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td class="actions-cell">
            <button class="btn-secondary btn-sm" onclick="viewInsuranceDetails('${application.id}')">Review</button>
            <button class="btn-success btn-sm" onclick="approveInsurance('${application.id}')" ${insuranceStatus === 'approved' ? 'disabled' : ''}>Approve</button>
            <button class="btn-danger btn-sm" onclick="rejectInsurance('${application.id}')" ${insuranceStatus === 'rejected' ? 'disabled' : ''}>Reject</button>
        </td>
    `;
    
    return row;
}

function getInsuranceStatusText(status) {
    const statusMap = {
        'pending': 'Pending Review',
        'approved': 'Approved',
        'rejected': 'Rejected',
        'under_review': 'Under Review'
    };
    return statusMap[status] || 'Pending Review';
}

function getInsuranceStatusClass(status) {
    const classMap = {
        'pending': 'status-pending',
        'approved': 'status-approved',
        'rejected': 'status-rejected',
        'under_review': 'status-processing'
    };
    return classMap[status] || 'status-pending';
}

function updateInsuranceSummary(applications) {
    const pending = applications.filter(app => !app.insuranceStatus || app.insuranceStatus === 'pending').length;
    const approved = applications.filter(app => app.insuranceStatus === 'approved').length;
    const rejected = applications.filter(app => app.insuranceStatus === 'rejected').length;
    
    // Update summary items
    const summaryItems = document.querySelectorAll('.summary-item .summary-number');
    if (summaryItems.length >= 4) {
        summaryItems[0].textContent = approved;
        summaryItems[1].textContent = pending;
        summaryItems[2].textContent = rejected;
        summaryItems[3].textContent = '₱' + (applications.length * 300000).toLocaleString();
    }
}

// Insurance verification functions
function viewInsuranceDetails(applicationId) {
    const applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    const application = applications.find(app => app.id === applicationId);
    
    if (!application) {
        showNotification('Application not found', 'error');
        return;
    }
    
    showInsuranceVerificationModal(application);
}

function showInsuranceVerificationModal(application) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
            <div class="modal-header">
                <h3>Insurance Certificate Verification - ${application.id}</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="verification-details">
                    <div class="detail-section">
                        <h4>User Information</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Name:</span>
                                <span class="detail-value">${application.owner.firstName} ${application.owner.lastName}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Email:</span>
                                <span class="detail-value">${application.owner.email}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Phone:</span>
                                <span class="detail-value">${application.owner.phone}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">ID Type:</span>
                                <span class="detail-value">${application.owner.idType}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">ID Number:</span>
                                <span class="detail-value">${application.owner.idNumber}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Vehicle Information</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">Make/Model:</span>
                                <span class="detail-value">${application.vehicle.make} ${application.vehicle.model}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Year:</span>
                                <span class="detail-value">${application.vehicle.year}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Plate Number:</span>
                                <span class="detail-value">${application.vehicle.plateNumber}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Engine Number:</span>
                                <span class="detail-value">${application.vehicle.engineNumber}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Chassis Number:</span>
                                <span class="detail-value">${application.vehicle.chassisNumber}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Insurance Certificate</h4>
                        <div class="document-verification">
                            <div class="document-item">
                                <span class="document-icon">🛡️</span>
                                <span class="document-name">${application.documents.insuranceCert}</span>
                                <button class="btn-secondary btn-sm" onclick="viewInsuranceDocument('${application.id}')">View Document</button>
                            </div>
                            <div class="verification-notes">
                                <label for="verificationNotes">Verification Notes:</label>
                                <textarea id="verificationNotes" placeholder="Add notes about the insurance certificate verification..." rows="3"></textarea>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-primary" onclick="approveInsurance('${application.id}')">Approve Insurance</button>
                <button class="btn-danger" onclick="rejectInsurance('${application.id}')">Reject Insurance</button>
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
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

function viewInsuranceDocument(applicationId) {
    const applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    const application = applications.find(app => app.id === applicationId);
    
    if (!application || !application.documents || !application.documents.insuranceCert) {
        showNotification('Insurance certificate not found', 'error');
        return;
    }
    
    // Use DocumentModal if available (preferred method)
    if (typeof DocumentModal !== 'undefined') {
        const docUrl = application.documents.insuranceCert;
        DocumentModal.view({ 
            url: docUrl, 
            filename: 'Insurance Certificate',
            type: 'insurance'
        });
    } else {
        // Strict: never open new tabs for viewing documents
        showNotification('Document viewer modal is not available. Please refresh the page.', 'error');
        return;
    }
    
    showNotification('Opening insurance certificate document...', 'info');
}

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

function updateInsuranceStatus(applicationId, status, notes) {
    let applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    let application = applications.find(app => app.id === applicationId);
    
    if (!application) return;
    
    // Update insurance status
    application.insuranceStatus = status;
    application.insuranceVerificationDate = new Date().toISOString();
    application.insuranceVerificationNotes = notes;
    application.lastUpdated = new Date().toISOString();
    
    // Save back to localStorage
    localStorage.setItem('submittedApplications', JSON.stringify(applications));
    
    // Add notification for user
    addUserNotification(applicationId, 'insurance_' + status, 
        status === 'approved' ? 'Your insurance certificate has been approved' : 
        'Your insurance certificate has been rejected. Please check the reason and resubmit.');
    
    // Refresh the table
    loadInsuranceVerificationTasks();
    
    // Close modal if open
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

function addUserNotification(applicationId, type, message) {
    let applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    let application = applications.find(app => app.id === applicationId);

    if (!application) return;

    const notification = {
        id: 'notif-' + Date.now(),
        applicationId: applicationId,
        type: type,
        title: type.includes('approved') ? 'Insurance Approved' : 'Insurance Rejected',
        message: message,
        vehicleInfo: `${application.vehicle.make} ${application.vehicle.model} (${application.vehicle.plateNumber})`,
        timestamp: new Date().toISOString(),
        read: false
    };

    let notifications = JSON.parse(localStorage.getItem('userNotifications') || '[]');
    notifications.unshift(notification);
    if (notifications.length > 20) {
        notifications = notifications.slice(0, 20);
    }
    localStorage.setItem('userNotifications', JSON.stringify(notifications));
}

function initializeSummaryUpdates() {
    // Initialize summary with current data
    const applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    const applicationsWithInsurance = applications.filter(app => 
        app.documents && app.documents.insuranceCert
    );
    updateInsuranceSummary(applicationsWithInsurance);
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
