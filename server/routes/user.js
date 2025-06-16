// server/routes/user.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Note: The main 'authMiddleware' will be applied in server.js before this router is used,
// so we don't need to add it to each route here. req.user will be available.

// @route   GET /api/user/profile
// @desc    Get the current user's profile data
// @access  Private
router.get('/profile', async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('profile');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        // Return the profile object, or an empty object if it doesn't exist
        res.json(user.profile || {});
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Server error while fetching profile.' });
    }
});

// @route   PUT /api/user/profile
// @desc    Update the current user's profile data
// @access  Private
router.put('/profile', async (req, res) => {
    const { name, college, universityNumber, degreeType, branch, year } = req.body;

    // Basic backend validation
    if (!name || !college || !universityNumber || !degreeType || !branch || !year) {
        return res.status(400).json({ message: 'All profile fields are required.' });
    }

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Update the profile sub-document
        user.profile = {
            name,
            college,
            universityNumber,
            degreeType,
            branch,
            year
        };

        await user.save();

        res.json({
            message: 'Profile updated successfully!',
            profile: user.profile
        });

    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server error while updating profile.' });
    }
});

module.exports = router;