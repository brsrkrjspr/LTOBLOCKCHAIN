// Owner Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeOwnerDashboard();
});

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

function updateOwnerStats() {
    // Simulate real-time updates for owner stats
    const stats = {
        registeredVehicles: Math.floor(Math.random() * 2) + 3,
        pendingApplications: Math.floor(Math.random() * 2) + 1,
        approvedApplications: Math.floor(Math.random() * 2) + 2,
        notifications: Math.floor(Math.random() * 3) + 5
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
    // Create notification toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(toast);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 4000);
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
    const applications = JSON.parse(localStorage.getItem('userApplications') || '[]');
    const applicationsTable = document.querySelector('.dashboard-card:nth-child(3) .table tbody');
    
    if (!applicationsTable) return;
    
    // Clear existing rows
    applicationsTable.innerHTML = '';
    
    if (applications.length === 0) {
        applicationsTable.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px; color: #666;">
                    No applications found. <a href="registration-wizard.html" style="color: #007bff;">Start a new registration</a>
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort applications by submission date (newest first)
    applications.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
    
    // Display applications
    applications.forEach(app => {
        const row = createUserApplicationRow(app);
        applicationsTable.appendChild(row);
    });
    
    // Update stats based on applications
    updateStatsFromApplications(applications);
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

function resubmitApplication(applicationId) {
    if (confirm('Are you sure you want to resubmit this application?')) {
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
        
        showNotification('Application resubmitted successfully!', 'success');
        loadUserApplications(); // Refresh the table
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
