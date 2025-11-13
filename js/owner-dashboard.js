// Owner Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeOwnerDashboard();
    initializeKeyboardShortcuts();
    initializePagination();
});

// Pagination state
let currentPage = 1;
const itemsPerPage = 10;
let allApplications = [];
let filteredApplications = [];

function initializeOwnerDashboard() {
    // Initialize user information
    updateUserInfo();
    
    // Initialize dashboard functionality
    updateOwnerStats();
    
    // Initialize application tracking
    initializeApplicationTracking();
    
    // Initialize notifications
    initializeNotifications();
    
    // Initialize submitted applications
    initializeSubmittedApplications();
    
    // Set up auto-refresh
    setInterval(updateOwnerStats, 60000); // Update every minute
}

function updateUserInfo() {
    // Get current user from localStorage
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    
    if (currentUser && currentUser.firstName) {
        // Update user name
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
        }
        
        // Update user avatar with initials
        const userAvatarElement = document.querySelector('.user-avatar');
        if (userAvatarElement) {
            const initials = `${currentUser.firstName.charAt(0)}${currentUser.lastName.charAt(0)}`.toUpperCase();
            userAvatarElement.textContent = initials;
        }
        
        // Update user role
        const userRoleElement = document.querySelector('.user-role');
        if (userRoleElement) {
            userRoleElement.textContent = 'Vehicle Owner';
        }
    } else {
        // Fallback to default values
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.textContent = 'John Owner';
        }
        
        const userAvatarElement = document.querySelector('.user-avatar');
        if (userAvatarElement) {
            userAvatarElement.textContent = 'JO';
        }
    }
}

async function updateOwnerStats() {
    const statCards = document.querySelectorAll('.stat-card .stat-number');
    statCards.forEach(card => {
        card.textContent = '...';
    });
    
    try {
        const signal = requestManager.createRequest('owner-stats');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const stats = {
            registeredVehicles: Math.floor(Math.random() * 2) + 3,
            pendingApplications: Math.floor(Math.random() * 2) + 1,
            approvedApplications: Math.floor(Math.random() * 2) + 2,
            notifications: Math.floor(Math.random() * 3) + 5
        };
        
        if (statCards.length >= 4) {
            statCards[0].textContent = stats.registeredVehicles;
            statCards[1].textContent = stats.pendingApplications;
            statCards[2].textContent = stats.approvedApplications;
            statCards[3].textContent = stats.notifications;
        }
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Failed to update stats:', error);
        }
    }
}

function initializeApplicationTracking() {
    // Add event listeners for application actions
    const applicationTable = document.querySelector('.table tbody');
    if (applicationTable) {
        applicationTable.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-secondary')) {
                handleViewApplication(e);
            }
        });
    }
    
    // Add status update animations
    animateStatusUpdates();
}

function handleViewApplication(e) {
    const row = e.target.closest('tr');
    const vehicleInfo = row.querySelector('.vehicle-info strong').textContent;
    const applicationId = row.querySelector('td:nth-child(2)').textContent;
    
    // Simulate opening document viewer
    showNotification(`Opening documents for ${vehicleInfo} (${applicationId})`, 'info');
    
    // In a real application, this would navigate to document-viewer.html with parameters
    setTimeout(() => {
        window.location.href = 'document-viewer.html?app=' + applicationId;
    }, 1000);
}

function animateStatusUpdates() {
    // Add subtle animations to status badges
    const statusBadges = document.querySelectorAll('.status-badge');
    statusBadges.forEach(badge => {
        badge.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
            this.style.transition = 'transform 0.2s ease';
        });
        
        badge.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
}

function initializeNotifications() {
    // Load and display user notifications
    loadUserNotifications();
    
    // Add notification management functionality
    const notificationsList = document.querySelector('.notifications-list');
    if (notificationsList) {
        notificationsList.addEventListener('click', function(e) {
            if (e.target.closest('.notification-item')) {
                handleNotificationClick(e);
            }
        });
    }
    
    // Set up auto-refresh for notifications
    setInterval(loadUserNotifications, 5000); // Update every 5 seconds
}

function handleNotificationClick(e) {
    const notification = e.target.closest('.notification-item');
    const title = notification.querySelector('h4').textContent;
    
    // Mark as read (visual feedback)
    notification.style.opacity = '0.7';
    notification.style.backgroundColor = '#f8f9fa';
    
    showNotification(`Notification "${title}" marked as read`, 'success');
}

function loadUserNotifications() {
    const notifications = JSON.parse(localStorage.getItem('userNotifications') || '[]');
    const notificationsList = document.querySelector('.notifications-list');
    
    if (!notificationsList) return;
    
    // Clear existing notifications
    notificationsList.innerHTML = '';
    
    if (notifications.length === 0) {
        notificationsList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                No notifications yet
            </div>
        `;
        return;
    }
    
    // Display notifications
    notifications.slice(0, 5).forEach(notification => { // Show only latest 5
        const notificationElement = createNotificationElement(notification);
        notificationsList.appendChild(notificationElement);
    });
    
    // Update notification count in stats
    updateNotificationCount(notifications.length);
}

function createNotificationElement(notification) {
    const element = document.createElement('div');
    element.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
    
    const icon = notification.type === 'approved' ? '✅' : '❌';
    const timeAgo = getTimeAgo(notification.timestamp);
    
    element.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
            <h4>${notification.title}</h4>
            <p>${notification.message}</p>
            <small>${timeAgo}</small>
        </div>
    `;
    
    // Mark as read when clicked
    element.addEventListener('click', function() {
        markNotificationAsRead(notification.id);
        element.classList.remove('unread');
        element.classList.add('read');
    });
    
    return element;
}

function getTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now - time) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

function markNotificationAsRead(notificationId) {
    let notifications = JSON.parse(localStorage.getItem('userNotifications') || '[]');
    const notification = notifications.find(n => n.id === notificationId);
    
    if (notification) {
        notification.read = true;
        localStorage.setItem('userNotifications', JSON.stringify(notifications));
    }
}

function updateNotificationCount(count) {
    const notificationStat = document.querySelector('.stat-card:nth-child(4) .stat-number');
    if (notificationStat) {
        notificationStat.textContent = count;
    }
}

function addNotificationToUI(notification) {
    const notificationsList = document.querySelector('.notifications-list');
    if (!notificationsList) return;
    
    const notificationElement = document.createElement('div');
    notificationElement.className = 'notification-item';
    notificationElement.innerHTML = `
        <div class="notification-icon">${notification.icon}</div>
        <div class="notification-content">
            <h4>${notification.title}</h4>
            <p>${notification.message}</p>
            <small>${notification.time}</small>
        </div>
    `;
    
    // Add to top of list
    notificationsList.insertBefore(notificationElement, notificationsList.firstChild);
    
    // Remove oldest notification if more than 5
    if (notificationsList.children.length > 5) {
        notificationsList.removeChild(notificationsList.lastChild);
    }
    
    // Show toast notification
    showNotification(`New notification: ${notification.title}`, 'info');
}

function showNotification(message, type = 'info') {
    ToastNotification.show(message, type);
}

// Quick action handlers
function startNewRegistration() {
    showNotification('Redirecting to registration wizard...', 'info');
    setTimeout(() => {
        window.location.href = 'registration-wizard.html';
    }, 1000);
}

function viewAllApplications() {
    showNotification('Loading all applications...', 'info');
    // In a real app, this would filter the table or navigate to a dedicated page
}

function viewAllNotifications() {
    showNotification('Opening notifications panel...', 'info');
    // In a real app, this would open a modal or navigate to notifications page
}

function initializeSubmittedApplications() {
    // Load and display user's submitted applications
    loadUserApplications();
    
    // Set up auto-refresh for applications
    setInterval(loadUserApplications, 10000); // Update every 10 seconds
}

function loadUserApplications() {
    allApplications = JSON.parse(localStorage.getItem('userApplications') || '[]');
    const applicationsTable = document.querySelector('.dashboard-card:nth-child(3) .table tbody');
    
    if (!applicationsTable) return;
    
    // Sort applications by submission date (newest first)
    allApplications.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
    
    // Apply filters
    filteredApplications = applyFilters(allApplications);
    
    // Update pagination
    updatePagination();
    renderApplications();
    
    // Update stats based on all applications
    updateStatsFromApplications(allApplications);
}

function applyFilters(applications) {
    const searchInput = document.getElementById('applicationSearch');
    const statusFilter = document.getElementById('statusFilter');
    
    let filtered = [...applications];
    
    if (searchInput && searchInput.value.trim()) {
        const searchTerm = searchInput.value.toLowerCase();
        filtered = filtered.filter(app => 
            app.id.toLowerCase().includes(searchTerm) ||
            `${app.vehicle.make} ${app.vehicle.model}`.toLowerCase().includes(searchTerm) ||
            app.vehicle.plateNumber.toLowerCase().includes(searchTerm)
        );
    }
    
    if (statusFilter && statusFilter.value !== 'all') {
        filtered = filtered.filter(app => app.status === statusFilter.value);
    }
    
    return filtered;
}

function renderApplications() {
    const applicationsTable = document.querySelector('.dashboard-card:nth-child(3) .table tbody');
    if (!applicationsTable) return;
    
    applicationsTable.innerHTML = '';
    
    if (filteredApplications.length === 0) {
        applicationsTable.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px; color: #666;">
                    No applications found. <a href="registration-wizard.html" style="color: #007bff;">Start a new registration</a>
                </td>
            </tr>
        `;
        return;
    }
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageApplications = filteredApplications.slice(startIndex, endIndex);
    
    pageApplications.forEach(app => {
        const row = createUserApplicationRow(app);
        applicationsTable.appendChild(row);
    });
}

function initializePagination() {
    const tableContainer = document.querySelector('.dashboard-card:nth-child(3)');
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
                </select>
            </div>
        `;
        
        const table = tableContainer.querySelector('table');
        if (table) {
            tableContainer.insertBefore(toolbar, table);
        }
        
        document.getElementById('applicationSearch')?.addEventListener('input', () => {
            currentPage = 1;
            loadUserApplications();
        });
        
        document.getElementById('statusFilter')?.addEventListener('change', () => {
            currentPage = 1;
            loadUserApplications();
        });
    }
    
    const tbody = document.querySelector('.dashboard-card:nth-child(3) .table tbody');
    if (tbody && !document.getElementById('pagination-container-owner')) {
        const paginationContainer = document.createElement('div');
        paginationContainer.id = 'pagination-container-owner';
        paginationContainer.style.marginTop = '1rem';
        tbody.closest('table')?.parentElement?.appendChild(paginationContainer);
    }
}

function updatePagination() {
    const totalPages = Math.ceil(filteredApplications.length / itemsPerPage);
    const container = document.getElementById('pagination-container-owner');
    
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
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            const searchInput = document.getElementById('applicationSearch');
            if (searchInput) {
                e.preventDefault();
                searchInput.focus();
            }
        }
    });
}

function createUserApplicationRow(application) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <div class="vehicle-info">
                <strong>${application.vehicle.make} ${application.vehicle.model} ${application.vehicle.year}</strong>
                <small>${application.vehicle.plateNumber}</small>
            </div>
        </td>
        <td>${application.id}</td>
        <td><span class="status-badge status-${application.status}">${getStatusText(application.status)}</span></td>
        <td>${new Date(application.submittedDate).toLocaleDateString()}</td>
        <td>
            <button class="btn-secondary btn-sm" onclick="viewUserApplication('${application.id}')">View Details</button>
            ${application.status === 'approved' ? '<button class="btn-primary btn-sm" onclick="downloadCertificate(\'' + application.id + '\')">Download Certificate</button>' : ''}
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

function updateStatsFromApplications(applications) {
    const stats = {
        registeredVehicles: applications.filter(app => app.status === 'approved').length,
        pendingApplications: applications.filter(app => app.status === 'submitted').length,
        approvedApplications: applications.filter(app => app.status === 'approved').length,
        notifications: applications.filter(app => app.status === 'submitted' || app.status === 'rejected').length
    };
    
    // Update stat cards
    const statCards = document.querySelectorAll('.stat-card .stat-number');
    if (statCards.length >= 4) {
        statCards[0].textContent = stats.registeredVehicles;
        statCards[1].textContent = stats.pendingApplications;
        statCards[2].textContent = stats.approvedApplications;
        statCards[3].textContent = stats.notifications;
    }
}

function viewUserApplication(applicationId) {
    const applications = JSON.parse(localStorage.getItem('userApplications') || '[]');
    const application = applications.find(app => app.id === applicationId);
    
    if (!application) {
        showNotification('Application not found', 'error');
        return;
    }
    
    showUserApplicationModal(application);
}

function showUserApplicationModal(application) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>My Application - ${application.id}</h3>
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
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Application Status</h4>
                        <div class="status-info">
                            <p><strong>Status:</strong> <span class="status-badge status-${application.status}">${getStatusText(application.status)}</span></p>
                            <p><strong>Submitted:</strong> ${new Date(application.submittedDate).toLocaleString()}</p>
                            <p><strong>Last Updated:</strong> ${new Date(application.lastUpdated).toLocaleString()}</p>
                            ${application.adminNotes ? `<p><strong>Admin Notes:</strong> ${application.adminNotes}</p>` : ''}
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4>Application Timeline</h4>
                        <div class="timeline">
                            <div class="timeline-item">
                                <div class="timeline-icon">📝</div>
                                <div class="timeline-content">
                                    <h4>Application Submitted</h4>
                                    <p>Your application has been submitted for review</p>
                                    <small>${new Date(application.submittedDate).toLocaleString()}</small>
                                </div>
                            </div>
                            ${application.status === 'approved' ? `
                            <div class="timeline-item">
                                <div class="timeline-icon">✅</div>
                                <div class="timeline-content">
                                    <h4>Application Approved</h4>
                                    <p>Your application has been approved by the admin</p>
                                    <small>${new Date(application.lastUpdated).toLocaleString()}</small>
                                </div>
                            </div>
                            ` : ''}
                            ${application.status === 'rejected' ? `
                            <div class="timeline-item">
                                <div class="timeline-icon">❌</div>
                                <div class="timeline-content">
                                    <h4>Application Rejected</h4>
                                    <p>Your application has been rejected. Please review the notes and resubmit.</p>
                                    <small>${new Date(application.lastUpdated).toLocaleString()}</small>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                ${application.status === 'approved' ? '<button class="btn-primary" onclick="downloadCertificate(\'' + application.id + '\')">Download Certificate</button>' : ''}
                ${application.status === 'rejected' ? '<button class="btn-primary" onclick="resubmitApplication(\'' + application.id + '\')">Resubmit Application</button>' : ''}
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

function downloadCertificate(applicationId) {
    showNotification('Preparing certificate download...', 'info');
    
    // Simulate certificate generation
    setTimeout(() => {
        showNotification('Certificate downloaded successfully!', 'success');
        // In a real app, this would trigger actual certificate download
    }, 2000);
}

async function resubmitApplication(applicationId) {
    const confirmed = await ConfirmationDialog.show({
        title: 'Resubmit Application',
        message: 'Are you sure you want to resubmit this application? It will be sent for review again.',
        confirmText: 'Resubmit',
        cancelText: 'Cancel',
        confirmColor: '#3498db',
        type: 'question'
    });
    
    if (confirmed) {
        try {
            // Update application status back to submitted
            let applications = JSON.parse(localStorage.getItem('userApplications') || '[]');
            let application = applications.find(app => app.id === applicationId);
            
            if (application) {
                application.status = 'submitted';
                application.lastUpdated = new Date().toISOString();
                application.adminNotes = '';
                localStorage.setItem('userApplications', JSON.stringify(applications));
            }
            
            // Also update in submitted applications
            let submittedApplications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
            let submittedApp = submittedApplications.find(app => app.id === applicationId);
            
            if (submittedApp) {
                submittedApp.status = 'submitted';
                submittedApp.lastUpdated = new Date().toISOString();
                submittedApp.adminNotes = '';
                localStorage.setItem('submittedApplications', JSON.stringify(submittedApplications));
            }
            
            ToastNotification.show('Application resubmitted successfully!', 'success');
            loadUserApplications(); // Refresh the table
        } catch (error) {
            ToastNotification.show('Failed to resubmit application. Please try again.', 'error');
        }
    }
}

// Export functions for potential external use
window.OwnerDashboard = {
    updateOwnerStats,
    handleViewApplication,
    showNotification,
    startNewRegistration,
    viewAllApplications,
    viewAllNotifications,
    viewUserApplication,
    downloadCertificate,
    resubmitApplication
};
