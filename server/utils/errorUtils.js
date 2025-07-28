// server/utils/errorUtils.js

// --- FIX: Import createHttpError instead of destructuring Error ---
const createHttpError = require('http-errors');

/**
 * Create a standardized error object
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @param {Object} [details] - Additional error details
 * @returns {Error} Standardized error object
 */
function createError(status, message, details = null) {
    // --- FIX: Use the imported function correctly ---
    const error = new createHttpError(status, message);
    error.details = details;
    return error;
}

/**
 * Handle Gemini API errors
 * @param {Error} error - Original error
 * @returns {Error} Formatted error
 */
function handleGeminiError(error) {
    const status = error.status || 500;
    let message = 'Failed to process request with Gemini AI';
    let details = null;

    if (error.message?.includes('API key not valid')) {
        message = 'Invalid Gemini API key';
    } else if (error.message?.includes('blocked')) {
        message = 'Request was blocked by safety filters';
        details = {
            blocked: true,
            categories: error.safetyRatings?.filter(r => r.blocked).map(r => r.category)
        };
    } else if (error.message?.includes('rate limit')) {
        message = 'Rate limit exceeded';
        details = {
            rateLimit: true,
            retryAfter: error.retryAfter
        };
    }

    return createError(status, message, details);
}

/**
 * Handle RAG-related errors
 * @param {Error} error - Original error
 * @param {string} query - Original query
 * @returns {Error} Formatted error
 */
function handleRAGError(error, query) {
    const status = error.status || 500;
    let message = 'Failed to process RAG request';
    let details = null;

    if (error.message?.includes('no relevant documents')) {
        message = 'No relevant documents found for query';
        details = {
            suggestions: [
                'Try uploading more relevant documents',
                'Try rephrasing your query',
                'Provide more context about what you need'
            ]
        };
    } else if (error.message?.includes('rate limit')) {
        message = 'Rate limit exceeded for RAG operations';
        details = {
            rateLimit: true,
            retryAfter: error.retryAfter
        };
    }

    return createError(status, message, details);
}

module.exports = {
    createError,
    handleGeminiError,
    handleRAGError
};