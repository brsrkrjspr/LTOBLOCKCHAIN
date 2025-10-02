// Insurance Verifier Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
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

function updateInsuranceStats() {
    // Get applications from localStorage
    const applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    
    // Calculate stats based on actual data
    const totalApplications = applications.length;
    const pendingInsurance = applications.filter(app => app.insuranceStatus === 'pending' || !app.insuranceStatus).length;
    const approvedInsurance = applications.filter(app => app.insuranceStatus === 'approved').length;
    const rejectedInsurance = applications.filter(app => app.insuranceStatus === 'rejected').length;
    
    // Update stat cards
    const statCards = document.querySelectorAll('.stat-card .stat-number');
    if (statCards.length >= 4) {
        statCards[0].textContent = pendingInsurance;
        statCards[1].textContent = approvedInsurance;
        statCards[2].textContent = totalApplications;
        statCards[3].textContent = '98%';
    }
}

function loadInsuranceVerificationTasks() {
    const applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    const tbody = document.getElementById('insuranceVerificationTableBody');
    
    if (!tbody) return;
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    if (applications.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #6c757d;">
                    No applications with insurance certificates found
                </td>
            </tr>
        `;
        return;
    }
    
    // Filter applications that have insurance certificates
    const applicationsWithInsurance = applications.filter(app => 
        app.documents && app.documents.insuranceCert
    );
    
    if (applicationsWithInsurance.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #6c757d;">
                    No applications with insurance certificates found
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort by submission date (newest first)
    applicationsWithInsurance.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
    
    // Display applications
    applicationsWithInsurance.forEach(app => {
        const row = createInsuranceVerificationRow(app);
        tbody.appendChild(row);
    });
    
    // Update summary
    updateInsuranceSummary(applicationsWithInsurance);
}

function createInsuranceVerificationRow(application) {
    const row = document.createElement('tr');
    
    // Get insurance status
    const insuranceStatus = application.insuranceStatus || 'pending';
    const statusText = getInsuranceStatusText(insuranceStatus);
    const statusClass = getInsuranceStatusClass(insuranceStatus);
    
    row.innerHTML = `
        <td>${application.id}</td>
        <td>
            <div class="user-info">
                <strong>${application.owner.firstName} ${application.owner.lastName}</strong>
                <small>${application.owner.email}</small>
                <small>${application.owner.phone}</small>
            </div>
        </td>
        <td>
            <div class="vehicle-info">
                <strong>${application.vehicle.make} ${application.vehicle.model}</strong>
                <small>${application.vehicle.year} • ${application.vehicle.plateNumber}</small>
                <small>Engine: ${application.vehicle.engineNumber}</small>
            </div>
        </td>
        <td>
            <div class="document-info">
                <div class="document-item">
                    <span class="document-icon">🛡️</span>
                    <span class="document-name">${application.documents.insuranceCert}</span>
                </div>
                <button class="btn-secondary btn-sm" onclick="viewInsuranceDocument('${application.id}')">View Document</button>
            </div>
        </td>
        <td>${new Date(application.submittedDate).toLocaleDateString()}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td>
            <button class="btn-secondary btn-sm" onclick="viewInsuranceDetails('${application.id}')">Review</button>
            <button class="btn-primary btn-sm" onclick="approveInsurance('${application.id}')" ${insuranceStatus === 'approved' ? 'disabled' : ''}>Approve</button>
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
    showNotification('Opening insurance certificate document...', 'info');
    // In a real application, this would open the actual document
    // For demo purposes, we'll just show a notification
    setTimeout(() => {
        showNotification('Document viewer would open here', 'info');
    }, 1000);
}

function approveInsurance(applicationId) {
    if (confirm('Are you sure you want to approve this insurance certificate?')) {
        updateInsuranceStatus(applicationId, 'approved', 'Insurance certificate approved by verifier');
        showNotification('Insurance certificate approved successfully', 'success');
    }
}

function rejectInsurance(applicationId) {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason && reason.trim()) {
        updateInsuranceStatus(applicationId, 'rejected', `Insurance certificate rejected: ${reason}`);
        showNotification('Insurance certificate rejected', 'success');
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

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.insurance-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `insurance-notification insurance-notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    // Insert notification at the top of the dashboard content
    const dashboardContent = document.querySelector('.dashboard-content .container');
    if (dashboardContent) {
        dashboardContent.insertBefore(notification, dashboardContent.firstChild);
    }

    // Auto-remove notification after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}
