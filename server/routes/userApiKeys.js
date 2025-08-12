// server/routes/userApiKeys.js
// Routes for user API key management

const express = require('express');
const router = express.Router();
const { tempAuth } = require('../middleware/authMiddleware');
const {
    getUserApiKeys,
    updateUserApiKeys,
    testUserServices,
    requestAdminAccess
} = require('../controllers/userApiKeysController');

// All routes require authentication
router.use(tempAuth);

// Get user's API key configuration
router.get('/', getUserApiKeys);

// Update user's API key configuration
router.put('/', updateUserApiKeys);

// Test user's service configuration
router.post('/test', testUserServices);

// Clear user service cache (force refresh)
router.post('/clear-cache', async (req, res) => {
    try {
        const userId = req.user.id;

        // Clear all service caches for this user
        if (req.serviceManager && req.serviceManager.clearUserCache) {
            req.serviceManager.clearUserCache(userId);
        }

        const userSpecificAI = require('../services/userSpecificAI');
        if (userSpecificAI && userSpecificAI.clearUserServices) {
            userSpecificAI.clearUserServices(userId);
        }

        const userAwareServiceFactory = require('../services/userAwareServiceFactory');
        if (userAwareServiceFactory && userAwareServiceFactory.clearUserCache) {
            userAwareServiceFactory.clearUserCache(userId);
        }

        console.log(`🔄 Manual cache clear requested for user ${userId}`);

        res.json({
            message: 'Service cache cleared successfully',
            userId: userId,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error clearing user cache:', error);
        res.status(500).json({ message: 'Failed to clear cache' });
    }
});

// Request admin access
router.post('/request-admin-access', requestAdminAccess);

module.exports = router;
