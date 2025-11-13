// Admin Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminDashboard();
    initializeKeyboardShortcuts();
    initializePagination();
});

// Pagination state
let currentPage = 1;
const itemsPerPage = 10;
let allApplications = [];
let filteredApplications = [];

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

async function updateSystemStats() {
    // Show loading state
    const statCards = document.querySelectorAll('.stat-card .stat-number');
    statCards.forEach(card => {
        card.textContent = '...';
    });
    
    try {
        // Simulate API call with abort controller
        const signal = requestManager.createRequest('system-stats');
        
        // Simulate real-time data updates
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const stats = {
            totalUsers: Math.floor(Math.random() * 100) + 1200,
            totalApplications: Math.floor(Math.random() * 200) + 3500,
            activeOrganizations: Math.floor(Math.random() * 10) + 85,
            systemUptime: (99.5 + Math.random() * 0.4).toFixed(1) + '%'
        };
        
        // Update stat cards
        if (statCards.length >= 4) {
            statCards[0].textContent = stats.totalUsers.toLocaleString();
            statCards[1].textContent = stats.totalApplications.toLocaleString();
            statCards[2].textContent = stats.activeOrganizations;
            statCards[3].textContent = stats.systemUptime;
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Failed to update stats:', error);
        }
    }
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

async function handleUserSuspend(e) {
    const row = e.target.closest('tr');
    const userId = row.querySelector('td:first-child').textContent;
    const userName = row.querySelector('td:nth-child(2)').textContent;
    
    const confirmed = await ConfirmationDialog.show({
        title: 'Suspend User',
        message: `Are you sure you want to suspend user ${userName} (${userId})? This action can be reversed later.`,
        confirmText: 'Suspend User',
        cancelText: 'Cancel',
        confirmColor: '#e74c3c',
        type: 'warning'
    });
    
    if (confirmed) {
        const button = e.target;
        LoadingManager.show(button, 'Suspending...');
        
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            ToastNotification.show('User suspended successfully', 'success');
            row.querySelector('.status-badge').textContent = 'Suspended';
            row.querySelector('.status-badge').className = 'status-badge status-suspended';
        } catch (error) {
            ToastNotification.show('Failed to suspend user. Please try again.', 'error');
        } finally {
            LoadingManager.hide(button);
        }
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
    ToastNotification.show(message, type);
}

function initializeSubmittedApplications() {
    // Load and display submitted applications
    loadSubmittedApplications();
    
    // Set up auto-refresh for applications
    setInterval(loadSubmittedApplications, 10000); // Update every 10 seconds
}

function loadSubmittedApplications() {
    allApplications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    const tbody = document.getElementById('submitted-applications-tbody');
    
    if (!tbody) return;
    
    // Sort applications by submission date (newest first)
    allApplications.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
    
    // Apply filters/search if any
    filteredApplications = applyFilters(allApplications);
    
    // Update pagination
    updatePagination();
    renderApplications();
}

function applyFilters(applications) {
    // Get search/filter values if they exist
    const searchInput = document.getElementById('applicationSearch');
    const statusFilter = document.getElementById('statusFilter');
    
    let filtered = [...applications];
    
    // Apply search
    if (searchInput && searchInput.value.trim()) {
        const searchTerm = searchInput.value.toLowerCase();
        filtered = filtered.filter(app => 
            app.id.toLowerCase().includes(searchTerm) ||
            `${app.vehicle.make} ${app.vehicle.model}`.toLowerCase().includes(searchTerm) ||
            `${app.owner.firstName} ${app.owner.lastName}`.toLowerCase().includes(searchTerm) ||
            app.vehicle.plateNumber.toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply status filter
    if (statusFilter && statusFilter.value !== 'all') {
        filtered = filtered.filter(app => app.status === statusFilter.value);
    }
    
    return filtered;
}

function renderApplications() {
    const tbody = document.getElementById('submitted-applications-tbody');
    if (!tbody) return;
    
    // Clear existing rows
    tbody.innerHTML = '';
    
    if (filteredApplications.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 20px; color: #666;">
                    No applications found
                </td>
            </tr>
        `;
        return;
    }
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageApplications = filteredApplications.slice(startIndex, endIndex);
    
    // Display applications
    pageApplications.forEach(app => {
        const row = createApplicationRow(app);
        tbody.appendChild(row);
    });
}

function initializePagination() {
    // Add search and filter controls if they don't exist
    const tableContainer = document.querySelector('.dashboard-card:has(#submitted-applications-tbody)');
    if (tableContainer && !document.getElementById('applicationSearch')) {
        const toolbar = document.createElement('div');
        toolbar.className = 'management-toolbar';
        toolbar.innerHTML = `
            <div class="search-box">
                <input type="text" id="applicationSearch" placeholder="Search applications..." style="padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px; min-width: 250px;">
            </div>
            <div class="filter-box">
                <select id="statusFilter" style="padding: 0.5rem; border: 1px solid #ced4da; border-radius: 4px;">
                    <option value="all">All Status</option>
                    <option value="submitted">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="processing">Processing</option>
                </select>
            </div>
        `;
        
        const table = tableContainer.querySelector('table');
        if (table) {
            tableContainer.insertBefore(toolbar, table);
        }
        
        // Add event listeners
        document.getElementById('applicationSearch')?.addEventListener('input', () => {
            currentPage = 1;
            loadSubmittedApplications();
        });
        
        document.getElementById('statusFilter')?.addEventListener('change', () => {
            currentPage = 1;
            loadSubmittedApplications();
        });
    }
    
    // Add pagination container
    const tbody = document.getElementById('submitted-applications-tbody');
    if (tbody && !document.getElementById('pagination-container')) {
        const paginationContainer = document.createElement('div');
        paginationContainer.id = 'pagination-container';
        paginationContainer.style.marginTop = '1rem';
        tbody.closest('table')?.parentElement?.appendChild(paginationContainer);
    }
}

function updatePagination() {
    const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);
    const container = document.getElementById('pagination-container');
    
    if (container) {
        PaginationHelper.createPagination(container, currentPage, totalPages, (page) => {
            currentPage = page;
            renderApplications();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl+F or Cmd+F to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            const searchInput = document.getElementById('applicationSearch');
            if (searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
        }
        
        // Ctrl+P or Cmd+P to print
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            window.print();
        }
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

async function approveApplication(applicationId) {
    const confirmed = await ConfirmationDialog.show({
        title: 'Approve Application',
        message: 'Are you sure you want to approve this application? The user will be notified immediately.',
        confirmText: 'Approve',
        cancelText: 'Cancel',
        confirmColor: '#27ae60',
        type: 'question'
    });
    
    if (confirmed) {
        const button = event?.target || document.querySelector(`[onclick*="approveApplication('${applicationId}')"]`);
        if (button) LoadingManager.show(button, 'Approving...');
        
        try {
            updateApplicationStatus(applicationId, 'approved', 'Application approved by admin');
            ToastNotification.show('Application approved successfully! User will be notified.', 'success');
            
            // Add notification for user
            addUserNotification(applicationId, 'approved', 'Your application has been approved! You can now download your certificate.');
            
            loadSubmittedApplications(); // Refresh the table
        } catch (error) {
            ToastNotification.show('Failed to approve application. Please try again.', 'error');
        } finally {
            if (button) LoadingManager.hide(button);
        }
    }
}

async function rejectApplication(applicationId) {
    // Show custom dialog for rejection reason
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>Reject Application</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom: 1rem;">Please provide a reason for rejection:</p>
                <textarea id="rejectionReason" style="width: 100%; min-height: 100px; padding: 0.75rem; border: 2px solid #ecf0f1; border-radius: 5px;" placeholder="Enter rejection reason..."></textarea>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn-danger" id="confirmReject">Reject Application</button>
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
                updateApplicationStatus(applicationId, 'rejected', `Application rejected: ${reason}`);
                ToastNotification.show('Application rejected successfully! User will be notified.', 'success');
                
                // Add notification for user
                addUserNotification(applicationId, 'rejected', `Your application has been rejected. Reason: ${reason}. Please review and resubmit.`);
                
                loadSubmittedApplications(); // Refresh the table
                modal.remove();
                resolve();
            } catch (error) {
                ToastNotification.show('Failed to reject application. Please try again.', 'error');
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
