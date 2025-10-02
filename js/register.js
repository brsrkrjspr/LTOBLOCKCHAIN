// Registration JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeRegistration();
});

function initializeRegistration() {
    // Initialize form validation and registration functionality
    const registrationForm = document.querySelector('.auth-form');
    
    if (registrationForm) {
        // Add real-time validation for all fields
        addFieldValidation();
        
        // Add form submission handler
        registrationForm.addEventListener('submit', handleRegistration);
        
        // Add password strength indicator
        initializePasswordStrength();
        
        // Add terms and conditions handler
        initializeTermsValidation();
    }
}

function addFieldValidation() {
    const fields = {
        firstName: { required: true, minLength: 2, pattern: /^[a-zA-Z\s]+$/ },
        lastName: { required: true, minLength: 2, pattern: /^[a-zA-Z\s]+$/ },
        email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
        phone: { required: true, pattern: /^[\+]?[0-9\s\-\(\)]{10,}$/ },
        password: { required: true, minLength: 8 },
        confirmPassword: { required: true, matchField: 'password' }
    };
    
    Object.keys(fields).forEach(fieldName => {
        const field = document.getElementById(fieldName);
        if (field) {
            field.addEventListener('input', () => validateField(fieldName, fields[fieldName]));
            field.addEventListener('blur', () => validateField(fieldName, fields[fieldName]));
        }
    });
}

function validateField(fieldName, rules) {
    const field = document.getElementById(fieldName);
    const value = field.value.trim();
    
    // Remove existing validation classes
    field.classList.remove('valid', 'invalid');
    
    // Check if field is required and empty
    if (rules.required && value.length === 0) {
        field.classList.add('invalid');
        showFieldError(fieldName, 'This field is required');
        return false;
    }
    
    // Check minimum length
    if (rules.minLength && value.length < rules.minLength) {
        field.classList.add('invalid');
        showFieldError(fieldName, `Minimum ${rules.minLength} characters required`);
        return false;
    }
    
    // Check pattern
    if (rules.pattern && !rules.pattern.test(value)) {
        field.classList.add('invalid');
        showFieldError(fieldName, 'Invalid format');
        return false;
    }
    
    // Check password match
    if (rules.matchField) {
        const matchField = document.getElementById(rules.matchField);
        if (matchField && value !== matchField.value) {
            field.classList.add('invalid');
            showFieldError(fieldName, 'Passwords do not match');
            return false;
        }
    }
    
    // Field is valid
    field.classList.add('valid');
    hideFieldError(fieldName);
    return true;
}

function showFieldError(fieldName, message) {
    const field = document.getElementById(fieldName);
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

function hideFieldError(fieldName) {
    const field = document.getElementById(fieldName);
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}

function initializePasswordStrength() {
    const passwordField = document.getElementById('password');
    if (!passwordField) return;
    
    // Create password strength indicator
    const strengthIndicator = document.createElement('div');
    strengthIndicator.className = 'password-strength';
    strengthIndicator.innerHTML = `
        <div class="strength-bar">
            <div class="strength-fill"></div>
        </div>
        <div class="strength-text">Password strength</div>
    `;
    
    passwordField.parentNode.appendChild(strengthIndicator);
    
    passwordField.addEventListener('input', function() {
        const strength = calculatePasswordStrength(this.value);
        updatePasswordStrength(strength);
    });
}

function calculatePasswordStrength(password) {
    let score = 0;
    const checks = {
        length: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        numbers: /\d/.test(password),
        symbols: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    Object.values(checks).forEach(check => {
        if (check) score++;
    });
    
    return {
        score: score,
        percentage: (score / 5) * 100,
        checks: checks
    };
}

function updatePasswordStrength(strength) {
    const strengthFill = document.querySelector('.strength-fill');
    const strengthText = document.querySelector('.strength-text');
    
    if (!strengthFill || !strengthText) return;
    
    strengthFill.style.width = strength.percentage + '%';
    
    // Update color and text based on strength
    strengthFill.className = 'strength-fill';
    if (strength.score <= 2) {
        strengthFill.classList.add('weak');
        strengthText.textContent = 'Weak password';
    } else if (strength.score <= 3) {
        strengthFill.classList.add('medium');
        strengthText.textContent = 'Medium strength';
    } else {
        strengthFill.classList.add('strong');
        strengthText.textContent = 'Strong password';
    }
}

function initializeTermsValidation() {
    const termsCheckbox = document.querySelector('input[name="terms"]');
    if (termsCheckbox) {
        termsCheckbox.addEventListener('change', function() {
            const submitButton = document.querySelector('button[type="submit"]');
            if (this.checked) {
                submitButton.disabled = false;
                submitButton.classList.remove('disabled');
            } else {
                submitButton.disabled = true;
                submitButton.classList.add('disabled');
            }
        });
    }
}

function handleRegistration(e) {
    e.preventDefault();
    
    // Validate all fields
    const fields = ['firstName', 'lastName', 'email', 'phone', 'password', 'confirmPassword'];
    let isValid = true;
    
    fields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        if (field) {
            const fieldRules = {
                firstName: { required: true, minLength: 2, pattern: /^[a-zA-Z\s]+$/ },
                lastName: { required: true, minLength: 2, pattern: /^[a-zA-Z\s]+$/ },
                email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
                phone: { required: true, pattern: /^[\+]?[0-9\s\-\(\)]{10,}$/ },
                password: { required: true, minLength: 8 },
                confirmPassword: { required: true, matchField: 'password' }
            };
            
            if (!validateField(fieldName, fieldRules[fieldName])) {
                isValid = false;
            }
        }
    });
    
    // Check terms acceptance
    const termsAccepted = document.querySelector('input[name="terms"]').checked;
    if (!termsAccepted) {
        showError('Please accept the Terms of Service and Privacy Policy');
        isValid = false;
    }
    
    if (!isValid) {
        showError('Please fix the errors above before submitting');
        return false;
    }
    
    // Show loading state
    showLoadingState();
    
    // Simulate API call
    setTimeout(() => {
        const registrationData = collectRegistrationData();
        processRegistration(registrationData);
    }, 2000);
}

function collectRegistrationData() {
    return {
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        password: document.getElementById('password').value,
        notifications: document.querySelector('input[name="notifications"]').checked,
        termsAccepted: document.querySelector('input[name="terms"]').checked,
        timestamp: new Date().toISOString()
    };
}

function processRegistration(data) {
    // Simulate registration processing
    hideLoadingState();
    
    // Check if email already exists (simulation)
    const existingEmails = ['admin@lto.gov', 'owner@example.com', 'test@test.com'];
    if (existingEmails.includes(data.email)) {
        showError('An account with this email already exists. Please use a different email or try logging in.');
        return;
    }
    
    // Success
    showSuccess('Account created successfully! Redirecting to login...');
    
    // Store registration data (in real app, this would be sent to server)
    localStorage.setItem('lastRegistration', JSON.stringify(data));
    
    // Redirect to login after delay
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 2000);
}

function showLoadingState() {
    const submitButton = document.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="loading-spinner"></span> Creating Account...';
    submitButton.classList.add('loading');
}

function hideLoadingState() {
    const submitButton = document.querySelector('button[type="submit"]');
    
    submitButton.disabled = false;
    submitButton.textContent = 'Create Account';
    submitButton.classList.remove('loading');
}

function showError(message) {
    // Remove existing messages
    const existingMessage = document.querySelector('.error-message, .success-message');
    if (existingMessage) {
        existingMessage.remove();
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
    
    // Auto remove after 8 seconds
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 8000);
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

// Export functions for potential external use
window.Registration = {
    validateField,
    calculatePasswordStrength,
    handleRegistration,
    showError,
    showSuccess
};
