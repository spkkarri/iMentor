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

// Request admin access
router.post('/request-admin-access', requestAdminAccess);

module.exports = router;
