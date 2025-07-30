// server/middleware/authMiddleware.js
const User = require('../models/User');

// TEMPORARY Authentication Middleware (INSECURE - for debugging only)
// Checks for 'X-User-ID' header and attaches user to req.user
const tempAuth = async (req, res, next) => {
    // Check for user ID in multiple header variations
    const userId = req.headers['x-user-id'] || req.headers['X-User-ID'] || req.headers['user-id'] || req.headers['User-ID'];

    console.log("TempAuth Middleware: Headers received:", Object.keys(req.headers));
    console.log("TempAuth Middleware: Looking for user ID in headers...");
    console.log("TempAuth Middleware: x-user-id:", req.headers['x-user-id']);
    console.log("TempAuth Middleware: X-User-ID:", req.headers['X-User-ID']);
    console.log("TempAuth Middleware: user-id:", req.headers['user-id']);
    console.log("TempAuth Middleware: User-ID:", req.headers['User-ID']);
    console.log("TempAuth Middleware: Selected userId:", userId);

    if (!userId) {
        console.warn("TempAuth Middleware: Missing X-User-ID header.");
        console.warn("TempAuth Middleware: Available headers:", Object.keys(req.headers));
        // Send 401 immediately if header is missing
        return res.status(401).json({ message: 'Unauthorized: Missing User ID header' });
    }

    // For testing: allow specific test user IDs to bypass database check
    const testUserIds = ['507f1f77bcf86cd799439011', 'test-user-123', '6889c5f51666097a9ee3c518'];
    if (testUserIds.includes(userId)) {
        console.log("TempAuth Middleware: Using test user:", userId);
        req.user = {
            _id: userId,
            username: userId === '6889c5f51666097a9ee3c518' ? 'Matthews' : 'testuser',
            id: userId
        };
        return next();
    }

    try {
        // Find user by the ID provided in the header
        // Ensure Mongoose is connected before this runs (handled by server.js)
        const user = await User.findById(userId).select('-password'); // Exclude password

        if (!user) {
            console.warn(`TempAuth Middleware: User not found for ID: ${userId}`);
            // Send 401 if user ID is provided but not found in DB
            return res.status(401).json({ message: 'Unauthorized: User not found' });
        }

        // Attach user object to the request
        req.user = user;
        console.log("TempAuth Middleware: User attached:", req.user.username);
        next(); // Proceed to the next middleware or route handler

    } catch (error) {
        console.error('TempAuth Middleware: Error fetching user:', error);
        // Handle potential invalid ObjectId format errors
        if (error.name === 'CastError' && error.kind === 'ObjectId') {
             return res.status(400).json({ message: 'Bad Request: Invalid User ID format' });
        }
        // Send 500 for other unexpected errors during auth check
        res.status(500).json({ message: 'Server error during temporary authentication' });
    }
};

// Export the temporary middleware
module.exports = { tempAuth };
