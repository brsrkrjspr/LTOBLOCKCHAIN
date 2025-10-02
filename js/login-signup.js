// Login/Signup JavaScript

// Toggle between login and signup forms
function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.tab-btn:first-child').classList.add('active');
    
    // Update footer text
    document.getElementById('authFooterText').innerHTML = 'Don\'t have an account? <a href="#" onclick="showSignup()">Sign up here</a>';
}

function showSignup() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.tab-btn:last-child').classList.add('active');
    
    // Update footer text
    document.getElementById('authFooterText').innerHTML = 'Already have an account? <a href="#" onclick="showLogin()">Login here</a>';
}

// Login validation
function validateLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    // Basic validation
    if (!email || !password) {
        showNotification('Please fill in all fields', 'error');
        return false;
    }

    // Get registered users from localStorage
    const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
    
    // Check if user exists in registered users
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
        // Store current user session
        localStorage.setItem('currentUser', JSON.stringify(user));
        showNotification('Login successful! Redirecting to dashboard...', 'success');
        setTimeout(() => {
            window.location.href = 'owner-dashboard.html';
        }, 1500);
        return false;
    } else if (email === 'owner@example.com' && password === 'owner123') {
        // Demo credentials fallback
        const demoUser = {
            id: 'DEMO001',
            firstName: 'Demo',
            lastName: 'User',
            email: 'owner@example.com',
            phone: '+63 912 345 6789',
            role: 'user'
        };
        localStorage.setItem('currentUser', JSON.stringify(demoUser));
        showNotification('Login successful! Redirecting to dashboard...', 'success');
        setTimeout(() => {
            window.location.href = 'owner-dashboard.html';
        }, 1500);
        return false;
    } else {
        showNotification('Invalid credentials. Please check your email and password.', 'error');
        return false;
    }
}

// Signup validation
function validateSignup() {
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const terms = document.querySelector('input[name="terms"]').checked;

    // Basic validation
    if (!firstName || !lastName || !email || !phone || !password || !confirmPassword) {
        showNotification('Please fill in all fields', 'error');
        return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Please enter a valid email address', 'error');
        return false;
    }

    // Phone validation (basic)
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(phone)) {
        showNotification('Please enter a valid phone number', 'error');
        return false;
    }

    // Password validation
    if (password.length < 8) {
        showNotification('Password must be at least 8 characters long', 'error');
        return false;
    }

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return false;
    }

    // Terms agreement
    if (!terms) {
        showNotification('Please agree to the Terms of Service and Privacy Policy', 'error');
        return false;
    }

    // Store user data in localStorage
    const userData = {
        id: 'USR' + Date.now(),
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        password: password, // In real app, this should be hashed
        createdAt: new Date().toISOString(),
        role: 'user'
    };

    // Get existing users or create new array
    let users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
    
    // Check if email already exists
    if (users.find(user => user.email === email)) {
        showNotification('An account with this email already exists', 'error');
        return false;
    }

    // Add new user
    users.push(userData);
    localStorage.setItem('registeredUsers', JSON.stringify(users));

    showNotification('Account created successfully! You can now login.', 'success');
    
    // Switch to login form after successful signup
    setTimeout(() => {
        showLogin();
        // Pre-fill email
        document.getElementById('loginEmail').value = email;
    }, 2000);

    return false;
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.auth-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `auth-notification auth-notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    // Insert notification at the top of the auth card
    const authCard = document.querySelector('.auth-card');
    authCard.insertBefore(notification, authCard.firstChild);

    // Auto-remove notification after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Form field validation helpers
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    // At least 8 characters, contains letters and numbers
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
    return passwordRegex.test(password);
}

function validatePhone(phone) {
    // Basic phone validation
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
}

// Real-time form validation
document.addEventListener('DOMContentLoaded', function() {
    // Email validation on blur
    const emailInputs = document.querySelectorAll('input[type="email"]');
    emailInputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value && !validateEmail(this.value)) {
                this.classList.add('invalid');
                showFieldError(this, 'Please enter a valid email address');
            } else {
                this.classList.remove('invalid');
                hideFieldError(this);
            }
        });
    });

    // Password validation on blur
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    passwordInputs.forEach(input => {
        input.addEventListener('blur', function() {
            if (this.value && !validatePassword(this.value)) {
                this.classList.add('invalid');
                showFieldError(this, 'Password must be at least 8 characters with letters and numbers');
            } else {
                this.classList.remove('invalid');
                hideFieldError(this);
            }
        });
    });

    // Phone validation on blur
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('blur', function() {
            if (this.value && !validatePhone(this.value)) {
                this.classList.add('invalid');
                showFieldError(this, 'Please enter a valid phone number');
            } else {
                this.classList.remove('invalid');
                hideFieldError(this);
            }
        });
    }

    // Confirm password validation
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const signupPasswordInput = document.getElementById('signupPassword');
    
    if (confirmPasswordInput && signupPasswordInput) {
        confirmPasswordInput.addEventListener('blur', function() {
            if (this.value && this.value !== signupPasswordInput.value) {
                this.classList.add('invalid');
                showFieldError(this, 'Passwords do not match');
            } else {
                this.classList.remove('invalid');
                hideFieldError(this);
            }
        });
    }
});

// Field error helpers
function showFieldError(field, message) {
    hideFieldError(field); // Remove existing error
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    
    field.parentElement.appendChild(errorDiv);
}

function hideFieldError(field) {
    const existingError = field.parentElement.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
}
