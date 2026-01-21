// Global Error Tracker - Detects undefined function calls and missing APIs
// This script tracks runtime errors to identify missing functions and API endpoints

(function() {
    'use strict';
    
    const logEndpoint = 'http://127.0.0.1:7242/ingest/4834ddd0-680e-48e9-886f-cc09b84f1bac';
    
    // Track undefined function calls
    window.addEventListener('error', function(event) {
        const error = event.error || event.message;
        const errorMessage = typeof error === 'string' ? error : error?.message || event.message || '';
        const errorStack = error?.stack || event.filename || '';
        
        // #region agent log
        // Silently fail if CSP blocks the request
        try {
            fetch(logEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: 'error-tracker.js:window.error',
                    message: 'Runtime error detected',
                    data: {
                        errorMessage,
                        errorStack: errorStack.substring(0, 500),
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno,
                        isUndefinedFunction: /is not a function|is not defined|cannot read property/i.test(errorMessage)
                    },
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    runId: 'run1',
                    hypothesisId: 'B'
                })
            }).catch(() => {
                // Silently fail - CSP may block this, which is expected
            });
        } catch (e) {
            // Silently fail - CSP violation is expected
        }
        // #endregion
    }, true);
    
    // Track unhandled promise rejections (API errors)
    window.addEventListener('unhandledrejection', function(event) {
        const error = event.reason;
        const errorMessage = error?.message || String(error) || 'Unhandled promise rejection';
        
        // #region agent log
        // Silently fail if CSP blocks the request
        try {
            fetch(logEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: 'error-tracker.js:unhandledrejection',
                    message: 'Unhandled promise rejection',
                    data: {
                        errorMessage,
                        errorStack: error?.stack?.substring(0, 500) || '',
                        isAPIError: /fetch|api|network|404|500/i.test(errorMessage)
                    },
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    runId: 'run1',
                    hypothesisId: 'B'
                })
            }).catch(() => {
                // Silently fail - CSP may block this, which is expected
            });
        } catch (e) {
            // Silently fail - CSP violation is expected
        }
        // #endregion
    });
    
    // Override console.error to track errors
    const originalConsoleError = console.error;
    console.error = function(...args) {
        const errorMessage = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        // #region agent log
        // Silently fail if CSP blocks the request
        try {
            fetch(logEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    location: 'error-tracker.js:console.error',
                    message: 'Console error logged',
                    data: {
                        errorMessage: errorMessage.substring(0, 500),
                        isUndefinedFunction: /is not a function|is not defined|cannot read property/i.test(errorMessage),
                        isAPIError: /fetch|api|network|404|500/i.test(errorMessage)
                    },
                    timestamp: Date.now(),
                    sessionId: 'debug-session',
                    runId: 'run1',
                    hypothesisId: 'B'
                })
            }).catch(() => {
                // Silently fail - CSP may block this, which is expected
            });
        } catch (e) {
            // Silently fail - CSP violation is expected
        }
        // #endregion
        
        originalConsoleError.apply(console, args);
    };
    
    console.log('✅ Error tracker initialized');
})();
