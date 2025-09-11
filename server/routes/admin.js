// server/routes/admin.js
// Routes for admin dashboard and user management

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const { 
    rateLimiters, 
    securityLogger, 
    sanitizeInput,
    validateAdminAccess 
} = require('../middleware/securityMiddleware');
const { addClient } = require('../utils/activityEvents');
const { getActivityLogs, getActivitySummary } = require('../controllers/activityLogController');
const {
    requireAdmin,
    getAdminDashboard,
    getAllUsers,
    approveAdminAccess,
    denyAdminAccess,
    revokeAdminAccess,
    promoteUserToAdmin,
    demoteAdminUser,
    getUserDetails,
    updateUserConfig,
    getSystemStats,
    deleteUser
} = require('../controllers/adminController');

// Apply security middleware to all admin routes
router.use(rateLimiters.admin); // Rate limiting
router.use(securityLogger); // Security logging
router.use(sanitizeInput); // Input sanitization

// Authentication and authorization
router.use(tempAuth);
router.use(validateAdminAccess); // Enhanced admin validation
router.use(requireAdmin); // Legacy admin check for compatibility

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

// Promote user to full admin
router.post('/users/:userId/promote-admin', promoteUserToAdmin);

// Demote admin user to regular user
router.post('/users/:userId/demote-admin', demoteAdminUser);

// Delete user
router.delete('/users/:userId', deleteUser);

// Get system statistics
router.get('/stats', getSystemStats);

// Activity logs and analytics
router.get('/activity/logs', getActivityLogs);
router.get('/activity/summary', getActivitySummary);

// Activity real-time stream (SSE)
router.get('/activity/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();
    res.write('retry: 2000\n\n');
    addClient(res);
});

module.exports = router;
