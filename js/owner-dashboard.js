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
        // Fallback - show generic placeholder
        const userNameElement = document.querySelector('.user-name');
        if (userNameElement) {
            userNameElement.textContent = 'User';
        }
        
        const userAvatarElement = document.querySelector('.user-avatar');
        if (userAvatarElement) {
            userAvatarElement.textContent = 'U';
        }
    }
}

async function updateOwnerStats() {
    const statCards = document.querySelectorAll('.stat-card .stat-number');
    statCards.forEach(card => {
        card.textContent = '...';
    });
    
    // Initialize stats with zeros
    const stats = {
        registeredVehicles: 0,
        pendingApplications: 0,
        approvedApplications: 0,
        notifications: 0
    };
    
    try {
        // Get real stats from API
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        
        // Check if it's a demo token - if so, skip API calls and use localStorage data
        if (token && token.startsWith('demo-token-')) {
            console.log('Demo mode: Using localStorage data instead of API');
            // Load from localStorage if available
            const localApplications = JSON.parse(localStorage.getItem('userApplications') || '[]');
            if (localApplications.length > 0) {
                stats.registeredVehicles = localApplications.filter(v => 
                    v.status === 'approved' || v.status === 'APPROVED'
                ).length;
                stats.pendingApplications = localApplications.filter(v => 
                    v.status === 'submitted' || v.status === 'SUBMITTED' || v.status === 'pending'
                ).length;
                stats.approvedApplications = localApplications.filter(v => 
                    v.status === 'approved' || v.status === 'APPROVED'
                ).length;
            }
        } else if (token) {
            // Only make API call if it's not a demo token
            try {
                const response = await fetch('/api/vehicles/my-vehicles', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.vehicles) {
                        const vehicles = data.vehicles;
                        stats.registeredVehicles = vehicles.filter(v => 
                            v.status === 'REGISTERED' || v.status === 'APPROVED'
                        ).length;
                        stats.pendingApplications = vehicles.filter(v => 
                            v.status === 'SUBMITTED' || v.status === 'PENDING_BLOCKCHAIN' || v.status === 'PROCESSING'
                        ).length;
                        stats.approvedApplications = vehicles.filter(v => 
                            v.status === 'APPROVED' || v.status === 'REGISTERED'
                        ).length;
                    }
                }
            } catch (apiError) {
                console.warn('Could not fetch vehicle stats:', apiError);
            }
        }
            
            // Get notifications count
            if (token && token.startsWith('demo-token-')) {
                // Demo mode: use localStorage
                const localNotifs = JSON.parse(localStorage.getItem('userNotifications') || '[]');
                stats.notifications = localNotifs.filter(n => !n.read).length;
            } else if (token) {
                try {
                    const notifResponse = await fetch('/api/notifications', {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (notifResponse.ok) {
                        const notifData = await notifResponse.json();
                        if (notifData.success && Array.isArray(notifData.notifications)) {
                            stats.notifications = notifData.notifications.filter(n => !n.read).length;
                        }
                    }
                } catch (notifError) {
                    console.warn('Could not fetch notifications:', notifError);
                    // Fallback to localStorage if available
                    const localNotifs = JSON.parse(localStorage.getItem('userNotifications') || '[]');
                    stats.notifications = localNotifs.filter(n => !n.read).length;
                }
            } else {
                // No token, use localStorage
                const localNotifs = JSON.parse(localStorage.getItem('userNotifications') || '[]');
                stats.notifications = localNotifs.filter(n => !n.read).length;
            }
    } catch (error) {
        console.warn('Error loading dashboard stats:', error);
        // Fallback to localStorage if API fails
        const localApplications = JSON.parse(localStorage.getItem('userApplications') || '[]');
        stats.registeredVehicles = localApplications.filter(v => 
            v.status === 'approved' || v.status === 'APPROVED'
        ).length;
        stats.pendingApplications = localApplications.filter(v => 
            v.status === 'submitted' || v.status === 'SUBMITTED' || v.status === 'pending'
        ).length;
        stats.approvedApplications = localApplications.filter(v => 
            v.status === 'approved' || v.status === 'APPROVED'
        ).length;
        const localNotifs = JSON.parse(localStorage.getItem('userNotifications') || '[]');
        stats.notifications = localNotifs.filter(n => !n.read).length;
    }
        
        // Update stat cards (using new IDs)
        const statVehiclesEl = document.getElementById('statVehicles');
        const statPendingEl = document.getElementById('statPending');
        const statApprovedEl = document.getElementById('statApproved');
        const statNotificationsEl = document.getElementById('statNotifications');
        
        if (statVehiclesEl) statVehiclesEl.textContent = stats.registeredVehicles;
        if (statPendingEl) statPendingEl.textContent = stats.pendingApplications;
        if (statApprovedEl) statApprovedEl.textContent = stats.approvedApplications;
        if (statNotificationsEl) statNotificationsEl.textContent = stats.notifications;
        
        // Fallback to old method if new IDs not found
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
        // Show zeros if API fails
        const statVehiclesEl = document.getElementById('statVehicles');
        const statPendingEl = document.getElementById('statPending');
        const statApprovedEl = document.getElementById('statApproved');
        const statNotificationsEl = document.getElementById('statNotifications');
        
        if (statVehiclesEl) statVehiclesEl.textContent = '0';
        if (statPendingEl) statPendingEl.textContent = '0';
        if (statApprovedEl) statApprovedEl.textContent = '0';
        if (statNotificationsEl) statNotificationsEl.textContent = '0';
        
        // Fallback to old method
        if (statCards.length >= 4) {
            statCards[0].textContent = '0';
            statCards[1].textContent = '0';
            statCards[2].textContent = '0';
            statCards[3].textContent = '0';
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
    
    // Find the application to get vehicle details
    const application = allApplications.find(app => app.id === applicationId);
    if (application && application.vehicle) {
        const vin = application.vehicle.vin;
        // Navigate to document viewer with VIN
        window.location.href = `document-viewer.html?vin=${encodeURIComponent(vin)}&type=registration`;
    } else {
        // Fallback to appId
        window.location.href = `document-viewer.html?appId=${applicationId}&type=registration`;
    }
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
    // Try new selector first, fallback to old
    let notificationsList = document.querySelector('.notifications-list-modern');
    if (!notificationsList) {
        notificationsList = document.querySelector('.notifications-list');
    }
    
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
    const notificationStat = document.getElementById('statNotifications');
    if (notificationStat) {
        notificationStat.textContent = count;
    } else {
        // Fallback to old method
        const oldStat = document.querySelector('.stat-card:nth-child(4) .stat-number');
        if (oldStat) {
            oldStat.textContent = count;
        }
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

async function loadUserApplications() {
    // Try new selector first, fallback to old
    let applicationsTable = document.querySelector('.table-modern tbody');
    if (!applicationsTable) {
        applicationsTable = document.querySelector('.dashboard-card:nth-child(3) .table tbody');
    }
    if (!applicationsTable) {
        applicationsTable = document.querySelector('.table tbody');
    }
    if (!applicationsTable) return;
    
    // Show loading state
    applicationsTable.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Loading applications...</td></tr>';
    
    try {
        // Try to load from API first
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        
        // Check if it's a demo token - if so, skip API calls
        if (token && token.startsWith('demo-token-')) {
            console.log('Demo mode: Loading applications from localStorage only');
            // Skip API call for demo tokens
        } else if (token && typeof APIClient !== 'undefined') {
            try {
                const apiClient = new APIClient();
                const response = await apiClient.get('/api/vehicles/my-vehicles');
                
                if (response && response.success && response.vehicles) {
                    // Convert vehicles to application format
                    allApplications = response.vehicles.map(vehicle => ({
                        id: vehicle.id,
                        vehicle: {
                            make: vehicle.make,
                            model: vehicle.model,
                            year: vehicle.year,
                            plateNumber: vehicle.plateNumber || vehicle.plate_number,
                            vin: vehicle.vin
                        },
                        status: vehicle.status?.toLowerCase() || 'submitted',
                        submittedDate: vehicle.registrationDate || vehicle.registration_date || vehicle.createdAt || new Date().toISOString(),
                        documents: vehicle.documents || []
                    }));
                    
                    // Save to localStorage for offline access
                    localStorage.setItem('userApplications', JSON.stringify(allApplications));
                    
                    // Sort applications by submission date (newest first)
                    allApplications.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
                    
                    // Apply filters
                    filteredApplications = applyFilters(allApplications);
                    
                    // Update pagination
                    updatePagination();
                    renderApplications();
                    
                    // Update stats based on all applications
                    updateStatsFromApplications(allApplications);
                    return;
                }
            } catch (apiError) {
                console.warn('API load failed, trying localStorage:', apiError);
            }
        }
        
        // Fallback to localStorage
        allApplications = JSON.parse(localStorage.getItem('userApplications') || '[]');
        
        if (allApplications.length === 0) {
            applicationsTable.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 20px; color: #666;">
                        No applications found. <a href="registration-wizard.html" style="color: #007bff;">Register a vehicle</a>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Sort applications by submission date (newest first)
        allApplications.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
        
        // Apply filters
        filteredApplications = applyFilters(allApplications);
        
        // Update pagination
        updatePagination();
        renderApplications();
        
        // Update stats based on all applications
        updateStatsFromApplications(allApplications);
        
    } catch (error) {
        console.error('Error loading applications:', error);
        applicationsTable.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px; color: #dc3545;">
                    Error loading applications. Please refresh the page.
                </td>
            </tr>
        `;
    }
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
    // Try new selector first, fallback to old
    let applicationsTable = document.querySelector('.table-modern tbody');
    if (!applicationsTable) {
        applicationsTable = document.querySelector('.dashboard-card:nth-child(3) .table tbody');
    }
    if (!applicationsTable) {
        applicationsTable = document.querySelector('.table tbody');
    }
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
    // Try new selector first, fallback to old
    let tableContainer = document.querySelector('.table-card');
    if (!tableContainer) {
        tableContainer = document.querySelector('.dashboard-card:nth-child(3)');
    }
    if (!tableContainer) {
        tableContainer = document.querySelector('[id="applications"]');
    }
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
    
    // Update stat cards (using new IDs)
    const statVehiclesEl = document.getElementById('statVehicles');
    const statPendingEl = document.getElementById('statPending');
    const statApprovedEl = document.getElementById('statApproved');
    const statNotificationsEl = document.getElementById('statNotifications');
    
    if (statVehiclesEl) statVehiclesEl.textContent = stats.registeredVehicles;
    if (statPendingEl) statPendingEl.textContent = stats.pendingApplications;
    if (statApprovedEl) statApprovedEl.textContent = stats.approvedApplications;
    if (statNotificationsEl) statNotificationsEl.textContent = stats.notifications;
    
    // Fallback to old method
    const statCards = document.querySelectorAll('.stat-card .stat-number');
    if (statCards.length >= 4) {
        statCards[0].textContent = stats.registeredVehicles;
        statCards[1].textContent = stats.pendingApplications;
        statCards[2].textContent = stats.approvedApplications;
        statCards[3].textContent = stats.notifications;
    }
}

function viewUserApplication(applicationId) {
    // Find the application to get vehicle details
    const application = allApplications.find(app => app.id === applicationId);
    if (application && application.vehicle) {
        const vin = application.vehicle.vin;
        // Check if we have specific documents to view
        if (application.documents && application.documents.length > 0) {
            // If only one document, view it directly
            if (application.documents.length === 1) {
                const doc = application.documents[0];
                const docType = doc.documentType || doc.document_type || 'registration';
                const typeParam = docType.replace('_cert', '').replace('_', '');
                // Check if document has valid ID
                const isValidDocumentId = doc.id && 
                    typeof doc.id === 'string' && 
                    doc.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) &&
                    !doc.id.startsWith('TEMP_');
                if (isValidDocumentId) {
                    window.location.href = `document-viewer.html?documentId=${doc.id}`;
                } else {
                    window.location.href = `document-viewer.html?vin=${encodeURIComponent(vin)}&type=${typeParam}`;
                }
            } else {
                // Multiple documents - show all via VIN
                window.location.href = `document-viewer.html?vin=${encodeURIComponent(vin)}&type=registration`;
            }
        } else {
            // No documents - still try to view by VIN
            window.location.href = `document-viewer.html?vin=${encodeURIComponent(vin)}&type=registration`;
        }
    } else {
        // Fallback to appId
        window.location.href = `document-viewer.html?appId=${applicationId}&type=registration`;
    }
}

function viewUserApplication_OLD(applicationId) {
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

// User Workflow Functions
let userWorkflowState = {
    registrationRequested: false,
    documentsUploaded: false,
    registrationCompleted: false
};

function checkUserWorkflowState() {
    const savedState = localStorage.getItem('userWorkflowState');
    if (savedState) {
        userWorkflowState = JSON.parse(savedState);
    }
    updateUserWorkflowUI();
    updateProgressTimeline();
}

function updateUserWorkflowUI() {
    const downloadBtn = document.getElementById('downloadPapersBtn');
    
    if (userWorkflowState.registrationCompleted) {
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.classList.add('enabled');
        }
    } else {
        if (downloadBtn) {
            downloadBtn.disabled = true;
            downloadBtn.classList.remove('enabled');
        }
    }
}

function saveUserWorkflowState() {
    localStorage.setItem('userWorkflowState', JSON.stringify(userWorkflowState));
    updateUserWorkflowUI();
    updateProgressTimeline();
}

function requestRegistration() {
    // Redirect to registration wizard
    window.location.href = 'registration-wizard.html';
}

function uploadDocuments() {
    // Show upload modal or redirect to document upload page
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>Upload Required Documents</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <form id="documentUploadForm" onsubmit="handleDocumentUpload(event)">
                    <div class="form-group">
                        <label for="documentType">Document Type</label>
                        <select id="documentType" name="documentType" required>
                            <option value="">Select document type...</option>
                            <option value="owner_id">Owner ID</option>
                            <option value="vehicle_registration">Vehicle Registration</option>
                            <option value="insurance_cert">Insurance Certificate</option>
                            <option value="emission_cert">Emission Certificate</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="documentFile">Upload Document (PDF/Image)</label>
                        <input type="file" id="documentFile" name="documentFile" accept=".pdf,.jpg,.jpeg,.png" required>
                        <small class="hint">Supported formats: PDF, JPG, PNG</small>
                    </div>
                    <div class="form-group">
                        <label for="documentNotes">Notes (Optional)</label>
                        <textarea id="documentNotes" name="notes" rows="3" placeholder="Add any notes about this document..."></textarea>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn-primary">Upload Document</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

function handleDocumentUpload(event) {
    event.preventDefault();
    const fileInput = document.getElementById('documentFile');
    const documentType = document.getElementById('documentType').value;
    
    if (!fileInput.files || fileInput.files.length === 0) {
        showNotification('Please select a file to upload', 'error');
        return;
    }
    
    userWorkflowState.documentsUploaded = true;
    saveUserWorkflowState();
    
    showNotification('Document uploaded successfully', 'success');
    event.target.closest('.modal').remove();
}

function downloadFinalPapers() {
    if (!userWorkflowState.registrationCompleted) {
        showNotification('Registration is not yet completed', 'error');
        return;
    }
    
    showNotification('Preparing final registration papers for download...', 'info');
    
    // Simulate download
    setTimeout(() => {
        showNotification('Final registration papers downloaded successfully!', 'success');
        // In real app, this would trigger actual PDF download
    }, 2000);
}

function updateProgressTimeline() {
    // Try new selector first, fallback to old
    let timelineItems = document.querySelectorAll('.timeline-item-modern');
    if (!timelineItems || timelineItems.length === 0) {
        timelineItems = document.querySelectorAll('.timeline-item');
    }
    if (!timelineItems || timelineItems.length === 0) return;
    
    // Update timeline based on workflow state
    timelineItems.forEach((item, index) => {
        // Try new selectors first
        let icon = item.querySelector('.timeline-icon-modern');
        if (!icon) {
            icon = item.querySelector('.timeline-icon');
        }
        let content = item.querySelector('.timeline-content-modern h4');
        if (!content) {
            content = item.querySelector('.timeline-content h4');
        }
        
        if (!icon || !content) return;
        
        // Reset all to pending
        item.classList.remove('completed', 'pending', 'active');
        item.classList.add('pending');
        icon.classList.remove('completed', 'pending', 'active');
        icon.classList.add('pending');
        
        // Update based on progress
        if (index === 0) {
            // Application Submitted - always completed if registration requested
            if (userWorkflowState.registrationRequested) {
                item.classList.remove('pending');
                item.classList.add('completed');
                icon.classList.remove('pending');
                icon.classList.add('completed');
                icon.innerHTML = '<i class="fas fa-check"></i>';
                let dateEl = item.querySelector('.timeline-date-modern');
                if (!dateEl) dateEl = item.querySelector('.timeline-date');
                if (dateEl) dateEl.textContent = new Date().toLocaleDateString();
            }
        } else if (index === 1) {
            // Emission Test
            content.textContent = 'Emission Test';
            // Check if emission is received (from LTO workflow state)
            const ltoState = JSON.parse(localStorage.getItem('ltoWorkflowState') || '{}');
            if (ltoState.emissionReceived) {
                item.classList.remove('pending');
                item.classList.add('completed');
                icon.classList.remove('pending');
                icon.classList.add('completed');
                icon.innerHTML = '<i class="fas fa-check"></i>';
            }
        } else if (index === 2) {
            // Insurance Verification
            content.textContent = 'Insurance Verification';
            const ltoState = JSON.parse(localStorage.getItem('ltoWorkflowState') || '{}');
            if (ltoState.insuranceReceived) {
                item.classList.remove('pending');
                item.classList.add('completed');
                icon.classList.remove('pending');
                icon.classList.add('completed');
                icon.innerHTML = '<i class="fas fa-check"></i>';
            }
        } else if (index === 3) {
            // HPG Clearance
            content.textContent = 'HPG Clearance';
            const ltoState = JSON.parse(localStorage.getItem('ltoWorkflowState') || '{}');
            if (ltoState.hpgReceived) {
                item.classList.remove('pending');
                item.classList.add('completed');
                icon.classList.remove('pending');
                icon.classList.add('completed');
                icon.innerHTML = '<i class="fas fa-check"></i>';
            }
        } else if (index === 4) {
            // Finalization
            content.textContent = 'Finalization';
            const ltoState = JSON.parse(localStorage.getItem('ltoWorkflowState') || '{}');
            if (ltoState.emissionReceived && ltoState.insuranceReceived && ltoState.hpgReceived) {
                item.classList.remove('pending');
                item.classList.add('active');
                icon.classList.remove('pending');
                icon.classList.add('active');
                icon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            }
        } else if (index === 5) {
            // Completed
            content.textContent = 'Completed';
            if (userWorkflowState.registrationCompleted) {
                item.classList.remove('pending');
                item.classList.add('completed');
                icon.classList.remove('pending');
                icon.classList.add('completed');
                icon.innerHTML = '<i class="fas fa-award"></i>';
                let dateEl = item.querySelector('.timeline-date-modern');
                if (!dateEl) dateEl = item.querySelector('.timeline-date');
                if (dateEl) dateEl.textContent = new Date().toLocaleDateString();
            }
        }
    });
}

// Initialize workflow state on page load
document.addEventListener('DOMContentLoaded', function() {
    checkUserWorkflowState();
    
    // Check for registration completion periodically
    setInterval(() => {
        const ltoState = JSON.parse(localStorage.getItem('ltoWorkflowState') || '{}');
        if (ltoState.emissionReceived && ltoState.insuranceReceived && ltoState.hpgReceived && !userWorkflowState.registrationCompleted) {
            userWorkflowState.registrationCompleted = true;
            saveUserWorkflowState();
        }
        updateProgressTimeline();
    }, 5000);
});

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
    resubmitApplication,
    requestRegistration,
    uploadDocuments,
    downloadFinalPapers,
    updateProgressTimeline
};
