// server/routes/admin/index.js
const express = require('express');
const router = express.Router();

// Import the individual route modules for different admin functionalities
const adminCoreRoutes = require('./admin'); // This is the original admin.js with stats, user management, etc.
const datasetRoutes = require('./datasetRoutes'); // The new dataset management routes

// Use the imported routers
// The path here is relative to the mount point in server.js, which will be '/api/admin'
router.use('/', adminCoreRoutes); // Mounts routes from admin.js at the base ('/api/admin')
router.use('/datasets', datasetRoutes); // Mounts dataset routes under '/api/admin/datasets'

module.exports = router;