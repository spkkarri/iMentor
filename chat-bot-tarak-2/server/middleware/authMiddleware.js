// server/middleware/authMiddleware.js

const User = require('../models/User');

// Authentication Middleware - Checks for User ID in headers OR query
const tempAuth = async (req, res, next) => {
    let userId = null;

    // --- THIS IS THE CORRECTED LOGIC ---
    // 1. Primary check: Look for the user ID in the standard header
    if (req.headers['x-user-id']) {
        userId = req.headers['x-user-id'];
    }
    // 2. Fallback check: Look for the user ID in query parameters (for downloads)
    else if (req.query.userId) {
        userId = req.query.userId;
        console.log("TempAuth Middleware: Found userId in query parameters (for download).");
    }
    // --- END OF CORRECTION ---

    if (!userId) {
        console.warn("TempAuth Middleware: No userId found in header or query.");
        return res.status(401).json({ message: 'Unauthorized: Missing User ID' });
    }

    // --- The rest of your existing logic remains unchanged ---

    // Special handling for the admin user
    if (userId === 'admin-user') {
        console.log("TempAuth Middleware: Admin user detected. Bypassing DB lookup.");
        req.user = {
            _id: 'admin-user',
            role: 'admin'
        };
        return next();
    }
    
    // Normal database lookup
    try {
        const user = await User.findById(userId).select('-password');

        if (!user) {
            console.warn(`TempAuth Middleware: User not found for ID: ${userId}`);
            return res.status(401).json({ message: 'Unauthorized: User not found' });
        }

        req.user = user;
        next();

    } catch (error) {
        console.error('TempAuth Middleware: Error fetching user:', error);
        if (error.name === 'CastError' && error.kind === 'ObjectId') {
             return res.status(400).json({ message: 'Bad Request: Invalid User ID format' });
        }
        res.status(500).json({ message: 'Server error during temporary authentication' });
    }
};

module.exports = { tempAuth };