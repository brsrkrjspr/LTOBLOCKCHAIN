// TrustChain LTO - Global Error Handler
// Centralized error handling and user-friendly error messages

class ErrorHandler {
    // Handle API errors
    static handleAPIError(error, context = '') {
        console.error(`API Error${context ? ' in ' + context : ''}:`, error);
        
        let userMessage = 'An unexpected error occurred.';
        
        if (error.message) {
            // Network errors
            if (error.message.includes('Network error') || error.message.includes('fetch')) {
                userMessage = 'Network error. Please check your internet connection and try again.';
            }
            // Timeout errors
            else if (error.message.includes('timeout')) {
                userMessage = 'Request timeout. The server is taking too long to respond. Please try again.';
            }
            // Authentication errors
            else if (error.message.includes('Authentication') || error.message.includes('Session expired')) {
                userMessage = 'Your session has expired. Please login again.';
                // Redirect handled by API client
            }
            // Permission errors
            else if (error.message.includes('permission') || error.message.includes('Forbidden')) {
                userMessage = 'You do not have permission to perform this action.';
            }
            // Conflict errors (duplicate records)
            else if (error.message.includes('already exists') || error.message.includes('Conflict') || error.message.includes('duplicate') || error.isConflict) {
                userMessage = error.message || 'This record already exists. Please check your information and try again.';
                // For VIN conflicts, provide more specific guidance
                if (error.message.includes('VIN')) {
                    userMessage = 'This Vehicle Identification Number (VIN) is already registered in the system. Please verify your VIN number and try again with a different vehicle, or contact support if you believe this is an error.';
                }
            }
            // Server errors
            else if (error.message.includes('Server error') || error.isServerError) {
                // Show more details if available (development mode)
                if (error.details && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                    console.error('Server error details:', error.details);
                    userMessage = error.message || 'Server error. Please check the console for details.';
                } else {
                    userMessage = error.message || 'Server error. Please try again later or contact support if the problem persists.';
                }
            }
            // Use the error message if it's user-friendly
            else {
                userMessage = error.message;
            }
        }
        
        // Show error notification
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show(userMessage, 'error', 5000);
        } else {
            alert(userMessage);
        }
        
        return userMessage;
    }

    // Handle form validation errors
    static handleValidationError(field, message) {
        const fieldElement = document.querySelector(`[name="${field}"], #${field}`);
        if (fieldElement) {
            fieldElement.classList.add('error');
            
            // Show field error
            if (typeof showFieldError === 'function') {
                showFieldError(fieldElement, message);
            } else {
                // Fallback error display
                const errorDiv = document.createElement('div');
                errorDiv.className = 'field-error';
                errorDiv.textContent = message;
                errorDiv.style.color = '#e74c3c';
                errorDiv.style.fontSize = '0.875rem';
                errorDiv.style.marginTop = '0.25rem';
                fieldElement.parentElement.appendChild(errorDiv);
            }
        }
        
        if (typeof ToastNotification !== 'undefined') {
            ToastNotification.show(message, 'error', 3000);
        }
    }

    // Clear field errors
    static clearFieldErrors(form) {
        const errorElements = form.querySelectorAll('.field-error');
        errorElements.forEach(el => el.remove());
        
        const errorFields = form.querySelectorAll('.error');
        errorFields.forEach(field => field.classList.remove('error'));
    }

    // Show user-friendly error page
    static showErrorPage(title, message, showRetry = false) {
        const errorPage = document.createElement('div');
        errorPage.className = 'error-page';
        errorPage.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 400px;
            padding: 2rem;
            text-align: center;
        `;
        
        errorPage.innerHTML = `
            <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
            <h2 style="color: #2c3e50; margin-bottom: 1rem;">${title}</h2>
            <p style="color: #7f8c8d; margin-bottom: 2rem; max-width: 500px;">${message}</p>
            ${showRetry ? '<button class="btn-primary" onclick="window.location.reload()">Retry</button>' : ''}
            <a href="index.html" class="btn-secondary" style="margin-top: 1rem;">Go to Home</a>
        `;
        
        // Replace main content
        const main = document.querySelector('main');
        if (main) {
            main.innerHTML = '';
            main.appendChild(errorPage);
        } else {
            document.body.appendChild(errorPage);
        }
    }

    // Setup global error handlers
    static setupGlobalHandlers() {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleAPIError(event.reason, 'Unhandled Promise');
            event.preventDefault();
        });

        // Handle JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('JavaScript error:', event.error);
            
            // Don't show error for script loading errors (likely network issues)
            if (event.target && event.target.tagName === 'SCRIPT') {
                return;
            }
            
            // Show user-friendly error
            if (typeof ToastNotification !== 'undefined') {
                ToastNotification.show(
                    'An unexpected error occurred. Please refresh the page.',
                    'error',
                    5000
                );
            }
        });
    }
}

// Setup global handlers when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ErrorHandler.setupGlobalHandlers();
    });
} else {
    ErrorHandler.setupGlobalHandlers();
}

// Export for global use
window.ErrorHandler = ErrorHandler;

