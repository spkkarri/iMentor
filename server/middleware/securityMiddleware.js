// server/middleware/securityMiddleware.js
// Enhanced security middleware for admin routes and API protection

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const crypto = require('crypto');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message, skipSuccessfulRequests = false) => {
    return rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests,
        keyGenerator: (req) => {
            // Use IP + User ID for authenticated requests
            const userId = req.user?.id || req.user?._id;
            return userId ? `${req.ip}-${userId}` : req.ip;
        }
    });
};

// Different rate limits for different endpoints
const rateLimiters = {
    // Admin endpoints - very strict
    admin: createRateLimiter(
        15 * 60 * 1000, // 15 minutes
        50, // 50 requests per window
        'Too many admin requests, please try again later'
    ),
    
    // Authentication endpoints
    auth: createRateLimiter(
        15 * 60 * 1000, // 15 minutes
        10, // 10 attempts per window
        'Too many authentication attempts, please try again later'
    ),
    
    // Chat endpoints
    chat: createRateLimiter(
        60 * 1000, // 1 minute
        30, // 30 messages per minute
        'Too many chat requests, please slow down'
    ),
    
    // General API
    general: createRateLimiter(
        15 * 60 * 1000, // 15 minutes
        1000, // 1000 requests per window
        'API rate limit exceeded'
    )
};

// Security headers middleware
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false, // Disable for compatibility
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

// Input sanitization middleware
const sanitizeInput = [
    mongoSanitize(), // Remove NoSQL injection attempts
    xss() // Clean XSS attempts
];

// Admin access validation
const validateAdminAccess = (req, res, next) => {
    const user = req.user;
    
    if (!user) {
        return res.status(401).json({ 
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }
    
    // Check admin status from database only
    const isAdmin = (user.isAdmin === true);
    
    if (!isAdmin) {
        // Log unauthorized admin access attempt
        console.warn(`🚨 Unauthorized admin access attempt by user: ${user.username || user.id}`);
        
        return res.status(403).json({ 
            error: 'Admin privileges required',
            code: 'ADMIN_REQUIRED'
        });
    }
    
    // Log successful admin access
    console.log(`✅ Admin access granted to: ${user.username || user.id}`);
    next();
};

// Request logging for security monitoring
const securityLogger = (req, res, next) => {
    const startTime = Date.now();
    
    // Log request details
    const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id || req.user?._id,
        username: req.user?.username
    };
    
    // Log response when it finishes
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        console.log(`🔍 ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - User: ${logData.username || 'Anonymous'}`);
        
        // Log suspicious activities
        if (res.statusCode >= 400) {
            console.warn(`⚠️ Security Alert: ${res.statusCode} response for ${req.method} ${req.originalUrl} from ${req.ip}`);
        }
    });
    
    next();
};

// API key validation middleware
const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
        return res.status(401).json({
            error: 'API key required',
            code: 'API_KEY_REQUIRED'
        });
    }
    
    // Validate API key format (you can enhance this)
    if (!isValidApiKey(apiKey)) {
        return res.status(401).json({
            error: 'Invalid API key format',
            code: 'INVALID_API_KEY'
        });
    }
    
    next();
};

// Helper function to validate API key format
const isValidApiKey = (apiKey) => {
    // Basic validation - you can enhance this
    return apiKey && typeof apiKey === 'string' && apiKey.length >= 20;
};

// Brute force protection for login attempts
const loginBruteForceProtection = (() => {
    const attempts = new Map();
    const MAX_ATTEMPTS = 5;
    const LOCK_TIME = 15 * 60 * 1000; // 15 minutes
    
    return (req, res, next) => {
        const identifier = req.body.username || req.body.email || req.ip;
        const now = Date.now();
        
        if (attempts.has(identifier)) {
            const data = attempts.get(identifier);
            
            if (data.lockedUntil && data.lockedUntil > now) {
                const remainingTime = Math.ceil((data.lockedUntil - now) / 1000 / 60);
                return res.status(429).json({
                    error: `Account locked due to too many failed attempts. Try again in ${remainingTime} minutes.`,
                    code: 'ACCOUNT_LOCKED'
                });
            }
            
            if (data.lockedUntil && data.lockedUntil <= now) {
                attempts.delete(identifier);
            }
        }
        
        // Track failed attempts in response
        const originalSend = res.send;
        res.send = function(data) {
            if (res.statusCode === 401 || res.statusCode === 403) {
                const attemptData = attempts.get(identifier) || { count: 0 };
                attemptData.count++;
                attemptData.lastAttempt = now;
                
                if (attemptData.count >= MAX_ATTEMPTS) {
                    attemptData.lockedUntil = now + LOCK_TIME;
                    console.warn(`🔒 Account locked for ${identifier} due to ${MAX_ATTEMPTS} failed attempts`);
                }
                
                attempts.set(identifier, attemptData);
            } else if (res.statusCode === 200) {
                // Success - clear attempts
                attempts.delete(identifier);
            }
            
            originalSend.call(this, data);
        };
        
        next();
    };
})();

module.exports = {
    rateLimiters,
    securityHeaders,
    sanitizeInput,
    validateAdminAccess,
    securityLogger,
    validateApiKey,
    loginBruteForceProtection
};
