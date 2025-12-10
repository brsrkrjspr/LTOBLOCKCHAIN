// Login/Signup JavaScript
// All functions are defined as window properties immediately to ensure global accessibility

(function() {
    'use strict';

    // ============================================
    // GLOBAL FUNCTION DEFINITIONS (Window Properties)
    // ============================================

    // Toggle between login and signup forms
    window.showLogin = function() {
        try {
            const loginForm = document.getElementById('loginForm');
            const signupForm = document.getElementById('signupForm');
            if (loginForm) loginForm.style.display = 'block';
            if (signupForm) signupForm.style.display = 'none';
            
            // Update tab buttons
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            const loginTab = document.querySelector('.tab-btn:first-child');
            if (loginTab) loginTab.classList.add('active');
            
            // Update footer text
            const footer = document.getElementById('authFooterText');
            if (footer) {
                footer.innerHTML = 'Don\'t have an account? <a href="#" onclick="showSignup(); return false;">Sign up here</a>';
            }
        } catch (error) {
            console.error('Error in showLogin:', error);
        }
    };

    window.showSignup = function() {
        try {
            const loginForm = document.getElementById('loginForm');
            const signupForm = document.getElementById('signupForm');
            if (loginForm) loginForm.style.display = 'none';
            if (signupForm) signupForm.style.display = 'block';
            
            // Update tab buttons
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            const signupTab = document.querySelector('.tab-btn:last-child');
            if (signupTab) signupTab.classList.add('active');
            
            // Update footer text
            const footer = document.getElementById('authFooterText');
            if (footer) {
                footer.innerHTML = 'Already have an account? <a href="#" onclick="showLogin(); return false;">Login here</a>';
            }
        } catch (error) {
            console.error('Error in showSignup:', error);
        }
    };

    // Fill demo credentials
    window.fillCredentials = function(email, password, role = '') {
        try {
            console.log('Filling credentials:', email, password, role);
            const emailInput = document.getElementById('loginEmail');
            const passwordInput = document.getElementById('loginPassword');
            if (emailInput) emailInput.value = email || '';
            if (passwordInput) passwordInput.value = password || '';
            
            // Show a notification that credentials were filled
            if (typeof showNotification === 'function') {
                showNotification(`Credentials filled: ${email}`, 'info');
            }
        } catch (error) {
            console.error('Error in fillCredentials:', error);
        }
    };

    // Handle login form submission
    window.handleLogin = function(event) {
        try {
            if (event) {
                event.preventDefault();
            }
            validateLogin();
        } catch (error) {
            console.error('Error in handleLogin:', error);
        }
    };

    // ============================================
    // NOTIFICATION SYSTEM (Must be defined early)
    // ============================================

    function showNotification(message, type = 'info') {
        try {
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
            if (authCard) {
                authCard.insertBefore(notification, authCard.firstChild);
            } else {
                // Fallback: append to body
                document.body.insertBefore(notification, document.body.firstChild);
            }

            // Auto-remove notification after 5 seconds
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 5000);
        } catch (error) {
            console.error('Error in showNotification:', error);
            // Fallback to alert
            alert(message);
        }
    }

    // Make showNotification globally accessible
    window.showNotification = showNotification;

    // ============================================
    // LOGIN VALIDATION
    // ============================================

    async function validateLogin() {
        try {
            const emailInput = document.getElementById('loginEmail');
            const passwordInput = document.getElementById('loginPassword');
            
            if (!emailInput || !passwordInput) {
                showNotification('Form elements not found. Please refresh the page.', 'error');
                return;
            }

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            // Basic validation
            if (!email || !password) {
                showNotification('Please fill in all fields', 'error');
                return;
            }

            // Determine role based on email address
            let role = 'vehicle_owner'; // Default role
            const testCredentials = {
                'hpgadmin@hpg.gov.ph': { password: 'hpg123456', role: 'hpg_admin', name: 'HPG Administrator', firstName: 'HPG', lastName: 'Admin' },
                'admin@lto.gov.ph': { password: 'admin123', role: 'admin', name: 'ADMIN', firstName: 'ADMIN', lastName: '' },
                'insurance@example.com': { password: 'insurance123', role: 'insurance_verifier', name: 'Insurance Verifier', firstName: 'Insurance', lastName: 'Verifier' },
                'emission@example.com': { password: 'emission123', role: 'emission_verifier', name: 'Emission Verifier', firstName: 'Emission', lastName: 'Verifier' },
                'owner@example.com': { password: 'owner123', role: 'vehicle_owner', name: 'Vehicle Owner', firstName: 'John', lastName: 'Doe' },
                'vehicle@example.com': { password: 'vehicle123', role: 'vehicle_owner', name: 'Vehicle Owner', firstName: 'Jane', lastName: 'Smith' }
            };

            // Check if email matches test credentials to determine role
            if (testCredentials[email]) {
                role = testCredentials[email].role;
            } else {
                // For real API calls, role will be determined by backend based on email
                // For now, default to vehicle_owner
                role = 'vehicle_owner';
            }

            // Email format validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showNotification('Please enter a valid email address', 'error');
                return;
            }

            console.log('Attempting login with:', email, role);
            
            // IMPORTANT: Admin accounts MUST use real API, never demo tokens
            // This ensures admin has proper JWT token with admin role
            const isAdminAccount = email === 'admin@lto.gov.ph' || role === 'admin';
            
            // Check if it's a test credential (but skip for admin accounts)
            if (!isAdminAccount && testCredentials[email] && testCredentials[email].password === password) {
                // Store user data
                const cred = testCredentials[email];
                const userData = {
                    id: 'demo-user-' + Date.now(),
                    email: email,
                    role: role,
                    firstName: cred.firstName || cred.name.split(' ')[0],
                    lastName: cred.lastName || cred.name.split(' ')[1] || '',
                    name: cred.name,
                    organization: 'Individual',
                    phone: '+63 912 345 6789',
                    isActive: true,
                    emailVerified: true
                };
                localStorage.setItem('currentUser', JSON.stringify(userData));
                const demoToken = 'demo-token-' + Date.now();
                localStorage.setItem('authToken', demoToken);
                localStorage.setItem('token', demoToken); // Also store as 'token' for compatibility
                
                console.log('Demo credentials stored:', { user: userData, token: demoToken });
                
                showNotification('Login successful! Redirecting to dashboard...', 'success');
                
                // Redirect based on role
                setTimeout(() => {
                    switch(role) {
                        case 'hpg_admin':
                            window.location.href = 'hpg-admin-dashboard.html';
                            break;
                        case 'insurance_verifier':
                            window.location.href = 'insurance-verifier-dashboard.html';
                            break;
                        case 'emission_verifier':
                            window.location.href = 'verifier-dashboard.html';
                            break;
                        case 'vehicle_owner':
                            window.location.href = 'owner-dashboard.html';
                            break;
                        default:
                            window.location.href = 'owner-dashboard.html';
                    }
                }, 1500);
                return;
            }
            
            // Call backend login API for real credentials (ALWAYS for admin, or if not in test credentials)
            try {
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
                    if (result.user) {
                        localStorage.setItem('currentUser', JSON.stringify(result.user));
                    }
                    if (result.token) {
                        // IMPORTANT: Clear any demo tokens first
                        if (localStorage.getItem('authToken')?.startsWith('demo-token-')) {
                            localStorage.removeItem('authToken');
                            localStorage.removeItem('token');
                        }
                        localStorage.setItem('authToken', result.token);
                        localStorage.setItem('token', result.token);
                    }
                    
                    console.log('✅ Real API login successful:', { 
                        email: result.user?.email, 
                        role: result.user?.role,
                        tokenType: result.token?.startsWith('demo-token-') ? 'demo' : 'JWT'
                    });
                    
                    showNotification('Login successful! Redirecting to dashboard...', 'success');
                    
                    // Redirect based on user role
                    setTimeout(() => {
                        const userRole = result.user?.role || role;
                        switch(userRole) {
                            case 'hpg_admin':
                                window.location.href = 'hpg-admin-dashboard.html';
                                break;
                            case 'admin':
                                window.location.href = 'admin-dashboard.html';
                                break;
                            case 'insurance_verifier':
                                window.location.href = 'insurance-verifier-dashboard.html';
                                break;
                            case 'emission_verifier':
                                window.location.href = 'verifier-dashboard.html';
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
            } catch (apiError) {
                // If API fails, show error
                showNotification('Login failed. Please check your credentials.', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showNotification('Login failed. Please try again.', 'error');
        }
    }

    // Make validateLogin globally accessible (for debugging)
    window.validateLogin = validateLogin;

    // ============================================
    // SIGNUP VALIDATION
    // ============================================

    window.validateSignup = async function() {
        try {
            const firstName = document.getElementById('firstName')?.value?.trim();
            const lastName = document.getElementById('lastName')?.value?.trim();
            const email = document.getElementById('signupEmail')?.value?.trim();
            const phone = document.getElementById('phone')?.value?.trim();
            const password = document.getElementById('signupPassword')?.value;
            const confirmPassword = document.getElementById('confirmPassword')?.value;
            const termsCheckbox = document.querySelector('input[name="terms"]');
            const terms = termsCheckbox ? termsCheckbox.checked : false;

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

            // Call backend registration API
            console.log('Attempting registration with:', email);
            
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    password,
                    firstName,
                    lastName,
                    phone,
                    role: 'vehicle_owner',
                    organization: 'Individual'
                })
            });

            const result = await response.json();
            console.log('Registration response:', result);

            if (result.success) {
                // Store user data and token
                if (result.user) {
                    localStorage.setItem('currentUser', JSON.stringify(result.user));
                }
                if (result.token) {
                    localStorage.setItem('authToken', result.token);
                    localStorage.setItem('token', result.token); // Also store as 'token' for compatibility
                }
                
                showNotification('Account created successfully! Redirecting to dashboard...', 'success');
                
                // Redirect to dashboard after successful registration
                setTimeout(() => {
                    window.location.href = 'owner-dashboard.html';
                }, 1500);
            } else {
                showNotification(result.error || 'Registration failed. Please try again.', 'error');
            }

            return false; // Prevent form submission
        } catch (error) {
            console.error('Registration error:', error);
            showNotification('Registration failed. Please try again.', 'error');
            return false;
        }
    };

    // ============================================
    // FORM VALIDATION HELPERS
    // ============================================

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

    // ============================================
    // FIELD ERROR HELPERS
    // ============================================

    function showFieldError(field, message) {
        try {
            hideFieldError(field); // Remove existing error
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.textContent = message;
            errorDiv.style.color = '#e74c3c';
            errorDiv.style.fontSize = '0.875rem';
            errorDiv.style.marginTop = '0.25rem';
            
            if (field && field.parentElement) {
                field.parentElement.appendChild(errorDiv);
            }
        } catch (error) {
            console.error('Error in showFieldError:', error);
        }
    }

    function hideFieldError(field) {
        try {
            if (field && field.parentElement) {
                const existingError = field.parentElement.querySelector('.field-error');
                if (existingError) {
                    existingError.remove();
                }
            }
        } catch (error) {
            console.error('Error in hideFieldError:', error);
        }
    }

    // Make field error helpers globally accessible
    window.showFieldError = showFieldError;
    window.hideFieldError = hideFieldError;

    // ============================================
    // REAL-TIME FORM VALIDATION
    // ============================================

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initializeFormValidation();
            handleURLParameters();
        });
    } else {
        initializeFormValidation();
        handleURLParameters();
    }

    // Handle URL parameters to auto-fill credentials
    function handleURLParameters() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const roleParam = urlParams.get('role');
            
            if (roleParam) {
                // Map URL parameter to test credentials
                const testCredentials = {
                    'hpg_admin': { email: 'hpgadmin@hpg.gov.ph', password: 'hpg123456' },
                    'hpg': { email: 'hpgadmin@hpg.gov.ph', password: 'hpg123456' },
                    'admin': { email: 'admin@lto.gov.ph', password: 'admin123' },
                    'lto': { email: 'admin@lto.gov.ph', password: 'admin123' },
                    'insurance_verifier': { email: 'insurance@example.com', password: 'insurance123' },
                    'insurance': { email: 'insurance@example.com', password: 'insurance123' },
                    'emission_verifier': { email: 'emission@example.com', password: 'emission123' },
                    'emission': { email: 'emission@example.com', password: 'emission123' }
                };
                
                const mappedRole = roleParam.toLowerCase();
                if (testCredentials[mappedRole]) {
                    const emailInput = document.getElementById('loginEmail');
                    const passwordInput = document.getElementById('loginPassword');
                    if (emailInput) emailInput.value = testCredentials[mappedRole].email;
                    if (passwordInput) passwordInput.value = testCredentials[mappedRole].password;
                }
            }
        } catch (error) {
            console.error('Error handling URL parameters:', error);
        }
    }

    function initializeFormValidation() {
        try {
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
        } catch (error) {
            console.error('Error initializing form validation:', error);
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    // Log that script loaded successfully
    console.log('Login/Signup script loaded successfully');
    console.log('Available functions:', {
        showLogin: typeof window.showLogin,
        showSignup: typeof window.showSignup,
        handleLogin: typeof window.handleLogin,
        validateSignup: typeof window.validateSignup,
        fillCredentials: typeof window.fillCredentials,
        showNotification: typeof window.showNotification
    });

})();
