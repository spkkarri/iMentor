// server/middleware/authMiddleware.js
const User = require('../models/User');

// TEMPORARY Authentication Middleware (INSECURE - for debugging only)
// Checks for 'X-User-ID' header and attaches user to req.user
const tempAuth = async (req, res, next) => {
    const userId = req.headers['x-user-id']; 

    if (!userId) {
        console.warn("TempAuth Middleware: Missing X-User-ID header.");
        return res.status(401).json({ message: 'Unauthorized: Missing User ID header' });
    }

    // ==================================================================
    //  START OF THE DEFINITIVE FIX: Special handling for the admin user
    // ==================================================================

    // If the user ID is our special admin string, bypass the database lookup.
    if (userId === 'admin-user') {
        console.log("TempAuth Middleware: Admin user detected. Bypassing DB lookup.");
        // Create a mock user object for the admin.
        // The most important part is setting the role correctly.
        req.user = {
            _id: 'admin-user',
            role: 'admin'
        };
        return next(); // Proceed to the next middleware or route handler
    }
    
    // ==================================================================
    //  END OF THE DEFINITIVE FIX
    // ==================================================================


    // If it's not the admin user, proceed with the normal database lookup.
    try {
        const user = await User.findById(userId).select('-password');

        if (!user) {
            console.warn(`TempAuth Middleware: User not found for ID: ${userId}`);
            return res.status(401).json({ message: 'Unauthorized: User not found' });
        }

        // Attach the real user object from the database to the request.
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

// Export the temporary middleware
module.exports = { tempAuth };