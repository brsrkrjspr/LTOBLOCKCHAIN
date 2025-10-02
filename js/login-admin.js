// Admin Login JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminLogin();
});

function initializeAdminLogin() {
    // Add form validation and enhanced login functionality
    const loginForm = document.querySelector('.auth-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    if (loginForm && usernameInput && passwordInput) {
        // Add real-time validation
        usernameInput.addEventListener('input', validateUsername);
        passwordInput.addEventListener('input', validatePassword);
        
        // Add form submission handler
        loginForm.addEventListener('submit', handleAdminLogin);
        
        // Add enter key support
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                handleAdminLogin(e);
            }
        });
    }
}

function validateUsername() {
    const username = document.getElementById('username').value;
    const usernameField = document.getElementById('username');
    
    // Remove existing validation classes
    usernameField.classList.remove('valid', 'invalid');
    
    if (username.length === 0) {
        return false;
    }
    
    // Check if it's a valid email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(username)) {
        usernameField.classList.add('valid');
        return true;
    } else {
        usernameField.classList.add('invalid');
        return false;
    }
}

function validatePassword() {
    const password = document.getElementById('password').value;
    const passwordField = document.getElementById('password');
    
    // Remove existing validation classes
    passwordField.classList.remove('valid', 'invalid');
    
    if (password.length === 0) {
        return false;
    }
    
    // Check password strength
    if (password.length >= 6) {
        passwordField.classList.add('valid');
        return true;
    } else {
        passwordField.classList.add('invalid');
        return false;
    }
}

function handleAdminLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.querySelector('input[name="remember"]').checked;
    
    // Validate inputs
    if (!validateUsername() || !validatePassword()) {
        showError('Please enter valid credentials');
        return false;
    }
    
    // Show loading state
    showLoadingState();
    
    // Simulate API call delay
    setTimeout(() => {
        if (validateAdminCredentials(username, password)) {
            // Store login state if remember me is checked
            if (rememberMe) {
                localStorage.setItem('adminRemembered', 'true');
                localStorage.setItem('adminUsername', username);
            }
            
            // Show success message
            showSuccess('Login successful! Redirecting...');
            
            // Redirect to admin dashboard
            setTimeout(() => {
                window.location.href = 'admin-dashboard.html';
            }, 1500);
        } else {
            hideLoadingState();
            showError('Invalid credentials. Please check your username and password.');
        }
    }, 1000);
}

function validateAdminCredentials(username, password) {
    // Check against predefined admin credentials
    const validCredentials = [
        { username: 'admin@lto.gov', password: 'admin123' },
        { username: 'superadmin@lto.gov', password: 'superadmin123' },
        { username: 'system@lto.gov', password: 'system123' }
    ];
    
    return validCredentials.some(cred => 
        cred.username === username && cred.password === password
    );
}

function showLoadingState() {
    const submitButton = document.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="loading-spinner"></span> Logging in...';
    submitButton.classList.add('loading');
}

function hideLoadingState() {
    const submitButton = document.querySelector('button[type="submit"]');
    
    submitButton.disabled = false;
    submitButton.textContent = 'Login as Admin';
    submitButton.classList.remove('loading');
}

function showError(message) {
    // Remove existing error messages
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Create error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <span class="error-icon">⚠️</span>
            <span class="error-text">${message}</span>
        </div>
    `;
    
    // Insert after form
    const form = document.querySelector('.auth-form');
    form.parentNode.insertBefore(errorDiv, form.nextSibling);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

function showSuccess(message) {
    // Remove existing messages
    const existingMessage = document.querySelector('.error-message, .success-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.innerHTML = `
        <div class="success-content">
            <span class="success-icon">✅</span>
            <span class="success-text">${message}</span>
        </div>
    `;
    
    // Insert after form
    const form = document.querySelector('.auth-form');
    form.parentNode.insertBefore(successDiv, form.nextSibling);
}

// Check for remembered login
function checkRememberedLogin() {
    if (localStorage.getItem('adminRemembered') === 'true') {
        const rememberedUsername = localStorage.getItem('adminUsername');
        if (rememberedUsername) {
            document.getElementById('username').value = rememberedUsername;
            document.querySelector('input[name="remember"]').checked = true;
        }
    }
}

// Initialize remembered login on page load
document.addEventListener('DOMContentLoaded', function() {
    checkRememberedLogin();
});

// Export functions for potential external use
window.AdminLogin = {
    validateAdminCredentials,
    showError,
    showSuccess,
    handleAdminLogin
};
