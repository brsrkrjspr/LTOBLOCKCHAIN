// LTO Officer Dashboard JavaScript
document.addEventListener('DOMContentLoaded', async function() {
    // STRICT: Require authentication - officers must be authenticated
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isProduction = !isLocalhost;

    // Wait for AuthManager to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (typeof window !== 'undefined' && window.authManager) {
        try {
            await window.authManager.init();
        } catch (error) {
            console.error('AuthManager initialization error:', error);
        }
    }
    
    // Check authentication
    if (typeof AuthUtils !== 'undefined') {
        const isAuthDisabled = typeof window !== 'undefined' && window.DISABLE_AUTH === true;
        
        if (isProduction) {
            let token = localStorage.getItem('authToken') || localStorage.getItem('token');
            if (!token && typeof window !== 'undefined' && window.authManager) {
                token = window.authManager.getAccessToken();
            }
            
            if (!token || token === 'dev-token-bypass' || token.startsWith('demo-token-')) {
                console.warn('❌ No valid authentication token - redirecting to login');
                window.location.href = 'login-signup.html?redirect=' + encodeURIComponent(window.location.pathname);
                return;
            }
            
            // Verify token and role
            try {
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(atob(parts[1]));
                    
                    if (payload.exp && payload.exp * 1000 < Date.now()) {
                        console.warn('❌ Token expired - redirecting to login');
                        localStorage.clear();
                        window.location.href = 'login-signup.html?expired=true';
                        return;
                    }
                    
                    // STRICT: Only lto_officer role can access officer dashboard
                    if (payload.role !== 'lto_officer') {
                        console.warn('❌ Access denied: LTO Officer role required');
                        localStorage.clear();
                        window.location.href = 'login-signup.html?message=Officer access required';
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
            if (!AuthUtils.requireAuth()) {
                return;
            }
            
            // Verify officer role
            if (!AuthUtils.hasRole('lto_officer')) {
                console.warn('❌ Access denied: LTO Officer role required');
                showNotification('Access denied. Officer role required. Redirecting to login...', 'error');
                setTimeout(() => {
                    window.location.href = 'login-signup.html?message=Officer access required';
                }, 2000);
                return;
            }
        }
    }
    
    // Initialize dashboard
    await initializeDashboard();
});

async function initializeDashboard() {
    try {
        // Load user info
        await loadUserInfo();
        
        // Load statistics
        await loadStatistics();
        
        // Setup sidebar toggle
        setupSidebarToggle();
        
        // Setup logout
        setupLogout();
        
        // Setup navigation badges
        await updateNavigationBadges();
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        showNotification('Failed to initialize dashboard', 'error');
    }
}

async function loadUserInfo() {
    try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) return;
        
        const parts = token.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            
            // Update welcome message
            const welcomeName = payload.firstName || payload.first_name || 'Officer';
            document.getElementById('welcomeOfficerName').textContent = welcomeName;
            
            // Update sidebar user info
            const sidebarName = `${payload.firstName || ''} ${payload.lastName || ''}`.trim() || payload.email || 'Officer';
            document.getElementById('sidebarUserName').textContent = sidebarName;
            document.getElementById('sidebarUserRole').textContent = 'LTO Officer';
            
            // Update avatar initials
            const initials = (payload.firstName?.[0] || '') + (payload.lastName?.[0] || '') || 'OF';
            document.getElementById('sidebarUserAvatar').textContent = initials.toUpperCase();
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
}

async function loadStatistics() {
    try {
        // Load pending transfers
        const transferResponse = await fetch('/api/transfer/requests?status=PENDING,UNDER_REVIEW', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
            }
        });
        
        if (transferResponse.ok) {
            const transferData = await transferResponse.json();
            const pendingCount = transferData.transferRequests?.filter(tr => 
                ['PENDING', 'UNDER_REVIEW', 'AWAITING_BUYER_DOCS'].includes(tr.status)
            ).length || 0;
            document.getElementById('pendingTransfers').textContent = pendingCount;
            
            // Update badge
            const badge = document.getElementById('transferBadge');
            if (pendingCount > 0) {
                badge.textContent = pendingCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }
        
        // Load pending inspections (vehicles without MVIR)
        const vehicleResponse = await fetch('/api/vehicles?status=SUBMITTED,PROCESSING', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
            }
        });
        
        if (vehicleResponse.ok) {
            const vehicleData = await vehicleResponse.json();
            const pendingInspections = vehicleData.vehicles?.filter(v => !v.mvir_number).length || 0;
            document.getElementById('pendingInspections').textContent = pendingInspections;
        }
        
        // Load completed today (approximate - count recent approvals)
        const today = new Date().toISOString().split('T')[0];
        const completedResponse = await fetch(`/api/transfer/requests?status=COMPLETED`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}`
            }
        });
        
        if (completedResponse.ok) {
            const completedData = await completedResponse.json();
            const completedToday = completedData.transferRequests?.filter(tr => {
                if (!tr.updated_at) return false;
                const updatedDate = new Date(tr.updated_at).toISOString().split('T')[0];
                return updatedDate === today;
            }).length || 0;
            document.getElementById('completedToday').textContent = completedToday;
        }
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
}

function setupSidebarToggle() {
    const toggleIcon = document.getElementById('sidebarToggleIcon');
    const sidebar = document.querySelector('.dashboard-sidebar');
    
    if (toggleIcon && sidebar) {
        toggleIcon.addEventListener('click', function() {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('officerSidebarCollapsed', sidebar.classList.contains('collapsed'));
        });
    }
}

function setupLogout() {
    const logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                localStorage.clear();
                window.location.href = 'login-signup.html';
            }
        });
    }
}

async function updateNavigationBadges() {
    // Badge updates are handled in loadStatistics()
    // This function can be extended for other badges if needed
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
    if (typeof window.showToastNotification === 'function') {
        window.showToastNotification(message, type);
    } else {
        alert(message);
    }
}
