// server/routes/admin.js
// Routes for admin dashboard and user management

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const {
    requireAdmin,
    getAdminDashboard,
    getAllUsers,
    approveAdminAccess,
    denyAdminAccess,
    revokeAdminAccess,
    getUserDetails,
    updateUserConfig,
    getSystemStats
} = require('../controllers/adminController');

// All routes require authentication and admin privileges
router.use(tempAuth);
router.use(requireAdmin);

// Admin dashboard overview
router.get('/dashboard', getAdminDashboard);

// Get all users
router.get('/users', getAllUsers);

// Get specific user details
router.get('/users/:userId', getUserDetails);

// Update user configuration
router.put('/users/:userId', updateUserConfig);

// Approve admin access request
router.post('/users/:userId/approve', approveAdminAccess);

// Deny admin access request
router.post('/users/:userId/deny', denyAdminAccess);

// Revoke admin access
router.post('/users/:userId/revoke', revokeAdminAccess);

// Get system statistics
router.get('/stats', getSystemStats);

module.exports = router;
