// Admin Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminDashboard();
});

function initializeAdminDashboard() {
    // Initialize real-time stats updates
    updateSystemStats();
    
    // Initialize user management functionality
    initializeUserManagement();
    
    // Initialize organization management
    initializeOrganizationManagement();
    
    // Initialize audit logs
    initializeAuditLogs();
    
    // Initialize reports
    initializeReports();
    
    // Initialize submitted applications
    initializeSubmittedApplications();
    
    // Set up auto-refresh for data
    setInterval(updateSystemStats, 30000); // Update every 30 seconds
}

function updateSystemStats() {
    // Simulate real-time data updates
    const stats = {
        totalUsers: Math.floor(Math.random() * 100) + 1200,
        totalApplications: Math.floor(Math.random() * 200) + 3500,
        activeOrganizations: Math.floor(Math.random() * 10) + 85,
        systemUptime: (99.5 + Math.random() * 0.4).toFixed(1) + '%'
    };
    
    // Update stat cards
    document.querySelector('.stat-card:nth-child(1) .stat-number').textContent = stats.totalUsers.toLocaleString();
    document.querySelector('.stat-card:nth-child(2) .stat-number').textContent = stats.totalApplications.toLocaleString();
    document.querySelector('.stat-card:nth-child(3) .stat-number').textContent = stats.activeOrganizations;
    document.querySelector('.stat-card:nth-child(4) .stat-number').textContent = stats.systemUptime;
}

function initializeUserManagement() {
    // Add click handler for User Management button
    const userMgmtBtn = document.querySelector('a[href="#users"]');
    if (userMgmtBtn) {
        userMgmtBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showUserManagementModal();
        });
    }
    
    // Add event listeners for user management actions
    const userTable = document.querySelector('.table tbody');
    if (userTable) {
        userTable.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-danger')) {
                handleUserSuspend(e);
            } else if (e.target.classList.contains('btn-secondary')) {
                handleUserEdit(e);
            }
        });
    }
}

function handleUserSuspend(e) {
    const row = e.target.closest('tr');
    const userId = row.querySelector('td:first-child').textContent;
    const userName = row.querySelector('td:nth-child(2)').textContent;
    
    if (confirm(`Are you sure you want to suspend user ${userName} (${userId})?`)) {
        // Simulate API call
        showNotification('User suspended successfully', 'success');
        row.querySelector('.status-badge').textContent = 'Suspended';
        row.querySelector('.status-badge').className = 'status-badge status-suspended';
    }
}

function handleUserEdit(e) {
    const row = e.target.closest('tr');
    const userId = row.querySelector('td:first-child').textContent;
    
    // Open user edit modal (placeholder)
    showNotification(`Edit user ${userId} - Feature coming soon`, 'info');
}

function initializeOrganizationManagement() {
    // Add click handler for Organization Management button
    const orgMgmtBtn = document.querySelector('a[href="#orgs"]');
    if (orgMgmtBtn) {
        orgMgmtBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showOrganizationManagementModal();
        });
    }
    
    // Add event listeners for organization management
    const orgTable = document.querySelector('.dashboard-card:nth-child(3) .table tbody');
    if (orgTable) {
        orgTable.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-danger')) {
                handleOrgDeactivate(e);
            } else if (e.target.classList.contains('btn-secondary')) {
                handleOrgEdit(e);
            }
        });
    }
}

function handleOrgDeactivate(e) {
    const row = e.target.closest('tr');
    const orgId = row.querySelector('td:first-child').textContent;
    const orgName = row.querySelector('td:nth-child(2)').textContent;
    
    if (confirm(`Are you sure you want to deactivate organization ${orgName} (${orgId})?`)) {
        showNotification('Organization deactivated successfully', 'success');
        row.querySelector('.status-badge').textContent = 'Inactive';
        row.querySelector('.status-badge').className = 'status-badge status-suspended';
    }
}

function handleOrgEdit(e) {
    const row = e.target.closest('tr');
    const orgId = row.querySelector('td:first-child').textContent;
    
    showNotification(`Edit organization ${orgId} - Feature coming soon`, 'info');
}

function initializeAuditLogs() {
    // Add click handler for Audit Logs button
    const auditBtn = document.querySelector('a[href="#audit"]');
    if (auditBtn) {
        auditBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showAuditLogsModal();
        });
    }
    
    // Add real-time audit log updates
    addNewAuditLog();
}

function initializeReports() {
    // Add click handler for Reports button
    const reportsBtn = document.querySelector('a[href="#reports"]');
    if (reportsBtn) {
        reportsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showReportsModal();
        });
    }
}

function addNewAuditLog() {
    const auditLogs = document.querySelector('.audit-logs');
    if (!auditLogs) return;
    
    const auditEvents = [
        { icon: '🔐', title: 'User Login', description: 'New user logged in from IP 192.168.1.105', time: new Date().toLocaleString() },
        { icon: '📝', title: 'Document Upload', description: 'New document uploaded to blockchain', time: new Date().toLocaleString() },
        { icon: '✅', title: 'Application Approved', description: 'Vehicle registration application approved', time: new Date().toLocaleString() },
        { icon: '⚠️', title: 'System Alert', description: 'High CPU usage detected', time: new Date().toLocaleString() }
    ];
    
    // Add random audit log every 2 minutes
    setInterval(() => {
        const randomEvent = auditEvents[Math.floor(Math.random() * auditEvents.length)];
        const newLog = createAuditLogElement(randomEvent);
        auditLogs.insertBefore(newLog, auditLogs.firstChild);
        
        // Remove oldest log if more than 5
        if (auditLogs.children.length > 5) {
            auditLogs.removeChild(auditLogs.lastChild);
        }
    }, 120000); // 2 minutes
}

function createAuditLogElement(event) {
    const auditItem = document.createElement('div');
    auditItem.className = 'audit-item';
    auditItem.innerHTML = `
        <div class="audit-icon">${event.icon}</div>
        <div class="audit-content">
            <h4>${event.title}</h4>
            <p>${event.description}</p>
            <small>${event.time}</small>
        </div>
    `;
    return auditItem;
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function initializeSubmittedApplications() {
    // Load and display submitted applications
    loadSubmittedApplications();
    
    // Set up auto-refresh for applications
    setInterval(loadSubmittedApplications, 10000); // Update every 10 seconds
}

function loadSubmittedApplications() {
    const applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    const tbody = document.getElementById('submitted-applications-tbody');
    
    // Debug logging
    console.log('Loading submitted applications:', applications);
    console.log('Found tbody element:', tbody);
    
    if (!tbody) return;
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    if (applications.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 20px; color: #666;">
                    No submitted applications found
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort applications by submission date (newest first)
    applications.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
    
    // Display applications
    applications.forEach(app => {
        const row = createApplicationRow(app);
        tbody.appendChild(row);
    });
}

function createApplicationRow(application) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${application.id}</td>
        <td>
            <div class="vehicle-info">
                <strong>${application.vehicle.make} ${application.vehicle.model} ${application.vehicle.year}</strong>
                <small>${application.vehicle.plateNumber}</small>
            </div>
        </td>
        <td>${application.owner.firstName} ${application.owner.lastName}</td>
        <td>${new Date(application.submittedDate).toLocaleDateString()}</td>
        <td><span class="status-badge status-${application.status}">${getStatusText(application.status)}</span></td>
        <td><span class="priority-badge priority-${application.priority}">${application.priority}</span></td>
        <td>
            <button class="btn-secondary btn-sm" onclick="viewApplication('${application.id}')">View</button>
            <button class="btn-primary btn-sm" onclick="approveApplication('${application.id}')">Approve</button>
            <button class="btn-danger btn-sm" onclick="rejectApplication('${application.id}')">Reject</button>
        </td>
    `;
    return row;
}

function getStatusText(status) {
    const statusMap = {
        'submitted': 'Pending Review',
        'approved': 'Approved',
        'rejected': 'Rejected',
        'processing': 'Processing',
        'completed': 'Completed'
    };
    return statusMap[status] || status;
}

function viewApplication(applicationId) {
    const applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    const application = applications.find(app => app.id === applicationId);
    
    if (!application) {
        showNotification('Application not found', 'error');
        return;
    }
    
    showApplicationModal(application);
}

function showApplicationModal(application) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Application Details - ${application.id}</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="application-details">
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
                                <span class="detail-label">Color:</span>
                                <span class="detail-value">${application.vehicle.color}</span>
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
                        <h4>Owner Information</h4>
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
                        <h4>Documents</h4>
                        <div class="document-list">
                            <div class="document-item">📄 ${application.documents.registrationCert}</div>
                            <div class="document-item">🛡️ ${application.documents.insuranceCert}</div>
                            <div class="document-item">🌱 ${application.documents.emissionCert}</div>
                            <div class="document-item">🆔 ${application.documents.ownerId}</div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Application Status</h4>
                        <div class="status-info">
                            <p><strong>Status:</strong> <span class="status-badge status-${application.status}">${getStatusText(application.status)}</span></p>
                            <p><strong>Submitted:</strong> ${new Date(application.submittedDate).toLocaleString()}</p>
                            <p><strong>Last Updated:</strong> ${new Date(application.lastUpdated).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-primary" onclick="approveApplication('${application.id}')">Approve</button>
                <button class="btn-danger" onclick="rejectApplication('${application.id}')">Reject</button>
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

function approveApplication(applicationId) {
    if (confirm('Are you sure you want to approve this application?')) {
        updateApplicationStatus(applicationId, 'approved', 'Application approved by admin');
        showNotification('Application approved successfully! User will be notified.', 'success');
        
        // Add notification for user
        addUserNotification(applicationId, 'approved', 'Your application has been approved! You can now download your certificate.');
        
        loadSubmittedApplications(); // Refresh the table
    }
}

function rejectApplication(applicationId) {
    const reason = prompt('Please provide a reason for rejection:');
    if (reason && reason.trim()) {
        updateApplicationStatus(applicationId, 'rejected', `Application rejected: ${reason}`);
        showNotification('Application rejected successfully! User will be notified.', 'success');
        
        // Add notification for user
        addUserNotification(applicationId, 'rejected', `Your application has been rejected. Reason: ${reason}. Please review and resubmit.`);
        
        loadSubmittedApplications(); // Refresh the table
    }
}

function updateApplicationStatus(applicationId, newStatus, notes) {
    // Update in submitted applications
    let applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    let application = applications.find(app => app.id === applicationId);
    
    if (application) {
        application.status = newStatus;
        application.lastUpdated = new Date().toISOString();
        application.adminNotes = notes;
        localStorage.setItem('submittedApplications', JSON.stringify(applications));
    }
    
    // Update in user applications
    let userApplications = JSON.parse(localStorage.getItem('userApplications') || '[]');
    let userApp = userApplications.find(app => app.id === applicationId);
    
    if (userApp) {
        userApp.status = newStatus;
        userApp.lastUpdated = new Date().toISOString();
        userApp.adminNotes = notes;
        localStorage.setItem('userApplications', JSON.stringify(userApplications));
    }
}

function addUserNotification(applicationId, type, message) {
    // Get the application to get vehicle info
    let applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    let application = applications.find(app => app.id === applicationId);
    
    if (!application) return;
    
    // Create notification
    const notification = {
        id: 'notif-' + Date.now(),
        applicationId: applicationId,
        type: type,
        title: type === 'approved' ? 'Application Approved' : 'Application Rejected',
        message: message,
        vehicleInfo: `${application.vehicle.make} ${application.vehicle.model} (${application.vehicle.plateNumber})`,
        timestamp: new Date().toISOString(),
        read: false
    };
    
    // Store notification
    let notifications = JSON.parse(localStorage.getItem('userNotifications') || '[]');
    notifications.unshift(notification); // Add to beginning
    
    // Keep only last 20 notifications
    if (notifications.length > 20) {
        notifications = notifications.slice(0, 20);
    }
    
    localStorage.setItem('userNotifications', JSON.stringify(notifications));
}

// Export functions for potential external use
window.AdminDashboard = {
    updateSystemStats,
    showNotification,
    handleUserSuspend,
    handleUserEdit,
    handleOrgDeactivate,
    handleOrgEdit,
    viewApplication,
    approveApplication,
    rejectApplication
};
