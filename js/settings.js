// Settings JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeSettings();
});

function initializeSettings() {
    // Initialize settings functionality
    initializeTabSwitching();
    initializeFormHandling();
    initializeSecurityActions();
    loadUserPreferences();
}

function initializeTabSwitching() {
    // Enhanced tab switching with smooth transitions
    document.querySelectorAll('.settings-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all tabs and sections
            document.querySelectorAll('.settings-link').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
            
            // Add active class to clicked tab
            link.classList.add('active');
            
            // Show corresponding section
            const targetId = link.getAttribute('href').substring(1) + '-section';
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
                
                // Smooth scroll to section
                targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

function initializeFormHandling() {
    // Profile form handling
    const profileForm = document.querySelector('#profile-section form');
    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileUpdate);
        addFormValidation(profileForm);
    }
    
    // Notifications form handling
    const notificationsForm = document.querySelector('#notifications-section form');
    if (notificationsForm) {
        notificationsForm.addEventListener('submit', handleNotificationPreferences);
    }
}

function addFormValidation(form) {
    const inputs = form.querySelectorAll('input[required]');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            if (this.classList.contains('invalid')) {
                validateField(this);
            }
        });
    });
}

function validateField(field) {
    const value = field.value.trim();
    
    // Remove existing validation classes
    field.classList.remove('valid', 'invalid');
    
    if (field.hasAttribute('required') && value.length === 0) {
        field.classList.add('invalid');
        showFieldError(field, 'This field is required');
        return false;
    }
    
    // Email validation
    if (field.type === 'email' && value.length > 0) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            field.classList.add('invalid');
            showFieldError(field, 'Please enter a valid email address');
            return false;
        }
    }
    
    // Phone validation
    if (field.type === 'tel' && value.length > 0) {
        if (!/^[\+]?[0-9\s\-\(\)]{10,}$/.test(value)) {
            field.classList.add('invalid');
            showFieldError(field, 'Please enter a valid phone number');
            return false;
        }
    }
    
    // Field is valid
    if (value.length > 0) {
        field.classList.add('valid');
    }
    hideFieldError(field);
    return true;
}

function showFieldError(field, message) {
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.textContent = message;
    } else {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        field.parentNode.appendChild(errorDiv);
    }
}

function hideFieldError(field) {
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

function handleProfileUpdate(e) {
    e.preventDefault();
    
    // Validate form
    const form = e.target;
    const inputs = form.querySelectorAll('input[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!validateField(input)) {
            isValid = false;
        }
    });
    
    if (!isValid) {
        showNotification('Please fix the errors before saving', 'error');
        return;
    }
    
    // Show loading state
    showLoadingState(form.querySelector('button[type="submit"]'));
    
    // Simulate API call
    setTimeout(() => {
        hideLoadingState(form.querySelector('button[type="submit"]'));
        
        // Collect form data
        const formData = new FormData(form);
        const profileData = {
            firstName: formData.get('firstName') || document.getElementById('firstName').value,
            lastName: formData.get('lastName') || document.getElementById('lastName').value,
            email: formData.get('email') || document.getElementById('email').value,
            phone: formData.get('phone') || document.getElementById('phone').value
        };
        
        // Save to localStorage (in real app, this would be sent to server)
        localStorage.setItem('userProfile', JSON.stringify(profileData));
        
        showNotification('Profile updated successfully!', 'success');
    }, 1500);
}

function handleNotificationPreferences(e) {
    e.preventDefault();
    
    // Show loading state
    showLoadingState(e.target.querySelector('button[type="submit"]'));
    
    // Collect notification preferences
    const checkboxes = e.target.querySelectorAll('input[type="checkbox"]');
    const preferences = {};
    
    checkboxes.forEach(checkbox => {
        const label = checkbox.closest('label').textContent.trim();
        preferences[label] = checkbox.checked;
    });
    
    // Save preferences
    localStorage.setItem('notificationPreferences', JSON.stringify(preferences));
    
    setTimeout(() => {
        hideLoadingState(e.target.querySelector('button[type="submit"]'));
        showNotification('Notification preferences saved!', 'success');
    }, 1000);
}

function initializeSecurityActions() {
    // Change password button
    const changePasswordBtn = document.querySelector('#security-section .btn-secondary:nth-child(1)');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', handleChangePassword);
    }
    
    // Two-factor authentication button
    const twoFactorBtn = document.querySelector('#security-section .btn-secondary:nth-child(2)');
    if (twoFactorBtn) {
        twoFactorBtn.addEventListener('click', handleTwoFactorAuth);
    }
    
    // Login history button
    const loginHistoryBtn = document.querySelector('#security-section .btn-secondary:nth-child(3)');
    if (loginHistoryBtn) {
        loginHistoryBtn.addEventListener('click', handleLoginHistory);
    }
}

function handleChangePassword() {
    showNotification('Change password feature coming soon', 'info');
    
    // In a real app, this would open a modal or navigate to password change page
    // For now, just show a placeholder
}

function handleTwoFactorAuth() {
    showNotification('Two-factor authentication setup coming soon', 'info');
    
    // In a real app, this would open 2FA setup modal
}

function handleLoginHistory() {
    showNotification('Opening login history...', 'info');
    
    // In a real app, this would show login history modal or navigate to history page
    setTimeout(() => {
        showLoginHistoryModal();
    }, 1000);
}

function showLoginHistoryModal() {
    // Create modal for login history
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Login History</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="login-history">
                    <div class="history-item">
                        <div class="history-info">
                            <strong>Current Session</strong>
                            <p>IP: 192.168.1.100 | Location: Manila, Philippines</p>
                        </div>
                        <div class="history-time">Now</div>
                    </div>
                    <div class="history-item">
                        <div class="history-info">
                            <strong>Previous Session</strong>
                            <p>IP: 192.168.1.100 | Location: Manila, Philippines</p>
                        </div>
                        <div class="history-time">2 hours ago</div>
                    </div>
                    <div class="history-item">
                        <div class="history-info">
                            <strong>Previous Session</strong>
                            <p>IP: 10.0.0.50 | Location: Quezon City, Philippines</p>
                        </div>
                        <div class="history-time">Yesterday</div>
                    </div>
                </div>
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

function loadUserPreferences() {
    // Load saved profile data
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
        const profileData = JSON.parse(savedProfile);
        document.getElementById('firstName').value = profileData.firstName || 'John';
        document.getElementById('lastName').value = profileData.lastName || 'Owner';
        document.getElementById('email').value = profileData.email || 'john@example.com';
        document.getElementById('phone').value = profileData.phone || '+63 123 456 7890';
    }
    
    // Load saved notification preferences
    const savedPreferences = localStorage.getItem('notificationPreferences');
    if (savedPreferences) {
        const preferences = JSON.parse(savedPreferences);
        const checkboxes = document.querySelectorAll('#notifications-section input[type="checkbox"]');
        
        checkboxes.forEach(checkbox => {
            const label = checkbox.closest('label').textContent.trim();
            if (preferences.hasOwnProperty(label)) {
                checkbox.checked = preferences[label];
            }
        });
    }
}

function showLoadingState(button) {
    if (button) {
        const originalText = button.textContent;
        button.disabled = true;
        button.innerHTML = '<span class="loading-spinner"></span> Saving...';
        button.classList.add('loading');
    }
}

function hideLoadingState(button) {
    if (button) {
        button.disabled = false;
        button.textContent = button.textContent.includes('Profile') ? 'Save Changes' : 'Save Preferences';
        button.classList.remove('loading');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 4000);
}

// Export functions for potential external use
window.Settings = {
    handleProfileUpdate,
    handleNotificationPreferences,
    handleChangePassword,
    handleTwoFactorAuth,
    handleLoginHistory,
    showNotification
};
