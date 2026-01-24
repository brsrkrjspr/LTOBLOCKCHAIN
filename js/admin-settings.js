// TrustChain LTO - Admin Settings Page
// Handles admin profile updates and password changes

// Global state
let currentUser = null;

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    if (!AuthUtils.isAuthenticated()) {
        window.location.href = 'login-signup.html';
        return;
    }

    // Check if user is admin or lto_admin
    const user = AuthUtils.getCurrentUser();
    if (user && !['admin', 'lto_admin'].includes(user.role)) {
        // Redirect non-admin users to their appropriate dashboard
        AuthUtils.redirectByRole();
        return;
    }

    // Initialize sidebar
    initializeSidebar();
    
    // Load user profile
    await loadUserProfile();
    
    // Setup form handlers
    setupFormHandlers();
    
    // Setup logout handler
    setupLogoutHandler();
    
    // Load document requirements if on documents tab
    if (window.location.hash === '#documents' || document.getElementById('documentsTab')?.classList.contains('active')) {
        loadDocumentRequirements();
    }
});

// Initialize sidebar
function initializeSidebar() {
    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            const sidebar = document.querySelector('.dashboard-sidebar');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
                const isCollapsed = sidebar.classList.contains('collapsed');
                localStorage.setItem('adminSidebarCollapsed', isCollapsed.toString());
            }
        });
    }

    // Update sidebar user info
    updateSidebarUserInfo();
}

// Update sidebar user info
function updateSidebarUserInfo() {
    const userInfo = AuthUtils.getCurrentUser();
    if (userInfo) {
        const avatar = document.getElementById('sidebarUserAvatar');
        const name = document.getElementById('sidebarUserName');
        const role = document.getElementById('sidebarUserRole');
        
        if (avatar) {
            const initials = getInitials(userInfo.firstName, userInfo.lastName);
            avatar.textContent = initials || 'AD';
        }
        if (name) {
            name.textContent = userInfo.firstName && userInfo.lastName 
                ? `${userInfo.firstName} ${userInfo.lastName}` 
                : 'ADMIN';
        }
        if (role) {
            role.textContent = 'System Administrator';
        }
    }
}

// Load user profile from API
async function loadUserProfile() {
    try {
        showLoading('Loading profile...');
        
        const response = await window.apiClient.get('/api/auth/profile');
        
        if (response.success && response.user) {
            currentUser = response.user;
            populateProfileForm(response.user);
            updateProfileDisplay(response.user);
        } else {
            showAlert('Failed to load profile information', 'error');
        }
    } catch (error) {
        console.error('Load profile error:', error);
        showAlert('Failed to load profile information. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Populate profile form with user data
function populateProfileForm(user) {
    document.getElementById('firstName').value = user.firstName || '';
    document.getElementById('lastName').value = user.lastName || '';
    document.getElementById('email').value = user.email || '';
    document.getElementById('phone').value = user.phone || '';
    document.getElementById('organization').value = user.organization || '';
    document.getElementById('address').value = user.address || '';
}

// Update profile display (avatar, name, etc.)
function updateProfileDisplay(user) {
    const avatar = document.getElementById('profileAvatar');
    const name = document.getElementById('profileName');
    const email = document.getElementById('profileEmail');
    const role = document.getElementById('profileRole');
    
    if (avatar) {
        const initials = getInitials(user.firstName, user.lastName);
        avatar.textContent = initials || 'AD';
    }
    if (name) {
        name.textContent = user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}` 
            : 'Admin User';
    }
    if (email) {
        email.textContent = user.email || '';
    }
    if (role) {
        role.textContent = 'System Administrator';
    }
}

// Setup form handlers
function setupFormHandlers() {
    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileSubmit);
    }
    
    const cancelProfileBtn = document.getElementById('cancelProfileBtn');
    if (cancelProfileBtn) {
        cancelProfileBtn.addEventListener('click', function() {
            if (currentUser) {
                populateProfileForm(currentUser);
            }
        });
    }
    
    // Password form
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', handlePasswordSubmit);
    }
    
    const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
    if (cancelPasswordBtn) {
        cancelPasswordBtn.addEventListener('click', function() {
            passwordForm.reset();
        });
    }
}

// Handle profile form submission
async function handleProfileSubmit(e) {
    e.preventDefault();
    
    const saveBtn = document.getElementById('saveProfileBtn');
    const originalText = saveBtn.innerHTML;
    
    try {
        // Disable button
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loading-spinner"></span> Saving...';
        
        // Get form data
        const formData = {
            firstName: document.getElementById('firstName').value.trim(),
            lastName: document.getElementById('lastName').value.trim(),
            phone: document.getElementById('phone').value.trim() || null,
            organization: document.getElementById('organization').value.trim() || null,
            address: document.getElementById('address').value.trim() || null
        };
        
        // Validate
        if (!formData.firstName || !formData.lastName) {
            showAlert('First name and last name are required', 'error');
            return;
        }
        
        // Submit update
        const response = await window.apiClient.put('/api/auth/profile', formData);
        
        if (response.success) {
            showAlert('Profile updated successfully!', 'success');
            currentUser = response.user;
            updateProfileDisplay(response.user);
            updateSidebarUserInfo();
            
            // Update AuthUtils user info
            const userInfo = AuthUtils.getCurrentUser();
            if (userInfo) {
                userInfo.firstName = response.user.firstName;
                userInfo.lastName = response.user.lastName;
                userInfo.phone = response.user.phone;
                userInfo.organization = response.user.organization;
                userInfo.address = response.user.address;
                AuthUtils.updateUser(userInfo);
            }
        } else {
            showAlert(response.error || 'Failed to update profile', 'error');
        }
    } catch (error) {
        console.error('Profile update error:', error);
        showAlert('Failed to update profile. Please try again.', 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

// Handle password form submission
async function handlePasswordSubmit(e) {
    e.preventDefault();
    
    const changeBtn = document.getElementById('changePasswordBtn');
    const originalText = changeBtn.innerHTML;
    
    try {
        // Disable button
        changeBtn.disabled = true;
        changeBtn.innerHTML = '<span class="loading-spinner"></span> Changing...';
        
        // Get form data
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        // Validate
        if (!currentPassword || !newPassword || !confirmPassword) {
            showAlert('All password fields are required', 'error');
            return;
        }
        
        if (newPassword.length < 8) {
            showAlert('New password must be at least 8 characters long', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showAlert('New password and confirmation do not match', 'error');
            return;
        }
        
        if (currentPassword === newPassword) {
            showAlert('New password must be different from current password', 'error');
            return;
        }
        
        // Submit password change
        const response = await window.apiClient.put('/api/auth/change-password', {
            currentPassword,
            newPassword
        });
        
        if (response.success) {
            showAlert('Password changed successfully!', 'success');
            document.getElementById('passwordForm').reset();
        } else {
            showAlert(response.error || 'Failed to change password', 'error');
        }
    } catch (error) {
        console.error('Password change error:', error);
        const errorMessage = error.message || 'Failed to change password. Please try again.';
        showAlert(errorMessage, 'error');
    } finally {
        changeBtn.disabled = false;
        changeBtn.innerHTML = originalText;
    }
}

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(inputId + 'Toggle');
    
    if (input && toggle) {
        if (input.type === 'password') {
            input.type = 'text';
            toggle.classList.remove('fa-eye');
            toggle.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            toggle.classList.remove('fa-eye-slash');
            toggle.classList.add('fa-eye');
        }
    }
}

// Setup logout handler
function setupLogoutHandler() {
    const logoutBtn = document.getElementById('sidebarLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                AuthUtils.logout();
                window.location.href = 'login-signup.html';
            }
        });
    }
}

// Tab switching functionality
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedTab = document.getElementById(tabName + 'Tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Add active class to clicked button
    const clickedButton = Array.from(document.querySelectorAll('.tab-button')).find(btn => 
        btn.textContent.toLowerCase().includes(tabName.toLowerCase())
    );
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
    
    // Load document requirements when switching to documents tab
    if (tabName === 'documents') {
        loadDocumentRequirements();
    }
}

// Show alert message
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    // Remove existing alerts
    alertContainer.innerHTML = '';
    
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                 type === 'error' ? 'fa-exclamation-circle' : 
                 'fa-info-circle';
    
    alert.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    alertContainer.appendChild(alert);
    
    // Auto-hide after 5 seconds for success/info
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            alert.remove();
        }, 5000);
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show loading state
function showLoading(message) {
    // You can implement a loading overlay if needed
    console.log('Loading:', message);
}

// Hide loading state
function hideLoading() {
    // You can implement a loading overlay if needed
}

// Get user initials for avatar
function getInitials(firstName, lastName) {
    const first = (firstName || '').charAt(0).toUpperCase();
    const last = (lastName || '').charAt(0).toUpperCase();
    return (first + last) || 'AD';
}

// Format role for display
function formatRole(role) {
    if (!role) return 'User';
    return role.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
}

// Expose functions globally for onclick handlers
window.togglePassword = togglePassword;
window.switchTab = switchTab;

