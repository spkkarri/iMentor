/**
 * Authentication Middleware for Multi-Model System
 * Provides authentication for API endpoints
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * JWT Authentication Middleware
 */
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'No authorization header provided'
            });
        }

        // Check if it's a Bearer token
        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.slice(7) 
            : authHeader;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        // For development/testing, allow a test token
        if (token === 'test-token' || token === 'test-token-123') {
            req.user = {
                id: 'test-user-123',
                username: 'testuser',
                email: 'test@example.com',
                isAdmin: true
            };
            return next();
        }

        // Verify JWT token
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            
            // Find user by ID from token
            const user = await User.findById(decoded.id).select('-password');
            
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'User not found'
                });
            }

            req.user = user;
            next();
            
        } catch (jwtError) {
            console.error('JWT verification error:', jwtError.message);
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during authentication'
        });
    }
};

/**
 * Alternative auth using X-User-ID header (for backward compatibility)
 */
const tempAuth = async (req, res, next) => {
    try {
        // Check for user ID in headers
        const userId = req.headers['x-user-id'] || 
                      req.headers['X-User-ID'] || 
                      req.headers['user-id'] || 
                      req.headers['User-ID'];

        if (!userId) {
            // For testing, allow requests without user ID
            req.user = {
                id: 'anonymous-user',
                username: 'anonymous',
                email: 'anonymous@example.com',
                isAdmin: false
            };
            return next();
        }

        // Find user by ID
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            // Create a temporary user object for testing
            req.user = {
                id: userId,
                username: `user-${userId}`,
                email: `${userId}@example.com`,
                isAdmin: false
            };
        } else {
            req.user = user;
        }

        next();

    } catch (error) {
        console.error('TempAuth middleware error:', error);
        
        // For development, continue with a default user
        req.user = {
            id: 'default-user',
            username: 'defaultuser',
            email: 'default@example.com',
            isAdmin: false
        };
        next();
    }
};

/**
 * Admin authentication middleware
 */
const adminAuth = async (req, res, next) => {
    try {
        // First run regular auth
        await new Promise((resolve, reject) => {
            auth(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Check if user is admin
        if (!req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Admin privileges required'
            });
        }

        next();

    } catch (error) {
        console.error('Admin auth error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during admin authentication'
        });
    }
};

/**
 * Optional auth middleware (doesn't fail if no auth provided)
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            // No auth provided, continue without user
            req.user = null;
            return next();
        }

        // Try to authenticate
        auth(req, res, (err) => {
            if (err) {
                // Auth failed, continue without user
                req.user = null;
            }
            next();
        });

    } catch (error) {
        // Continue without user on any error
        req.user = null;
        next();
    }
};

module.exports = {
    auth,
    tempAuth,
    adminAuth,
    optionalAuth
};
