// server/routes/admin.js
// Routes for admin dashboard and user management

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const { addClient } = require('../utils/activityEvents');
const { getActivityLogs, getActivitySummary } = require('../controllers/activityLogController');
const {
    requireAdmin,
    getAdminDashboard,
    getAllUsers,
    approveAdminAccess,
    denyAdminAccess,
    revokeAdminAccess,
    getUserDetails,
    updateUserConfig,
    getSystemStats,
    deleteUser
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
