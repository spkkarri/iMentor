// // server/routes/admin.js
// const express = require('express');
// const { tempAuth } = require('../middleware/authMiddleware');
// const User = require('../models/User');
// const { sendEmail } = require('../services/emailService');

// const router = express.Router();

// // Middleware to ensure only an admin can access these routes
// const adminOnly = async (req, res, next) => {
//     try {
//         // We fetch the user from the DB to get their role, which is not in the token.
//         const user = await User.findById(req.user.id);
//         if (user && user.role === 'admin') {
//             next(); // User is an admin, proceed to the next handler
//         } else {
//             // User is not an admin, deny access.
//             return res.status(403).json({ message: 'Forbidden: Admin access required.' });
//         }
//     } catch (error) {
//         console.error("Admin check failed:", error);
//         res.status(500).json({ message: 'Server error during admin authorization.' });
//     }
// };
 
// /**
//  * @route   GET /api/admin/requests
//  * @desc    Admin fetches all users with pending API key requests.
//  * @access  Admin Only
//  */
// router.get('/requests', tempAuth, adminOnly, async (req, res) => {
//     try {
//         const pendingUsers = await User.find({ 'apiKeyAccessRequest.status': 'pending' })
//             .select('username email apiKeyAccessRequest.requestedAt') // Select fields to display
//             .sort({ 'apiKeyAccessRequest.requestedAt': 1 }); // Show oldest requests first

//         res.status(200).json(pendingUsers);
//     } catch (error) {
//         console.error('Error fetching API key requests:', error);
//         res.status(500).json({ message: 'Server error while fetching requests.' });
//     }
// });

// /**
//  * @route   POST /api/admin/approve
//  * @desc    Admin approves or denies an API key access request for a user.
//  * @access  Admin Only
//  */
// router.post('/approve', tempAuth, adminOnly, async (req, res) => {
//     // userId is the ID of the user being approved/denied.
//     // isApproved is a boolean from the admin's action.
//     const { userId, isApproved } = req.body;

//     if (!userId || typeof isApproved !== 'boolean') {
//         return res.status(400).json({ message: 'User ID and approval status are required.' });
//     }

//     try {
//         const userToUpdate = await User.findById(userId);
//         if (!userToUpdate) {
//             return res.status(404).json({ message: 'User not found.' });
//         }
        
//         // Update the user's request status based on the admin's action.
//         userToUpdate.apiKeyAccessRequest.status = isApproved ? 'approved' : 'denied';
//         userToUpdate.apiKeyAccessRequest.processedAt = Date.now();

//         await userToUpdate.save();

//         // Notify user via email if email exists
//         if (userToUpdate.email) {
//             const subject = `Your Admin Key Access Request Has Been ${isApproved ? 'Approved' : 'Denied'}`;
//             const text = isApproved
//                 ? `Congratulations, your request to use admin API keys has been approved. You now have access.`
//                 : `Sorry, your request to use admin API keys has been denied. Please contact the administrator for more information.`;
//             sendEmail(userToUpdate.email, subject, text).catch(console.error);
//         }

//         res.status(200).json({ 
//             message: `User access request has been successfully ${isApproved ? 'approved' : 'denied'}.`
//         });

//     } catch (error) {
//         console.error('Error processing access request:', error);
//         res.status(500).json({ message: 'Server error while processing request.' });
//     }
// });

// /**
//  * @route   GET /api/admin/accepted
//  * @desc    Admin fetches all users with approved API key requests.
//  * @access  Admin Only
//  */
// router.get('/accepted', tempAuth, adminOnly, async (req, res) => {
//     try {
//         const acceptedUsers = await User.find({ 'apiKeyAccessRequest.status': 'approved' })
//             .select('username email apiKeyAccessRequest.processedAt')
//             .sort({ 'apiKeyAccessRequest.processedAt': -1 }); // Most recently approved first
//         res.status(200).json(acceptedUsers);
//     } catch (error) {
//         console.error('Error fetching accepted users:', error);
//         res.status(500).json({ message: 'Server error while fetching accepted users.' });
//     }
// });

// module.exports = router;

// server/routes/admin.js
const express = require('express');
const { tempAuth } = require('../middleware/authMiddleware');
const User = require('../models/User');

const router = express.Router();

// Middleware to ensure only an admin can access these routes
const adminOnly = async (req, res, next) => {
    try {
        // We fetch the user from the DB to get their role, which is not in the token.
        const user = await User.findById(req.user.id);
        if (user && user.role === 'admin') {
            next(); // User is an admin, proceed to the next handler
        } else {
            // User is not an admin, deny access.
            return res.status(403).json({ message: 'Forbidden: Admin access required.' });
        }
    } catch (error) {
        console.error("Admin check failed:", error);
        res.status(500).json({ message: 'Server error during admin authorization.' });
    }
};

/**
 * @route   GET /api/admin/requests
 * @desc    Admin fetches all users with pending API key requests.
 * @access  Admin Only
 */
router.get('/requests', tempAuth, adminOnly, async (req, res) => {
    try {
        const pendingUsers = await User.find({ 'apiKeyAccessRequest.status': 'pending' })
            .select('username email apiKeyAccessRequest.requestedAt') // Select fields to display
            .sort({ 'apiKeyAccessRequest.requestedAt': 1 }); // Show oldest requests first

        res.status(200).json(pendingUsers);
    } catch (error) {
        console.error('Error fetching API key requests:', error);
        res.status(500).json({ message: 'Server error while fetching requests.' });
    }
});

/**
 * @route   POST /api/admin/approve
 * @desc    Admin approves or denies an API key access request for a user.
 * @access  Admin Only
 */
router.post('/approve', tempAuth, adminOnly, async (req, res) => {
    // userId is the ID of the user being approved/denied.
    // isApproved is a boolean from the admin's action.
    const { userId, isApproved } = req.body;

    if (!userId || typeof isApproved !== 'boolean') {
        return res.status(400).json({ message: 'User ID and approval status are required.' });
    }

    try {
        const userToUpdate = await User.findById(userId);
        if (!userToUpdate) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        // Update the user's request status based on the admin's action.
        userToUpdate.apiKeyAccessRequest.status = isApproved ? 'approved' : 'denied';
        userToUpdate.apiKeyAccessRequest.processedAt = Date.now();

        await userToUpdate.save();

        res.status(200).json({ 
            message: `User access request has been successfully ${isApproved ? 'approved' : 'denied'}.`
        });

    } catch (error) {
        console.error('Error processing access request:', error);
        res.status(500).json({ message: 'Server error while processing request.' });
    }
});

/**
 * @route   GET /api/admin/accepted
 * @desc    Admin fetches all users with approved API key requests.
 * @access  Admin Only
 */
router.get('/accepted', tempAuth, adminOnly, async (req, res) => {
    try {
        const acceptedUsers = await User.find({ 'apiKeyAccessRequest.status': 'approved' })
            .select('username email apiKeyAccessRequest.processedAt')
            .sort({ 'apiKeyAccessRequest.processedAt': -1 }); // Most recently approved first
        res.status(200).json(acceptedUsers);
    } catch (error) {
        console.error('Error fetching accepted users:', error);
        res.status(500).json({ message: 'Server error while fetching accepted users.' });
    }
});

module.exports = router;