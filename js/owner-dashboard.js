// Owner Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // SECURITY: Require authentication before initializing dashboard
    if (typeof AuthUtils !== 'undefined') {
        const isAuthDisabled = typeof window !== 'undefined' && window.DISABLE_AUTH === true;
        
        if (!isAuthDisabled) {
            // Production mode: Require authentication
            if (!AuthUtils.requireAuth()) {
                return; // Redirect to login page
            }
            
            // Verify vehicle_owner role
            if (!AuthUtils.hasRole('vehicle_owner')) {
                console.warn('❌ Access denied: Vehicle owner role required');
                showNotification('Access denied. Vehicle owner role required. Redirecting to login...', 'error');
                setTimeout(() => {
                    window.location.href = 'login-signup.html?message=Vehicle owner access required';
                }, 2000);
                return;
            }
        }
    }
    
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
    // Try multiple selectors
    let notificationsList = null;
    const selectors = [
        '.notifications-list-modern',
        '#notifications .notifications-list-modern',
        '.dashboard-card-modern.notifications-card .notifications-list-modern',
        '.notifications-list'
    ];
    
    for (const selector of selectors) {
        notificationsList = document.querySelector(selector);
        if (notificationsList) break;
    }
    
    if (!notificationsList) {
        console.warn('⚠️ Could not find notifications list');
        return;
    }
    
    // Try to load from API first
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    
    if (token && !token.startsWith('demo-token-') && typeof APIClient !== 'undefined') {
        try {
            const apiClient = new APIClient();
            apiClient.get('/api/notifications').then(response => {
                if (response && response.success && response.notifications) {
                    localStorage.setItem('userNotifications', JSON.stringify(response.notifications));
                    renderNotifications(response.notifications);
                } else {
                    renderNotifications(JSON.parse(localStorage.getItem('userNotifications') || '[]'));
                }
            }).catch(err => {
                console.warn('Failed to load notifications from API:', err);
                renderNotifications(JSON.parse(localStorage.getItem('userNotifications') || '[]'));
            });
        } catch (error) {
            console.warn('Error loading notifications:', error);
            renderNotifications(JSON.parse(localStorage.getItem('userNotifications') || '[]'));
        }
    } else {
        renderNotifications(JSON.parse(localStorage.getItem('userNotifications') || '[]'));
    }
}

function renderNotifications(notifications) {
    let notificationsList = document.querySelector('.notifications-list-modern') || 
                           document.querySelector('.notifications-list');
    
    if (!notificationsList) return;
    
    notificationsList.innerHTML = '';
    
    if (notifications.length === 0) {
        notificationsList.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                No notifications yet
            </div>
        `;
        return;
    }
    
    // Display notifications (show only latest 5)
    notifications.slice(0, 5).forEach(notification => {
        const notificationElement = createNotificationElement(notification);
        notificationsList.appendChild(notificationElement);
    });
    
    // Update notification count in stats
    updateNotificationCount(notifications.filter(n => !n.read).length);
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
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(loadUserApplications, 100);
        });
    } else {
        // DOM is ready, but wait a bit for dynamic content
        setTimeout(loadUserApplications, 100);
    }
    
    // Set up auto-refresh for applications
    setInterval(() => {
        loadUserApplications();
    }, 30000); // Update every 30 seconds
}

async function loadUserApplications() {
    // Wait for DOM to be fully ready
    if (document.readyState === 'loading') {
        await new Promise(resolve => {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', resolve);
            } else {
                resolve();
            }
        });
    }
    
    // Try multiple selectors with retry logic
    let applicationsTable = null;
    const selectors = [
        '.table-modern tbody',
        '#applications .table-modern tbody',
        '.dashboard-card-modern.table-card .table-modern tbody',
        '.dashboard-card:nth-child(3) .table tbody',
        '.table tbody'
    ];
    
    for (const selector of selectors) {
        applicationsTable = document.querySelector(selector);
        if (applicationsTable) {
            console.log(`✅ Found applications table with selector: ${selector}`);
            break;
        }
    }
    
    if (!applicationsTable) {
        console.error('❌ Could not find applications table. Available selectors:', {
            tableModern: document.querySelector('.table-modern'),
            applicationsDiv: document.querySelector('#applications'),
            allTables: document.querySelectorAll('table')
        });
        // Retry after a short delay
        setTimeout(loadUserApplications, 500);
        return;
    }
    
    // Show loading state
    applicationsTable.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Loading applications...</td></tr>';
    
    try {
        // Try to load from API first
        const token = localStorage.getItem('token') || localStorage.getItem('authToken');
        console.log('🔍 Loading applications. Token exists:', !!token);
        
        // Check if it's a demo token - if so, skip API calls
        if (token && token.startsWith('demo-token-')) {
            console.log('Demo mode: Loading applications from localStorage only');
            // Skip API call for demo tokens
        } else if (token && typeof APIClient !== 'undefined') {
            try {
                console.log('📡 Attempting API call to /api/vehicles/my-vehicles');
                const apiClient = new APIClient();
                const response = await apiClient.get('/api/vehicles/my-vehicles');
                
                console.log('📥 API Response:', response);
                
                if (response && response.success && response.vehicles) {
                    console.log(`✅ Loaded ${response.vehicles.length} vehicles from API`);
                    
                    // Convert vehicles to application format
                    allApplications = response.vehicles.map(vehicle => ({
                        id: vehicle.id,
                        vehicle: {
                            make: vehicle.make,
                            model: vehicle.model,
                            year: vehicle.year,
                            plateNumber: vehicle.plateNumber || vehicle.plate_number,
                            vin: vehicle.vin,
                            color: vehicle.color
                        },
                        status: vehicle.status?.toLowerCase() || 'submitted',
                        submittedDate: vehicle.registrationDate || vehicle.registration_date || vehicle.createdAt || vehicle.created_at || new Date().toISOString(),
                        documents: vehicle.documents || []
                    }));
                    
                    // Save to localStorage for offline access
                    localStorage.setItem('userApplications', JSON.stringify(allApplications));
                    console.log(`💾 Saved ${allApplications.length} applications to localStorage`);
                    
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
                } else {
                    console.warn('⚠️ API response missing vehicles:', response);
                }
            } catch (apiError) {
                console.error('❌ API load failed:', apiError);
                console.warn('API load failed, trying localStorage:', apiError);
            }
        } else {
            console.warn('⚠️ No valid token found. Token:', token ? 'exists but invalid' : 'missing');
        }
        
        // Fallback to localStorage
        console.log('📦 Loading from localStorage...');
        const localApps = JSON.parse(localStorage.getItem('userApplications') || '[]');
        console.log(`📦 Found ${localApps.length} applications in localStorage`);
        
        allApplications = localApps;
        
        if (allApplications.length === 0) {
            console.log('ℹ️ No applications found in localStorage');
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
        
        console.log(`✅ Rendered ${filteredApplications.length} applications`);
        
    } catch (error) {
        console.error('❌ Error loading applications:', error);
        applicationsTable.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px; color: #dc3545;">
                    Error loading applications: ${error.message}. Please refresh the page.
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
    // Try multiple selectors
    let applicationsTable = null;
    const selectors = [
        '.table-modern tbody',
        '#applications .table-modern tbody',
        '.dashboard-card-modern.table-card .table-modern tbody',
        '.dashboard-card:nth-child(3) .table tbody',
        '.table tbody'
    ];
    
    for (const selector of selectors) {
        applicationsTable = document.querySelector(selector);
        if (applicationsTable) break;
    }
    
    if (!applicationsTable) {
        console.error('❌ Could not find applications table for rendering');
        return;
    }
    
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
    
    console.log(`📊 Rendering ${pageApplications.length} applications (page ${currentPage})`);
    
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
    let application = allApplications.find(app => app.id === applicationId);
    
    // Also check localStorage
    if (!application) {
        const storedApps = JSON.parse(localStorage.getItem('userApplications') || '[]');
        const storedSubmitted = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
        application = storedApps.find(app => app.id === applicationId) || 
                     storedSubmitted.find(app => app.id === applicationId);
    }
    
    if (!application) {
        showNotification('Application not found', 'error');
        return;
    }
    
    // Show application details modal with document selection
    showApplicationDetailsModal(application);
}

// Show application details modal with document chooser
function showApplicationDetailsModal(application) {
    // Remove existing modal if any
    const existingModal = document.getElementById('applicationDetailsModal');
    if (existingModal) existingModal.remove();
    
    const vehicle = application.vehicle || {};
    const documents = application.documents || {};
    const status = application.status || 'submitted';
    
    // Build document list
    const documentTypes = [
        { key: 'registrationCert', label: 'Registration Certificate (OR/CR)', icon: 'fa-car' },
        { key: 'insuranceCert', label: 'Insurance Certificate', icon: 'fa-shield-alt' },
        { key: 'emissionCert', label: 'Emission Certificate', icon: 'fa-leaf' },
        { key: 'ownerId', label: 'Owner ID', icon: 'fa-id-card' },
        { key: 'deedOfSale', label: 'Deed of Sale', icon: 'fa-file-contract' },
        { key: 'validId', label: 'Valid ID', icon: 'fa-id-badge' }
    ];
    
    let documentListHTML = '';
    let hasDocuments = false;
    
    documentTypes.forEach(docType => {
        const docUrl = documents[docType.key];
        if (docUrl) {
            hasDocuments = true;
            documentListHTML += `
                <div class="doc-select-item" onclick="openDocumentFromModal('${docUrl}', '${docType.label}')">
                    <div class="doc-select-icon">
                        <i class="fas ${docType.icon}"></i>
                    </div>
                    <div class="doc-select-info">
                        <div class="doc-select-title">${docType.label}</div>
                        <div class="doc-select-status">
                            <i class="fas fa-check-circle" style="color: #27ae60;"></i> Uploaded
                        </div>
                    </div>
                    <div class="doc-select-action">
                        <i class="fas fa-external-link-alt"></i>
                    </div>
                </div>
            `;
        }
    });
    
    if (!hasDocuments) {
        documentListHTML = `
            <div style="text-align: center; padding: 2rem; color: #7f8c8d;">
                <i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>No documents uploaded yet</p>
            </div>
        `;
    }
    
    const modal = document.createElement('div');
    modal.id = 'applicationDetailsModal';
    modal.className = 'owner-details-modal';
    modal.innerHTML = `
        <div class="owner-modal-overlay" onclick="closeApplicationDetailsModal()"></div>
        <div class="owner-modal-content">
            <div class="owner-modal-header">
                <div class="owner-modal-title">
                    <div class="owner-modal-icon">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <div>
                        <h3>Application Details</h3>
                        <small>ID: ${application.id}</small>
                    </div>
                </div>
                <button class="owner-modal-close" onclick="closeApplicationDetailsModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="owner-modal-body">
                <!-- Status Banner -->
                <div class="status-banner status-banner-${status}">
                    <i class="fas ${getStatusIcon(status)}"></i>
                    <span>${getStatusText(status)}</span>
                </div>
                
                <!-- Vehicle Info Section -->
                <div class="detail-section">
                    <h4><i class="fas fa-car"></i> Vehicle Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Make</span>
                            <span class="detail-value">${vehicle.make || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Model</span>
                            <span class="detail-value">${vehicle.model || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Year</span>
                            <span class="detail-value">${vehicle.year || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Plate Number</span>
                            <span class="detail-value">${vehicle.plateNumber || 'Pending'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">VIN</span>
                            <span class="detail-value">${vehicle.vin || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Color</span>
                            <span class="detail-value">${vehicle.color || 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                <!-- Documents Section -->
                <div class="detail-section">
                    <h4><i class="fas fa-folder-open"></i> Documents</h4>
                    <p style="color: #7f8c8d; font-size: 0.875rem; margin-bottom: 1rem;">Click on a document to view it</p>
                    <div class="doc-select-list">
                        ${documentListHTML}
                    </div>
                </div>
                
                <!-- Timeline Section -->
                <div class="detail-section">
                    <h4><i class="fas fa-history"></i> Application Timeline</h4>
                    <div class="mini-timeline">
                        <div class="mini-timeline-item ${status !== 'rejected' ? 'completed' : ''}">
                            <div class="mini-timeline-dot"></div>
                            <div class="mini-timeline-content">
                                <strong>Submitted</strong>
                                <small>${application.submittedDate ? new Date(application.submittedDate).toLocaleDateString() : 'N/A'}</small>
                            </div>
                        </div>
                        <div class="mini-timeline-item ${status === 'processing' || status === 'approved' || status === 'completed' ? 'completed' : ''}">
                            <div class="mini-timeline-dot"></div>
                            <div class="mini-timeline-content">
                                <strong>Under Review</strong>
                                <small>${status === 'processing' ? 'In Progress' : status === 'submitted' ? 'Pending' : 'Completed'}</small>
                            </div>
                        </div>
                        <div class="mini-timeline-item ${status === 'approved' || status === 'completed' ? 'completed' : status === 'rejected' ? 'rejected' : ''}">
                            <div class="mini-timeline-dot"></div>
                            <div class="mini-timeline-content">
                                <strong>${status === 'rejected' ? 'Rejected' : 'Approved'}</strong>
                                <small>${status === 'approved' || status === 'completed' || status === 'rejected' ? new Date().toLocaleDateString() : 'Pending'}</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="owner-modal-footer">
                ${hasDocuments ? `
                    <button class="btn-primary" onclick="viewAllDocuments('${application.id}', '${vehicle.vin || ''}')">
                        <i class="fas fa-folder-open"></i> View All Documents
                    </button>
                ` : ''}
                <button class="btn-secondary" onclick="closeApplicationDetailsModal()">
                    Close
                </button>
            </div>
        </div>
    `;
    
    // Add styles
    if (!document.getElementById('owner-modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'owner-modal-styles';
        styles.textContent = `
            .owner-details-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .owner-modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
            }
            .owner-modal-content {
                position: relative;
                background: white;
                border-radius: 16px;
                max-width: 600px;
                width: 95%;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                animation: modalSlideIn 0.3s ease;
            }
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            .owner-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 1.5rem;
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                color: white;
            }
            .owner-modal-title {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            .owner-modal-icon {
                width: 48px;
                height: 48px;
                background: rgba(255,255,255,0.2);
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.25rem;
            }
            .owner-modal-title h3 {
                margin: 0;
                font-size: 1.25rem;
            }
            .owner-modal-title small {
                opacity: 0.8;
                font-size: 0.75rem;
            }
            .owner-modal-close {
                background: rgba(255,255,255,0.1);
                border: none;
                color: white;
                width: 40px;
                height: 40px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 1.25rem;
                transition: background 0.2s;
            }
            .owner-modal-close:hover {
                background: rgba(255,255,255,0.2);
            }
            .owner-modal-body {
                flex: 1;
                overflow-y: auto;
                padding: 1.5rem;
            }
            .status-banner {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 1rem;
                border-radius: 12px;
                margin-bottom: 1.5rem;
                font-weight: 600;
            }
            .status-banner-submitted, .status-banner-pending {
                background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
                color: white;
            }
            .status-banner-approved, .status-banner-completed {
                background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
                color: white;
            }
            .status-banner-rejected {
                background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                color: white;
            }
            .status-banner-processing {
                background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                color: white;
            }
            .detail-section {
                margin-bottom: 1.5rem;
            }
            .detail-section h4 {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin: 0 0 1rem 0;
                color: #2c3e50;
                font-size: 1rem;
                padding-bottom: 0.5rem;
                border-bottom: 2px solid #e9ecef;
            }
            .detail-section h4 i {
                color: #3498db;
            }
            .detail-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
            }
            .detail-item {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
            }
            .detail-label {
                font-size: 0.75rem;
                color: #7f8c8d;
                text-transform: uppercase;
                font-weight: 600;
            }
            .detail-value {
                font-size: 1rem;
                color: #2c3e50;
                font-weight: 500;
            }
            .doc-select-list {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            .doc-select-item {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                background: #f8f9fa;
                border: 2px solid #e9ecef;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.2s;
            }
            .doc-select-item:hover {
                border-color: #3498db;
                background: #e3f2fd;
                transform: translateX(4px);
            }
            .doc-select-icon {
                width: 44px;
                height: 44px;
                background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                color: white;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.25rem;
            }
            .doc-select-info {
                flex: 1;
            }
            .doc-select-title {
                font-weight: 600;
                color: #2c3e50;
            }
            .doc-select-status {
                font-size: 0.75rem;
                color: #7f8c8d;
                display: flex;
                align-items: center;
                gap: 0.25rem;
            }
            .doc-select-action {
                color: #3498db;
                font-size: 1rem;
            }
            .mini-timeline {
                display: flex;
                flex-direction: column;
                gap: 0;
                position: relative;
                padding-left: 1.5rem;
            }
            .mini-timeline::before {
                content: '';
                position: absolute;
                left: 6px;
                top: 8px;
                bottom: 8px;
                width: 2px;
                background: #e9ecef;
            }
            .mini-timeline-item {
                display: flex;
                align-items: flex-start;
                gap: 1rem;
                padding: 0.5rem 0;
                position: relative;
            }
            .mini-timeline-dot {
                width: 14px;
                height: 14px;
                background: #e9ecef;
                border-radius: 50%;
                position: absolute;
                left: -1.5rem;
                top: 0.6rem;
                z-index: 1;
            }
            .mini-timeline-item.completed .mini-timeline-dot {
                background: #27ae60;
            }
            .mini-timeline-item.rejected .mini-timeline-dot {
                background: #e74c3c;
            }
            .mini-timeline-content {
                display: flex;
                flex-direction: column;
            }
            .mini-timeline-content strong {
                color: #2c3e50;
                font-size: 0.9rem;
            }
            .mini-timeline-content small {
                color: #7f8c8d;
                font-size: 0.75rem;
            }
            .owner-modal-footer {
                display: flex;
                gap: 1rem;
                padding: 1rem 1.5rem;
                border-top: 2px solid #e9ecef;
                justify-content: flex-end;
            }
            .owner-modal-footer button {
                padding: 0.75rem 1.5rem;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            }
            @media (max-width: 480px) {
                .detail-grid {
                    grid-template-columns: 1fr;
                }
                .owner-modal-footer {
                    flex-direction: column;
                }
                .owner-modal-footer button {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function closeApplicationDetailsModal() {
    const modal = document.getElementById('applicationDetailsModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

function getStatusIcon(status) {
    const icons = {
        'submitted': 'fa-clock',
        'pending': 'fa-clock',
        'processing': 'fa-spinner fa-spin',
        'approved': 'fa-check-circle',
        'completed': 'fa-check-double',
        'rejected': 'fa-times-circle'
    };
    return icons[status] || 'fa-question-circle';
}

function openDocumentFromModal(docUrl, docLabel) {
    closeApplicationDetailsModal();
    
    // Use the document modal if available
    if (typeof DocumentModal !== 'undefined') {
        DocumentModal.view({
            url: docUrl,
            filename: docLabel,
            type: docLabel
        });
    } else {
        // Fallback to opening in new tab
        window.open(docUrl, '_blank');
    }
}

function viewAllDocuments(applicationId, vin) {
    closeApplicationDetailsModal();
    
    if (vin) {
        window.location.href = `document-viewer.html?vin=${encodeURIComponent(vin)}`;
    } else {
        window.location.href = `document-viewer.html?appId=${applicationId}`;
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
