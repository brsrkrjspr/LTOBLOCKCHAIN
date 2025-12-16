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
    initializeEmissionReports();
    
    // Set up auto-refresh
    setInterval(updateVerifierStats, 60000); // Update every minute
}

function updateVerifierStats() {
    // Placeholder: Replace with actual API call
    // Example: const response = await APIClient.get('/api/emission-verifier/stats');
    // const stats = await response.json();
    
    // Update stat cards - data will be loaded from API
    const statCards = document.querySelectorAll('.stat-card .stat-number');
    if (statCards.length >= 4) {
        // Set to "-" if no data available
        statCards[0].textContent = '-';
        statCards[1].textContent = '-';
        statCards[2].textContent = '-';
        statCards[3].textContent = '-';
        
        // If API call succeeds, populate with real data:
        // statCards[0].textContent = stats.assignedTasks || '-';
        // statCards[1].textContent = stats.completedToday || '-';
        // statCards[2].textContent = stats.thisWeek || '-';
        // statCards[3].textContent = stats.accuracyRate || '-';
    }
}

function initializeTaskManagement() {
    // Load emission verification requests
    loadEmissionVerificationTasks();
    
    // Add event listeners for emission task actions
    const taskTable = document.querySelector('.table tbody');
    if (taskTable) {
        taskTable.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-primary')) {
                handleEmissionApprove(e);
            } else if (e.target.classList.contains('btn-danger')) {
                handleEmissionReject(e);
            } else if (e.target.classList.contains('btn-secondary')) {
                handleEmissionReview(e);
            }
        });
    }
}

async function loadEmissionVerificationTasks() {
    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;
    
    // Show loading state
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading verification requests...</td></tr>';
    
    try {
        // Call API to get emission verification requests
        if (typeof APIClient !== 'undefined') {
            const apiClient = new APIClient();
            const response = await apiClient.get('/api/emission/requests?status=PENDING');
            
            if (response && response.success && response.requests) {
                const requests = response.requests;
                
                if (requests.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 2rem; color: #6c757d;">
                                No pending emission verification requests
                            </td>
                        </tr>
                    `;
                    return;
                }
                
                // Clear existing rows
                tbody.innerHTML = '';
                
                // Display requests
                requests.forEach(req => {
                    const row = createEmissionVerificationRow(req);
                    tbody.appendChild(row);
                });
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

function createEmissionVerificationRow(request) {
    const row = document.createElement('tr');
    const vehicle = request.vehicle || {};
    const owner = request.owner || {};
    const requestDate = request.created_at ? new Date(request.created_at).toLocaleDateString() : 'N/A';
    
    row.innerHTML = `
        <td>${request.id.substring(0, 8)}...</td>
        <td>
            <div class="vehicle-info">
                <strong>${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.year || ''}</strong>
            </div>
        </td>
        <td>${vehicle.plate_number || 'N/A'}</td>
        <td>${owner.first_name || ''} ${owner.last_name || 'Unknown'}</td>
        <td>${requestDate}</td>
        <td><span class="status-badge status-${request.status?.toLowerCase() || 'pending'}">${request.status || 'PENDING'}</span></td>
        <td>
            <button class="btn-primary btn-sm" onclick="handleEmissionApproveFromRequest('${request.id}')">Approve</button>
            <button class="btn-danger btn-sm" onclick="handleEmissionRejectFromRequest('${request.id}')">Reject</button>
            <button class="btn-secondary btn-sm" onclick="handleEmissionReviewFromRequest('${request.id}')">Review</button>
        </td>
    `;
    return row;
}

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

function handleEmissionReviewFromRequest(requestId) {
    window.location.href = `document-viewer.html?requestId=${requestId}&returnTo=verifier-dashboard.html`;
}

async function handleEmissionApprove(e) {
    const row = e.target.closest('tr');
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

function handleEmissionReview(e) {
    const row = e.target.closest('tr');
    const appId = row.querySelector('td:first-child').textContent;
    const emissionTest = row.querySelector('td:nth-child(3)').textContent;
    
    showNotification(`Opening emission test documents for review (${appId})...`, 'info');
    
    // In a real app, this would open document viewer with emission-specific documents
    setTimeout(() => {
        window.location.href = 'document-viewer.html?app=' + appId + '&type=emission';
    }, 1000);
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
    handleEmissionApprove,
    handleEmissionReject,
    handleEmissionReview,
    handleGenerateReport,
    updateTaskStats,
    showNotification,
    receiveLTORequest,
    uploadEmissionResult,
    sendResultToLTO
};
