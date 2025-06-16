// server/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

const authMiddleware = async (req, res, next) => {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        console.warn("Auth Middleware: No Authorization header found.");
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        console.warn("Auth Middleware: Token format is 'Bearer <token>', received:", authHeader);
        return res.status(401).json({ message: 'Token format is invalid' });
    }

    const token = parts[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            console.warn(`Auth Middleware: User not found for ID: ${decoded.userId} from token.`);
            return res.status(401).json({ message: 'User not found, token invalid' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.warn("Auth Middleware: Token verification failed:", error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token is not valid' });
        }
        res.status(401).json({ message: 'Not authorized, token verification failed' });
    }
};

module.exports = { authMiddleware }; // ONLY export this