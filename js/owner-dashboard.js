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
                // Check if user has hpg_admin role and redirect to HPG dashboard
                if (AuthUtils.hasRole('hpg_admin')) {
                    console.log('🔄 Redirecting HPG admin to HPG dashboard...');
                    showNotification('Redirecting to HPG Admin Dashboard...', 'info');
                    setTimeout(() => {
                        window.location.href = 'hpg-admin-dashboard.html';
                    }, 1000);
                    return;
                }
                
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
    
    // Initialize pagination after a short delay to ensure table is rendered
    setTimeout(() => {
        initializePagination();
    }, 100);
});

// Pagination state
let currentPage = 1;
const itemsPerPage = 10;
let allApplications = [];
let filteredApplications = [];

// Silent refresh system
let isUserInteracting = false;
let lastInteractionTime = Date.now();
let isPageVisible = true;

// Check blockchain connection status
async function updateBlockchainStatus() {
    const badge = document.getElementById('blockchainStatusBadge');
    if (!badge) return;
    
    const indicator = badge.querySelector('.status-indicator');
    const text = badge.querySelector('.status-text');
    
    if (!indicator || !text) return;
    
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get('/api/blockchain/status');
        
        if (response.success && response.blockchain) {
            const blockchain = response.blockchain;
            if (blockchain.status === 'CONNECTED') {
                indicator.className = 'status-indicator connected';
                const peerCount = blockchain.peers ? blockchain.peers.filter(p => p.status === 'UP').length : 1;
                text.textContent = `Hyperledger Fabric: Connected (${peerCount} peers)`;
                badge.title = `Network: ${blockchain.networkName || blockchain.network || 'ltochannel'}\nChaincode: ${blockchain.chaincodeName || 'vehicle-registration'}`;
            } else {
                indicator.className = 'status-indicator disconnected';
                text.textContent = 'Blockchain: Disconnected';
                badge.title = 'Hyperledger Fabric network is unavailable';
            }
        } else {
            indicator.className = 'status-indicator disconnected';
            text.textContent = 'Blockchain: Disconnected';
            badge.title = 'Unable to check blockchain status';
        }
    } catch (error) {
        indicator.className = 'status-indicator disconnected';
        text.textContent = 'Blockchain: Error';
        badge.title = 'Failed to check blockchain status';
        console.error('Blockchain status check failed:', error);
    }
}

function initializeOwnerDashboard() {
    // Initialize user information
    updateUserInfo();
    
    // Initialize dashboard functionality
    updateOwnerStats();
    
    // Initialize blockchain status
    updateBlockchainStatus();
    setInterval(updateBlockchainStatus, 30000);
    
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
        const token = (typeof window !== 'undefined' && window.authManager) 
            ? window.authManager.getAccessToken() 
            : (localStorage.getItem('authToken') || localStorage.getItem('token'));
        
        // Check if it's a demo token - if so, skip API calls and use localStorage data
        if (token && token.startsWith('demo-token-')) {
            console.log('Demo mode: Using localStorage data instead of API');
            // Load from localStorage if available
            const localApplications = JSON.parse(localStorage.getItem('userApplications') || '[]');
            if (localApplications.length > 0) {
                // FIX: Case-insensitive comparison
                stats.registeredVehicles = localApplications.filter(v => {
                    const status = (v.status || '').toUpperCase();
                    return status === 'APPROVED' || status === 'REGISTERED';
                }).length;
                stats.pendingApplications = localApplications.filter(v => {
                    if (typeof window !== 'undefined' && window.StatusUtils && window.StatusUtils.isPendingOrSubmitted) {
                        return window.StatusUtils.isPendingOrSubmitted(v.status);
                    }
                    const status = (v.status || '').toUpperCase();
                    return status === 'SUBMITTED' || status === 'PENDING' || status === 'PENDING_BLOCKCHAIN';
                }).length;
                stats.approvedApplications = localApplications.filter(v => {
                    if (typeof window !== 'undefined' && window.StatusUtils && window.StatusUtils.isApprovedOrRegistered) {
                        return window.StatusUtils.isApprovedOrRegistered(v.status);
                    }
                    const status = (v.status || '').toUpperCase();
                    return status === 'APPROVED' || status === 'REGISTERED';
                }).length;
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
                        
                        // FIX: Use case-insensitive status comparison
                        stats.registeredVehicles = vehicles.filter(v => {
                            const status = (v.status || '').toUpperCase();
                            return status === 'REGISTERED' || status === 'APPROVED';
                        }).length;
                        
                        stats.pendingApplications = vehicles.filter(v => {
                            const status = (v.status || '').toUpperCase();
                            return status === 'SUBMITTED' || status === 'PENDING_BLOCKCHAIN' || status === 'PROCESSING' || status === 'PENDING';
                        }).length;
                        
                        stats.approvedApplications = vehicles.filter(v => {
                            const status = (v.status || '').toUpperCase();
                            return status === 'APPROVED' || status === 'REGISTERED';
                        }).length;
                        
                        console.log('✅ Stats calculated:', {
                            total: vehicles.length,
                            registered: stats.registeredVehicles,
                            pending: stats.pendingApplications,
                            approved: stats.approvedApplications,
                            statuses: vehicles.map(v => v.status)
                        });
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
        // FIX: Case-insensitive comparison
        stats.registeredVehicles = localApplications.filter(v => {
            const status = (v.status || '').toUpperCase();
            return status === 'APPROVED' || status === 'REGISTERED';
        }).length;
        stats.pendingApplications = localApplications.filter(v => {
            const status = (v.status || '').toUpperCase();
            return status === 'SUBMITTED' || status === 'PENDING' || status === 'PENDING_BLOCKCHAIN';
        }).length;
        stats.approvedApplications = localApplications.filter(v => {
            const status = (v.status || '').toUpperCase();
            return status === 'APPROVED' || status === 'REGISTERED';
        }).length;
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
    
    // Strict: do not navigate to full-page document viewers.
    // Guide user to use the in-page modal / details view instead.
    showNotification('Please use the in-page document modal to view documents (no new tabs). Open the application details and click "View Documents".', 'info');
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
    
    // Set up auto-refresh for notifications (smart refresh - only when tab visible)
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            loadUserNotifications();
        }
    }, 120000); // Every 2 minutes instead of 5 seconds
}

function handleNotificationClick(e) {
    const notification = e.target.closest('.notification-item');
    const title = notification.querySelector('h4').textContent;
    
    // Mark as read (visual feedback)
    notification.style.opacity = '0.7';
    notification.style.backgroundColor = '#f8f9fa';
    
    showNotification(`Notification "${title}" marked as read`, 'success');
}

async function loadUserNotifications() {
    // Try multiple selectors including the modal notification list
    let notificationsList = null;
    const selectors = [
        '#notificationList', // Modal notification list
        '.notification-list', // Modal notification list class
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
        console.warn('⚠️ Could not find notifications list - this is normal if using the modal notification system');
        return;
    }
    
    // Load from API only (no localStorage fallback)
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get('/api/notifications');
        
        if (response && response.success && response.notifications) {
            renderNotifications(response.notifications);
        } else {
            renderNotifications([]);
        }
    } catch (err) {
        console.error('Failed to load notifications from API:', err);
        renderNotifications([]);
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
    
    const icon = notification.type === 'approved' ? '✅' : notification.type === 'info' ? 'ℹ️' : '❌';
    const timeAgo = getTimeAgo(notification.sentAt || notification.timestamp);
    
    element.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
            <h4>${notification.title}</h4>
            <p>${notification.message}</p>
            <small>${timeAgo}</small>
        </div>
    `;
    
    // Mark as read when clicked
    element.addEventListener('click', async function() {
        if (!notification.read) {
            await markNotificationAsRead(notification.id);
            element.classList.remove('unread');
            element.classList.add('read');
        }
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

async function markNotificationAsRead(notificationId) {
    console.log('🔔 [MARK READ] Marking notification as read, ID:', notificationId);
    
    // Find button by data-id attribute on parent notification item
    const notificationItem = document.querySelector(`.notification-item[data-id="${notificationId}"], .notification-item[data-id="${String(notificationId)}"]`);
    const button = notificationItem?.querySelector('.btn-mark-read');
    const originalButtonText = button?.innerHTML || '';
    const originalButtonDisabled = button?.disabled || false;
    
    if (button) {
        button.disabled = true;
        button.style.opacity = '0.6';
        button.style.cursor = 'not-allowed';
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Marking...';
    }
    
    // Get the global notifications array if it exists (from owner-dashboard.html)
    const globalNotifications = window.notifications || [];
    const notification = globalNotifications.find(n => n.id === notificationId || String(n.id) === String(notificationId));
    
    // Store original state for rollback
    let originalReadState = null;
    
    // Optimistically update UI if notification found in global array
    if (notification) {
        originalReadState = notification.read;
        notification.read = true;
        
        // Update localStorage immediately
        try {
            localStorage.setItem('ownerNotifications', JSON.stringify(globalNotifications));
        } catch (e) {
            console.error('Error saving to localStorage:', e);
        }
        
        // Update UI if renderNotifications function exists
        if (typeof window.renderNotifications === 'function') {
            window.renderNotifications();
        }
        
        // Update badge if function exists
        if (typeof window.updateNotificationBadge === 'function') {
            window.updateNotificationBadge();
        }
    }
    
    try {
        const apiClient = window.apiClient || new APIClient();
        console.log('📡 [MARK READ] Calling API to mark notification as read...');
        console.log('📡 [MARK READ] Notification ID:', notificationId);
        console.log('📡 [MARK READ] API Client:', apiClient);
        console.log('📡 [MARK READ] Auth Token:', apiClient.getAuthToken() ? 'Present' : 'Missing');
        
        // Use patch method
        const response = await apiClient.patch(`/api/notifications/${notificationId}/read`, {});
        
        console.log('✅ [MARK READ] API response:', response);
        console.log('✅ [MARK READ] Response type:', typeof response);
        console.log('✅ [MARK READ] Response success:', response?.success);
        
        if (response && response.success) {
            // Update notification with server response if available
            if (response.notification && notification) {
                notification.read = true;
                notification.readAt = response.notification.readAt;
                try {
                    localStorage.setItem('ownerNotifications', JSON.stringify(globalNotifications));
                } catch (e) {
                    console.error('Error saving to localStorage:', e);
                }
            }
            
            // Reload notifications to reflect the change
            if (typeof loadUserNotifications === 'function') {
                await loadUserNotifications();
            }
            
            // Update UI
            if (typeof window.renderNotifications === 'function') {
                window.renderNotifications();
            }
            if (typeof window.updateNotificationBadge === 'function') {
                window.updateNotificationBadge();
            }
            
            // Show success message
            if (typeof showNotification === 'function') {
                showNotification('Notification marked as read', 'success');
            } else if (typeof ToastNotification !== 'undefined') {
                ToastNotification.show('Notification marked as read', 'success');
            }
            
            console.log('✅ [MARK READ] Successfully marked notification as read');
        } else {
            const errorMsg = response?.error || response?.message || 'Failed to mark notification as read';
            console.error('❌ [MARK READ] API returned unsuccessful response:', response);
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error('❌ [MARK READ] Error marking notification as read:', error);
        console.error('❌ [MARK READ] Error details:', {
            message: error?.message,
            error: error?.error,
            status: error?.status,
            isServerError: error?.isServerError,
            stack: error?.stack
        });
        
        // Log the full error object for debugging
        console.error('❌ [MARK READ] Full error object:', error);
        
        // Revert optimistic update on error
        if (notification && originalReadState !== null) {
            notification.read = originalReadState;
            try {
                localStorage.setItem('ownerNotifications', JSON.stringify(globalNotifications));
            } catch (e) {
                console.error('Error reverting in localStorage:', e);
            }
            
            // Update UI
            if (typeof window.renderNotifications === 'function') {
                window.renderNotifications();
            }
            if (typeof window.updateNotificationBadge === 'function') {
                window.updateNotificationBadge();
            }
        }
        
        // Extract error message
        let errorMessage = 'Failed to mark notification as read';
        if (error?.message) {
            errorMessage = error.message;
        } else if (error?.error) {
            errorMessage = error.error;
        } else if (typeof error === 'string') {
            errorMessage = error;
        }
        
        // Show error message
        if (typeof showNotification === 'function') {
            showNotification(errorMessage, 'error');
        } else if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show(errorMessage, 'error');
        } else {
            alert(errorMessage);
        }
    } finally {
        // Re-enable button
        if (button) {
            button.disabled = originalButtonDisabled;
            button.style.opacity = '';
            button.style.cursor = '';
            button.innerHTML = originalButtonText;
        }
    }
}

async function deleteNotification(notificationId) {
    console.log('🗑️ [DELETE] Deleting notification, ID:', notificationId);
    
    if (!confirm('Are you sure you want to delete this notification?')) {
        return;
    }
    
    // Find button by data-id attribute on parent notification item
    const notificationItem = document.querySelector(`.notification-item[data-id="${notificationId}"], .notification-item[data-id="${String(notificationId)}"]`);
    const button = notificationItem?.querySelector('.btn-delete');
    const originalButtonText = button?.innerHTML || '';
    const originalButtonDisabled = button?.disabled || false;
    
    if (button) {
        button.disabled = true;
        button.style.opacity = '0.6';
        button.style.cursor = 'not-allowed';
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    }
    
    // Get the global notifications array if it exists (from owner-dashboard.html)
    const globalNotifications = window.notifications || [];
    const notification = globalNotifications.find(n => n.id === notificationId || String(n.id) === String(notificationId));
    
    if (!notification) {
        console.error('❌ [DELETE] Notification not found:', notificationId);
        const errorMsg = 'Notification not found';
        if (typeof showNotification === 'function') {
            showNotification(errorMsg, 'error');
        } else if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show(errorMsg, 'error');
        }
        
        // Re-enable button
        if (button) {
            button.disabled = originalButtonDisabled;
            button.style.opacity = '';
            button.style.cursor = '';
            button.innerHTML = originalButtonText;
        }
        return;
    }
    
    // Store original array for rollback
    const originalNotifications = [...globalNotifications];
    
    // Optimistically remove from array
    const filteredNotifications = globalNotifications.filter(n => n.id !== notificationId && String(n.id) !== String(notificationId));
    window.notifications = filteredNotifications;
    
    // Update localStorage immediately
    try {
        localStorage.setItem('ownerNotifications', JSON.stringify(filteredNotifications));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
    
    // Update UI immediately
    if (typeof window.renderNotifications === 'function') {
        window.renderNotifications();
    }
    if (typeof window.updateNotificationBadge === 'function') {
        window.updateNotificationBadge();
    }
    
    // Delete via API
    try {
        const apiClient = window.apiClient || new APIClient();
        console.log('📡 [DELETE] Calling API to delete notification...');
        
        const response = await apiClient.delete(`/api/notifications/${notificationId}`);
        
        console.log('✅ [DELETE] API response:', response);
        
        if (response && response.success !== false) {
            console.log('✅ [DELETE] Successfully deleted notification');
            
            // Show success message
            if (typeof showNotification === 'function') {
                showNotification('Notification deleted', 'success');
            } else if (typeof ToastNotification !== 'undefined') {
                ToastNotification.show('Notification deleted', 'success');
            }
            
            // Reload notifications
            if (typeof loadUserNotifications === 'function') {
                await loadUserNotifications();
            }
        } else {
            throw new Error(response?.error || 'Failed to delete notification');
        }
    } catch (error) {
        console.error('❌ [DELETE] Error deleting notification:', error);
        console.error('❌ [DELETE] Error details:', {
            message: error?.message,
            error: error?.error,
            status: error?.status,
            stack: error?.stack
        });
        
        // Revert optimistic update on error
        window.notifications = originalNotifications;
        try {
            localStorage.setItem('ownerNotifications', JSON.stringify(originalNotifications));
        } catch (e) {
            console.error('Error reverting in localStorage:', e);
        }
        
        // Update UI
        if (typeof window.renderNotifications === 'function') {
            window.renderNotifications();
        }
        if (typeof window.updateNotificationBadge === 'function') {
            window.updateNotificationBadge();
        }
        
        // Extract error message
        let errorMessage = 'Failed to delete notification';
        if (error?.message) {
            errorMessage = error.message;
        } else if (error?.error) {
            errorMessage = error.error;
        } else if (typeof error === 'string') {
            errorMessage = error;
        }
        
        // Show error message
        if (typeof showNotification === 'function') {
            showNotification(errorMessage, 'error');
        } else if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show(errorMessage, 'error');
        } else {
            alert(errorMessage);
        }
    } finally {
        // Re-enable button
        if (button) {
            button.disabled = originalButtonDisabled;
            button.style.opacity = '';
            button.style.cursor = '';
            button.innerHTML = originalButtonText;
        }
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
    // Use ToastNotification if available, otherwise fallback to alert
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show(message, type);
    } else {
        // Fallback notification
        console.warn('ToastNotification not available, using alert fallback:', message);
        alert(message);
    }
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
    // Ensure registrations tab is visible on initial load
    const registrationsTab = document.getElementById('registrations-tab');
    const transfersTab = document.getElementById('transfers-tab');
    
    if (registrationsTab && transfersTab) {
        registrationsTab.style.display = 'block';
        transfersTab.style.display = 'none';
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(loadUserApplications, 100);
        });
    } else {
        // DOM is ready, but wait a bit for dynamic content
        setTimeout(loadUserApplications, 100);
    }
    
    // Set up auto-refresh for applications (silent background refresh)
    setInterval(() => {
        // Only refresh if page is visible and user is not actively interacting
        if (isPageVisible && !isUserInteracting && (Date.now() - lastInteractionTime) > 30000) {
            loadUserApplications(true); // Silent refresh
        }
    }, 120000); // Update every 2 minutes instead of 30 seconds
}

// Track user interactions to pause auto-refresh
['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, () => {
        isUserInteracting = true;
        lastInteractionTime = Date.now();
        setTimeout(() => {
            isUserInteracting = false;
        }, 30000); // Consider inactive after 30 seconds
    }, { passive: true });
});

// Track page visibility
document.addEventListener('visibilitychange', () => {
    isPageVisible = !document.hidden;
});

async function loadUserApplications(isSilent = false) {
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
    
    // Target the registrations tbody specifically
    const applicationsTable = document.getElementById('my-registrations-tbody');
    
    if (!applicationsTable) {
        console.error('❌ Could not find registrations table (#my-registrations-tbody). Retrying...');
        // Retry after a short delay
        setTimeout(() => loadUserApplications(isSilent), 500);
        return;
    }
    
    console.log('✅ Found registrations table (#my-registrations-tbody)');
    
    // Only show loading if NOT silent refresh
    if (!isSilent && applicationsTable) {
        applicationsTable.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Loading applications...</td></tr>';
    }
    
    try {
        // Try to load from API first
        const token = (typeof window !== 'undefined' && window.authManager) 
            ? window.authManager.getAccessToken() 
            : (localStorage.getItem('authToken') || localStorage.getItem('token'));
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
                    
                    // Convert vehicles to application format using canonical mapper
                    const mapper = (window.VehicleMapper && window.VehicleMapper.mapVehicleToApplication) || null;
                    if (!mapper) {
                        console.error('❌ VehicleMapper not available. Make sure js/models/vehicle-mapper.js is loaded.');
                        throw new Error('VehicleMapper not available');
                    }
                    
                    allApplications = response.vehicles.map(vehicle => mapper(vehicle));
                    
                    // For vehicles with active transfer requests, use transfer request verification status
                    // Transfer requests need buyer documents before auto-verification can run
                    // Don't show original registration verification status for pending transfer requests
                    try {
                        const transferResponse = await apiClient.get('/api/vehicles/transfer/requests?limit=100');
                        if (transferResponse.success && transferResponse.requests) {
                            // Group transfer requests by vehicle_id
                            const transferRequestsByVehicle = {};
                            transferResponse.requests.forEach(tr => {
                                const vehicleId = tr.vehicle_id || tr.vehicle?.id;
                                if (vehicleId) {
                                    if (!transferRequestsByVehicle[vehicleId]) {
                                        transferRequestsByVehicle[vehicleId] = [];
                                    }
                                    transferRequestsByVehicle[vehicleId].push(tr);
                                }
                            });
                            
                            // Update verification status for vehicles with active transfer requests
                            allApplications.forEach(app => {
                                const vehicleId = app.id;
                                const transferRequests = transferRequestsByVehicle[vehicleId] || [];
                                
                                // Find the most recent active transfer request
                                const activeTransfer = transferRequests
                                    .filter(tr => ['PENDING', 'AWAITING_BUYER_DOCS', 'UNDER_REVIEW'].includes(tr.status))
                                    .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))[0];
                                
                                if (activeTransfer) {
                                    // For PENDING or AWAITING_BUYER_DOCS: Clear verification status (buyer hasn't uploaded docs yet)
                                    if (activeTransfer.status === 'PENDING' || activeTransfer.status === 'AWAITING_BUYER_DOCS') {
                                        app.verificationStatus = {}; // Clear - buyer hasn't uploaded documents yet
                                    } else if (activeTransfer.status === 'UNDER_REVIEW') {
                                        // For UNDER_REVIEW: Use transfer request's approval status instead of vehicle's original verifications
                                        app.verificationStatus = {
                                            insurance: activeTransfer.insurance_approval_status?.toLowerCase() || 'pending',
                                            hpg: activeTransfer.hpg_approval_status?.toLowerCase() || 'pending'
                                        };
                                    }
                                }
                            });
                        }
                    } catch (transferError) {
                        console.warn('Could not load transfer requests for verification status check:', transferError);
                        // Continue without transfer request check
                    }
                    
                    // Save to localStorage for offline access (v2 format)
                    localStorage.setItem('userApplications_v2', JSON.stringify(allApplications));
                    console.log(`💾 Saved ${allApplications.length} applications to localStorage (v2)`);
                    
                    // Keep v1 for backward compatibility (read-only, don't overwrite if it exists)
                    if (!localStorage.getItem('userApplications')) {
                        localStorage.setItem('userApplications', JSON.stringify(allApplications));
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
        
        // Fallback to localStorage with migration support
        console.log('📦 Loading from localStorage...');
        
        // Try v2 first
        let localApps = JSON.parse(localStorage.getItem('userApplications_v2') || '[]');
        
        // If v2 is empty but v1 exists, migrate
        if (localApps.length === 0) {
            const v1Apps = JSON.parse(localStorage.getItem('userApplications') || '[]');
            if (v1Apps.length > 0) {
                console.log(`🔄 Migrating ${v1Apps.length} applications from v1 to v2...`);
                const mapper = (window.VehicleMapper && window.VehicleMapper.mapVehicleToApplication) || null;
                
                if (mapper) {
                    // Attempt to migrate old entries
                    try {
                        localApps = v1Apps.map(oldApp => {
                            // If old app already has the structure, try to map it through the mapper
                            // by treating it as a vehicle-like object
                            if (oldApp.vehicle && oldApp.id) {
                                // Reconstruct vehicle-like object from old app (using Object.assign for compatibility)
                                const vehicleLike = Object.assign({
                                    id: oldApp.id,
                                    orCrNumber: oldApp.or_cr_number,
                                    status: oldApp.status,
                                    registrationDate: oldApp.submittedDate,
                                    documents: oldApp.documents || [],
                                    verificationStatus: oldApp.verificationStatus || {}
                                }, oldApp.vehicle);
                                return mapper(vehicleLike);
                            }
                            return oldApp; // Fallback to old structure if migration fails
                        });
                        
                        // Save migrated data to v2
                        localStorage.setItem('userApplications_v2', JSON.stringify(localApps));
                        console.log(`✅ Migration complete: ${localApps.length} applications migrated`);
                    } catch (migrationError) {
                        console.error('❌ Migration failed, using v1 data as-is:', migrationError);
                        localApps = v1Apps;
                    }
                } else {
                    console.warn('⚠️ Mapper not available for migration, using v1 data as-is');
                    localApps = v1Apps;
                }
            }
        }
        
        console.log(`📦 Found ${localApps.length} applications in localStorage`);
        allApplications = localApps;
        
        if (allApplications.length === 0) {
            console.log('ℹ️ No applications found in localStorage');
            applicationsTable.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px; color: #666;">
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
                <td colspan="7" style="text-align: center; padding: 20px; color: #dc3545;">
                    Error loading applications: ${error.message}. Please refresh the page.
                </td>
            </tr>
        `;
    }
}

// Load transfer requests for the current owner
async function loadOwnerTransferRequests() {
    try {
        const tbody = document.getElementById('my-transfers-tbody');
        if (!tbody) {
            console.warn('Transfer requests tbody not found');
            return;
        }
        
        // Convert tables to mobile cards after rendering transfers
        setTimeout(() => {
            if (typeof convertTablesToCards === 'function') {
                convertTablesToCards();
            }
        }, 100);
        
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Loading transfer requests...</td></tr>';
        
        const apiClient = window.apiClient || new APIClient();
        
        // Get transfer requests where current user is seller or buyer
        const response = await apiClient.get('/api/vehicles/transfer/requests?limit=50');
        
        if (!response.success || !response.requests || response.requests.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                        <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        <p>No transfer requests found</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Filter to only show requests where current user is involved
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const currentUserId = currentUser.id || currentUser.userId;
        const currentUserEmail = currentUser.email;
        
        const userRequests = response.requests.filter(r => {
            // User is seller
            if (r.seller_id === currentUserId || r.seller_email === currentUserEmail) {
                return true;
            }
            // User is buyer
            if (r.buyer_id === currentUserId || r.buyer_email === currentUserEmail) {
                return true;
            }
            return false;
        });
        
        if (userRequests.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                        <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                        <p>No transfer requests found</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = userRequests.map(r => {
            const vehicleInfo = r.vehicle || {};
            const isSeller = r.seller_id === currentUserId || r.seller_email === currentUserEmail;
            const otherParty = isSeller 
                ? (r.buyer_name || r.buyer_email || 'Buyer')
                : (r.seller_name || r.seller_email || 'Seller');
            const transferType = isSeller ? 'Selling' : 'Buying';
            
            return `
                <tr>
                    <td>
                        <div class="vehicle-info">
                            <strong>${vehicleInfo.plate_number || vehicleInfo.vin || 'N/A'}</strong>
                            <br><small>${vehicleInfo.make || ''} ${vehicleInfo.model || ''} ${vehicleInfo.year || ''}</small>
                        </div>
                    </td>
                    <td><code style="font-size: 0.85rem;">${(r.id || '').substring(0, 8)}...</code></td>
                    <td><span class="badge">${transferType}</span></td>
                    <td>${otherParty}</td>
                    <td><span class="status-badge status-${(r.status || '').toLowerCase()}">${r.status || 'N/A'}</span></td>
                    <td>
                        <button class="btn-secondary btn-sm" onclick="viewTransferRequest('${r.id}')">View</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Convert tables to mobile cards after rendering transfers
        setTimeout(() => {
            if (typeof convertTablesToCards === 'function') {
                convertTablesToCards();
            }
        }, 100);
        
    } catch (error) {
        console.error('Error loading transfer requests:', error);
        const tbody = document.getElementById('my-transfers-tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: #e74c3c;">
                        <i class="fas fa-exclamation-triangle"></i> Error loading transfer requests
                    </td>
                </tr>
            `;
        }
    }
}

// View transfer request details
function viewTransferRequest(requestId) {
    window.location.href = `transfer-confirmation.html?requestId=${requestId}`;
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
        var v = (statusFilter.value || '').toLowerCase();
        filtered = filtered.filter(function(app) {
            var s = (app.status || '').toLowerCase();
            return s === v || (v === 'approved' && (s === 'registered' || s === 'approved'));
        });
    }
    
    return filtered;
}

function renderApplications() {
    // Try multiple selectors
    // Target the registrations tbody specifically
    const applicationsTable = document.getElementById('my-registrations-tbody');
    
    if (!applicationsTable) {
        console.error('❌ Could not find registrations table (#my-registrations-tbody) for rendering');
        return;
    }
    
    // Only clear if table has content (prevents flicker during silent refresh)
    if (applicationsTable.children.length > 0) {
        applicationsTable.innerHTML = '';
    }
    
    if (filteredApplications.length === 0) {
        applicationsTable.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 20px; color: #666;">
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
    
    // Convert tables to mobile cards after rendering
    setTimeout(() => {
        if (typeof convertTablesToCards === 'function') {
            convertTablesToCards();
        }
    }, 100);
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
            // Safely insert toolbar before table
            // Check if table is a direct child of tableContainer
            if (table.parentElement === tableContainer) {
                tableContainer.insertBefore(toolbar, table);
            } else {
                // Table is nested, insert at the beginning of tableContainer instead
                tableContainer.insertBefore(toolbar, tableContainer.firstChild);
            }
        } else {
            // Table not found yet, insert at beginning of container
            tableContainer.insertBefore(toolbar, tableContainer.firstChild);
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
    
    // Try multiple selectors for tbody
    const tbody = document.querySelector('.table-modern tbody') || 
                  document.querySelector('#applications .table-modern tbody') ||
                  document.querySelector('.dashboard-card:nth-child(3) .table tbody');
    
    if (tbody && !document.getElementById('pagination-container-owner')) {
        const paginationContainer = document.createElement('div');
        paginationContainer.id = 'pagination-container-owner';
        paginationContainer.style.marginTop = '1rem';
        
        // Find the table wrapper to append pagination
        const tableElement = tbody.closest('table');
        const tableWrapper = tableElement?.parentElement;
        if (tableWrapper) {
            tableWrapper.appendChild(paginationContainer);
        }
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

// Create blockchain proof section for vehicle cards
function createBlockchainProofSection(vehicle) {
    const hasBlockchainTx = vehicle.blockchainTxId || vehicle.blockchain_tx_id;
    const txId = hasBlockchainTx || 'Pending...';
    // Normalize status to uppercase for consistent comparison
    const normalizedStatus = (vehicle.status || '').toUpperCase();
    const isVerified = hasBlockchainTx && !['SUBMITTED', 'PENDING_BLOCKCHAIN'].includes(normalizedStatus);
    
    return `
        <div class="blockchain-proof-section ${isVerified ? 'verified' : 'pending'}">
            <div class="proof-header">
                <i class="fas fa-link"></i>
                <span>Blockchain Proof</span>
                ${isVerified ? 
                    '<span class="proof-badge verified"><i class="fas fa-check-circle"></i> Immutable</span>' : 
                    '<span class="proof-badge pending"><i class="fas fa-clock"></i> Pending</span>'
                }
            </div>
            <div class="proof-details">
                <div class="proof-item">
                    <span class="proof-label">Transaction ID:</span>
                    <code class="proof-value ${hasBlockchainTx ? 'clickable' : ''}" 
                          ${hasBlockchainTx ? `onclick="viewBlockchainTransaction('${txId}')"` : ''}>
                        ${hasBlockchainTx ? txId.substring(0, 16) + '...' : 'Awaiting confirmation'}
                    </code>
                </div>
                ${isVerified ? `
                <div class="proof-item">
                    <span class="proof-label">Network:</span>
                    <span class="proof-value">Hyperledger Fabric</span>
                </div>
                <div class="proof-item">
                    <span class="proof-label">Status:</span>
                    <span class="proof-value">
                        <i class="fas fa-lock" style="color: #27ae60;"></i> 
                        Tamper-Proof
                    </span>
                </div>
                ` : `
                <div class="proof-item">
                    <span class="proof-label">Status:</span>
                    <span class="proof-value">Broadcasting to network...</span>
                </div>
                `}
            </div>
            ${isVerified ? `
            <button class="btn-verify-blockchain" onclick="verifyOnBlockchain('${vehicle.vin || vehicle.vehicle?.vin || ''}')">
                <i class="fas fa-search"></i> Verify on Blockchain
            </button>
            ` : ''}
        </div>
    `;
}

// View blockchain transaction
function viewBlockchainTransaction(txId) {
    window.open(`/verify/${txId}`, '_blank');
}

// Verify on blockchain
function verifyOnBlockchain(vin) {
    if (!vin) {
        console.error('VIN is required for blockchain verification');
        return;
    }
    // Get transaction ID from vehicle data or query API
    // Use /api/vehicles/:vin route which allows vehicle owners to view their own vehicles
    const apiClient = window.apiClient || new APIClient();
    apiClient.get(`/api/vehicles/${vin}`)
        .then(response => {
            if (response.success && response.vehicle) {
                const vehicle = response.vehicle;
                const txId = vehicle.blockchain_tx_id || vehicle.blockchainTxId;
                if (txId) {
                    window.open(`/verify/${txId}`, '_blank');
                } else {
                    alert('Blockchain transaction ID not found for this vehicle.');
                }
            } else {
                alert('Vehicle not found or you do not have permission to view it.');
            }
        })
        .catch(error => {
            console.error('Error fetching vehicle:', error);
            alert('Could not fetch vehicle information for verification.');
        });
}

// Render timeline item with blockchain icon support
function renderTimelineItem(title, date, isCompleted, transactionId, action) {
    const hasBlockchainTx = transactionId && !transactionId.includes('-'); // UUIDs contain hyphens
    const isBlockchainAction = ['BLOCKCHAIN_REGISTERED', 'APPROVED', 'REGISTERED'].includes(action);
    const isBlockchainRecorded = hasBlockchainTx && isBlockchainAction;
    
    return `
        <div class="mini-timeline-item ${isCompleted ? 'completed' : ''} ${isBlockchainRecorded ? 'blockchain-recorded' : ''}">
            <div class="mini-timeline-dot">
                ${isBlockchainRecorded ? '<i class="fas fa-cube" style="font-size: 0.7rem;"></i>' : ''}
            </div>
            <div class="mini-timeline-content">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <strong>${title}</strong>
                    ${isBlockchainRecorded ? '<span class="immutable-badge" style="font-size: 0.65rem; padding: 2px 6px;"><i class="fas fa-lock"></i> Immutable</span>' : ''}
                </div>
                <small>${date || 'Pending'}</small>
                ${isBlockchainRecorded && transactionId ? `
                    <div class="blockchain-tx-info" style="margin-top: 6px; font-size: 0.75rem;">
                        <i class="fas fa-link" style="color: #3498db;"></i>
                        <code onclick="viewBlockchainTransaction('${transactionId}')" 
                              style="cursor: pointer; color: #3498db; text-decoration: underline;">
                            ${transactionId.substring(0, 20)}...
                        </code>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderStatusHistorySection(historyEntries) {
    if (!Array.isArray(historyEntries) || historyEntries.length === 0) {
        return `
            <div style="margin-top: 1rem; color: #6c757d; font-size: 0.85rem;">
                No detailed status history available for this application yet.
            </div>
        `;
    }

    let currentUser = {};
    try {
        currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    } catch (error) {
        console.warn('Failed to parse currentUser from localStorage:', error);
        currentUser = {};
    }
    const currentUserId = currentUser.id || currentUser.userId || null;
    const currentUserEmail = currentUser.email ? currentUser.email.toLowerCase() : null;
    const filteredHistory = historyEntries.filter(entry => {
        const action = (entry.action || '').toUpperCase();
        if (action.includes('REGISTRATION') || action.startsWith('STATUS_')) {
            return true;
        }
        if (action.includes('TRANSFER') || action.includes('OWNERSHIP_TRANSFERRED')) {
            const metadata = entry.metadata || {};
            const involvedIds = [metadata.previousOwnerId, metadata.newOwnerId].filter(Boolean);
            const involvedEmails = [metadata.previousOwnerEmail, metadata.newOwnerEmail]
                .filter(Boolean)
                .map(email => String(email).toLowerCase());
            if (involvedIds.length > 0 || involvedEmails.length > 0) {
                return (currentUserId && involvedIds.includes(currentUserId)) ||
                    (currentUserEmail && involvedEmails.includes(currentUserEmail));
            }
            return true;
        }
        if (action.includes('HPG') || action.includes('INSURANCE') || action.includes('EMISSION')) {
            return true;
        }
        if (action.includes('REJECTED')) {
            return true;
        }
        return false;
    });

    if (filteredHistory.length === 0) {
        return `
            <div style="margin-top: 1rem; color: #6c757d; font-size: 0.85rem;">
                Status history is not yet recorded for this application.
            </div>
        `;
    }

    const historyWithTimes = filteredHistory.map(entry => {
        const dateValue = entry.performed_at || entry.performedAt || entry.timestamp;
        const parsedTime = dateValue ? new Date(dateValue).getTime() : NaN;
        const safeParsedTime = Number.isFinite(parsedTime) ? parsedTime : NaN;
        return {
            entry,
            timeValue: safeParsedTime
        };
    });

    const sortedHistory = historyWithTimes.sort((a, b) => {
        const timeA = a.timeValue;
        const timeB = b.timeValue;
        if (Number.isNaN(timeA) && Number.isNaN(timeB)) return 0;
        if (Number.isNaN(timeA)) return 1;
        if (Number.isNaN(timeB)) return -1;
        return timeB - timeA;
    }).map(item => item.entry);

    const formattedHistory = sortedHistory.map(entry => {
        if (!entry.action) {
            console.warn('History entry missing action:', entry);
        }
        return {
            ...entry,
            performed_at: entry.performed_at || entry.performedAt || entry.timestamp,
            action: (entry.action || 'ACTION_NOT_SPECIFIED').toUpperCase().trim(),
            transaction_id: entry.transaction_id || entry.transactionId || null
        };
    });

    const historyHtml = formattedHistory.map(entry => renderHistoryItem(entry)).join('');

    return `
        <div style="margin-top: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; color: #1f2937; font-weight: 600; font-size: 0.9rem;">
                <i class="fas fa-stream" style="color: #3498db;"></i>
                <span>Status History</span>
            </div>
            <div class="history-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${historyHtml}
            </div>
        </div>
    `;
}

// Status action labels are normalized via formatAction during history rendering in renderHistoryItem.

// Render history item with blockchain icons (for use in history/audit sections)
function renderHistoryItem(historyEntry) {
    const hasBlockchainTx = historyEntry.transaction_id && !historyEntry.transaction_id.includes('-');
    const isBlockchainAction = ['BLOCKCHAIN_REGISTERED', 'OWNERSHIP_TRANSFERRED', 'VERIFICATION_APPROVED'].includes(historyEntry.action);
    
    return `
        <div class="history-item ${hasBlockchainTx ? 'blockchain-recorded' : 'database-only'}">
            <div class="history-icon">
                ${hasBlockchainTx ? 
                    '<i class="fas fa-cube" title="Recorded on Blockchain"></i>' : 
                    '<i class="fas fa-database" title="Database Record Only"></i>'
                }
            </div>
            <div class="history-content">
                <div class="history-header">
                    <span class="history-action">${formatAction(historyEntry.action)}</span>
                    <span class="history-timestamp">${formatDate(historyEntry.performed_at)}</span>
                </div>
                <p class="history-description">${historyEntry.description || ''}</p>
                ${hasBlockchainTx ? `
                    <div class="blockchain-tx-info">
                        <i class="fas fa-link"></i>
                        <code onclick="viewBlockchainTransaction('${historyEntry.transaction_id}')" 
                              style="cursor: pointer; color: #3498db;">
                            ${historyEntry.transaction_id.substring(0, 20)}...
                        </code>
                        <span class="immutable-badge">
                            <i class="fas fa-lock"></i> Immutable
                        </span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Helper functions for history rendering
function formatAction(action) {
    const actionMap = {
        'BLOCKCHAIN_REGISTERED': 'Blockchain Registration',
        'SUBMITTED': 'Application Submitted',
        'APPROVED': 'Application Approved',
        'REJECTED': 'Application Rejected',
        'OWNERSHIP_TRANSFERRED': 'Ownership Transferred',
        'VERIFICATION_APPROVED': 'Verification Approved',
        'REGISTRATION_SUBMITTED': 'Registration Submitted',
        'REGISTRATION_APPROVED': 'Registration Approved',
        'REGISTRATION_REJECTED': 'Registration Rejected',
        'REGISTRATION_PENDING_REVIEW': 'Registration Pending Review',
        'TRANSFER_REQUESTED': 'Transfer Requested',
        'TRANSFER_BUYER_ACCEPTED': 'Transfer Accepted by Buyer',
        'TRANSFER_APPROVED': 'Transfer Approved',
        'TRANSFER_REJECTED': 'Transfer Rejected',
        'TRANSFER_REQUEST_REJECTED': 'Transfer Request Rejected',
        'TRANSFER_COMPLETED': 'Transfer Completed',
        'TRANSFER_EXPIRED': 'Transfer Expired',
        'TRANSFER_HPG_REJECTED': 'Transfer HPG Rejected',
        'TRANSFER_INSURANCE_REJECTED': 'Transfer Insurance Rejected',
        'HPG_CLEARANCE_REJECTED': 'HPG Clearance Rejected',
        'INSURANCE_VERIFICATION_REJECTED': 'Insurance Verification Rejected',
        'INSURANCE_MANUAL_VERIFICATION': 'Insurance Manual Verification',
        'LTO_INSPECTION_COMPLETED': 'LTO Inspection Completed',
        'STATUS_APPROVED': 'Status Updated: Approved',
        'STATUS_REJECTED': 'Status Updated: Rejected',
        'STATUS_REGISTERED': 'Status Updated: Registered',
        'STATUS_SUBMITTED': 'Status Updated: Submitted',
        'STATUS_PENDING': 'Status Updated: Pending',
        'STATUS_PROCESSING': 'Status Updated: Processing',
        'STATUS_UPDATED': 'Status Updated'
    };
    return actionMap[action] || action.replace(/_/g, ' ');
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleString();
    } catch (e) {
        return dateString;
    }
}

function createUserApplicationRow(application) {
    const row = document.createElement('tr');
    // Get separate OR and CR numbers (new format)
    const orNumber = application.or_number || application.orNumber || application.vehicle?.or_number || application.vehicle?.orNumber || null;
    const crNumber = application.cr_number || application.crNumber || application.vehicle?.cr_number || application.vehicle?.crNumber || null;
    // Backward compatibility
    const orCrNumber = orNumber || crNumber || application.or_cr_number || application.vehicle?.or_cr_number || '-';
    const isApproved = application.status === 'approved' || application.status === 'registered';
    const rawId = (application.id || '');
    const appId = rawId.length <= 14 ? rawId : rawId.substring(0, 12) + '...';
    
    // Get verification status display
    const verificationStatus = application.verificationStatus || {};
    const verificationStatusText = getVerificationStatusDisplay(verificationStatus, application.status);
    
    // Format OR/CR display
    let orCrDisplay = '-';
    if (isApproved && (orNumber || crNumber)) {
        if (orNumber && crNumber) {
            orCrDisplay = `<div style="display: flex; flex-direction: column; gap: 4px;">
                <span style="background: #667eea; color: white; padding: 3px 6px; border-radius: 4px; font-size: 0.8rem;">OR: ${escapeHtml(orNumber)}</span>
                <span style="background: #11998e; color: white; padding: 3px 6px; border-radius: 4px; font-size: 0.8rem;">CR: ${escapeHtml(crNumber)}</span>
            </div>`;
        } else if (orNumber) {
            orCrDisplay = `<span style="background: #667eea; color: white; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.9rem;">OR: ${escapeHtml(orNumber)}</span>`;
        } else if (crNumber) {
            orCrDisplay = `<span style="background: #11998e; color: white; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.9rem;">CR: ${escapeHtml(crNumber)}</span>`;
        }
    } else if (isApproved && orCrNumber !== '-') {
        orCrDisplay = `<span style="background: #d4edda; color: #155724; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 0.9rem;">${escapeHtml(orCrNumber)}</span>`;
    }
    
    row.innerHTML = `
        <td>
            <div class="vehicle-info">
                <strong>${escapeHtml(application.vehicle?.make || '')} ${escapeHtml(application.vehicle?.model || '')} ${escapeHtml(application.vehicle?.year || '')}</strong>
                <br><small>${escapeHtml(application.vehicle?.plateNumber || '')}</small>
                ${renderOriginBadge(application.vehicle?.originType)}
            </div>
        </td>
        <td><code style="font-size: 0.85rem;">${appId}</code></td>
        <td>
            ${orCrDisplay !== '-' ? orCrDisplay : `<span style="color: #6c757d;">-</span>`}
        </td>
        <td>${application.submittedDate ? new Date(application.submittedDate).toLocaleDateString() : '-'}</td>
        <td>${verificationStatusText}</td>
        <td><span class="status-badge status-${application.status}">${getStatusText(application.status)}</span></td>
        <td class="app-actions-cell">
            <div class="app-actions-wrap">
                <button class="btn-secondary btn-sm" onclick="viewUserApplication('${application.id}')">View Details</button>
                ${isApproved && (orNumber || crNumber || orCrNumber !== '-') ? `<button class="btn-primary btn-sm" onclick="downloadVehicleCertificate('${application.id}', '${escapeHtml(orNumber || crNumber || orCrNumber)}')">Download Certificate</button>` : ''}
            </div>
        </td>
    `;
    return row;
}

function renderOriginBadge(originType) {
    if (!originType) return '';
    if (String(originType).toUpperCase() !== 'TRANSFER') return '';
    return '<span class="badge badge-transfer-origin" aria-label="Vehicle originated from transfer transaction">Transfer</span>';
}

// Helper function for escaping HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Use StatusUtils.getStatusText if available, otherwise fallback
function getStatusText(status) {
    if (typeof window !== 'undefined' && window.StatusUtils && window.StatusUtils.getStatusText) {
        return window.StatusUtils.getStatusText(status);
    }
    const fallbackMap = {
        'submitted': 'Pending Review',
        'pending_blockchain': 'Pending Blockchain',
        'processing': 'Processing',
        'approved': 'Approved',
        'registered': 'Registered',
        'completed': 'Completed',
        'rejected': 'Rejected'
    };
    const normalized = (status || '').toLowerCase();
    return fallbackMap[normalized] || status;
}

function getVerificationStatusDisplay(verificationStatus, applicationStatus) {
    // Normalize status for comparison (handle both cases and separators)
    const normalizedStatus = applicationStatus 
        ? String(applicationStatus).toUpperCase().replace(/[-_]/g, '_').trim()
        : '';
    
    const isPendingBlockchain = normalizedStatus === 'PENDING_BLOCKCHAIN' || 
                                 normalizedStatus === 'SUBMITTED' ||
                                 normalizedStatus === 'PENDING';
    
    const isEmpty = !verificationStatus || typeof verificationStatus !== 'object' || Object.keys(verificationStatus).length === 0;
    
    // If verificationStatus is empty, show dash
    if (isEmpty) {
        return '<span style="color: #6c757d;">-</span>';
    }
    
    const statuses = [];
    const insuranceStatus = (verificationStatus.insurance || '').toLowerCase();
    const hpgStatus = (verificationStatus.hpg || '').toLowerCase();
    
    var itemStyle = 'display:inline-flex;align-items:center;gap:4px;';
    if (insuranceStatus === 'approved') {
        statuses.push('<span style="color: #28a745;' + itemStyle + '"><i class="fas fa-check-circle" aria-hidden="true"></i> Insurance</span>');
    } else if (insuranceStatus === 'pending') {
        statuses.push('<span style="color: #ffc107;' + itemStyle + '"><i class="fas fa-clock" aria-hidden="true"></i> Insurance</span>');
    } else if (insuranceStatus === 'rejected') {
        statuses.push('<span style="color: #dc3545;' + itemStyle + '"><i class="fas fa-times-circle" aria-hidden="true"></i> Insurance</span>');
    }
    
    if (hpgStatus === 'approved') {
        statuses.push('<span style="color: #28a745;' + itemStyle + '"><i class="fas fa-check-circle" aria-hidden="true"></i> HPG</span>');
    } else if (hpgStatus === 'pending') {
        statuses.push('<span style="color: #ffc107;' + itemStyle + '"><i class="fas fa-clock" aria-hidden="true"></i> HPG</span>');
    } else if (hpgStatus === 'rejected') {
        statuses.push('<span style="color: #dc3545;' + itemStyle + '"><i class="fas fa-times-circle" aria-hidden="true"></i> HPG</span>');
    }
    
    if (statuses.length === 0) {
        return '<span style="color: #6c757d;">Pending</span>';
    }
    
    return statuses.join(' | ');
}

function updateStatsFromApplications(applications) {
    const stats = {
        // FIX: Case-insensitive comparison
        registeredVehicles: applications.filter(app => {
            const status = (app.status || '').toUpperCase();
            return status === 'APPROVED' || status === 'REGISTERED';
        }).length,
        pendingApplications: applications.filter(app => {
            const status = (app.status || '').toUpperCase();
            return status === 'SUBMITTED' || status === 'PENDING' || status === 'PENDING_BLOCKCHAIN';
        }).length,
        approvedApplications: applications.filter(app => {
            const status = (app.status || '').toUpperCase();
            return status === 'APPROVED' || status === 'REGISTERED';
        }).length,
        notifications: applications.filter(app => {
            const status = (app.status || '').toUpperCase();
            return status === 'SUBMITTED' || status === 'REJECTED';
        }).length
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

async function viewUserApplication(applicationId) {
    // Show loading state
    showNotification('Loading application details...', 'info');
    
    console.log('📂 viewUserApplication called with ID:', applicationId);
    
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
    
    console.log('📂 Found application:', application);
    console.log('📂 Existing documents:', application.documents);
    
    // Check if the application ID looks like a real UUID (from API)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId);
    console.log('📂 Is UUID:', isUUID);
    
    // Try to load full vehicle details and documents from API if it's a real vehicle
    if (isUUID) {
        try {
            const apiClient = window.apiClient || new APIClient();
            console.log('📂 Fetching full vehicle details from API for vehicle:', applicationId);
            
            // Fetch full vehicle details (includes blockchain_tx_id)
            const vehicleResponse = await apiClient.get(`/api/vehicles/id/${applicationId}`);
            
            if (vehicleResponse.success && vehicleResponse.vehicle) {
                console.log('📂 Vehicle details fetched:', vehicleResponse.vehicle);
                // Update application with full vehicle data including blockchain_tx_id
                application.vehicle = {
                    ...application.vehicle,
                    ...vehicleResponse.vehicle,
                    blockchain_tx_id: vehicleResponse.vehicle.blockchain_tx_id || vehicleResponse.vehicle.blockchainTxId,
                    blockchainTxId: vehicleResponse.vehicle.blockchainTxId || vehicleResponse.vehicle.blockchain_tx_id
                };
                // Also update application-level blockchain fields
                application.blockchain_tx_id = vehicleResponse.vehicle.blockchain_tx_id || vehicleResponse.vehicle.blockchainTxId;
                application.blockchainTxId = vehicleResponse.vehicle.blockchainTxId || vehicleResponse.vehicle.blockchain_tx_id;
                application.history = vehicleResponse.vehicle.history || application.history || [];
                
                // Update documents if available
                if (vehicleResponse.vehicle.documents && vehicleResponse.vehicle.documents.length > 0) {
                    console.log('📂 Found', vehicleResponse.vehicle.documents.length, 'documents from vehicle API');
                    
                    // Convert array format to object format for the modal
                    const docsMap = {};
                    vehicleResponse.vehicle.documents.forEach(doc => {
                        console.log('📂 Processing doc:', doc.document_type || doc.type, doc.id);
                        const key = mapDocTypeToKey(doc.document_type || doc.type);
                        console.log('📂 Mapped key:', key);
                        docsMap[key] = {
                            id: doc.id,
                            url: `/api/documents/${doc.id}/view`,
                            cid: doc.ipfs_cid || doc.cid,
                            filename: doc.original_name || doc.filename,
                            type: doc.document_type || doc.type
                        };
                    });
                    console.log('📂 Final docsMap:', docsMap);
                    application.documents = docsMap;
                }
            }
            
            // Also try to fetch documents separately if vehicle API didn't return them
            if (!application.documents || Object.keys(application.documents).length === 0) {
                const token = (typeof window !== 'undefined' && window.authManager) 
                    ? window.authManager.getAccessToken() 
                    : (localStorage.getItem('authToken') || localStorage.getItem('token'));
                console.log('📂 Fetching documents from API for vehicle:', applicationId);
                
                const response = await fetch(`/api/documents/vehicle-id/${applicationId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                console.log('📂 API response status:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('📂 API response data:', data);
                    
                    if (data.documents && data.documents.length > 0) {
                        console.log('📂 Found', data.documents.length, 'documents from API');
                        
                        // Convert array format to object format for the modal
                        const docsMap = {};
                        data.documents.forEach(doc => {
                            console.log('📂 Processing doc:', doc.document_type, doc.id);
                            const key = mapDocTypeToKey(doc.document_type);
                            console.log('📂 Mapped key:', key);
                            docsMap[key] = {
                                id: doc.id,
                                url: `/api/documents/${doc.id}/view`,
                                cid: doc.ipfs_cid || doc.cid,
                                filename: doc.original_name || doc.filename,
                                type: doc.document_type
                            };
                        });
                        console.log('📂 Final docsMap:', docsMap);
                        application.documents = docsMap;
                    } else {
                        console.log('📂 No documents returned from API');
                    }
                } else {
                    console.log('📂 API response not OK:', response.status, response.statusText);
                }
            }
        } catch (apiError) {
            console.error('📂 Error loading vehicle details from API:', apiError);
            // Continue with existing data
        }
    }
    
    // If documents is still empty and we have existing documents in localStorage format, try to use them
    if ((!application.documents || Object.keys(application.documents).length === 0)) {
        // Check if there are documents stored in submittedApplications
        const submittedApps = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
        const submittedApp = submittedApps.find(app => app.id === applicationId || app.vehicle?.vin === application.vehicle?.vin);
        if (submittedApp && submittedApp.documents && Object.keys(submittedApp.documents).length > 0) {
            console.log('📂 Found documents in submittedApplications:', submittedApp.documents);
            application.documents = submittedApp.documents;
        }
    }
    
    console.log('📂 Final application documents:', application.documents);
    
    // Show application details modal with document selection
    showApplicationDetailsModal(application);
}

// Map API document types to modal keys
function mapDocTypeToKey(docType) {
    const typeMap = {
        // Core canonical database types
        'registration_cert': 'registrationCert',
        'or_cr': 'registrationCert',
        'insurance_cert': 'insuranceCert',
        'owner_id': 'ownerId',
        'valid_id': 'validId',
        'deed_of_sale': 'deedOfSale',
        'seller_id': 'sellerId',
        'buyer_id': 'buyerId',
        'csr': 'csr',
        'hpg_clearance': 'hpgClearance',
        'sales_invoice': 'salesInvoice',

        // CamelCase / logical types
        'registrationCert': 'registrationCert',
        'registrationCertificate': 'registrationCert',
        'insuranceCert': 'insuranceCert',
        'insuranceCertificate': 'insuranceCert',
        'ownerId': 'ownerId',
        'ownerValidId': 'ownerId',
        'validId': 'validId',
        'deedOfSale': 'deedOfSale',
        'sellerId': 'sellerId',
        'buyerId': 'buyerId',
        'certificateOfStockReport': 'csr',
        'hpgClearance': 'hpgClearance',
        'pnpHpgClearance': 'hpgClearance',
        'salesInvoice': 'salesInvoice'
    };
    return typeMap[docType] || docType;
}

// Retry loading documents for an application
async function retryLoadDocuments(applicationId) {
    console.log('📂 Retrying document load for:', applicationId);
    closeApplicationDetailsModal();
    await viewUserApplication(applicationId);
}

// Store current application documents for modal access
let currentModalDocuments = {};
let currentModalApplication = null;

// Show application details modal with document chooser
function showApplicationDetailsModal(application) {
    console.log('📂 showApplicationDetailsModal called with:', application);
    
    // Remove existing modal if any
    const existingModal = document.getElementById('applicationDetailsModal');
    if (existingModal) existingModal.remove();
    
    const vehicle = application.vehicle || {};
    let documents = application.documents || {};
    const status = application.status || 'submitted';
    // Normalize status for consistent comparison
            const normalizedStatus = (typeof window !== 'undefined' && window.StatusUtils && window.StatusUtils.normalizeStatus) 
                ? window.StatusUtils.normalizeStatus(status)
                : (status || '').toLowerCase();
            
            console.log('📂 Initial documents:', documents, 'Type:', typeof documents, 'IsArray:', Array.isArray(documents));
    
    // Handle documents if they're in array format (from API)
    if (Array.isArray(documents)) {
        console.log('📂 Converting array format to object format');
        const docsMap = {};
        documents.forEach(doc => {
            const key = mapDocTypeToKey(doc.document_type || doc.type);
            docsMap[key] = {
                id: doc.id,
                url: doc.url || (doc.id ? `/api/documents/${doc.id}/view` : null),
                cid: doc.cid || doc.ipfs_cid,
                filename: doc.original_name || doc.filename,
                type: doc.document_type || doc.type
            };
        });
        documents = docsMap;
    }
    // Handle case where documents might have nested structure or different keys
    else if (documents && typeof documents === 'object') {
        // Check if any key has a string value (direct URL) and needs normalization
        const normalizedDocs = {};
        Object.entries(documents).forEach(([key, value]) => {
            const normalizedKey = mapDocTypeToKey(key);
            if (typeof value === 'string') {
                // Direct URL or data URL
                normalizedDocs[normalizedKey] = {
                    url: value,
                    filename: key,
                    type: key
                };
            } else if (typeof value === 'object' && value !== null) {
                // Already an object
                normalizedDocs[normalizedKey] = value;
            }
        });
        if (Object.keys(normalizedDocs).length > 0) {
            documents = normalizedDocs;
        }
    }
    
    console.log('📂 Final documents object:', documents);
    
    // Store for access by click handlers
    currentModalDocuments = documents;
    currentModalApplication = application;
    
    // Build document list
    const documentTypes = [
        { key: 'registrationCert', label: 'Registration Certificate (OR/CR)', icon: 'fa-car', type: 'registration' },
        { key: 'insuranceCert', label: 'Insurance Certificate', icon: 'fa-shield-alt', type: 'insurance' },
        { key: 'ownerId', label: 'Owner ID', icon: 'fa-id-card', type: 'id' },
        { key: 'validId', label: 'Valid ID', icon: 'fa-id-badge', type: 'id' },
        { key: 'deedOfSale', label: 'Deed of Sale', icon: 'fa-file-contract', type: 'other' },
        { key: 'sellerId', label: 'Seller ID', icon: 'fa-user-tag', type: 'id' },
        { key: 'buyerId', label: 'Buyer ID', icon: 'fa-user-check', type: 'id' },
        { key: 'csr', label: 'Certificate of Stock Report (CSR)', icon: 'fa-file-alt', type: 'other' },
        { key: 'hpgClearance', label: 'HPG Clearance Certificate', icon: 'fa-shield-alt', type: 'other' },
        { key: 'salesInvoice', label: 'Sales Invoice', icon: 'fa-receipt', type: 'other' }
    ];
    
    let documentListHTML = '';
    let hasDocuments = false;
    let docCount = 0;
    
    documentTypes.forEach(docType => {
        const docData = documents[docType.key];
        if (docData) {
            hasDocuments = true;
            docCount++;
            // Get filename for display
            const filename = typeof docData === 'object' ? (docData.filename || docType.label) : docType.label;
            
            // Check if application is pending/rejected (allows document updates)
            // Normalize status to handle both uppercase and lowercase from backend
            const normalizedStatus = (typeof window !== 'undefined' && window.StatusUtils && window.StatusUtils.normalizeStatus) 
                ? window.StatusUtils.normalizeStatus(status)
                : (status || '').toLowerCase();
            const canUpdate = (typeof window !== 'undefined' && window.StatusUtils && window.StatusUtils.canUpdateDocuments) 
                ? window.StatusUtils.canUpdateDocuments(status)
                : ['submitted', 'processing', 'rejected', 'pending'].includes(normalizedStatus);
            
            documentListHTML += `
                <div class="doc-select-item" data-doc-key="${docType.key}" data-doc-id="${docData.id || ''}">
                    <div class="doc-select-icon">
                        <i class="fas ${docType.icon}"></i>
                    </div>
                    <div class="doc-select-info">
                        <div class="doc-select-title">${docType.label}</div>
                        <div class="doc-select-subtitle">${filename !== docType.label ? filename : ''}</div>
                        <div class="doc-select-status">
                            <i class="fas fa-check-circle" style="color: #27ae60;"></i> Uploaded
                        </div>
                    </div>
                    <div class="doc-select-actions" style="display: flex; gap: 0.5rem;">
                        <button class="btn-icon" onclick="openDocumentByKey('${docType.key}')" title="View Document">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${canUpdate ? `
                        <button class="btn-icon btn-update-doc" onclick="showDocumentUpdateModal('${docType.key}', '${docType.label}', '${docData.id || ''}', '${application.id}')" title="Update Document" style="color: #3498db;">
                            <i class="fas fa-upload"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }
    });
    
    if (!hasDocuments) {
        console.log('📂 No documents found. Documents object:', documents);
        documentListHTML = `
            <div style="text-align: center; padding: 2rem; color: #7f8c8d;">
                <i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                <p>No documents found</p>
                <p style="font-size: 0.8rem; margin-top: 0.5rem;">Documents may not have been uploaded yet, or are still being processed.</p>
                <button class="btn-secondary btn-sm" onclick="retryLoadDocuments('${application.id}')" style="margin-top: 1rem;">
                    <i class="fas fa-sync"></i> Retry Loading
                </button>
            </div>
        `;
    } else {
        console.log('📂 Found', docCount, 'documents to display');
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
                
                <!-- Rejection Reason Display -->
                ${normalizedStatus === 'rejected' && (application.rejectionReason || application.notes || application.rejection_reason) ? `
                <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
                    <h4 style="margin-top: 0; color: #721c24; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas fa-exclamation-triangle"></i> Reason for Rejection
                    </h4>
                    <p style="margin: 0; white-space: pre-wrap; color: #721c24;">${application.rejectionReason || application.notes || application.rejection_reason}</p>
                </div>
                ` : ''}
                
                <!-- OR/CR Number Display -->
                ${application.or_number || application.cr_number || application.vehicle?.or_number || application.vehicle?.cr_number || application.or_cr_number || application.vehicle?.or_cr_number ? `
                <div class="orcr-display" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: center;">
                    <small style="opacity: 0.8; display: block; margin-bottom: 0.5rem;">Official Receipt (OR) / Certificate of Registration (CR)</small>
                    <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; font-size: 1.1rem; font-weight: bold; letter-spacing: 1px;">
                        ${(application.or_number || application.vehicle?.or_number) ? `<span>OR: ${application.or_number || application.vehicle?.or_number}</span>` : ''}
                        ${(application.cr_number || application.vehicle?.cr_number) ? `<span>CR: ${application.cr_number || application.vehicle?.cr_number}</span>` : ''}
                        ${(!application.or_number && !application.cr_number && (application.or_cr_number || application.vehicle?.or_cr_number)) ? `<span>${application.or_cr_number || application.vehicle?.or_cr_number}</span>` : ''}
                    </div>
                </div>
                ` : (status === 'approved' || status === 'registered') ? `
                <div style="background: #fff3cd; color: #856404; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: center; font-size: 0.9rem;">
                    <i class="fas fa-clock"></i> OR/CR Numbers: Pending Assignment
                </div>
                ` : ''}
                
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
                
                <!-- Blockchain Proof Section -->
                ${createBlockchainProofSection(vehicle || application.vehicle || {})}
                
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
                        ${(() => {
                            const blockchainTx = application.blockchain_tx_id || application.blockchainTxId || vehicle.blockchain_tx_id || vehicle.blockchainTxId || null;
                            const submittedLabel = 'Submitted';
                            const submittedDate = application.submittedDate ? new Date(application.submittedDate).toLocaleDateString() : 'N/A';
                            const submittedDone = status !== 'rejected';
                            const reviewDone = ['processing', 'approved', 'completed'].includes(status);
                            const reviewAction = status === 'processing' ? 'PROCESSING' : 'PENDING';
                            const finalLabel = status === 'rejected' ? 'Rejected' : 'Approved';
                            const finalDate = (status === 'approved' || status === 'completed' || status === 'rejected') ? new Date().toLocaleDateString() : null;
                            const finalDone = status === 'approved' || status === 'completed';
                            const finalTx = finalDone ? blockchainTx : null;
                            const finalAction = status === 'rejected' ? 'REJECTED' : 'APPROVED';

                            return [
                                renderTimelineItem(submittedLabel, submittedDate, submittedDone, blockchainTx, 'SUBMITTED'),
                                renderTimelineItem('Under Review', null, reviewDone, null, reviewAction),
                                renderTimelineItem(finalLabel, finalDate, finalDone, finalTx, finalAction)
                            ].join('');
                        })()}
                    </div>
                    ${renderStatusHistorySection(application.history || [])}
                </div>
            </div>
            
            <div class="owner-modal-footer">
                ${hasDocuments ? `
                    <button class="btn-primary" onclick="viewAllDocumentsFullPage()">
                        <i class="fas fa-expand"></i> Open Document Viewer (${docCount} docs)
                    </button>
                    <button class="btn-info" onclick="viewAllDocsInModal()">
                        <i class="fas fa-images"></i> Quick View
                    </button>
                ` : ''}
                ${status === 'submitted' || status === 'processing' || status === 'rejected' || status === 'pending' ? `
                <button class="btn-warning" onclick="showBulkDocumentUpdateModal('${application.id}')" style="background: #f39c12; color: white;">
                    <i class="fas fa-upload"></i> Update Documents
                </button>
                ` : ''}
                <button class="btn-secondary" onclick="closeApplicationDetailsModal()">
                    Close
                </button>
            </div>
        </div>
    `;
    
    // Add document update modal HTML if not exists
    if (!document.getElementById('documentUpdateModal')) {
        const updateModal = document.createElement('div');
        updateModal.id = 'documentUpdateModal';
        updateModal.className = 'owner-details-modal';
        updateModal.style.display = 'none';
        updateModal.innerHTML = `
            <div class="owner-modal-overlay" onclick="closeDocumentUpdateModal()"></div>
            <div class="owner-modal-content" style="max-width: 600px;">
                <div class="owner-modal-header">
                    <div class="owner-modal-title">
                        <div class="owner-modal-icon">
                            <i class="fas fa-upload"></i>
                        </div>
                        <div>
                            <h3>Update Document</h3>
                            <small id="updateDocTypeLabel">Document Type</small>
                        </div>
                    </div>
                    <button class="owner-modal-close" onclick="closeDocumentUpdateModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="owner-modal-body">
                    <p style="margin-bottom: 1.5rem; color: #555; font-size: 0.95rem;">
                        Upload a new version of this document. The new document will replace the existing one for this application.
                    </p>
                    <div class="transfer-upload-item" style="margin-bottom: 1rem;">
                        <div class="transfer-upload-info">
                            <h4><i class="fas fa-file"></i> Select New Document</h4>
                            <p>PDF, JPG, PNG (max 10MB)</p>
                        </div>
                        <div class="transfer-upload-area">
                            <input type="file" id="updateDocumentFile" accept=".pdf,.jpg,.jpeg,.png" 
                                   style="display: none;">
                            <label for="updateDocumentFile" class="transfer-upload-label" id="label-updateDocumentFile">
                                <span class="transfer-upload-icon">📄</span>
                                <span class="transfer-upload-text">Choose File</span>
                            </label>
                            <div class="transfer-file-name" id="updateDocumentFileName"></div>
                        </div>
                    </div>
                    <div id="updateDocumentError" style="display: none; padding: 0.75rem; background: #fee; border: 1px solid #fcc; border-radius: 4px; color: #c33; margin-top: 1rem;"></div>
                </div>
                <div class="owner-modal-footer">
                    <button class="btn-secondary" onclick="closeDocumentUpdateModal()">Cancel</button>
                    <button class="btn-primary" id="submitDocumentUpdateBtn" onclick="submitDocumentUpdate()">
                        <i class="fas fa-upload"></i> Upload & Update
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(updateModal);
    }
    
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
            .doc-select-actions {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }
            .btn-sm {
                padding: 0.4rem 0.8rem;
                font-size: 0.875rem;
                border-radius: 6px;
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
                border: none;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
            }
            .owner-modal-footer .btn-primary {
                background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                color: white;
            }
            .owner-modal-footer .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(52, 152, 219, 0.4);
            }
            .owner-modal-footer .btn-info {
                background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%);
                color: white;
            }
            .owner-modal-footer .btn-info:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(155, 89, 182, 0.4);
            }
            .owner-modal-footer .btn-secondary {
                background: #e9ecef;
                color: #2c3e50;
            }
            .owner-modal-footer .btn-secondary:hover {
                background: #dee2e6;
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

// Open a specific document by key from the stored modal documents
function openDocumentByKey(docKey) {
    const docTypeLabels = {
        'registrationCert': 'Registration Certificate (OR/CR)',
        'insuranceCert': 'Insurance Certificate',
        'emissionCert': 'Emission Certificate',
        'ownerId': 'Owner ID',
        'deedOfSale': 'Deed of Sale',
        'validId': 'Valid ID'
    };
    
    const docData = currentModalDocuments[docKey];
    const docLabel = docTypeLabels[docKey] || docKey;
    
    if (!docData) {
        showNotification('Document not found', 'error');
        return;
    }
    
    // Handle both string URL format and object format
    let docUrl, docId, docCid, filename;
    
    if (typeof docData === 'string') {
        // Simple string URL (or data URL)
        docUrl = docData;
        filename = docLabel;
    } else if (typeof docData === 'object') {
        // Object format with id, url, cid, etc.
        docId = docData.id;
        docCid = docData.cid || docData.ipfs_cid;
        docUrl = docData.url || (docId ? `/api/documents/${docId}/view` : null) || (docCid ? `/api/documents/ipfs/${docCid}` : null);
        filename = docData.filename || docData.original_name || docLabel;
    }
    
    if (!docUrl && !docId && !docCid) {
        showNotification('Document URL not available', 'error');
        return;
    }
    
    closeApplicationDetailsModal();
    
    // Use the document modal if available
    if (typeof DocumentModal !== 'undefined') {
        DocumentModal.view({
            id: docId,
            url: docUrl,
            cid: docCid,
            filename: filename,
            type: docKey
        });
    } else {
        // Strict: never open new tabs for viewing documents
        showNotification('Document viewer modal is not available. Please refresh the page.', 'error');
        return;
    }
}

// Strict: no full-page document viewers; always use modal.
function viewAllDocumentsFullPage() {
    showNotification('Full-page document viewer is disabled. Please use the in-page document modal.', 'info');
}

// View all documents in the DocumentModal (quick view)
function viewAllDocsInModal() {
    if (!currentModalDocuments || Object.keys(currentModalDocuments).length === 0) {
        showNotification('No documents to view', 'error');
        return;
    }
    
    const docTypeLabels = {
        'registrationCert': { label: 'Registration Certificate (OR/CR)', type: 'registration' },
        'insuranceCert': { label: 'Insurance Certificate', type: 'insurance' },
        'emissionCert': { label: 'Emission Certificate', type: 'emission' },
        'ownerId': { label: 'Owner ID', type: 'id' },
        'deedOfSale': { label: 'Deed of Sale', type: 'other' },
        'validId': { label: 'Valid ID', type: 'id' }
    };
    
    // Build document array for DocumentModal
    const docs = [];
    Object.entries(currentModalDocuments).forEach(([key, docData]) => {
        if (docData) {
            const info = docTypeLabels[key] || { label: key, type: 'other' };
            
            // Handle both string URL format and object format
            let docObj;
            if (typeof docData === 'string') {
                docObj = {
                    id: `${currentModalApplication?.id || 'doc'}_${key}`,
                    url: docData,
                    filename: info.label,
                    type: info.type,
                    document_type: key
                };
            } else if (typeof docData === 'object') {
                docObj = {
                    id: docData.id || `${currentModalApplication?.id || 'doc'}_${key}`,
                    url: docData.url || (docData.id ? `/api/documents/${docData.id}/view` : null) || (docData.cid ? `/api/documents/ipfs/${docData.cid}` : null),
                    cid: docData.cid || docData.ipfs_cid,
                    filename: docData.filename || docData.original_name || info.label,
                    type: info.type,
                    document_type: key
                };
            }
            
            if (docObj) {
                docs.push(docObj);
            }
        }
    });
    
    closeApplicationDetailsModal();
    
    if (docs.length > 0 && typeof DocumentModal !== 'undefined') {
        DocumentModal.viewMultiple(docs, 0);
    } else if (docs.length > 0) {
        // Fallback - open first document
        openDocumentByKey(Object.keys(currentModalDocuments)[0]);
    }
}

// Legacy function for backward compatibility
function openDocumentFromModal(docUrl, docLabel) {
    closeApplicationDetailsModal();
    
    if (typeof DocumentModal !== 'undefined') {
        DocumentModal.view({
            url: docUrl,
            filename: docLabel,
            type: docLabel
        });
    } else {
        showNotification('Document viewer modal is not available. Please refresh the page.', 'error');
    }
}

function viewAllDocuments(applicationId, vin) {
    closeApplicationDetailsModal();
    showNotification('Full-page document viewer is disabled. Please use the in-page document modal.', 'info');
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
    // Prepare vehicle data with safe property access
    const vehicle = application.vehicle || {};
    const vehicleMake = vehicle.make || 'N/A';
    const vehicleModel = vehicle.model || 'N/A';
    const vehicleYear = vehicle.year || 'N/A';
    const vehicleColor = vehicle.color || 'N/A';
    const vehiclePlate = vehicle.plateNumber || vehicle.plate_number || 'N/A';
    
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
                                <span class="detail-value">${vehicleMake} ${vehicleModel}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Year:</span>
                                <span class="detail-value">${vehicleYear}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Color:</span>
                                <span class="detail-value">${vehicleColor}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Plate Number:</span>
                                <span class="detail-value">${vehiclePlate}</span>
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
    console.warn('downloadCertificate is deprecated. Redirecting to downloadVehicleCertificate.');
    // Delegate to the real certificate download flow which uses CertificateGenerator
    try {
        downloadVehicleCertificate(applicationId, null);
    } catch (e) {
        console.error('downloadCertificate fallback error:', e);
        if (typeof showNotification === 'function') {
            showNotification('Unable to generate certificate. Please try again.', 'error');
        }
    }
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
            // Update application status back to submitted (try v2 first, fallback to v1)
            let applications = JSON.parse(localStorage.getItem('userApplications_v2') || '[]');
            if (applications.length === 0) {
                applications = JSON.parse(localStorage.getItem('userApplications') || '[]');
            }
            let application = applications.find(app => app.id === applicationId);
            
            if (application) {
                application.status = 'submitted';
                application.lastUpdated = new Date().toISOString();
                application.adminNotes = '';
                // Update in localStorage (prefer v2, update both if v1 exists)
                localStorage.setItem('userApplications_v2', JSON.stringify(applications));
                if (localStorage.getItem('userApplications')) {
                    localStorage.setItem('userApplications', JSON.stringify(applications));
                }
            }
            
            // Also update in submitted applications (try v2 first, fallback to v1)
            let submittedApplications = JSON.parse(localStorage.getItem('submittedApplications_v2') || '[]');
            if (submittedApplications.length === 0) {
                submittedApplications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
            }
            let submittedApp = submittedApplications.find(app => app.id === applicationId);
            
            if (submittedApp) {
                submittedApp.status = 'submitted';
                submittedApp.lastUpdated = new Date().toISOString();
                submittedApp.adminNotes = '';
                // Update in localStorage (prefer v2, update both if v1 exists)
                localStorage.setItem('submittedApplications_v2', JSON.stringify(submittedApplications));
                if (localStorage.getItem('submittedApplications')) {
                    localStorage.setItem('submittedApplications', JSON.stringify(submittedApplications));
                }
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

// Download vehicle registration certificate (owner dashboard)
async function downloadVehicleCertificate(applicationId, orCrNumber) {
    console.log('=== downloadVehicleCertificate (Owner Dashboard) START ===');
    console.log('Application ID:', applicationId);
    console.log('OR/CR Number:', orCrNumber);
    
    try {
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Generating certificate...', 'info');
        }

        if (typeof CertificateGenerator === 'undefined') {
            console.error('CertificateGenerator not loaded');
            throw new Error('Certificate generator not loaded. Please refresh the page.');
        }

        const apiClient = window.apiClient || new APIClient();

        // Find the application in local cache to get vehicle ID
        let applications = JSON.parse(localStorage.getItem('userApplications') || '[]');
        let application = applications.find(app => app.id === applicationId);

        if (!application || !application.vehicle || !application.vehicle.vin) {
            console.warn('Application not found locally or missing vehicle VIN. Falling back to API lookup.');
        }

        // We don't have vehicleId directly here, so we call a dedicated endpoint if needed
        // Try to use application.id as vehicle ID first (if they match), otherwise user will download via My Vehicles page
        const vehicleId = applicationId;

        console.log('Fetching vehicle details for certificate via /api/vehicles/id/', vehicleId);
        const vehicleResponse = await apiClient.get(`/api/vehicles/id/${vehicleId}`);
        console.log('Vehicle API response (owner dashboard):', vehicleResponse);

        if (!vehicleResponse.success) {
            throw new Error(vehicleResponse.error || 'Failed to load vehicle data');
        }

        const vehicle = vehicleResponse.vehicle;

        // Fetch owner profile
        let owner = { email: 'N/A' };
        try {
            const profileResponse = await apiClient.get('/api/auth/profile');
            if (profileResponse.success) {
                owner = profileResponse.user;
            }
        } catch (e) {
            console.warn('Could not load owner profile for certificate:', e);
        }

        console.log('Calling CertificateGenerator.generateCertificate from owner dashboard...');
        const result = await CertificateGenerator.generateCertificate(vehicle, owner);
        console.log('Certificate generation result (owner dashboard):', result);

        if (result && result.method === 'download') {
            if (typeof ToastNotification !== 'undefined') {
                ToastNotification.show('Certificate downloaded as HTML file. Open it and use Print to save as PDF.', 'warning');
            }
        } else {
            if (typeof ToastNotification !== 'undefined') {
                ToastNotification.show('Certificate opened! Use Print dialog to save as PDF.', 'success');
            }
        }
        
        console.log('=== downloadVehicleCertificate (Owner Dashboard) SUCCESS ===');
    } catch (error) {
        console.error('=== downloadVehicleCertificate (Owner Dashboard) ERROR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show(`Error: ${error.message}`, 'error');
        } else {
            alert(`Error generating certificate: ${error.message}`);
        }
    }
}
function requestRegistration() {
    // Redirect to registration wizard
    window.location.href = 'registration-wizard.html';
}

// DEPRECATED: This function is no longer used.
// Document uploads are handled within registration-wizard.html
// Redirecting to My Vehicles page instead
function uploadDocuments() {
    // Redirect to My Vehicles page where users can manage their vehicles and documents
    window.location.href = 'my-vehicle-ownership.html';
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

// Enhanced timeline update function - works with new timeline structure
function updateProgressTimeline() {
    // Try new enhanced timeline first
    const enhancedTimeline = document.getElementById('workflowTimeline');
    if (enhancedTimeline) {
        // Use API-based update if vehicle ID is available
        const urlParams = new URLSearchParams(window.location.search);
        const vehicleId = urlParams.get('vehicleId');
        if (vehicleId) {
            updateRegistrationTimeline(vehicleId);
            return;
        }
        
        // Fallback to localStorage-based update
        updateTimelineFromState();
        return;
    }
    
    // Fallback to old timeline structure
    let timelineItems = document.querySelectorAll('.timeline-item-modern');
    if (!timelineItems || timelineItems.length === 0) {
        timelineItems = document.querySelectorAll('.timeline-item');
    }
    if (!timelineItems || timelineItems.length === 0) return;
    
    // Update old timeline based on workflow state
    timelineItems.forEach((item, index) => {
        let icon = item.querySelector('.timeline-icon-modern') || item.querySelector('.timeline-icon');
        let content = item.querySelector('.timeline-content-modern h4') || item.querySelector('.timeline-content h4');
        if (!icon || !content) return;
        
        item.classList.remove('completed', 'pending', 'active');
        item.classList.add('pending');
        icon.classList.remove('completed', 'pending', 'active');
        icon.classList.add('pending');
        
        if (index === 0 && userWorkflowState.registrationRequested) {
            item.classList.add('completed');
            icon.classList.add('completed');
            icon.innerHTML = '<i class="fas fa-check"></i>';
        }
    });
}

// Update registration timeline based on vehicle progress (API-based)
async function updateRegistrationTimeline(vehicleId) {
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/vehicles/${vehicleId}/progress`);
        
        if (response.success && response.progress) {
            renderTimeline(response.progress, response.vehicle);
        } else {
            // Fallback to state-based update
            updateTimelineFromState();
        }
    } catch (error) {
        console.warn('Failed to load timeline from API, using state-based update:', error);
        updateTimelineFromState();
    }
}

// Render timeline based on progress data
function renderTimeline(progress, vehicle) {
    const steps = {
        submitted: { key: 'applicationSubmitted', step: 'submitted' },
        hpg: { key: 'hpgClearance', step: 'hpg' },
        insurance: { key: 'insuranceVerification', step: 'insurance' },
        emission: { key: 'emissionTest', step: 'emission' },
        inspection: { key: 'ltoInspection', step: 'inspection' },
        blockchain: { key: 'blockchainRegistration', step: 'blockchain' },
        complete: { key: 'completed', step: 'complete' }
    };
    
    Object.keys(steps).forEach(stepKey => {
        const stepElement = document.querySelector(`.timeline-step[data-step="${stepKey}"]`);
        if (!stepElement) return;
        
        const progressData = progress[steps[stepKey].key];
        const statusIndicator = stepElement.querySelector('.status-indicator');
        const dateElement = stepElement.querySelector('.step-date');
        
        // Reset classes
        stepElement.classList.remove('completed', 'active', 'rejected');
        statusIndicator.classList.remove('completed', 'active', 'rejected');
        
        if (progressData) {
            if (progressData.status === 'completed') {
                stepElement.classList.add('completed');
                statusIndicator.classList.add('completed');
                if (progressData.date) {
                    dateElement.textContent = new Date(progressData.date).toLocaleString();
                }
            } else if (progressData.status === 'pending') {
                stepElement.classList.add('active');
                statusIndicator.classList.add('active');
                dateElement.textContent = 'In Progress...';
            } else if (progressData.status === 'rejected') {
                stepElement.classList.add('rejected');
                statusIndicator.classList.add('rejected');
                dateElement.textContent = 'Rejected';
            }
        }
    });
    
    // Special handling for blockchain step
    if (vehicle && vehicle.status === 'REGISTERED') {
        const blockchainStep = document.querySelector('.timeline-step[data-step="blockchain"]');
        if (blockchainStep) {
            blockchainStep.classList.add('completed');
            const txSpan = blockchainStep.querySelector('.blockchain-tx');
            if (txSpan && vehicle.blockchain_tx_id) {
                txSpan.style.display = 'block';
                txSpan.textContent = `TX: ${vehicle.blockchain_tx_id.substring(0, 20)}...`;
            }
        }
    }
}

// Fallback: Update timeline from localStorage state
function updateTimelineFromState() {
    const steps = document.querySelectorAll('.timeline-step');
    if (!steps || steps.length === 0) return;
    
    const ltoState = JSON.parse(localStorage.getItem('ltoWorkflowState') || '{}');
    
    // Step 1: Application Submitted
    const submittedStep = document.querySelector('.timeline-step[data-step="submitted"]');
    if (submittedStep && userWorkflowState.registrationRequested) {
        submittedStep.classList.add('completed');
        submittedStep.querySelector('.status-indicator').classList.add('completed');
        submittedStep.querySelector('.step-date').textContent = new Date().toLocaleDateString();
    }
    
    // Step 2: HPG Clearance
    const hpgStep = document.querySelector('.timeline-step[data-step="hpg"]');
    if (hpgStep && ltoState.hpgReceived) {
        hpgStep.classList.add('completed');
        hpgStep.querySelector('.status-indicator').classList.add('completed');
    } else if (hpgStep && ltoState.hpgPending) {
        hpgStep.classList.add('active');
        hpgStep.querySelector('.status-indicator').classList.add('active');
    }
    
    // Step 3: Insurance Verification
    const insuranceStep = document.querySelector('.timeline-step[data-step="insurance"]');
    if (insuranceStep && ltoState.insuranceReceived) {
        insuranceStep.classList.add('completed');
        insuranceStep.querySelector('.status-indicator').classList.add('completed');
    } else if (insuranceStep && ltoState.insurancePending) {
        insuranceStep.classList.add('active');
        insuranceStep.querySelector('.status-indicator').classList.add('active');
    }
    
    // Step 4: Emission Test
    const emissionStep = document.querySelector('.timeline-step[data-step="emission"]');
    if (emissionStep && ltoState.emissionReceived) {
        emissionStep.classList.add('completed');
        emissionStep.querySelector('.status-indicator').classList.add('completed');
    } else if (emissionStep && ltoState.emissionPending) {
        emissionStep.classList.add('active');
        emissionStep.querySelector('.status-indicator').classList.add('active');
    }
    
    // Step 5: LTO Inspection
    const inspectionStep = document.querySelector('.timeline-step[data-step="inspection"]');
    if (inspectionStep && ltoState.inspectionCompleted) {
        inspectionStep.classList.add('completed');
        inspectionStep.querySelector('.status-indicator').classList.add('completed');
    }
    
    // Step 6: Blockchain Registration
    const blockchainStep = document.querySelector('.timeline-step[data-step="blockchain"]');
    if (blockchainStep && userWorkflowState.registrationCompleted) {
        blockchainStep.classList.add('completed');
        blockchainStep.querySelector('.status-indicator').classList.add('completed');
    }
    
    // Step 7: Complete
    const completeStep = document.querySelector('.timeline-step[data-step="complete"]');
    if (completeStep && userWorkflowState.registrationCompleted) {
        completeStep.classList.add('completed');
        completeStep.querySelector('.status-indicator').classList.add('completed');
        completeStep.querySelector('.step-date').textContent = new Date().toLocaleDateString();
    }
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

// Helper function to get days until expiry
function getDaysUntilExpiry(expiryDate) {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Helper function to format expiry date
function formatExpiryDate(expiryDate) {
    if (!expiryDate) return 'N/A';
    return new Date(expiryDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Helper function to generate expiry badge HTML
function generateExpiryBadge(vehicle) {
    if (!vehicle.registration_expiry_date) return '';
    
    const daysUntilExpiry = getDaysUntilExpiry(vehicle.registration_expiry_date);
    if (daysUntilExpiry === null || daysUntilExpiry < 0) return '';
    
    let badgeClass = '';
    let urgencyText = '';
    
    if (daysUntilExpiry <= 1) {
        badgeClass = 'urgent';
        urgencyText = 'URGENT';
    } else if (daysUntilExpiry <= 7) {
        badgeClass = 'warning';
        urgencyText = 'Expiring Soon';
    } else if (daysUntilExpiry <= 30) {
        badgeClass = 'warning';
        urgencyText = 'Expiring Soon';
    }
    
    return `
        <div class="expiry-info">
            <div class="expiry-badge ${badgeClass}">
                <i class="fas fa-calendar-alt"></i>
                <span>Expires: ${formatExpiryDate(vehicle.registration_expiry_date)}</span>
                ${daysUntilExpiry <= 30 ? 
                    `<span class="expiry-countdown">(${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'day' : 'days'} left)</span>` : ''}
            </div>
        </div>
    `;
}

// Export functions for potential external use
window.OwnerDashboard = {
    updateOwnerStats,
    handleViewApplication,
    generateExpiryBadge,
    getDaysUntilExpiry,
    formatExpiryDate,
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
    updateProgressTimeline,
    retryLoadDocuments,
    showApplicationDetailsModal,
    closeApplicationDetailsModal,
    openDocumentByKey,
    viewAllDocumentsFullPage,
    viewAllDocsInModal
};

// Application tab switching function
function showApplicationTab(tab, btn) {
    // Update tab buttons
    document.querySelectorAll('.app-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    // Show/hide content
    document.querySelectorAll('.application-tab-content').forEach(c => c.classList.remove('active'));
    const targetTab = document.getElementById(`${tab}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
        targetTab.style.display = 'block';
        
        // Load data when switching tabs
        if (tab === 'transfers') {
            // Load transfer requests
            if (typeof loadOwnerTransferRequests === 'function') {
                loadOwnerTransferRequests();
            } else {
                console.warn('loadOwnerTransferRequests function not available');
            }
        } else if (tab === 'registrations') {
            // Ensure registrations are loaded and rendered
            if (typeof loadUserApplications === 'function') {
                // Always load data when switching to registrations tab
                // This ensures fresh data and handles empty states
                console.log('Switching to registrations tab, loading applications...');
                loadUserApplications();
            } else {
                console.warn('loadUserApplications function not available');
            }
        }
    }
    
    // Hide other tabs
    document.querySelectorAll('.application-tab-content').forEach(c => {
        if (!c.classList.contains('active')) {
            c.style.display = 'none';
        }
    });
}

// Make functions globally available for inline onclick handlers
window.retryLoadDocuments = retryLoadDocuments;
window.viewUserApplication = viewUserApplication;
window.showApplicationDetailsModal = showApplicationDetailsModal;
window.closeApplicationDetailsModal = closeApplicationDetailsModal;
window.openDocumentByKey = openDocumentByKey;
window.viewAllDocumentsFullPage = viewAllDocumentsFullPage;
window.viewAllDocsInModal = viewAllDocsInModal;
window.showApplicationTab = showApplicationTab;
window.loadOwnerTransferRequests = loadOwnerTransferRequests;
window.viewTransferRequest = viewTransferRequest;

// Signal that the real showApplicationTab function is loaded
window.showApplicationTabLoaded = true;

// Document Update Functions
let currentUpdateDocKey = null;
let currentUpdateDocId = null;
let currentUpdateApplicationId = null;

function showDocumentUpdateModal(docKey, docLabel, docId, applicationId, isTransferRequest = false, transferRequestId = null, vehicleId = null) {
    currentUpdateDocKey = docKey;
    currentUpdateDocId = docId;
    currentUpdateApplicationId = applicationId;
    // Store transfer request context if applicable
    if (isTransferRequest) {
        window.currentTransferRequestId = transferRequestId;
        window.currentTransferVehicleId = vehicleId;
    }
    
    const modal = document.getElementById('documentUpdateModal');
    if (!modal) {
        console.error('Document update modal not found');
        return;
    }
    
    // Update label
    const labelEl = document.getElementById('updateDocTypeLabel');
    if (labelEl) labelEl.textContent = docLabel;
    
    // Reset form
    const fileInput = document.getElementById('updateDocumentFile');
    const fileNameDiv = document.getElementById('updateDocumentFileName');
    const errorDiv = document.getElementById('updateDocumentError');
    
    if (fileInput) fileInput.value = '';
    if (fileNameDiv) fileNameDiv.textContent = '';
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }
    
    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Add file change listener and trigger label click
    if (fileInput) {
        // Make label clickable
        const label = document.getElementById('label-updateDocumentFile');
        if (label) {
            label.onclick = function(e) {
                e.preventDefault();
                fileInput.click();
            };
        }
        
        fileInput.onchange = function() {
            if (this.files && this.files.length > 0) {
                const fileName = this.files[0].name;
                if (fileNameDiv) {
                    fileNameDiv.innerHTML = `<span style="color: #27ae60;">✅ ${fileName}</span>`;
                }
                if (label) {
                    label.classList.add('uploaded');
                }
            }
        };
    }
}

function closeDocumentUpdateModal() {
    const modal = document.getElementById('documentUpdateModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    currentUpdateDocKey = null;
    currentUpdateDocId = null;
    currentUpdateApplicationId = null;
}

async function submitDocumentUpdate() {
    const fileInput = document.getElementById('updateDocumentFile');
    const errorDiv = document.getElementById('updateDocumentError');
    const submitBtn = document.getElementById('submitDocumentUpdateBtn');
    
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = 'Please select a file to upload';
        }
        return;
    }
    
    const file = fileInput.files[0];
    
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = 'File size exceeds 10MB limit';
        }
        return;
    }
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = 'Invalid file type. Please upload PDF, JPG, or PNG';
        }
        return;
    }
    
    try {
        // Disable submit button
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
        }
        
        // Get vehicle ID - check if this is a transfer request update
        let vehicleId = null;
        if (window.currentTransferRequestId && window.currentTransferVehicleId) {
            // Transfer request context
            vehicleId = window.currentTransferVehicleId;
        } else {
            // Regular application context
            const application = currentModalApplication;
            if (!application || !application.vehicle || !application.vehicle.id) {
                throw new Error('Application or vehicle information not found');
            }
            vehicleId = application.vehicle.id;
        }
        
        // Map document key to logical type
        const docTypeMap = {
            'registrationCert': 'registrationCert',
            'insuranceCert': 'insuranceCert',
            'emissionCert': 'emissionCert',
            'ownerId': 'ownerId',
            'validId': 'ownerId',
            'deedOfSale': 'deedOfSale',
            'sellerId': 'sellerId',
            'buyerId': 'buyerId',
            'hpgClearance': 'hpgClearance',
            'csr': 'csr',
            'salesInvoice': 'salesInvoice'
        };
        
        const logicalDocType = docTypeMap[currentUpdateDocKey] || currentUpdateDocKey;
        
        // Upload new document
        const formData = new FormData();
        formData.append('document', file);
        formData.append('type', logicalDocType);
        formData.append('vehicleId', vehicleId);
        
        const apiClient = window.apiClient || new APIClient();
        const uploadResponse = await apiClient.post('/api/documents/upload', formData);
        
        if (!uploadResponse.success) {
            throw new Error(uploadResponse.error || 'Upload failed');
        }
        
        // If this is a transfer request, link the document to the transfer request
        if (window.currentTransferRequestId && uploadResponse.document && uploadResponse.document.id) {
            try {
                // Map document key to transfer document role (matching linkTransferDocuments mapping)
                const transferDocRoleMap = {
                    'deedOfSale': 'deedOfSale',
                    'deed_of_sale': 'deedOfSale',
                    'sellerId': 'sellerId',
                    'buyerId': 'buyerId',
                    'buyerTin': 'buyerTin',
                    'buyer_tin': 'buyerTin',
                    'buyerCtpl': 'buyerCtpl',
                    'buyer_ctpl': 'buyerCtpl',
                    'buyerHpgClearance': 'buyerHpgClearance',
                    'buyer_hpg_clearance': 'buyerHpgClearance',
                    'buyerMvir': 'buyerMvir',
                    'buyer_mvir': 'buyerMvir',
                    'or_cr': 'orCr',
                    'orCr': 'orCr',
                    'hpgClearance': 'buyerHpgClearance'
                };
                
                const transferDocRole = transferDocRoleMap[currentUpdateDocKey] || currentUpdateDocKey;
                
                // Link document to transfer request using the accept endpoint's document linking logic
                // We'll use a direct API call that accepts documents object
                const linkResponse = await apiClient.post(`/api/vehicles/transfer/requests/${window.currentTransferRequestId}/link-document`, {
                    documents: {
                        [transferDocRole]: uploadResponse.document.id
                    }
                });
                
                if (!linkResponse.success) {
                    console.warn('Document uploaded but failed to link to transfer request:', linkResponse.error);
                    // Don't fail - document is uploaded, just not linked
                } else {
                    console.log('✅ Document linked to transfer request successfully');
                }
            } catch (linkError) {
                console.error('Error linking document to transfer request:', linkError);
                // Don't fail - document is uploaded, just not linked
            }
        }
        
        // Show success message
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show('Document updated successfully. The new document has been uploaded.', 'success');
        } else {
            alert('Document updated successfully!');
        }
        
        // Close modal
        closeDocumentUpdateModal();
        
        // Handle reload based on context
        if (window.currentTransferRequestId) {
            // Transfer request context - reload transfer requests
            closeTransferRequestDetailsModal();
            if (typeof loadMyTransferRequests === 'function') {
                loadMyTransferRequests();
            }
            // Clear transfer request context
            window.currentTransferRequestId = null;
            window.currentTransferVehicleId = null;
        } else {
            // Regular application context
            closeApplicationDetailsModal();
            
            // Reload applications list
            if (typeof loadUserApplications === 'function') {
                loadUserApplications();
            }
            
            // Optionally reopen the application details modal
            setTimeout(() => {
                if (currentUpdateApplicationId && typeof showApplicationDetailsModal === 'function') {
                    // Reload application data
                    const applications = window.myApplications || [];
                    const updatedApp = applications.find(app => app.id === currentUpdateApplicationId);
                    if (updatedApp) {
                        showApplicationDetailsModal(updatedApp);
                    }
                }
            }, 500);
        }
        
    } catch (error) {
        console.error('Error updating document:', error);
        if (errorDiv) {
            errorDiv.style.display = 'block';
            errorDiv.textContent = error.message || 'Failed to update document. Please try again.';
        }
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show(`Error: ${error.message || 'Failed to update document'}`, 'error');
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-upload"></i> Upload & Update';
        }
    }
}

function showBulkDocumentUpdateModal(applicationId) {
    // For now, just show a message directing to individual document updates
    if (typeof ToastNotification !== 'undefined') {
        ToastNotification.show('Click the upload icon next to each document to update it individually.', 'info');
    } else {
        alert('Click the upload icon next to each document to update it individually.');
    }
}

// Make notification functions globally available for onclick handlers
if (typeof window !== 'undefined') {
    window.markNotificationAsRead = markNotificationAsRead;
    window.deleteNotification = deleteNotification;
}
