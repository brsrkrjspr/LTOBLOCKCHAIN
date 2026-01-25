// TrustChain LTO - Centralized Error Handler Utility
// Provides consistent error handling with audit logging across all modules

const db = require('../database/services');
const { ALL_ACTIONS } = require('../config/actionConstants');

/**
 * Error severity levels
 */
const ERROR_SEVERITY = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
};

/**
 * Error categories
 */
const ERROR_CATEGORY = {
    VALIDATION: 'VALIDATION',
    DATABASE: 'DATABASE',
    BLOCKCHAIN: 'BLOCKCHAIN',
    NETWORK: 'NETWORK',
    AUTHENTICATION: 'AUTHENTICATION',
    AUTHORIZATION: 'AUTHORIZATION',
    BUSINESS_LOGIC: 'BUSINESS_LOGIC',
    SYSTEM: 'SYSTEM'
};

/**
 * Handle error with audit logging
 * @param {Error} error - Error object
 * @param {Object} context - Context information (req, vehicleId, etc.)
 * @param {string} severity - Error severity (LOW, MEDIUM, HIGH, CRITICAL)
 * @param {string} category - Error category
 * @returns {Object} Formatted error response
 */
async function handleError(error, context = {}, severity = ERROR_SEVERITY.MEDIUM, category = ERROR_CATEGORY.SYSTEM) {
    const {
        req,
        vehicleId,
        transferRequestId,
        clearanceRequestId,
        userId,
        action,
        metadata = {}
    } = context;

    const errorId = require('crypto').randomUUID();
    const timestamp = new Date().toISOString();

    // Extract error details
    const errorDetails = {
        errorId,
        timestamp,
        severity,
        category,
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        context: {
            vehicleId,
            transferRequestId,
            clearanceRequestId,
            userId: userId || req?.user?.userId,
            action,
            endpoint: req?.path,
            method: req?.method,
            ip: req?.ip,
            userAgent: req?.get('user-agent')
        },
        metadata
    };

    // Log to console
    const severityEmoji = {
        [ERROR_SEVERITY.LOW]: 'ℹ️',
        [ERROR_SEVERITY.MEDIUM]: '⚠️',
        [ERROR_SEVERITY.HIGH]: '🔴',
        [ERROR_SEVERITY.CRITICAL]: '🚨'
    };

    console.error(`${severityEmoji[severity] || '⚠️'} [${severity}] ${category} Error [${errorId}]:`, {
        message: error.message,
        context: errorDetails.context
    });

    // Log to vehicle history if vehicleId is provided
    if (vehicleId && action) {
        try {
            await db.addVehicleHistory({
                vehicleId,
                action: ALL_ACTIONS.REGISTRATION_REJECTED || 'ERROR_OCCURRED', // Use appropriate action or create ERROR action
                description: `Error occurred: ${error.message} [Error ID: ${errorId}]`,
                performedBy: userId || req?.user?.userId || null,
                transactionId: null,
                metadata: {
                    errorId,
                    severity,
                    category,
                    errorMessage: error.message,
                    errorName: error.name,
                    errorCode: error.code,
                    ...metadata
                }
            });
        } catch (historyError) {
            console.error('Failed to log error to vehicle history:', historyError.message);
            // Don't throw - error logging should not fail the request
        }
    }

    // Alert admins for HIGH and CRITICAL errors
    if (severity === ERROR_SEVERITY.HIGH || severity === ERROR_SEVERITY.CRITICAL) {
        try {
            const adminUsers = await db.query(
                "SELECT id FROM users WHERE role = 'admin' LIMIT 5"
            );
            
            for (const admin of adminUsers.rows) {
                await db.createNotification({
                    userId: admin.id,
                    title: `${severity} Error: ${category}`,
                    message: `Error [${errorId}]: ${error.message}. Vehicle: ${vehicleId || 'N/A'}. Check logs for details.`,
                    type: severity === ERROR_SEVERITY.CRITICAL ? 'error' : 'warning'
                });
            }
        } catch (notificationError) {
            console.error('Failed to notify admins:', notificationError.message);
            // Don't throw - notification failure should not fail the request
        }
    }

    // Return formatted error response
    return {
        success: false,
        error: category,
        errorId,
        message: getErrorMessage(error, severity, category),
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined,
        timestamp
    };
}

/**
 * Get user-friendly error message based on error type and severity
 * @param {Error} error - Error object
 * @param {string} severity - Error severity
 * @param {string} category - Error category
 * @returns {string} User-friendly error message
 */
function getErrorMessage(error, severity, category) {
    // Critical errors - show actionable message
    if (severity === ERROR_SEVERITY.CRITICAL) {
        if (category === ERROR_CATEGORY.BLOCKCHAIN) {
            return 'A critical blockchain error occurred. The operation may have partially completed. Please contact support immediately with the error ID.';
        }
        if (category === ERROR_CATEGORY.DATABASE) {
            return 'A critical database error occurred. Your data may be at risk. Please contact support immediately with the error ID.';
        }
        return 'A critical system error occurred. Please contact support immediately with the error ID.';
    }

    // High severity errors - show specific guidance
    if (severity === ERROR_SEVERITY.HIGH) {
        if (category === ERROR_CATEGORY.VALIDATION) {
            return error.message || 'Invalid request. Please check your input and try again.';
        }
        if (category === ERROR_CATEGORY.AUTHORIZATION) {
            return 'You do not have permission to perform this action.';
        }
        return error.message || 'An error occurred. Please try again or contact support if the issue persists.';
    }

    // Medium and Low severity - show generic message
    return error.message || 'An error occurred. Please try again.';
}

/**
 * Express error handler middleware
 * Catches all errors and handles them consistently
 */
function errorHandlerMiddleware(err, req, res, next) {
    // Determine severity and category from error
    let severity = ERROR_SEVERITY.MEDIUM;
    let category = ERROR_CATEGORY.SYSTEM;

    // Categorize error
    if (err.name === 'ValidationError' || err.message?.includes('validation')) {
        category = ERROR_CATEGORY.VALIDATION;
        severity = ERROR_SEVERITY.LOW;
    } else if (err.name === 'UnauthorizedError' || err.status === 401) {
        category = ERROR_CATEGORY.AUTHENTICATION;
        severity = ERROR_SEVERITY.MEDIUM;
    } else if (err.status === 403) {
        category = ERROR_CATEGORY.AUTHORIZATION;
        severity = ERROR_SEVERITY.MEDIUM;
    } else if (err.message?.includes('blockchain') || err.message?.includes('Fabric')) {
        category = ERROR_CATEGORY.BLOCKCHAIN;
        severity = ERROR_SEVERITY.HIGH;
    } else if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        category = ERROR_CATEGORY.NETWORK;
        severity = ERROR_SEVERITY.HIGH;
    } else if (err.code?.startsWith('23') || err.message?.includes('database')) {
        category = ERROR_CATEGORY.DATABASE;
        severity = ERROR_SEVERITY.HIGH;
    }

    // Handle error asynchronously (don't block response)
    handleError(err, { req }, severity, category)
        .then(errorResponse => {
            const statusCode = err.status || err.statusCode || 500;
            res.status(statusCode).json(errorResponse);
        })
        .catch(handlerError => {
            // Fallback if error handler itself fails
            console.error('Error handler failed:', handlerError);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: 'An unexpected error occurred'
            });
        });
}

/**
 * Wrap async route handlers to catch errors
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped route handler
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Create error response for API endpoints
 * @param {Error} error - Error object
 * @param {Object} context - Context information
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Error response object
 */
function createErrorResponse(error, context = {}, statusCode = 500) {
    const severity = context.severity || ERROR_SEVERITY.MEDIUM;
    const category = context.category || ERROR_CATEGORY.SYSTEM;

    return {
        statusCode,
        ...handleError(error, context, severity, category)
    };
}

module.exports = {
    handleError,
    getErrorMessage,
    errorHandlerMiddleware,
    asyncHandler,
    createErrorResponse,
    ERROR_SEVERITY,
    ERROR_CATEGORY
};
