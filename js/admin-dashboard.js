// Admin Dashboard JavaScript
document.addEventListener('DOMContentLoaded', async function() {
    // SECURITY: Require authentication before initializing dashboard
    // Always check authentication in production (non-localhost)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isProduction = !isLocalhost;

    // Small delay to allow scripts/localStorage writes to settle after redirects
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Wait for AuthManager to initialize and load token from localStorage
    if (typeof window !== 'undefined' && window.authManager) {
        try {
            // Wait for init to complete (it loads token from localStorage)
            console.log('🔄 Initializing AuthManager...');
            await window.authManager.init();
            console.log('✅ AuthManager initialized');
        } catch (error) {
            console.error('AuthManager initialization error:', error);
            // Continue anyway - init() doesn't throw, but token might not be loaded
        }
    }
    
    if (typeof AuthUtils !== 'undefined') {
        // Check if auth is disabled (dev mode)
        const isAuthDisabled = typeof window !== 'undefined' && window.DISABLE_AUTH === true;
        
        // In production, always require authentication regardless of DISABLE_AUTH setting
        if (isProduction) {
            // Check for token - localStorage FIRST (most reliable), then AuthManager
            let token = localStorage.getItem('authToken') || localStorage.getItem('token');
            console.log('🔍 Token from localStorage:', token ? 'Found' : 'Not found');

            if (!token && typeof window !== 'undefined' && window.authManager) {
                token = window.authManager.getAccessToken();
                console.log('🔍 Token from AuthManager:', token ? 'Found' : 'Not found');
            }
            
            if (!token || token === 'dev-token-bypass' || token.startsWith('demo-token-')) {
                console.warn('❌ No valid authentication token - redirecting to login');
                console.log('Debug info:', {
                    hasAuthManager: typeof window !== 'undefined' && !!window.authManager,
                    authManagerToken: typeof window !== 'undefined' && window.authManager ? window.authManager.getAccessToken() : null,
                    localStorageToken: localStorage.getItem('authToken'),
                    localStorageTokenAlt: localStorage.getItem('token'),
                    currentUser: localStorage.getItem('currentUser')
                });
                window.location.href = 'login-signup.html?redirect=' + encodeURIComponent(window.location.pathname);
                return;
            }
            
            // Verify token is valid JWT
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1]));
                    
                    // Check expiration
                    if (payload.exp && payload.exp * 1000 < Date.now()) {
                        console.warn('❌ Token expired - redirecting to login');
                        localStorage.clear();
                        window.location.href = 'login-signup.html?expired=true';
                        return;
                    }
                    
                    // Check admin role
                    if (payload.role !== 'admin') {
                        console.warn('❌ Access denied: Admin role required');
                        localStorage.clear();
                        window.location.href = 'login-signup.html?message=Admin access required';
                        return;
                    }
                } else {
                    console.warn('❌ Invalid token format - redirecting to login');
                    localStorage.clear();
                    window.location.href = 'login-signup.html?message=Invalid authentication';
                    return;
                }
            } catch (e) {
                console.warn('❌ Token validation failed - redirecting to login:', e);
                localStorage.clear();
                window.location.href = 'login-signup.html?message=Authentication error';
                return;
            }
        } else if (!isAuthDisabled) {
            // Development mode but auth enabled: Use AuthUtils
            if (!AuthUtils.requireAuth()) {
                return; // Redirect to login page
            }
            
            // Verify admin role
            if (!AuthUtils.hasRole('admin')) {
                console.warn('❌ Access denied: Admin role required');
                showNotification('Access denied. Admin role required. Redirecting to login...', 'error');
                setTimeout(() => {
                    window.location.href = 'login-signup.html?message=Admin access required';
                }, 2000);
                return;
            }
        }
        // If localhost and DISABLE_AUTH = true, allow access (dev mode)
    }
    
    initializeAdminDashboard();
    initializeKeyboardShortcuts();
    initializePagination();
});

// Pagination state
let currentPage = 1;
const itemsPerPage = 10;
let allApplications = [];
let filteredApplications = [];

// Smart Auto-Refresh System
let autoRefreshIntervals = [];
let isAutoRefreshEnabled = true;
let isPageVisible = true;
let isUserInteracting = false;
let lastInteractionTime = Date.now();

// Page Visibility API - pause refresh when tab is hidden
document.addEventListener('visibilitychange', () => {
    isPageVisible = !document.hidden;
    if (!isPageVisible) {
        console.log('⏸️ Page hidden - pausing auto-refresh');
    } else {
        console.log('▶️ Page visible - resuming auto-refresh');
    }
});

// Track user interaction - pause refresh during active use
let interactionTimeout;
['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
    document.addEventListener(event, () => {
        isUserInteracting = true;
        lastInteractionTime = Date.now();
        clearTimeout(interactionTimeout);
        interactionTimeout = setTimeout(() => {
            isUserInteracting = false;
        }, 30000); // Consider user inactive after 30 seconds
    }, { passive: true });
});

// Smart interval wrapper - only runs when conditions are met
function createSmartInterval(callback, interval, name) {
    return setInterval(() => {
        // Skip if auto-refresh disabled
        if (!isAutoRefreshEnabled) {
            return;
        }
        
        // Skip if page is hidden
        if (!isPageVisible) {
            return;
        }
        
        // Skip if user is actively interacting (within last 30 seconds)
        if (isUserInteracting && (Date.now() - lastInteractionTime) < 30000) {
            return;
        }
        
        // Execute callback
        callback();
    }, interval);
}

// Function to clear all auto-refresh intervals
function clearAllAutoRefresh() {
    autoRefreshIntervals.forEach(interval => clearInterval(interval));
    autoRefreshIntervals = [];
}

// Function to setup auto-refresh with smart intervals
function setupAutoRefresh() {
    clearAllAutoRefresh();
    
    if (!isAutoRefreshEnabled) return;
    
    // Stats: Every 5 minutes (was 2 minutes)
    autoRefreshIntervals.push(
        createSmartInterval(updateSystemStats, 300000, 'stats')
    );
    
    // Org verification: Every 10 minutes (was 5 minutes)
    autoRefreshIntervals.push(
        createSmartInterval(loadOrgVerificationStatus, 600000, 'org-verification')
    );
    
    // Applications: Every 5 minutes (was 2 minutes) - but only refresh if not actively viewing
    autoRefreshIntervals.push(
        createSmartInterval(() => {
            // Only refresh if user hasn't interacted in last 2 minutes
            if (Date.now() - lastInteractionTime > 120000) {
                loadRegistrationApplications();
                loadTransferApplications();
            }
        }, 300000, 'applications')
    );
}

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

function initializeAdminDashboard() {
    // Check and clear demo accounts first
    if (!checkAndClearDemoAccount()) {
        return; // Stop initialization if demo account detected
    }
    
    // PRIORITY 1: Load applications first (most important)
    initializeSubmittedApplications();
    
    // PRIORITY 2: Load stats (defer slightly)
    setTimeout(() => {
    updateSystemStats();
    }, 500);
    
    // PRIORITY 3: Defer non-critical features
    setTimeout(() => {
    initializeUserManagement();
    initializeOrganizationManagement();
    initializeAuditLogs();
    initializeReports();
    loadOrgVerificationStatus();
    }, 2000); // Load after 2 seconds
    
    // Set up smart auto-refresh (replaces old setInterval calls)
    setupAutoRefresh();
    
    // Initialize blockchain status
    updateBlockchainStatus();
    setInterval(updateBlockchainStatus, 30000);
}

// Load organization verification statuses from API
async function loadOrgVerificationStatus() {
    try {
        const apiClient = window.apiClient || new APIClient();
        
        // Try consolidated endpoint first, fallback to individual endpoints
        let response;
        try {
            response = await apiClient.get('/api/admin/clearance-requests');
        } catch (e) {
            console.log('Consolidated endpoint not available, using individual endpoints');
            response = null;
        }
        
        let hpgRequests = [], insuranceRequests = [], emissionRequests = [];
        let stats = null;
        
        if (response && response.success) {
            // Use consolidated response
            hpgRequests = response.grouped?.hpg || [];
            insuranceRequests = response.grouped?.insurance || [];
            emissionRequests = response.grouped?.emission || [];
            stats = response.stats;
        } else {
            // Fallback to individual endpoints
            const [hpgResponse, insuranceResponse, emissionResponse] = await Promise.all([
                apiClient.get('/api/hpg/requests').catch(e => ({ success: false, requests: [] })),
                apiClient.get('/api/insurance/requests').catch(e => ({ success: false, requests: [] })),
                apiClient.get('/api/emission/requests').catch(e => ({ success: false, requests: [] }))
            ]);
            
            hpgRequests = hpgResponse.requests || [];
            insuranceRequests = insuranceResponse.requests || [];
            emissionRequests = emissionResponse.requests || [];
        }
        
        // Calculate stats if not provided
        if (!stats) {
            stats = {
                hpg: {
                    pending: hpgRequests.filter(r => r.status === 'PENDING').length,
                    approved: hpgRequests.filter(r => r.status === 'APPROVED' || r.status === 'COMPLETED').length,
                    rejected: hpgRequests.filter(r => r.status === 'REJECTED').length
                },
                insurance: {
                    pending: insuranceRequests.filter(r => r.status === 'PENDING').length,
                    approved: insuranceRequests.filter(r => r.status === 'APPROVED' || r.status === 'COMPLETED').length,
                    rejected: insuranceRequests.filter(r => r.status === 'REJECTED').length
                },
                emission: {
                    pending: emissionRequests.filter(r => r.status === 'PENDING').length,
                    approved: emissionRequests.filter(r => r.status === 'APPROVED' || r.status === 'COMPLETED').length,
                    rejected: emissionRequests.filter(r => r.status === 'REJECTED').length
                }
            };
        }
        
        // Update HPG counts (with null checks for pages that don't have these elements)
        const hpgPendingEl = document.getElementById('hpgPendingCount');
        const hpgApprovedEl = document.getElementById('hpgApprovedCount');
        const hpgRejectedEl = document.getElementById('hpgRejectedCount');
        if (hpgPendingEl) hpgPendingEl.textContent = stats.hpg.pending;
        if (hpgApprovedEl) hpgApprovedEl.textContent = stats.hpg.approved + (stats.hpg.completed || 0);
        if (hpgRejectedEl) hpgRejectedEl.textContent = stats.hpg.rejected;
        
        // Update Insurance counts (with null checks)
        const insurancePendingEl = document.getElementById('insurancePendingCount');
        const insuranceApprovedEl = document.getElementById('insuranceApprovedCount');
        const insuranceRejectedEl = document.getElementById('insuranceRejectedCount');
        if (insurancePendingEl) insurancePendingEl.textContent = stats.insurance.pending;
        if (insuranceApprovedEl) insuranceApprovedEl.textContent = stats.insurance.approved + (stats.insurance.completed || 0);
        if (insuranceRejectedEl) insuranceRejectedEl.textContent = stats.insurance.rejected;
        
        // Update Emission counts (with null checks)
        const emissionPendingEl = document.getElementById('emissionPendingCount');
        const emissionApprovedEl = document.getElementById('emissionApprovedCount');
        const emissionRejectedEl = document.getElementById('emissionRejectedCount');
        if (emissionPendingEl) emissionPendingEl.textContent = stats.emission.pending;
        if (emissionApprovedEl) emissionApprovedEl.textContent = stats.emission.approved + (stats.emission.completed || 0);
        if (emissionRejectedEl) emissionRejectedEl.textContent = stats.emission.rejected;
        
        // Combine all requests and sort by date for the table
        const allRequests = [
            ...hpgRequests.map(r => ({ ...r, orgType: 'HPG', orgIcon: 'fa-shield-alt', orgColor: '#2c3e50' })),
            ...insuranceRequests.map(r => ({ ...r, orgType: 'Insurance', orgIcon: 'fa-file-shield', orgColor: '#3498db' })),
            ...emissionRequests.map(r => ({ ...r, orgType: 'Emission', orgIcon: 'fa-leaf', orgColor: '#16a085' }))
        ].sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
        
        // Render the verification responses table (with null check)
        const verificationTbody = document.getElementById('verification-responses-tbody');
        if (verificationTbody) {
            renderVerificationResponsesTable(allRequests.slice(0, 20)); // Show latest 20
        }
        
        console.log('📊 Organization verification status loaded:', stats);
        
    } catch (error) {
        console.error('Error loading organization verification status:', error);
        const verificationTbody = document.getElementById('verification-responses-tbody');
        if (verificationTbody) {
            verificationTbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #e74c3c;">
                        <i class="fas fa-exclamation-triangle"></i> Error loading verification statuses
                    </td>
                </tr>
            `;
        }
    }
}

// Render verification responses table
function renderVerificationResponsesTable(requests) {
    const tbody = document.getElementById('verification-responses-tbody');
    if (!tbody) return;
    
    if (requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                    <i class="fas fa-inbox"></i> No verification requests yet
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = requests.map(req => {
        const metadata = typeof req.metadata === 'string' ? JSON.parse(req.metadata) : (req.metadata || {});
        const vehicleInfo = metadata.vehiclePlate || req.plate_number || req.vin || 'N/A';
        const statusClass = getVerificationStatusClass(req.status);
        const statusIcon = getVerificationStatusIcon(req.status);
        const responseDate = req.updated_at || req.created_at;
        
        return `
            <tr>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <strong>${vehicleInfo}</strong>
                        ${metadata.vehicleMake ? `<small style="color: #7f8c8d;">${metadata.vehicleMake} ${metadata.vehicleModel || ''}</small>` : ''}
                    </div>
                </td>
                <td>
                    <span style="display: inline-flex; align-items: center; gap: 0.5rem; color: ${req.orgColor};">
                        <i class="fas ${req.orgIcon}"></i>
                        ${req.orgType}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <i class="fas ${statusIcon}"></i> ${req.status}
                    </span>
                </td>
                <td>${new Date(responseDate).toLocaleString()}</td>
                <td>
                    <button class="btn-secondary btn-sm" onclick="viewVerificationDetails('${req.id}', '${req.orgType.toLowerCase()}')" title="View Status Details">
                        <i class="fas fa-info-circle"></i>
                    </button>
                    ${req.status === 'APPROVED' || req.status === 'COMPLETED' ? `
                        <button class="btn-success btn-sm" onclick="acknowledgeVerification('${req.id}', '${req.orgType.toLowerCase()}')" title="Acknowledge">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

function getVerificationStatusClass(status) {
    const statusMap = {
        'PENDING': 'status-pending',
        'APPROVED': 'status-approved',
        'COMPLETED': 'status-approved',
        'REJECTED': 'status-rejected'
    };
    return statusMap[status] || 'status-pending';
}

function getVerificationStatusIcon(status) {
    const iconMap = {
        'PENDING': 'fa-clock',
        'APPROVED': 'fa-check-circle',
        'COMPLETED': 'fa-check-double',
        'REJECTED': 'fa-times-circle'
    };
    return iconMap[status] || 'fa-question-circle';
}

// View verification details - Shows modal with verification info (LTO cannot access org interfaces)
function viewVerificationDetails(requestId, orgType) {
    // LTO admin should NOT access org interfaces directly
    // Instead, show a modal with the verification details
    
    const orgLabels = {
        'hpg': 'HPG Clearance',
        'insurance': 'Insurance Verification',
        'emission': 'Emission Verification'
    };
    
    const orgIcons = {
        'hpg': 'fa-shield-alt',
        'insurance': 'fa-file-shield',
        'emission': 'fa-leaf'
    };
    
    const orgColors = {
        'hpg': '#2c3e50',
        'insurance': '#3498db',
        'emission': '#16a085'
    };
    
    // Create and show modal
    const existingModal = document.getElementById('verificationDetailsModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'verificationDetailsModal';
    modal.className = 'modal';
    modal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10000; align-items: center; justify-content: center;';
    
    modal.innerHTML = `
        <div class="modal-content" style="background: white; border-radius: 16px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
            <div class="modal-header" style="padding: 1.5rem; border-bottom: 2px solid #e9ecef; display: flex; align-items: center; gap: 1rem;">
                <div style="background: ${orgColors[orgType]}; color: white; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <i class="fas ${orgIcons[orgType]}" style="font-size: 1.25rem;"></i>
                </div>
                <div style="flex: 1;">
                    <h3 style="margin: 0; font-size: 1.25rem; color: #2c3e50;">${orgLabels[orgType]} Details</h3>
                    <small style="color: #7f8c8d;">Request ID: ${requestId.substring(0, 8)}...</small>
                </div>
                <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 1.5rem; color: #7f8c8d; cursor: pointer; padding: 0.25rem;">&times;</button>
            </div>
            <div class="modal-body" style="padding: 1.5rem;">
                <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 0.875rem;">
                        <i class="fas fa-info-circle"></i> 
                        This verification request was sent to <strong>${orgLabels[orgType]}</strong> for processing. 
                        LTO can only view the status - the organization handles the verification process independently.
                    </p>
                </div>
                
                <div style="display: grid; gap: 1rem;">
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; margin-bottom: 0.25rem;">Request ID</label>
                        <span style="font-weight: 600; color: #2c3e50;">${requestId}</span>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; margin-bottom: 0.25rem;">Organization</label>
                        <span style="font-weight: 600; color: ${orgColors[orgType]};">
                            <i class="fas ${orgIcons[orgType]}"></i> ${orgLabels[orgType]}
                        </span>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: #7f8c8d; text-transform: uppercase; margin-bottom: 0.25rem;">Status</label>
                        <span class="status-badge status-pending" style="font-weight: 600;">Awaiting Response</span>
                    </div>
                </div>
                
                <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 2px solid #e9ecef;">
                    <p style="margin: 0; color: #7f8c8d; font-size: 0.875rem;">
                        <i class="fas fa-lock"></i> 
                        <strong>Note:</strong> LTO does not have access to organization interfaces. 
                        Verification decisions are made independently by each organization.
                    </p>
                </div>
            </div>
            <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 2px solid #e9ecef; display: flex; justify-content: flex-end;">
                <button onclick="this.closest('.modal').remove()" class="btn-secondary" style="padding: 0.75rem 1.5rem;">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close on backdrop click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Acknowledge verification (mark as seen by LTO)
async function acknowledgeVerification(requestId, orgType) {
    try {
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show(`${orgType.toUpperCase()} verification acknowledged`, 'success');
        } else {
            alert(`${orgType.toUpperCase()} verification acknowledged`);
        }
        
        // Refresh the table
        loadOrgVerificationStatus();
    } catch (error) {
        console.error('Error acknowledging verification:', error);
    }
}

// Check if user is using a demo account and clear it
function checkAndClearDemoAccount() {
    const isAuthDisabled = typeof window !== 'undefined' && window.DISABLE_AUTH === true;
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    const currentUser = localStorage.getItem('currentUser');
    
    // If auth is disabled (dev mode), allow access but still check for admin role
    if (isAuthDisabled) {
        // In dev mode, check if user has admin role
        if (currentUser) {
            try {
                const user = JSON.parse(currentUser);
                if (user.role !== 'admin') {
                    console.warn('❌ Non-admin account in dev mode - redirecting');
                    showNotification('Admin access required. Redirecting to login...', 'error');
                    setTimeout(() => {
                        window.location.href = 'login-signup.html?message=Admin access required';
                    }, 2000);
                    return false;
                }
            } catch (e) {
                console.warn('Could not parse currentUser:', e);
            }
        }
        return true; // Allow access in dev mode
    }
    
    // Production mode: Require valid authentication
    if (!token) {
        console.warn('❌ No authentication token found - redirecting to login');
        showNotification('Authentication required. Redirecting to login...', 'error');
        setTimeout(() => {
            window.location.href = 'login-signup.html?redirect=' + encodeURIComponent(window.location.pathname);
        }, 2000);
        return false;
    }
    
    // Check if it's a demo token
    if (token.startsWith('demo-token-')) {
        console.warn('❌ Demo account detected - clearing credentials');
        localStorage.clear();
        showNotification('Demo accounts cannot access admin features. Please login with a real admin account.', 'error');
        setTimeout(() => {
            window.location.href = 'login-signup.html?message=Please login as admin';
        }, 2000);
        return false;
    }
    
    // Check if currentUser has admin role
    if (currentUser) {
        try {
            const user = JSON.parse(currentUser);
            if (user.role !== 'admin') {
                console.warn('❌ Non-admin account detected - clearing credentials');
                localStorage.clear();
                showNotification(`Access denied. Admin role required. Your role: ${user.role || 'none'}. Please login as admin.`, 'error');
                setTimeout(() => {
                    window.location.href = 'login-signup.html?message=Admin access required';
                }, 2000);
                return false;
            }
        } catch (e) {
            console.warn('Could not parse currentUser:', e);
        }
    }
    
    // Check JWT token role if it's a real token
    if (!token.startsWith('demo-token-')) {
        try {
            const parts = token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                
                // Check token expiration
                if (payload.exp && payload.exp * 1000 < Date.now()) {
                    console.warn('❌ Token expired - redirecting to login');
                    localStorage.clear();
                    showNotification('Session expired. Please login again.', 'error');
                    setTimeout(() => {
                        window.location.href = 'login-signup.html?expired=true';
                    }, 2000);
                    return false;
                }
                
                // Check admin role
                if (payload.role !== 'admin') {
                    console.warn('❌ Token does not have admin role - clearing credentials');
                    localStorage.clear();
                    showNotification(`Access denied. Admin role required. Your role: ${payload.role || 'none'}. Please login as admin.`, 'error');
                    setTimeout(() => {
                        window.location.href = 'login-signup.html?message=Admin access required';
                    }, 2000);
                    return false;
                }
                console.log('✅ Admin authentication verified:', { role: payload.role, email: payload.email });
            } else {
                console.warn('❌ Invalid token format - redirecting to login');
                localStorage.clear();
                showNotification('Invalid authentication. Please login again.', 'error');
                setTimeout(() => {
                    window.location.href = 'login-signup.html?message=Invalid authentication';
                }, 2000);
                return false;
            }
        } catch (e) {
            console.warn('Could not decode token:', e);
            // Invalid token - redirect to login
            localStorage.clear();
            showNotification('Authentication error. Please login again.', 'error');
            setTimeout(() => {
                window.location.href = 'login-signup.html?message=Authentication error';
            }, 2000);
            return false;
        }
    }
    
    return true;
}

async function updateSystemStats() {
    try {
        const apiClient = window.apiClient || new APIClient();
        
        // Load stats from backend API
        const [adminStatsResponse, transferStatsResponse] = await Promise.all([
            apiClient.get('/api/admin/stats').catch(e => {
                console.error('Failed to load admin stats:', e);
                return { success: false, stats: null };
            }),
            apiClient.get('/api/vehicles/transfer/requests/stats').catch(e => {
                console.error('Failed to load transfer stats:', e);
                return { success: false, stats: null };
            })
        ]);
        
        // Update dashboard stat cards if they exist
        const totalAppsEl = document.getElementById('totalApplications');
        const pendingTransfersEl = document.getElementById('pendingTransfers');
        const approvedAppsEl = document.getElementById('approvedApplications');
        const totalUsersEl = document.getElementById('totalUsers');
        
        // Update total applications (vehicles)
        if (totalAppsEl && adminStatsResponse.success && adminStatsResponse.stats) {
            const totalVehicles = adminStatsResponse.stats.vehicles?.total || 0;
            totalAppsEl.textContent = totalVehicles.toLocaleString();
        }
        
        // Update pending transfers (PENDING + REVIEWING - both need admin attention)
        if (pendingTransfersEl && transferStatsResponse.success && transferStatsResponse.stats) {
            const stats = transferStatsResponse.stats;
            // PENDING = waiting for buyer, REVIEWING = waiting for admin
            const pendingCount = (stats.pending || 0) + (stats.reviewing || 0);
            pendingTransfersEl.textContent = pendingCount.toLocaleString();
            
            // Update badge
            const transferBadge = document.getElementById('transferBadge');
            if (transferBadge) {
                if (pendingCount > 0) {
                    transferBadge.textContent = pendingCount;
                    transferBadge.style.display = 'inline-block';
                } else {
                    transferBadge.style.display = 'none';
                }
            }
        }
        
        // Update approved applications
        if (approvedAppsEl && adminStatsResponse.success && adminStatsResponse.stats) {
            const vehicles = adminStatsResponse.stats.vehicles || {};
            const approvedCount = (vehicles.approved || 0) + (vehicles.registered || 0);
            approvedAppsEl.textContent = approvedCount.toLocaleString();
        }
        
        // Update total users
        if (totalUsersEl && adminStatsResponse.success && adminStatsResponse.stats) {
            const totalUsers = adminStatsResponse.stats.users?.total || 0;
            totalUsersEl.textContent = totalUsers.toLocaleString();
        }
        
        console.log('✅ System stats updated:', {
            vehicles: adminStatsResponse.stats?.vehicles,
            transfers: transferStatsResponse.stats,
            users: adminStatsResponse.stats?.users
        });
        
    } catch (error) {
        console.error('Failed to update system stats:', error);
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
    // Load and display submitted applications (legacy - for backward compatibility)
    // Now using separate functions for registrations and transfers
    loadRegistrationApplications();
    loadTransferApplications();
    
    // Auto-refresh is now handled by setupAutoRefresh() in initializeAdminDashboard
    // No separate setInterval here anymore
}

async function loadSubmittedApplications() {
    const tbody = document.getElementById('submitted-applications-tbody');
    if (!tbody) return;
    
    // Show loading state
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Loading applications...</td></tr>';
    
    try {
        // Check for demo account first
        const token = (typeof window !== 'undefined' && window.authManager) 
            ? window.authManager.getAccessToken() 
            : (localStorage.getItem('authToken') || localStorage.getItem('token'));
        
        if (token && token.startsWith('demo-token-')) {
            console.warn('Demo token detected - cannot load applications');
            showNotification('Demo accounts cannot access admin features. Please login with a real admin account.', 'error');
            localStorage.clear();
            setTimeout(() => {
                window.location.href = 'login-signup.html?message=Please login as admin';
            }, 2000);
            return;
        }
        
        // Try to load from API first
        if (token && typeof APIClient !== 'undefined') {
            try {
                const apiClient = new APIClient();
                // Use combined status query with optimized limit
                let response = await apiClient.get('/api/vehicles?status=SUBMITTED,PENDING_BLOCKCHAIN&limit=50&page=1');
                let allVehicles = response && response.success && response.vehicles ? response.vehicles : [];
                
                if (allVehicles.length > 0) {
                    response = {
                        success: true,
                        vehicles: allVehicles,
                        pagination: response.pagination || null
                    };
                }
                
                if (response && response.success && response.vehicles) {
                    // Convert vehicles to application format using canonical mapper + admin extensions
                    const mapper = (window.VehicleMapper && window.VehicleMapper.mapVehicleToApplication) || null;
                    if (!mapper) {
                        console.error('❌ VehicleMapper not available. Make sure js/models/vehicle-mapper.js is loaded.');
                        throw new Error('VehicleMapper not available');
                    }
                    
                    allApplications = response.vehicles.map(vehicle => {
                        // Start with canonical mapping
                        const app = mapper(vehicle);
                        
                        // Extend with admin-specific fields
                        const verificationStatus = app.verificationStatus || {};
                        
                        // Use Object.assign for compatibility instead of spread operator
                        return Object.assign({}, app, {
                            // Add engine and chassis numbers to vehicle info
                            vehicle: Object.assign({}, app.vehicle, {
                                engineNumber: vehicle.engineNumber || vehicle.engine_number || '',
                                chassisNumber: vehicle.chassisNumber || vehicle.chassis_number || ''
                            }),
                            // Admin-specific owner information
                            owner: {
                                firstName: vehicle.owner_name ? vehicle.owner_name.split(' ')[0] : 'Unknown',
                                lastName: vehicle.owner_name ? vehicle.owner_name.split(' ').slice(1).join(' ') : 'User',
                                email: vehicle.owner_email || 'unknown@example.com'
                            },
                            // Admin-specific priority
                            priority: vehicle.priority || 'MEDIUM',
                            // Preserve verifications array for backward compatibility
                            verifications: vehicle.verifications || [],
                            // Add flat status properties for insurance verifier compatibility
                            insuranceStatus: verificationStatus.insurance || 'pending',
                            emissionStatus: verificationStatus.emission || 'pending',
                            hpgStatus: verificationStatus.hpg || 'pending',
                            // Ensure status is lowercase for filter matching
                            status: (vehicle.status || 'SUBMITTED').toLowerCase()
                        });
                    });
                    
                    // Save to localStorage for offline access (v2 format)
                    localStorage.setItem('submittedApplications_v2', JSON.stringify(allApplications));
                    console.log(`💾 Saved ${allApplications.length} applications to localStorage (v2)`);
                    
                    // Keep v1 for backward compatibility (read-only, don't overwrite if it exists)
                    if (!localStorage.getItem('submittedApplications')) {
                        localStorage.setItem('submittedApplications', JSON.stringify(allApplications));
                    }
                    
                    // Sort applications by submission date (newest first)
                    allApplications.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
                    
                    // Apply filters/search if any
                    filteredApplications = applyFilters(allApplications);
                    
                    // Update pagination
                    updatePagination();
                    renderApplications();
                    return;
                }
            } catch (apiError) {
                console.warn('API load failed, trying localStorage:', apiError);
            }
        }
        
        // Fallback to localStorage with migration support
        console.log('📦 Loading from localStorage...');
        
        // Try v2 first
        let localApps = JSON.parse(localStorage.getItem('submittedApplications_v2') || '[]');
        
        // If v2 is empty but v1 exists, migrate
        if (localApps.length === 0) {
            const v1Apps = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
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
                                    verificationStatus: oldApp.verificationStatus || {},
                                    verifications: oldApp.verifications || [],
                                    owner_name: oldApp.owner ? `${oldApp.owner.firstName} ${oldApp.owner.lastName}` : null,
                                    owner_email: oldApp.owner ? oldApp.owner.email : null,
                                    priority: oldApp.priority
                                }, oldApp.vehicle);
                                const baseApp = mapper(vehicleLike);
                                const verificationStatus = baseApp.verificationStatus || {};
                                
                                // Return with admin extensions (using Object.assign for compatibility)
                                return Object.assign({}, baseApp, {
                                    vehicle: Object.assign({}, baseApp.vehicle, {
                                        engineNumber: oldApp.vehicle.engineNumber || '',
                                        chassisNumber: oldApp.vehicle.chassisNumber || ''
                                    }),
                                    owner: oldApp.owner || {
                                        firstName: 'Unknown',
                                        lastName: 'User',
                                        email: 'unknown@example.com'
                                    },
                                    priority: oldApp.priority || 'MEDIUM',
                                    verifications: oldApp.verifications || [],
                                    insuranceStatus: verificationStatus.insurance || oldApp.insuranceStatus || 'pending',
                                    emissionStatus: verificationStatus.emission || oldApp.emissionStatus || 'pending',
                                    hpgStatus: verificationStatus.hpg || oldApp.hpgStatus || 'pending'
                                });
                            }
                            return oldApp; // Fallback to old structure if migration fails
                        });
                        
                        // Save migrated data to v2
                        localStorage.setItem('submittedApplications_v2', JSON.stringify(localApps));
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
        
        // Sort applications by submission date (newest first)
        allApplications.sort((a, b) => new Date(b.submittedDate) - new Date(a.submittedDate));
        
        // Apply filters/search if any
        filteredApplications = applyFilters(allApplications);
        
        // Update pagination
        updatePagination();
        renderApplications();
    } catch (error) {
        console.error('Error loading applications:', error);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: red;">Error loading applications. Please refresh the page.</td></tr>';
    }
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
            (app.vehicle.plateNumber && app.vehicle.plateNumber.toLowerCase().includes(searchTerm))
        );
    }
    
    // Apply status filter (case-insensitive comparison)
    if (statusFilter && statusFilter.value !== 'all') {
        const filterStatus = statusFilter.value.toLowerCase();
        filtered = filtered.filter(app => {
            const appStatus = (app.status || '').toLowerCase();
            return appStatus === filterStatus;
        });
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
                <td colspan="8" style="text-align: center; padding: 20px; color: #666;">
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
        
        // Find the table-container div (which contains the table)
        const tableContainerDiv = tableContainer.querySelector('.table-container');
        if (tableContainerDiv) {
            // Insert toolbar before the table-container div
            tableContainer.insertBefore(toolbar, tableContainerDiv);
        } else {
            // Fallback: try to find table and insert before its parent
            const table = tableContainer.querySelector('table');
            if (table && table.parentElement) {
                table.parentElement.insertBefore(toolbar, table);
            }
        }
        
        // Add event listeners
        document.getElementById('applicationSearch')?.addEventListener('input', () => {
            currentPage = 1;
            filteredApplications = applyFilters(allApplications);
            updatePagination();
            renderApplications();
        });
        
        document.getElementById('statusFilter')?.addEventListener('change', () => {
            currentPage = 1;
            filteredApplications = applyFilters(allApplications);
            updatePagination();
            renderApplications();
        });
        
        // Add refresh button
        addRefreshButton();
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

// Load integrity status for a vehicle
async function loadIntegrityStatus(vehicleId, vin, cellElement) {
    if (!cellElement || !vin) return;
    
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/integrity/check/${vin}`);
        
        if (response.success) {
            const status = response.status;
            let badgeClass = 'verified';
            let badgeIcon = 'fa-check-circle';
            let badgeText = 'VERIFIED';
            
            if (status === 'TAMPERED') {
                badgeClass = 'tampered';
                badgeIcon = 'fa-exclamation-triangle';
                badgeText = 'TAMPERED';
            } else if (status === 'MISMATCH') {
                badgeClass = 'mismatch';
                badgeIcon = 'fa-exclamation-circle';
                badgeText = 'MISMATCH';
            } else if (status === 'NOT_REGISTERED') {
                badgeClass = 'not-registered';
                badgeIcon = 'fa-info-circle';
                badgeText = 'NOT REGISTERED';
            } else if (status === 'ERROR') {
                badgeClass = 'error';
                badgeIcon = 'fa-times-circle';
                badgeText = 'ERROR';
            }
            
            cellElement.innerHTML = `
                <span class="integrity-badge ${badgeClass}" title="${response.message || ''}">
                    <i class="fas ${badgeIcon}"></i> ${badgeText}
                </span>
            `;
        } else {
            cellElement.innerHTML = '<span class="integrity-badge error"><i class="fas fa-times-circle"></i> ERROR</span>';
        }
    } catch (error) {
        console.warn(`Integrity check failed for VIN ${vin}:`, error);
        cellElement.innerHTML = '<span class="integrity-badge error"><i class="fas fa-times-circle"></i> ERROR</span>';
    }
}

// Add refresh button to force reload from API
function addRefreshButton() {
    const tableContainer = document.querySelector('.dashboard-card:has(#submitted-applications-tbody)');
    if (!tableContainer) return;
    
    // Check if refresh button already exists
    if (document.getElementById('refreshApplicationsBtn')) return;
    
    const toolbar = tableContainer.querySelector('.management-toolbar');
    if (toolbar) {
        // Manual refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'refreshApplicationsBtn';
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        refreshBtn.className = 'btn btn-primary';
        refreshBtn.style.marginLeft = '1rem';
        refreshBtn.style.padding = '0.5rem 1rem';
        refreshBtn.style.cursor = 'pointer';
        refreshBtn.onclick = async () => {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            
            // Clear localStorage to force fresh API load
            localStorage.removeItem('submittedApplications');
            localStorage.removeItem('submittedApplications_v2');
            
            // Reload applications
            await loadSubmittedApplications();
            
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            
            // Show notification
            if (typeof showNotification !== 'undefined') {
                showNotification('Applications refreshed', 'success');
            } else if (typeof ToastNotification !== 'undefined') {
                ToastNotification.show('Applications refreshed', 'success');
            }
        };
        
        // Auto-refresh toggle button
        const autoRefreshToggle = document.createElement('button');
        autoRefreshToggle.id = 'autoRefreshToggle';
        autoRefreshToggle.innerHTML = isAutoRefreshEnabled 
            ? '<i class="fas fa-pause"></i> Pause Auto-Refresh' 
            : '<i class="fas fa-play"></i> Enable Auto-Refresh';
        autoRefreshToggle.className = 'btn btn-secondary';
        autoRefreshToggle.style.marginLeft = '0.5rem';
        autoRefreshToggle.style.padding = '0.5rem 1rem';
        autoRefreshToggle.onclick = () => {
            isAutoRefreshEnabled = !isAutoRefreshEnabled;
            if (isAutoRefreshEnabled) {
                setupAutoRefresh();
                autoRefreshToggle.innerHTML = '<i class="fas fa-pause"></i> Pause Auto-Refresh';
                if (typeof showNotification !== 'undefined') {
                    showNotification('Auto-refresh enabled', 'info');
                } else if (typeof ToastNotification !== 'undefined') {
                    ToastNotification.show('Auto-refresh enabled', 'info');
                }
            } else {
                clearAllAutoRefresh();
                autoRefreshToggle.innerHTML = '<i class="fas fa-play"></i> Enable Auto-Refresh';
                if (typeof showNotification !== 'undefined') {
                    showNotification('Auto-refresh paused', 'info');
                } else if (typeof ToastNotification !== 'undefined') {
                    ToastNotification.show('Auto-refresh paused', 'info');
                }
            }
        };
        
        toolbar.appendChild(refreshBtn);
        toolbar.appendChild(autoRefreshToggle);
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
    const vehicleId = application.id;
    const vin = application.vehicle?.vin || '';
    const vehicle = application.vehicle || {};
    
    // Check inspection status - check both application.vehicle and application itself
    const hasInspection = vehicle.mvir_number || application.mvir_number || vehicle.mvirNumber || application.mvirNumber;
    const mvirNumber = vehicle.mvir_number || application.mvir_number || vehicle.mvirNumber || application.mvirNumber;
    
    const inspectionStatus = hasInspection 
        ? `<span class="badge badge-success" title="MVIR: ${mvirNumber}" style="margin-top: 0.25rem; display: inline-block;">
            <i class="fas fa-check-circle"></i> Inspected
           </span>`
        : `<span class="badge badge-warning" title="Inspection required before approval" style="margin-top: 0.25rem; display: inline-block;">
            <i class="fas fa-exclamation-triangle"></i> Not Inspected
           </span>`;
    
    // Get verification status and auto-verification info
    const verifications = application.verifications || [];
    const insuranceVerification = verifications.find(v => v.verification_type === 'insurance');
    const emissionVerification = verifications.find(v => v.verification_type === 'emission');
    const hpgVerification = verifications.find(v => v.verification_type === 'hpg');
    
    // Build auto-verification status badges
    let autoVerificationBadges = '';
    
    if (insuranceVerification && insuranceVerification.automated) {
        const score = insuranceVerification.verification_score || 0;
        const status = insuranceVerification.status || 'PENDING';
        const badgeClass = status === 'APPROVED' ? 'badge-success' : 'badge-warning';
        const icon = status === 'APPROVED' ? 'fa-robot' : 'fa-exclamation-triangle';
        autoVerificationBadges += `<span class="badge ${badgeClass}" title="Insurance Auto-Verified: ${status} (Score: ${score}%)" style="margin-top: 0.25rem; display: inline-block; margin-right: 0.25rem;">
            <i class="fas ${icon}"></i> Insurance: ${status === 'APPROVED' ? 'Auto-Approved' : 'Auto-Flagged'} (${score}%)
        </span>`;
    }
    
    if (emissionVerification && emissionVerification.automated) {
        const score = emissionVerification.verification_score || 0;
        const status = emissionVerification.status || 'PENDING';
        const badgeClass = status === 'APPROVED' ? 'badge-success' : 'badge-warning';
        const icon = status === 'APPROVED' ? 'fa-robot' : 'fa-exclamation-triangle';
        autoVerificationBadges += `<span class="badge ${badgeClass}" title="Emission Auto-Verified: ${status} (Score: ${score}%)" style="margin-top: 0.25rem; display: inline-block; margin-right: 0.25rem;">
            <i class="fas ${icon}"></i> Emission: ${status === 'APPROVED' ? 'Auto-Approved' : 'Auto-Flagged'} (${score}%)
        </span>`;
    }
    
    if (hpgVerification && hpgVerification.automated) {
        const score = hpgVerification.verification_score || 0;
        autoVerificationBadges += `<span class="badge badge-info" title="HPG Pre-Verified: Data extracted (Score: ${score}%)" style="margin-top: 0.25rem; display: inline-block; margin-right: 0.25rem;">
            <i class="fas fa-robot"></i> HPG: Pre-Verified (${score}%)
        </span>`;
    }
    
    // Determine if approval should be disabled (allow admin override for now)
    const canApprove = true; // Set to false to enforce strict requirement
    const approveButtonClass = canApprove ? 'btn-primary' : 'btn-secondary';
    const approveButtonDisabled = canApprove ? '' : 'disabled';
    const approveButtonTitle = canApprove ? 'Approve application' : 'Inspection required before approval';
    
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
        <td><span class="status-badge status-${(application.status || '').toLowerCase()}">${getStatusText(application.status)}</span></td>
        <td><span class="priority-badge priority-${application.priority}">${application.priority}</span></td>
        <td class="integrity-status-cell" data-vehicle-id="${vehicleId}" data-vin="${vin}">
            <span class="integrity-badge loading">
                <i class="fas fa-spinner fa-spin"></i> Checking...
            </span>
        </td>
        <td>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-start;">
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn-secondary btn-sm" onclick="viewApplication('${application.id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-info btn-sm" onclick="inspectVehicle('${vehicleId}')" title="${hasInspection ? 'View inspection details' : 'Perform vehicle inspection'}">
                        <i class="fas fa-clipboard-check"></i> ${hasInspection ? 'View Inspection' : 'Inspect'}
                    </button>
                    ${vin ? `<button class="btn-info btn-sm" onclick="checkDataIntegrity('${vehicleId}', '${vin}')" title="Check Data Integrity">
                        <i class="fas fa-shield-alt"></i> Integrity
                    </button>` : ''}
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="${approveButtonClass} btn-sm" onclick="approveApplication('${application.id}')" ${approveButtonDisabled} title="${approveButtonTitle}">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="btn-danger btn-sm" onclick="rejectApplication('${application.id}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
                ${inspectionStatus}
                ${autoVerificationBadges ? `<div style="margin-top: 0.25rem; display: flex; flex-wrap: wrap; gap: 0.25rem;">${autoVerificationBadges}</div>` : ''}
            </div>
        </td>
    `;
    
    // Lazy load integrity status after row is created
    if (vin) {
        setTimeout(() => loadIntegrityStatus(vehicleId, vin, row.querySelector('.integrity-status-cell')), 100);
    } else {
        row.querySelector('.integrity-status-cell').innerHTML = '<span class="integrity-badge error"><i class="fas fa-question"></i> N/A</span>';
    }
    
    return row;
}

function getStatusText(status) {
    // Normalize status to lowercase for mapping
    const normalizedStatus = (status || '').toLowerCase();
    const statusMap = {
        'submitted': 'Pending Review',
        'approved': 'Approved',
        'rejected': 'Rejected',
        'processing': 'Processing',
        'completed': 'Completed',
        'registered': 'Registered',
        'pending_blockchain': 'Pending Blockchain'
    };
    return statusMap[normalizedStatus] || status;
}

async function viewApplication(applicationId) {
    console.log('🔍 viewApplication called with ID:', applicationId);
    try {
        // Check authentication first
        const token = (typeof window !== 'undefined' && window.authManager) 
            ? window.authManager.getAccessToken() 
            : (localStorage.getItem('authToken') || localStorage.getItem('token'));
        
        if (!token) {
            console.warn('❌ No token found');
            showNotification('Please login to view applications', 'error');
            window.location.href = 'login-signup.html';
            return;
        }
        
        // Check if it's a demo token
        if (token.startsWith('demo-token-')) {
            console.warn('❌ Demo token detected');
            showNotification('Demo accounts cannot access admin features. Please login with a real admin account.', 'error');
            localStorage.clear();
            setTimeout(() => {
                window.location.href = 'login-signup.html?message=Please login as admin';
            }, 2000);
            return;
        }
        
        console.log('✅ Token valid, loading application...');
        
        // Try to load from API first
        let application = null;
        
        if (token && typeof APIClient !== 'undefined') {
            try {
                const apiClient = new APIClient();
                console.log('📡 Calling API:', `/api/vehicles/id/${applicationId}`);
                // Use /id/:id route for UUID vehicle IDs
                const response = await apiClient.get(`/api/vehicles/id/${applicationId}`);
                console.log('📡 API Response:', response);
                
                if (response && response.success && response.vehicle) {
                    const vehicle = response.vehicle;
                    const mapper = (window.VehicleMapper && window.VehicleMapper.mapVehicleToApplication) || null;
                    
                    if (mapper) {
                        // Start with canonical mapping
                        const baseApp = mapper(vehicle);
                        const verificationStatus = baseApp.verificationStatus || {};
                        
                        // Extend with admin-specific fields (using Object.assign for compatibility)
                        application = Object.assign({}, baseApp, {
                            // Add engine and chassis numbers to vehicle info
                            vehicle: Object.assign({}, baseApp.vehicle, {
                                engineNumber: vehicle.engineNumber || vehicle.engine_number || '',
                                chassisNumber: vehicle.chassisNumber || vehicle.chassis_number || ''
                            }),
                            // Admin-specific owner information
                            owner: vehicle.owner || {
                                firstName: vehicle.ownerFirstName || vehicle.owner_first_name || (vehicle.ownerName ? vehicle.ownerName.split(' ')[0] : 'Unknown'),
                                lastName: vehicle.ownerLastName || vehicle.owner_last_name || (vehicle.ownerName ? vehicle.ownerName.split(' ').slice(1).join(' ') : 'User'),
                                email: vehicle.ownerEmail || vehicle.owner_email || 'unknown@example.com',
                                phone: vehicle.ownerPhone || vehicle.owner_phone || 'N/A',
                                idType: vehicle.owner_id_type || undefined,
                                idNumber: vehicle.owner_id_number || undefined
                            },
                            // Admin-specific priority
                            priority: vehicle.priority || 'MEDIUM',
                            // Preserve verifications array for backward compatibility
                            verifications: vehicle.verifications || [],
                            // Add flat status properties for insurance verifier compatibility
                            insuranceStatus: verificationStatus.insurance || 'pending',
                            emissionStatus: verificationStatus.emission || 'pending',
                            hpgStatus: verificationStatus.hpg || 'pending'
                        });
                    } else {
                        // Fallback to old mapping if mapper not available
                        console.warn('⚠️ VehicleMapper not available, using fallback mapping');
                        application = {
                            id: vehicle.id,
                            vehicle: {
                                make: vehicle.make,
                                model: vehicle.model,
                                year: vehicle.year,
                                plateNumber: vehicle.plateNumber || vehicle.plate_number,
                                vin: vehicle.vin,
                                color: vehicle.color,
                                engineNumber: vehicle.engineNumber || vehicle.engine_number,
                                chassisNumber: vehicle.chassisNumber || vehicle.chassis_number
                            },
                            owner: vehicle.owner || {
                                firstName: vehicle.ownerFirstName || vehicle.owner_first_name || (vehicle.ownerName ? vehicle.ownerName.split(' ')[0] : 'Unknown'),
                                lastName: vehicle.ownerLastName || vehicle.owner_last_name || (vehicle.ownerName ? vehicle.ownerName.split(' ').slice(1).join(' ') : 'User'),
                                email: vehicle.ownerEmail || vehicle.owner_email || 'unknown@example.com',
                                phone: vehicle.ownerPhone || vehicle.owner_phone || 'N/A',
                                idType: vehicle.owner_id_type || undefined,
                                idNumber: vehicle.owner_id_number || undefined
                            },
                            status: vehicle.status?.toLowerCase() || 'submitted',
                            submittedDate: vehicle.registrationDate || vehicle.registration_date || vehicle.createdAt || new Date().toISOString(),
                            priority: vehicle.priority || 'MEDIUM',
                            documents: vehicle.documents || [],
                            verifications: vehicle.verifications || [],
                            verificationStatus: vehicle.verificationStatus || {}
                        };
                    }
                    console.log('✅ Application loaded from API:', application);
                }
            } catch (apiError) {
                console.warn('⚠️ API load failed, trying localStorage:', apiError);
                console.error('API Error details:', apiError);
            }
        }
        
        // Fallback to localStorage (try v2 first, then v1)
        if (!application) {
            console.log('📦 Loading from localStorage...');
            // Try v2 first
            let applications = JSON.parse(localStorage.getItem('submittedApplications_v2') || '[]');
            application = applications.find(app => app.id === applicationId);
            
            // If not found in v2, try v1
            if (!application) {
                applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
                application = applications.find(app => app.id === applicationId);
            }
            
            if (application) {
                console.log('✅ Application found in localStorage:', application);
            }
        }
        
        if (!application) {
            console.error('❌ Application not found');
            showNotification('Application not found', 'error');
            return;
        }
        
        console.log('📋 Showing modal for application:', application.id);
        showApplicationModal(application);
    } catch (error) {
        console.error('❌ Error viewing application:', error);
        console.error('Error stack:', error.stack);
        showNotification('Failed to load application details: ' + error.message, 'error');
    }
}

// Make viewApplication globally accessible
window.viewApplication = viewApplication;

function showApplicationModal(application) {
    console.log('📋 showApplicationModal called with:', application);
    
    // Normalize status to lowercase for consistent comparison
    const normalizedStatus = (application.status || '').toLowerCase();
    const isFinalState = ['approved', 'registered', 'rejected'].includes(normalizedStatus);
    const isApprovedOrRegistered = ['approved', 'registered'].includes(normalizedStatus);
    
    // Remove any existing modals first
    const existingModal = document.querySelector('.modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex'; // Ensure modal is visible
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modal.style.zIndex = '10000';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    
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
                        <h4>Documents (${application.documents ? application.documents.length : 0})</h4>
                        <div class="document-list">
                            ${application.documents && application.documents.length > 0 ? 
                                application.documents.map(doc => {
                                    const docType = doc.documentType || doc.document_type || 'document';
                                    const typeNames = {
                                        'registration_cert': '📄 Registration Certificate',
                                        'insurance_cert': '🛡️ Insurance Certificate',
                                        'emission_cert': '🌱 Emission Certificate',
                                        'owner_id': '🆔 Owner ID'
                                    };
                                    const docName = typeNames[docType] || `📄 ${doc.originalName || doc.original_name || doc.filename || 'Document'}`;
                                    
                                    // Use document ID if available (valid UUID), otherwise use VIN + type
                                    const isValidDocumentId = doc.id && 
                                        typeof doc.id === 'string' && 
                                        doc.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) &&
                                        !doc.id.startsWith('TEMP_');
                                    
                                    const typeParam = docType.replace('_cert', '').replace('_', '');
                                    const viewerUrl = isValidDocumentId 
                                        ? `document-viewer.html?documentId=${doc.id}`
                                        : `document-viewer.html?vin=${application.vehicle.vin || application.vehicle?.vin || ''}&type=${typeParam}`;
                                    
                                    return `<div class="document-item" style="cursor: pointer; padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;" onclick="window.open('${viewerUrl}', '_blank')">
                                        <span>${docName}</span>
                                        <span style="color: #3498db;">View →</span>
                                    </div>`;
                                }).join('') :
                                '<p style="color: #999;">No documents uploaded yet</p>'
                            }
                        </div>
                        ${application.vehicle && application.vehicle.vin ? `
                        <div style="margin-top: 15px;">
                            <a href="document-viewer.html?vin=${application.vehicle.vin}" target="_blank" class="btn-secondary">View All Documents in Viewer</a>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="detail-section">
                        <h4>Verification Requests</h4>
                        ${!isApprovedOrRegistered ? `
                        <div style="padding: 15px; background-color: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 4px;">
                            <p style="color: #1976d2; margin: 0;">
                                <i class="fas fa-info-circle"></i> Verification requests are automatically sent to HPG, Insurance, and Emission organizations when a vehicle registration is submitted. No manual action is required.
                            </p>
                        </div>
                        ` : `
                        <div style="padding: 15px; background-color: #e8f5e9; border-left: 4px solid #27ae60; border-radius: 4px;">
                            <p style="color: #27ae60; margin: 0;">
                                <i class="fas fa-check-circle"></i> This application has been ${normalizedStatus === 'approved' ? 'approved' : 'registered'}. Verification requests are no longer needed.
                            </p>
                        </div>
                        `}
                    </div>
                    
                    <div class="detail-section">
                        <h4>Application Status</h4>
                        <div class="status-info">
                            <p><strong>Status:</strong> <span class="status-badge status-${application.status}">${getStatusText(application.status)}</span></p>
                            <p><strong>Submitted:</strong> ${new Date(application.submittedDate).toLocaleString()}</p>
                            ${application.lastUpdated ? `<p><strong>Last Updated:</strong> ${new Date(application.lastUpdated).toLocaleString()}</p>` : ''}
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; gap: 10px; justify-content: space-between;">
                ${!isFinalState ? `
                <div style="display: flex; gap: 10px;">
                    <button class="btn-primary" onclick="approveApplication('${application.id}')">Approve</button>
                    <button class="btn-danger" onclick="rejectApplication('${application.id}')">Reject</button>
                </div>
                ` : `
                <div style="display: flex; gap: 10px;">
                    <span style="padding: 8px 16px; color: #666; font-style: italic;">
                        ${normalizedStatus === 'approved' || normalizedStatus === 'registered' 
                            ? 'Application has been approved' 
                            : 'Application has been rejected'}
                    </span>
                </div>
                `}
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    console.log('✅ Modal appended to body');
    
    // Ensure modal content is styled properly
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.maxWidth = '90%';
        modalContent.style.maxHeight = '90vh';
        modalContent.style.overflowY = 'auto';
        modalContent.style.backgroundColor = 'white';
        modalContent.style.borderRadius = '8px';
        modalContent.style.padding = '0';
        modalContent.style.margin = '20px';
    }
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            console.log('Closing modal (clicked outside)');
            modal.remove();
        }
    });
    
    // Close modal with Escape key
    const escapeHandler = function(e) {
        if (e.key === 'Escape') {
            console.log('Closing modal (Escape key)');
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
    
    console.log('✅ Modal setup complete');
}

async function approveApplication(applicationId) {
    // First check if vehicle has inspection
    try {
        const apiClient = new APIClient();
        const vehicleResponse = await apiClient.get(`/api/vehicles/id/${applicationId}`);
        
        if (!vehicleResponse.success || !vehicleResponse.vehicle) {
            throw new Error('Failed to load vehicle data');
        }
        
        const vehicle = vehicleResponse.vehicle;
        
        // Check if inspection is required but missing
        if (!vehicle.mvir_number) {
            const proceedWithoutInspection = await ConfirmationDialog.show({
                title: 'Inspection Required',
                message: 'This vehicle has not been inspected yet. Inspection is required before approval per LTO Citizen Charter. Do you want to proceed anyway? (Inspection will be auto-generated)',
                confirmText: 'Proceed with Auto-Inspection',
                cancelText: 'Cancel',
                confirmColor: '#f59e0b',
                type: 'warning'
            });
            
            if (!proceedWithoutInspection) {
                return;
            }
        }
    } catch (error) {
        console.error('Error checking inspection status:', error);
        ToastNotification.show('Failed to check inspection status. Please try again.', 'error');
        return;
    }
    
    const confirmed = await ConfirmationDialog.show({
        title: 'Approve Application',
        message: 'Are you sure you want to approve this application? This will assign OR/CR numbers, register on blockchain, and notify the user.',
        confirmText: 'Approve',
        cancelText: 'Cancel',
        confirmColor: '#27ae60',
        type: 'question'
    });
    
    if (confirmed) {
        const button = event?.target || document.querySelector(`[onclick*="approveApplication('${applicationId}')"]`);
        if (button) LoadingManager.show(button, 'Approving...');
        
        try {
                const apiClient = new APIClient();
            // FIX: Use approve-clearance endpoint instead of status update
            const response = await apiClient.post(`/api/lto/approve-clearance`, {
                vehicleId: applicationId,
                    notes: 'Application approved by admin'
                });
                
                if (response && response.success) {
                const message = `Application approved successfully! OR: ${response.orNumber || 'N/A'}, CR: ${response.crNumber || 'N/A'}`;
                if (response.mvirNumber) {
                    ToastNotification.show(`${message} MVIR: ${response.mvirNumber}`, 'success');
                } else {
                    ToastNotification.show(message, 'success');
                }
                    
                    // Close any open modals
                    const openModal = document.querySelector('.modal');
                    if (openModal) {
                        openModal.remove();
                    }
                    
                    // Refresh the table
                    await loadSubmittedApplications();
                } else {
                    throw new Error(response?.error || 'Failed to approve application');
            }
        } catch (error) {
            console.error('Error approving application:', error);
            ToastNotification.show(`Failed to approve application: ${error.message || 'Please try again.'}`, 'error');
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
                // Call API to update vehicle status
                const token = (typeof window !== 'undefined' && window.authManager) 
            ? window.authManager.getAccessToken() 
            : (localStorage.getItem('authToken') || localStorage.getItem('token'));
                if (token && typeof APIClient !== 'undefined') {
                    const apiClient = new APIClient();
                    const response = await apiClient.put(`/api/vehicles/id/${applicationId}/status`, {
                        status: 'REJECTED',
                        notes: `Application rejected: ${reason}`
                    });
                    
                    if (response && response.success) {
                        ToastNotification.show('Application rejected successfully! User will be notified.', 'success');
                        
                        // Update local storage
                        updateApplicationStatus(applicationId, 'rejected', `Application rejected: ${reason}`);
                        
                        // Add notification for user
                        addUserNotification(applicationId, 'rejected', `Your application has been rejected. Reason: ${reason}. Please review and resubmit.`);
                        
                        // Refresh the table
                        await loadSubmittedApplications();
                        modal.remove();
                        resolve();
                    } else {
                        throw new Error(response?.error || 'Failed to reject application');
                    }
                } else {
                    // Fallback to localStorage only if no API client
                    updateApplicationStatus(applicationId, 'rejected', `Application rejected: ${reason}`);
                    ToastNotification.show('Application rejected (local only). Please refresh to sync with server.', 'warning');
                    await loadSubmittedApplications();
                    modal.remove();
                    resolve();
                }
            } catch (error) {
                console.error('Error rejecting application:', error);
                ToastNotification.show('Failed to reject application: ' + (error.message || 'Please try again.'), 'error');
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

// Perform vehicle inspection
async function inspectVehicle(vehicleId) {
    try {
        // Get vehicle details first
        const apiClient = new APIClient();
        const vehicleResponse = await apiClient.get(`/api/vehicles/id/${vehicleId}`);
        
        if (!vehicleResponse.success || !vehicleResponse.vehicle) {
            throw new Error('Failed to load vehicle data');
        }
        
        const vehicle = vehicleResponse.vehicle;
        
        // Check if already inspected
        if (vehicle.mvir_number) {
            // Show inspection details modal instead
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-clipboard-check"></i> Inspection Details</h3>
                        <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 1rem;">
                            <strong>Vehicle:</strong> ${vehicle.plateNumber || vehicle.vin || 'N/A'}<br>
                            <strong>Make/Model:</strong> ${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}
                        </div>
                        <div style="background: #f0f9ff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                            <h4 style="margin-top: 0; color: #0369a1;">Inspection Information</h4>
                            <p><strong>MVIR Number:</strong> ${vehicle.mvir_number || 'N/A'}</p>
                            <p><strong>Inspection Date:</strong> ${vehicle.inspection_date ? new Date(vehicle.inspection_date).toLocaleDateString() : 'N/A'}</p>
                            <p><strong>Result:</strong> <span class="badge badge-${vehicle.inspection_result === 'PASS' ? 'success' : 'danger'}">${vehicle.inspection_result || 'N/A'}</span></p>
                            <p><strong>Roadworthiness:</strong> <span class="badge badge-${vehicle.roadworthiness_status === 'ROADWORTHY' ? 'success' : 'danger'}">${vehicle.roadworthiness_status || 'N/A'}</span></p>
                            <p><strong>Emission Compliance:</strong> <span class="badge badge-${vehicle.emission_compliance === 'COMPLIANT' ? 'success' : 'danger'}">${vehicle.emission_compliance || 'N/A'}</span></p>
                            ${vehicle.inspection_officer ? `<p><strong>Inspected By:</strong> ${vehicle.inspection_officer}</p>` : ''}
                            ${vehicle.inspection_notes ? `<p><strong>Notes:</strong> ${vehicle.inspection_notes}</p>` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            return;
        }
        
        // Create inspection modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3><i class="fas fa-clipboard-check"></i> Vehicle Inspection</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 1rem;">
                        <strong>Vehicle:</strong> ${vehicle.plateNumber || vehicle.vin || 'N/A'}<br>
                        <strong>Make/Model:</strong> ${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || ''}
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                            Inspection Result <span style="color: red;">*</span>
                        </label>
                        <select id="inspectionResult" class="form-control" required>
                            <option value="">Select result...</option>
                            <option value="PASS">PASS</option>
                            <option value="FAIL">FAIL</option>
                            <option value="PENDING">PENDING</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                            Roadworthiness Status <span style="color: red;">*</span>
                        </label>
                        <select id="roadworthinessStatus" class="form-control" required>
                            <option value="">Select status...</option>
                            <option value="ROADWORTHY">ROADWORTHY</option>
                            <option value="NOT_ROADWORTHY">NOT_ROADWORTHY</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                            Emission Compliance <span style="color: red;">*</span>
                        </label>
                        <select id="emissionCompliance" class="form-control" required>
                            <option value="">Select compliance...</option>
                            <option value="COMPLIANT">COMPLIANT</option>
                            <option value="NON_COMPLIANT">NON_COMPLIANT</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                            Inspection Officer
                        </label>
                        <input type="text" id="inspectionOfficer" class="form-control" placeholder="Leave blank to use your name">
                    </div>
                    
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
                            Inspection Notes
                        </label>
                        <textarea id="inspectionNotes" class="form-control" rows="3" placeholder="Additional notes about the inspection..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                    <button class="btn-primary" id="confirmInspect">
                        <i class="fas fa-check"></i> Complete Inspection
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Handle form submission
        modal.querySelector('#confirmInspect').onclick = async function() {
            const inspectionResult = document.getElementById('inspectionResult').value;
            const roadworthinessStatus = document.getElementById('roadworthinessStatus').value;
            const emissionCompliance = document.getElementById('emissionCompliance').value;
            const inspectionOfficer = document.getElementById('inspectionOfficer').value.trim();
            const inspectionNotes = document.getElementById('inspectionNotes').value.trim();
            
            // Validate required fields
            if (!inspectionResult || !roadworthinessStatus || !emissionCompliance) {
                ToastNotification.show('Please fill in all required fields', 'error');
                return;
            }
            
            const button = this;
            LoadingManager.show(button, 'Processing...');
            
            try {
                const response = await apiClient.post(`/api/lto/inspect`, {
                    vehicleId: vehicleId,
                    inspectionResult: inspectionResult,
                    roadworthinessStatus: roadworthinessStatus,
                    emissionCompliance: emissionCompliance,
                    inspectionOfficer: inspectionOfficer || undefined,
                    inspectionNotes: inspectionNotes || undefined
                });
                
                if (response && response.success) {
                    ToastNotification.show(
                        `Inspection completed! MVIR: ${response.inspection.mvirNumber}`, 
                        'success'
                    );
                    
                    modal.remove();
                    await loadSubmittedApplications();
                } else {
                    throw new Error(response?.error || 'Failed to complete inspection');
                }
            } catch (error) {
                console.error('Inspection error:', error);
                ToastNotification.show(`Failed to complete inspection: ${error.message}`, 'error');
            } finally {
                LoadingManager.hide(button);
            }
        };
        
    } catch (error) {
        console.error('Error opening inspection modal:', error);
        ToastNotification.show(`Error: ${error.message}`, 'error');
    }
}

function updateApplicationStatus(applicationId, newStatus, notes) {
    // Update in submitted applications (try v2 first, fallback to v1)
    let applications = JSON.parse(localStorage.getItem('submittedApplications_v2') || '[]');
    
    if (applications.length === 0) {
        applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    }
    
    let application = applications.find(app => app.id === applicationId);
    
    if (application) {
        application.status = newStatus;
        application.lastUpdated = new Date().toISOString();
        application.adminNotes = notes;
        
        // Update in localStorage (prefer v2, update both if v1 exists)
        localStorage.setItem('submittedApplications_v2', JSON.stringify(applications));
        if (localStorage.getItem('submittedApplications')) {
            localStorage.setItem('submittedApplications', JSON.stringify(applications));
        }
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
    // Try v2 first, fallback to v1
    let applications = JSON.parse(localStorage.getItem('submittedApplications_v2') || '[]');
    if (applications.length === 0) {
        applications = JSON.parse(localStorage.getItem('submittedApplications') || '[]');
    }
    
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

// LTO Workflow Functions
let workflowState = {
    emissionRequested: false,
    emissionReceived: false,
    insuranceRequested: false,
    insuranceReceived: false,
    hpgRequested: false,
    hpgReceived: false
};

function checkWorkflowState() {
    // Load workflow state from localStorage
    const savedState = localStorage.getItem('ltoWorkflowState');
    if (savedState) {
        workflowState = JSON.parse(savedState);
    }
    updateWorkflowUI();
}

function updateWorkflowUI() {
    // Update received documents visibility
    const emissionDocItem = document.getElementById('emissionDocItem');
    const insuranceDocItem = document.getElementById('insuranceDocItem');
    const hpgDocItem = document.getElementById('hpgDocItem');
    const finalizeBtn = document.getElementById('finalizeBtn');
    
    if (emissionDocItem) {
        emissionDocItem.style.display = workflowState.emissionRequested ? 'flex' : 'none';
        if (workflowState.emissionReceived) {
            document.getElementById('emissionStatus').textContent = 'Test Result Received';
            document.getElementById('emissionStatus').className = 'status-badge status-approved';
            document.getElementById('viewEmissionBtn').style.display = 'inline-block';
            document.getElementById('emissionLoadingBadge').style.display = 'none';
        } else if (workflowState.emissionRequested) {
            document.getElementById('emissionStatus').textContent = 'Awaiting Test Result';
            document.getElementById('emissionStatus').className = 'status-badge status-pending';
            document.getElementById('emissionLoadingBadge').style.display = 'inline-block';
        }
    }
    
    if (insuranceDocItem) {
        insuranceDocItem.style.display = workflowState.insuranceRequested ? 'flex' : 'none';
        if (workflowState.insuranceReceived) {
            document.getElementById('insuranceStatus').textContent = 'Insurance Verification Pending';
            document.getElementById('insuranceStatus').className = 'status-badge status-pending';
            document.getElementById('approveInsuranceBtn').style.display = 'inline-block';
            document.getElementById('rejectInsuranceBtn').style.display = 'inline-block';
        }
    }
    
    if (hpgDocItem) {
        hpgDocItem.style.display = workflowState.hpgRequested ? 'flex' : 'none';
        if (workflowState.hpgReceived) {
            document.getElementById('hpgStatus').textContent = 'Clearance Approved';
            document.getElementById('hpgStatus').className = 'status-badge status-approved';
            document.getElementById('approveHPGBtn').style.display = 'none';
        } else if (workflowState.hpgRequested) {
            document.getElementById('hpgStatus').textContent = 'HPG Clearance Pending';
            document.getElementById('hpgStatus').className = 'status-badge status-pending';
        }
    }
    
    // Enable finalize button only when all three are complete
    if (finalizeBtn) {
        const allComplete = workflowState.emissionReceived && 
                           workflowState.insuranceReceived && 
                           workflowState.hpgReceived;
        finalizeBtn.disabled = !allComplete;
        if (allComplete) {
            finalizeBtn.classList.add('enabled');
        } else {
            finalizeBtn.classList.remove('enabled');
        }
    }
}

function saveWorkflowState() {
    localStorage.setItem('ltoWorkflowState', JSON.stringify(workflowState));
    updateWorkflowUI();
}

async function requestEmissionTest() {
    const confirmed = await ConfirmationDialog.show({
        title: 'Request Emission Test Result',
        message: 'Send request to Emission for test result?',
        confirmText: 'Send Request',
        cancelText: 'Cancel',
        confirmColor: '#27ae60',
        type: 'question'
    });
    
    if (confirmed) {
        workflowState.emissionRequested = true;
        workflowState.emissionReceived = false;
        saveWorkflowState();
        
        ToastNotification.show('Request sent to Emission. Status: Awaiting Test Result', 'success');
        
        // Simulate receiving result after delay (for demo)
        // In real app, this would be triggered by Emission sending the result
    }
}

async function requestInsuranceProof() {
    const confirmed = await ConfirmationDialog.show({
        title: 'Request Proof of Insurance',
        message: 'Send request to Insurance for proof of insurance?',
        confirmText: 'Send Request',
        cancelText: 'Cancel',
        confirmColor: '#3498db',
        type: 'question'
    });
    
    if (confirmed) {
        workflowState.insuranceRequested = true;
        workflowState.insuranceReceived = false;
        saveWorkflowState();
        
        ToastNotification.show('Request sent to Insurance. Status: Insurance Verification Pending', 'success');
    }
}

async function requestHPGClearance() {
    // Show vehicle info dialog before sending
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>Request HPG MV Clearance</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <p>Review vehicle information before sending clearance request to HPG:</p>
                <div class="vehicle-preview" style="background: #f8f9fa; padding: 1rem; border-radius: 5px; margin: 1rem 0;">
                    <p><strong>Vehicle:</strong> <span id="previewVehicle">-</span></p>
                    <p><strong>Owner:</strong> <span id="previewOwner">-</span></p>
                    <p><strong>Plate Number:</strong> <span id="previewPlate">-</span></p>
                </div>
                <p style="color: #666; font-size: 0.9rem;">Status will change to "HPG Clearance Pending" after sending.</p>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn-primary" id="confirmHPGRequest">Send Request to HPG</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#confirmHPGRequest').onclick = async function() {
        workflowState.hpgRequested = true;
        workflowState.hpgReceived = false;
        saveWorkflowState();
        
        ToastNotification.show('Request sent to HPG. Status: HPG Clearance Pending', 'success');
        modal.remove();
    };
    
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

function viewEmissionResult() {
    ToastNotification.show('Opening Emission Test Result document...', 'info');
    // In real app, this would open the PDF/image viewer
    // window.open('document-viewer.html?type=emission', '_blank');
}

async function approveInsurance() {
    const confirmed = await ConfirmationDialog.show({
        title: 'Approve Insurance Papers',
        message: 'Approve the submitted insurance papers?',
        confirmText: 'Approve',
        cancelText: 'Cancel',
        confirmColor: '#27ae60',
        type: 'question'
    });
    
    if (confirmed) {
        ToastNotification.show('Insurance papers approved successfully', 'success');
        // Update status
        document.getElementById('insuranceStatus').textContent = 'Insurance Approved';
        document.getElementById('insuranceStatus').className = 'status-badge status-approved';
    }
}

async function requestInsuranceCorrection() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>Request Insurance Correction</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <p>Please specify what needs to be corrected:</p>
                <textarea id="correctionReason" style="width: 100%; min-height: 100px; padding: 0.75rem; border: 2px solid #ecf0f1; border-radius: 5px;" placeholder="Enter correction request..."></textarea>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                <button class="btn-danger" id="confirmCorrection">Send Correction Request</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#confirmCorrection').onclick = function() {
        const reason = document.getElementById('correctionReason').value.trim();
        if (!reason) {
            ToastNotification.show('Please provide a reason for correction', 'error');
            return;
        }
        
        ToastNotification.show('Correction request sent to Insurance', 'success');
        workflowState.insuranceReceived = false;
        saveWorkflowState();
        modal.remove();
    };
    
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

async function approveHPGClearance() {
    const confirmed = await ConfirmationDialog.show({
        title: 'Approve HPG MV Clearance',
        message: 'Approve the HPG MV Clearance Certificate?',
        confirmText: 'Approve',
        cancelText: 'Cancel',
        confirmColor: '#27ae60',
        type: 'question'
    });
    
    if (confirmed) {
        workflowState.hpgReceived = true;
        saveWorkflowState();
        
        ToastNotification.show('HPG MV Clearance approved. Status: Clearance Approved', 'success');
    }
}

async function finalizeRegistration() {
    if (!workflowState.emissionReceived || !workflowState.insuranceReceived || !workflowState.hpgReceived) {
        ToastNotification.show('Cannot finalize: All verifications must be complete', 'error');
        return;
    }
    
    const confirmed = await ConfirmationDialog.show({
        title: 'Finalize Registration',
        message: 'Finalize this registration and send final output to User?',
        confirmText: 'Finalize',
        cancelText: 'Cancel',
        confirmColor: '#27ae60',
        type: 'question'
    });
    
    if (confirmed) {
        ToastNotification.show('Registration finalized successfully! Final output sent to User.', 'success');
        // In real app, this would trigger sending final documents to user
    }
}

// NOTE: Manual request sending has been removed - requests are now automatically sent via clearanceService
// when vehicle registration is submitted

// Initialize workflow state on page load
document.addEventListener('DOMContentLoaded', function() {
    checkWorkflowState();
});

// Load registration applications
async function loadRegistrationApplications() {
    try {
        const tbody = document.getElementById('registration-applications-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #7f8c8d;"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
        
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get('/api/vehicles?status=SUBMITTED,PENDING_BLOCKCHAIN,PROCESSING,APPROVED,REJECTED&limit=50&page=1');
        
        console.log('[loadRegistrationApplications] API Response:', response);
        
        if (!response.success || !response.vehicles || response.vehicles.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                        <i class="fas fa-inbox"></i> No registration applications found
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = response.vehicles.map(v => {
            // Handle BOTH camelCase and snake_case field names
            const plateNumber = v.plateNumber || v.plate_number || 'N/A';
            const ownerName = v.ownerName || v.owner_name || v.ownerEmail || v.owner_email || 'N/A';
            const submittedDate =
                v.registrationDate || v.registration_date ||
                v.lastUpdated || v.last_updated ||
                v.createdAt || v.created_at;
            const formattedDate = submittedDate ? new Date(submittedDate).toLocaleDateString() : 'N/A';
            const vin = v.vin || '';
            const vehicleId = v.id || '';
            
            console.log('[loadRegistrationApplications] Vehicle row:', {
                id: v.id,
                plateNumber,
                ownerName,
                submittedDate,
                status: v.status
            });
            
            return `
                <tr>
                    <td><code style="font-size: 0.85rem;">${(v.id || '').substring(0, 8)}...</code></td>
                    <td>
                        <strong>${plateNumber}</strong><br>
                        <small>${v.make || ''} ${v.model || ''} ${v.year || ''}</small>
                    </td>
                    <td>${ownerName}</td>
                    <td>${formattedDate}</td>
                    <td>${renderOrgStatusIndicators(v)}</td>
                    <td><span class="status-badge status-${(v.status || '').toLowerCase()}">${v.status || 'N/A'}</span></td>
                    <td class="integrity-status-cell" data-vehicle-id="${vehicleId}" data-vin="${vin}">
                        <span class="integrity-badge loading">
                            <i class="fas fa-spinner fa-spin"></i> Checking...
                        </span>
                    </td>
                    <td>
                        <button class="btn-secondary btn-sm" onclick="viewApplication('${v.id}')">View</button>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Load integrity status for all rows after table is rendered
        setTimeout(() => {
            const integrityCells = document.querySelectorAll('.integrity-status-cell[data-vin]');
            integrityCells.forEach((cell, index) => {
                const vehicleId = cell.getAttribute('data-vehicle-id');
                const vin = cell.getAttribute('data-vin');
                if (vin) {
                    setTimeout(() => loadIntegrityStatus(vehicleId, vin, cell), index * 200); // Stagger requests
                } else {
                    cell.innerHTML = '<span class="integrity-badge error"><i class="fas fa-question"></i> N/A</span>';
                }
            });
        }, 500);
    } catch (error) {
        console.error('Error loading registration applications:', error);
        const tbody = document.getElementById('registration-applications-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #e74c3c;">Error loading applications</td></tr>';
        }
    }
}

// Load transfer applications
async function loadTransferApplications() {
    try {
        const tbody = document.getElementById('transfer-applications-tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #7f8c8d;"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>';
        
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get('/api/vehicles/transfer/requests?limit=10');
        
        if (!response.success || !response.requests || response.requests.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #7f8c8d;">
                        <i class="fas fa-inbox"></i> No transfer requests found
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = response.requests.map(r => `
            <tr>
                <td><code style="font-size: 0.85rem;">${(r.id || '').substring(0, 8)}...</code></td>
                <td>
                    <strong>${r.vehicle?.plate_number || 'N/A'}</strong><br>
                    <small>${r.vehicle?.make || ''} ${r.vehicle?.model || ''}</small>
                </td>
                <td>
                    ${r.seller_name || 'Seller'} → ${r.buyer_name || r.buyer_email || 'Buyer'}
                </td>
                <td>${r.created_at ? new Date(r.created_at).toLocaleDateString() : 'N/A'}</td>
                <td>${renderTransferOrgStatus(r)}</td>
                <td><span class="status-badge status-${(r.status || '').toLowerCase()}">${r.status || 'N/A'}</span></td>
                <td>
                    <a href="admin-transfer-details.html?id=${r.id}" class="btn-secondary btn-sm">View</a>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading transfer applications:', error);
        const tbody = document.getElementById('transfer-applications-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #e74c3c;">Error loading transfers</td></tr>';
        }
    }
}

// Render org status indicators for registration
function renderOrgStatusIndicators(vehicle) {
    // Get verification status from the correct location (backend provides verificationStatus object)
    const verificationStatus = vehicle.verificationStatus || {};
    const hpg = verificationStatus.hpg || vehicle.hpg_clearance_status || vehicle.hpg_status || 'NOT_STARTED';
    const insurance = verificationStatus.insurance || vehicle.insurance_status || 'NOT_STARTED';
    const emission = verificationStatus.emission || vehicle.emission_status || 'NOT_STARTED';
    
    return `
        <div class="org-status-indicators">
            <span class="org-indicator ${getOrgStatusClass(hpg)}" title="HPG: ${hpg}">H</span>
            <span class="org-indicator ${getOrgStatusClass(insurance)}" title="Insurance: ${insurance}">I</span>
            <span class="org-indicator ${getOrgStatusClass(emission)}" title="Emission: ${emission}">E</span>
        </div>
    `;
}

// Render org status for transfer
function renderTransferOrgStatus(request) {
    const hpg = request.hpg_approval_status || 'NOT_FORWARDED';
    const insurance = request.insurance_approval_status || 'NOT_FORWARDED';
    const emission = request.emission_approval_status || 'NOT_FORWARDED';
    
    return `
        <div class="org-status-indicators">
            <span class="org-indicator ${getOrgStatusClass(hpg)}" title="HPG: ${hpg}">H</span>
            <span class="org-indicator ${getOrgStatusClass(insurance)}" title="Insurance: ${insurance}">I</span>
            <span class="org-indicator ${getOrgStatusClass(emission)}" title="Emission: ${emission}">E</span>
        </div>
    `;
}

function getOrgStatusClass(status) {
    switch (status) {
        case 'APPROVED':
        case 'COMPLETED':
            return 'approved';
        case 'PENDING':
        case 'PROCESSING':
            return 'pending';
        case 'REJECTED':
            return 'rejected';
        default:
            return 'not-forwarded';
    }
}

// Filter functions
function filterRegistrations(status, btn) {
    // Update active tab
    const tabs = document.querySelectorAll('#registration-applications-table ~ .table-header-actions .filter-tab, .table-header-actions:has(#registration-applications-table) .filter-tab');
    tabs.forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    // Filter logic - reload with status filter
    if (status === 'all') {
        loadRegistrationApplications();
    } else {
        // Filter by status
        const tbody = document.getElementById('registration-applications-tbody');
        if (tbody) {
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const statusBadge = row.querySelector('.status-badge');
                if (statusBadge) {
                    const rowStatus = statusBadge.textContent.trim().toUpperCase();
                    const shouldShow = status === 'all' || rowStatus === status.toUpperCase();
                    row.style.display = shouldShow ? '' : 'none';
                }
            });
        }
    }
}

function filterTransfers(status, btn) {
    // Update active tab
    const tabs = document.querySelectorAll('#transfer-applications-table ~ .table-header-actions .filter-tab, .table-header-actions:has(#transfer-applications-table) .filter-tab');
    tabs.forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');
    
    // Filter logic - reload with status filter
    if (status === 'all') {
        loadTransferApplications();
    } else {
        // Filter by status
        const tbody = document.getElementById('transfer-applications-tbody');
        if (tbody) {
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                const statusBadge = row.querySelector('.status-badge');
                if (statusBadge) {
                    const rowStatus = statusBadge.textContent.trim().toUpperCase();
                    const shouldShow = status === 'all' || rowStatus === status.toUpperCase();
                    row.style.display = shouldShow ? '' : 'none';
                }
            });
        }
    }
}

// Make filter functions globally available (override stubs)
window.filterRegistrations = filterRegistrations;
window.filterTransfers = filterTransfers;

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
    rejectApplication,
    inspectVehicle,
    requestEmissionTest,
    requestInsuranceProof,
    requestHPGClearance,
    viewEmissionResult,
    approveInsurance,
    requestInsuranceCorrection,
    approveHPGClearance,
    finalizeRegistration,
    checkDataIntegrity,
    closeIntegrityModal
};

// Make inspectVehicle globally available
window.inspectVehicle = inspectVehicle;

// Check data integrity for a vehicle
async function checkDataIntegrity(vehicleId, vin) {
    const modal = document.getElementById('integrityModal');
    const statusDiv = document.getElementById('integrityStatus');
    const dbValuesDiv = document.getElementById('databaseValues');
    const blockchainValuesDiv = document.getElementById('blockchainValues');
    const detailsDiv = document.getElementById('comparisonDetails');
    const timestampSpan = document.getElementById('integrityTimestamp');
    
    if (!modal || !statusDiv) {
        console.error('Integrity modal elements not found');
        return;
    }
    
    // Show modal with loading state
    modal.style.display = 'flex';
    statusDiv.innerHTML = '<div class="loading-spinner"></div> Checking integrity...';
    if (dbValuesDiv) dbValuesDiv.innerHTML = '';
    if (blockchainValuesDiv) blockchainValuesDiv.innerHTML = '';
    if (detailsDiv) detailsDiv.innerHTML = '';
    
    try {
        const apiClient = window.apiClient || new APIClient();
        const response = await apiClient.get(`/api/integrity/check/${vin}`);
        
        if (!response.success) {
            throw new Error(response.error || 'Integrity check failed');
        }
        
        // Render status badge
        const statusClass = {
            'VERIFIED': 'verified',
            'TAMPERED': 'tampered',
            'MISMATCH': 'mismatch',
            'NOT_REGISTERED': 'not-registered'
        }[response.integrityStatus] || 'error';
        
        const statusIcon = {
            'VERIFIED': 'check-circle',
            'TAMPERED': 'exclamation-triangle',
            'MISMATCH': 'exclamation-circle',
            'NOT_REGISTERED': 'question-circle'
        }[response.integrityStatus] || 'times-circle';
        
        statusDiv.innerHTML = `
            <div class="integrity-badge ${statusClass}">
                <i class="fas fa-${statusIcon}"></i>
                <span>${response.integrityStatus || 'ERROR'}</span>
            </div>
            <p class="integrity-message" style="margin-top: 10px; color: #666;">
                ${response.integrityStatus === 'VERIFIED' ? 'All data matches between database and blockchain' : 
                  response.integrityStatus === 'TAMPERED' ? 'Critical data mismatch detected - possible tampering' :
                  response.integrityStatus === 'MISMATCH' ? 'Some fields do not match between database and blockchain' :
                  response.integrityStatus === 'NOT_REGISTERED' ? 'Vehicle not found on blockchain' :
                  'Error checking integrity'}
            </p>
        `;
        
        // Render database values
        if (response.database && dbValuesDiv) {
            dbValuesDiv.innerHTML = renderVehicleValues(response.database, 'database');
        }
        
        // Render blockchain values
        if (response.blockchain && blockchainValuesDiv) {
            blockchainValuesDiv.innerHTML = renderVehicleValues(response.blockchain, 'blockchain');
        }
        
        // Render field comparisons
        if (detailsDiv) {
            if (response.mismatches && response.mismatches.length > 0) {
                detailsDiv.innerHTML = renderComparisonDetails(response.mismatches, response.database, response.blockchain);
            } else {
                detailsDiv.innerHTML = '<p style="text-align: center; color: #27ae60; padding: 20px;"><i class="fas fa-check-circle"></i> All fields match perfectly!</p>';
            }
        }
        
        if (timestampSpan) {
            timestampSpan.textContent = `Checked at: ${new Date(response.timestamp || Date.now()).toLocaleString()}`;
        }
        
    } catch (error) {
        statusDiv.innerHTML = `
            <div class="integrity-badge error">
                <i class="fas fa-times-circle"></i>
                <span>ERROR</span>
            </div>
            <p class="integrity-message" style="margin-top: 10px; color: #e74c3c;">${error.message}</p>
        `;
    }
}

function renderVehicleValues(vehicle, source) {
    const fields = [
        { key: 'vin', label: 'VIN' },
        { key: 'plateNumber', label: 'Plate Number' },
        { key: 'plate_number', label: 'Plate Number' },
        { key: 'engineNumber', label: 'Engine Number' },
        { key: 'engine_number', label: 'Engine Number' },
        { key: 'chassisNumber', label: 'Chassis Number' },
        { key: 'chassis_number', label: 'Chassis Number' },
        { key: 'make', label: 'Make' },
        { key: 'model', label: 'Model' },
        { key: 'year', label: 'Year' },
        { key: 'vehicleCategory', label: 'Vehicle Category (PNS)' },
        { key: 'vehicle_category', label: 'Vehicle Category (PNS)' },
        { key: 'passengerCapacity', label: 'Passenger Capacity' },
        { key: 'passenger_capacity', label: 'Passenger Capacity' },
        { key: 'grossVehicleWeight', label: 'Gross Vehicle Weight (kg)' },
        { key: 'gross_vehicle_weight', label: 'Gross Vehicle Weight (kg)' },
        { key: 'netWeight', label: 'Net Weight (kg)' },
        { key: 'net_weight', label: 'Net Weight (kg)' },
        { key: 'classification', label: 'Classification' },
        { key: 'registration_type', label: 'Classification' }
    ];
    
    const uniqueFields = [];
    const seenLabels = new Set();
    
    fields.forEach(field => {
        if (!seenLabels.has(field.label)) {
            seenLabels.add(field.label);
            uniqueFields.push(field);
        }
    });
    
    return uniqueFields.map(field => {
        const value = vehicle[field.key] || 'N/A';
        return `
            <div class="value-row">
                <span class="value-label">${field.label}:</span>
                <span class="value-data">${value}</span>
            </div>
        `;
    }).join('');
}

function renderComparisonDetails(mismatches, dbData, blockchainData) {
    const allFields = [
        { dbKey: 'vin', blockchainKey: 'vin', label: 'VIN' },
        { dbKey: 'plate_number', blockchainKey: 'plateNumber', label: 'Plate Number' },
        { dbKey: 'engine_number', blockchainKey: 'engineNumber', label: 'Engine Number' },
        { dbKey: 'chassis_number', blockchainKey: 'chassisNumber', label: 'Chassis Number' },
        { dbKey: 'make', blockchainKey: 'make', label: 'Make' },
        { dbKey: 'model', blockchainKey: 'model', label: 'Model' },
        { dbKey: 'year', blockchainKey: 'year', label: 'Year' }
    ];
    
    return `
        <h4 style="margin-top: 20px; margin-bottom: 15px;"><i class="fas fa-list-check"></i> Field-by-Field Comparison</h4>
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Field</th>
                    <th>Database</th>
                    <th>Blockchain</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${allFields.map(field => {
                    const dbValue = dbData?.[field.dbKey] || 'N/A';
                    const blockchainValue = blockchainData?.[field.blockchainKey] || 'N/A';
                    const isMismatch = mismatches.some(m => m.fieldKey === field.dbKey || m.field === field.label);
                    const mismatch = mismatches.find(m => m.fieldKey === field.dbKey || m.field === field.label);
                    
                    return `
                        <tr class="${isMismatch ? 'mismatch' : 'match'}">
                            <td>
                                ${field.label}
                                ${mismatch && mismatch.critical ? '<span class="critical-badge">Critical</span>' : ''}
                            </td>
                            <td><code>${dbValue}</code></td>
                            <td><code>${blockchainValue}</code></td>
                            <td>
                                ${isMismatch ? 
                                    '<i class="fas fa-times-circle" style="color: #e74c3c;"></i>' : 
                                    '<i class="fas fa-check-circle" style="color: #27ae60;"></i>'
                                }
                            </td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function closeIntegrityModal() {
    const modal = document.getElementById('integrityModal');
    if (modal) {
        modal.style.display = 'none';
    }
}
