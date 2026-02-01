// Login/Signup JavaScript
// All functions are defined as window properties immediately to ensure global accessibility

(function () {
    'use strict';

    // ============================================
    // GLOBAL FUNCTION DEFINITIONS (Window Properties)
    // ============================================

    // Toggle between login and signup forms
    window.showLogin = function () {
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

    window.showSignup = function () {
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
    window.fillCredentials = function (email, password, role = '') {
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
    window.handleLogin = function (event) {
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

            // Check for existing session (prevent multiple accounts)
            if (typeof AuthUtils !== 'undefined') {
                const existingSession = AuthUtils.checkExistingSession();
                if (existingSession.hasExisting) {
                    const existingEmail = existingSession.user.email;
                    if (existingEmail !== email) {
                        // Different account trying to login
                        const confirmSwitch = confirm(
                            `You are currently logged in as ${existingEmail}.\n\n` +
                            `Do you want to logout and switch to ${email}?\n\n` +
                            `Click OK to switch accounts, or Cancel to stay logged in.`
                        );
                        if (confirmSwitch) {
                            AuthUtils.forceLogout();
                            showNotification('Previous session cleared. Please login again.', 'info');
                        } else {
                            showNotification(`Continuing as ${existingEmail}`, 'info');
                            // Redirect based on existing user role
                            AuthUtils.redirectByRole();
                            return;
                        }
                    }
                }
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

            console.log('Attempting login with:', email);

            // ALWAYS call backend login API - no demo accounts, all accounts are real database accounts
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
                    // CHECK FOR 2FA
                    if (result.require2fa || result.require_2fa) {
                        console.log('2FA required for login');
                        // Store tempToken from backend for 2FA verification
                        sessionStorage.setItem('pending2faTempToken', result.tempToken);
                        sessionStorage.setItem('pending2faEmail', email);

                        // Show 2FA UI
                        const loginForm = document.getElementById('loginForm');
                        const twoFAForm = document.getElementById('twoFAForm');
                        if (loginForm) loginForm.style.display = 'none';
                        if (twoFAForm) twoFAForm.style.display = 'block';

                        showNotification('Please enter the verification code sent to your email.', 'info');
                        return;
                    }

                    // Store user data in localStorage (non-sensitive)
                    if (result.user) {
                        localStorage.setItem('currentUser', JSON.stringify(result.user));
                    }

                    // Store access token in AuthManager (memory), NOT localStorage
                    if (result.token && typeof window !== 'undefined' && window.authManager) {
                        // IMPORTANT: Clear any demo tokens first
                        if (localStorage.getItem('authToken')?.startsWith('demo-token-')) {
                            localStorage.removeItem('authToken');
                            localStorage.removeItem('token');
                        }
                        // Store in AuthManager memory
                        window.authManager.setAccessToken(result.token);
                        // Keep localStorage for backward compatibility during transition
                        localStorage.setItem('authToken', result.token);
                    } else if (result.token) {
                        // Fallback if AuthManager not available
                        localStorage.setItem('authToken', result.token);
                        localStorage.setItem('token', result.token);
                    }

                    console.log('✅ Real API login successful:', {
                        email: result.user?.email,
                        role: result.user?.role,
                        tokenType: result.token?.startsWith('demo-token-') ? 'demo' : 'JWT'
                    });

                    showNotification('Login successful! Redirecting to dashboard...', 'success');

                    // Check for redirect parameter (e.g., from transfer confirmation)
                    const urlParams = new URLSearchParams(window.location.search);
                    const redirect = urlParams.get('redirect');
                    const token = urlParams.get('token');

                    // Handle transfer confirmation redirect
                    if (redirect === 'transfer-confirmation' && token) {
                        setTimeout(() => {
                            // Store token in sessionStorage for transfer-confirmation page
                            sessionStorage.setItem('transferToken', token);
                            // Redirect to my-vehicle-ownership.html where buyer can see pending transfers
                            window.location.href = 'my-vehicle-ownership.html';
                        }, 1500);
                        return;
                    }

                    // Handle other redirects
                    if (redirect && redirect !== 'transfer-confirmation') {
                        setTimeout(() => {
                            window.location.href = redirect;
                        }, 1500);
                        return;
                    }

                    // Redirect based on user role
                    setTimeout(() => {
                        const userRole = result.user?.role;
                        const userEmail = result.user?.email?.toLowerCase();

                        // Special case: Certificate Generator account goes directly to certificate generator
                        if (userEmail === 'certificategenerator@generator.com') {
                            window.location.href = 'certificate-generator.html';
                            return;
                        }

                        switch (userRole) {
                            case 'hpg_admin':
                                window.location.href = 'hpg-admin-dashboard.html';
                                break;

                            case 'admin':
                                // Check organization to determine if HPG admin
                                const org = result.user?.organization || '';
                                if (org.toLowerCase().includes('hpg') || email.toLowerCase().includes('hpg')) {
                                    window.location.href = 'hpg-admin-dashboard.html';
                                } else {
                                    window.location.href = 'admin-dashboard.html';
                                }
                                break;
                            case 'lto_admin':
                                // LTO Admin goes to admin dashboard (has full admin access)
                                window.location.href = 'admin-dashboard.html';
                                break;
                            case 'lto_officer':
                                // LTO Officer goes to officer dashboard
                                window.location.href = 'lto-officer-dashboard.html';
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
                } else if (result.code === 'EMAIL_NOT_VERIFIED') {
                    // Email verification required - redirect to verification prompt
                    console.log('Email verification required:', result.email);

                    // Store pending verification info in localStorage
                    localStorage.setItem('pendingVerificationEmail', result.email);
                    if (result.userId) {
                        localStorage.setItem('pendingVerificationUserId', result.userId);
                    }

                    // Show warning and redirect
                    showNotification('Please verify your email before continuing. Redirecting...', 'warning');
                    setTimeout(() => {
                        window.location.href = 'email-verification-prompt.html';
                    }, 2000);
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

    // 2FA FUNCTIONS
    window.handle2FAVerification = async function () {
        try {
            const codeInput = document.getElementById('twofaCode');
            const code = codeInput ? codeInput.value.trim() : '';
            const tempToken = sessionStorage.getItem('pending2faTempToken');

            if (!code || code.length !== 6) {
                showNotification('Please enter a valid 6-digit code', 'error');
                return;
            }
            if (!tempToken) {
                showNotification('Session expired. Please login again.', 'error');
                window.cancel2FA();
                return;
            }

            // Call verify API with tempToken (not userId)
            const response = await fetch('/api/auth/verify-2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tempToken, code })
            });

            const result = await response.json();

            if (result.success) {
                // Success! Proceed with login flow (store tokens etc)
                // We'll reuse the logic from validateLogin or duplicate it here for safety

                if (result.user) {
                    localStorage.setItem('currentUser', JSON.stringify(result.user));
                }

                if (result.token) {
                    if (window.authManager) {
                        window.authManager.setAccessToken(result.token);
                    }
                    localStorage.setItem('authToken', result.token);
                    localStorage.setItem('token', result.token);
                }

                showNotification('Verification successful! Redirecting...', 'success');

                // Clear pending 2FA data
                sessionStorage.removeItem('pending2faTempToken');
                sessionStorage.removeItem('pending2faEmail');

                // Redirect
                setTimeout(() => {
                    const userRole = result.user?.role || 'vehicle_owner';
                    const userEmail = result.user?.email?.toLowerCase();

                    // Special case: Certificate Generator account
                    if (userEmail === 'certificategenerator@generator.com') {
                        window.location.href = 'certificate-generator.html';
                        return;
                    }

                    switch (userRole) {
                        case 'hpg_admin':
                        case 'hpg_officer':
                            window.location.href = 'hpg-admin-dashboard.html';
                            break;
                        case 'admin':
                        case 'lto_admin':
                            window.location.href = 'admin-dashboard.html';
                            break;
                        case 'lto_officer': window.location.href = 'lto-officer-dashboard.html'; break;
                        case 'insurance_verifier': window.location.href = 'insurance-verifier-dashboard.html'; break;
                        case 'emission_verifier': window.location.href = 'verifier-dashboard.html'; break;
                        default: window.location.href = 'owner-dashboard.html';
                    }
                }, 1500);


            } else {
                showNotification(result.error || 'Invalid code', 'error');
            }

        } catch (error) {
            console.error('2FA Error:', error);
            showNotification('Verification failed', 'error');
        }
    };

    window.resend2FACode = async function () {
        const userId = sessionStorage.getItem('pending2faUserId');
        const email = sessionStorage.getItem('pending2faEmail');
        if (!userId) return;

        try {
            showNotification('Resending code...', 'info');
            const response = await fetch('/api/auth/resend-2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, email })
            });
            const result = await response.json();
            if (result.success) {
                showNotification('Code resent successfully', 'success');
            } else {
                showNotification(result.error || 'Failed to resend code', 'error');
            }
        } catch (e) {
            showNotification('Failed to resend code', 'error');
        }
    };

    window.cancel2FA = function () {
        document.getElementById('twoFAForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
        sessionStorage.removeItem('pending2faTempToken');
        sessionStorage.removeItem('pending2faEmail');
    };

    // ============================================
    // SIGNUP VALIDATION
    // ============================================

    window.validateSignup = async function (event) {
        // Prevent form submission immediately
        if (event) {
            event.preventDefault();
        }

        try {
            const firstName = document.getElementById('firstName')?.value?.trim();
            const lastName = document.getElementById('lastName')?.value?.trim();
            const email = document.getElementById('signupEmail')?.value?.trim();
            const phone = document.getElementById('phone')?.value?.trim();
            const address = document.getElementById('address')?.value?.trim() || null;
            const password = document.getElementById('signupPassword')?.value;
            const confirmPassword = document.getElementById('confirmPassword')?.value;
            const termsCheckbox = document.querySelector('input[name="terms"]');
            const terms = termsCheckbox ? termsCheckbox.checked : false;

            // Basic validation (address is optional, so not included in required fields check)
            if (!firstName || !lastName || !email || !phone || !password || !confirmPassword) {
                showNotification('Please fill in all required fields', 'error');
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

            // Password validation (match backend requirement: 12 characters minimum)
            if (password.length < 12) {
                showNotification('Password must be at least 12 characters long', 'error');
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

            const requestBody = {
                email,
                password,
                firstName,
                lastName,
                phone,
                address: address || null,
                role: 'vehicle_owner',
                organization: 'Individual'
            };

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            let result;
            let responseText = '';
            try {
                responseText = await response.text();
                result = JSON.parse(responseText);
            } catch (parseError) {
                throw parseError;
            }

            console.log('Registration response:', result);
            console.log('Response status:', response.status);
            console.log('User object:', result.user);
            console.log('Email verified status:', result.user?.emailVerified);

            if (result.success) {
                // Check if email verification is required
                // Handle both camelCase and snake_case for emailVerified
                const emailVerified = result.user?.emailVerified ?? result.user?.email_verified ?? false;
                console.log('Email verified (normalized):', emailVerified);

                // Always redirect to verification prompt if emailVerified is false or undefined
                // This ensures unverified users go to verification prompt
                if (result.user && (emailVerified === false || emailVerified === undefined || !emailVerified)) {
                    // Email verification required - redirect to verification prompt
                    console.log('Email verification required for:', result.user.email);

                    // Store pending verification info in localStorage (DO NOT store tokens yet)
                    localStorage.setItem('pendingVerificationEmail', result.user.email);
                    if (result.user.id) {
                        localStorage.setItem('pendingVerificationUserId', result.user.id);
                    }

                    // Verify it was stored
                    console.log('Stored pendingVerificationEmail:', localStorage.getItem('pendingVerificationEmail'));

                    showNotification('Account created! Please check your email to verify your account.', 'success');

                    // Redirect to email verification prompt immediately (no delay to prevent form submission)
                    window.location.href = 'email-verification-prompt.html';
                    return false; // Prevent any further execution
                } else {
                    // Email already verified or verification disabled - proceed normally
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
                }
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

            // Find the form-group container
            const formGroup = field.closest('.form-group');

            if (formGroup) {
                // Find the input-wrapper to insert error before it
                const inputWrapper = formGroup.querySelector('.input-wrapper');
                if (inputWrapper) {
                    // Insert error message before the input-wrapper (after label, before input)
                    formGroup.insertBefore(errorDiv, inputWrapper);
                } else {
                    // Fallback: if no input-wrapper, insert after label
                    const label = formGroup.querySelector('label');
                    if (label && label.nextSibling) {
                        formGroup.insertBefore(errorDiv, label.nextSibling);
                    } else {
                        formGroup.appendChild(errorDiv);
                    }
                }
            } else if (field && field.parentElement) {
                // Fallback: append to parent
                field.parentElement.appendChild(errorDiv);
            }
        } catch (error) {
            console.error('Error in showFieldError:', error);
        }
    }

    function hideFieldError(field) {
        try {
            // Find the form-group container
            let formGroup = field.closest('.form-group');
            if (!formGroup) {
                // Fallback: try to find parent with form-group class
                formGroup = field.parentElement;
                while (formGroup && !formGroup.classList.contains('form-group')) {
                    formGroup = formGroup.parentElement;
                }
            }

            if (formGroup) {
                const existingError = formGroup.querySelector('.field-error');
                if (existingError) {
                    existingError.remove();
                }
            } else if (field && field.parentElement) {
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
        document.addEventListener('DOMContentLoaded', function () {
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
                // Map URL parameter to real account emails (passwords not shown for security)
                const accountEmails = {
                    'hpg_admin': 'hpgadmin@hpg.gov.ph',
                    'hpg': 'hpgadmin@hpg.gov.ph',
                    'admin': 'admin@lto.gov.ph',
                    'lto': 'admin@lto.gov.ph',
                    'insurance_verifier': 'insurance@insurance.gov.ph',
                    'insurance': 'insurance@insurance.gov.ph',
                    'emission_verifier': 'emission@emission.gov.ph',
                    'emission': 'emission@emission.gov.ph',
                    'owner': 'owner@example.com',
                    'vehicle_owner': 'owner@example.com'
                };

                const mappedRole = roleParam.toLowerCase();
                if (accountEmails[mappedRole]) {
                    const emailInput = document.getElementById('loginEmail');
                    if (emailInput) emailInput.value = accountEmails[mappedRole];
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
                input.addEventListener('blur', function () {
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
                input.addEventListener('blur', function () {
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
                phoneInput.addEventListener('blur', function () {
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
                confirmPasswordInput.addEventListener('blur', function () {
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
