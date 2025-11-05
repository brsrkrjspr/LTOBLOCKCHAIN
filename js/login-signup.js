// Login/Signup JavaScript

// Fill demo credentials
function fillCredentials(email, password) {
    console.log('Filling credentials:', email, password);
    document.getElementById('loginEmail').value = email;
    document.getElementById('loginPassword').value = password;
    
    // Show a notification that credentials were filled
    showNotification(`Credentials filled: ${email}`, 'info');
}

// Test login function for debugging
function testLogin() {
    console.log('Test login clicked');
    document.getElementById('loginEmail').value = 'admin@lto.gov.ph';
    document.getElementById('loginPassword').value = 'admin123';
    showNotification('Test credentials filled. Click Login button.', 'info');
}

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

// Handle login form submission
function handleLogin(event) {
    event.preventDefault();
    validateLogin();
}

// Login validation
async function validateLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    // Basic validation
    if (!email || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    try {
        console.log('Attempting login with:', email);
        
        // Call backend login API
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        console.log('Login response:', result);

        if (result.success) {
            // Store user data and token
            localStorage.setItem('currentUser', JSON.stringify(result.user));
            localStorage.setItem('authToken', result.token);
            
            showNotification('Login successful! Redirecting to dashboard...', 'success');
            
            // Redirect based on user role
            setTimeout(() => {
                switch(result.user.role) {
                    case 'admin':
                        window.location.href = 'admin-dashboard.html';
                        break;
                    case 'insurance_verifier':
                        window.location.href = 'insurance-verifier-dashboard.html';
                        break;
                    case 'emission_verifier':
                        window.location.href = 'emission-verifier-dashboard.html';
                        break;
                    case 'vehicle_owner':
                    default:
                        window.location.href = 'owner-dashboard.html';
                        break;
                }
            }, 1500);
        } else {
            showNotification(result.error || 'Login failed. Please check your credentials.', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed. Please try again.', 'error');
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
