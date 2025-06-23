// // server/routes/auth.js
// const express = require('express');
// const { v4: uuidv4 } = require('uuid');
// const User = require('../models/User');
// const { tempAuth } = require('../middleware/authMiddleware');
// const { sendEmail } = require('../services/emailService');
// require('dotenv').config();

// const router = express.Router();

// // --- @route   POST /api/auth/signup ---
// router.post('/signup', async (req, res) => {
//     const { username, password, email } = req.body;
//     if (!username || !password || !email) { return res.status(400).json({ message: 'Please provide username, password, and email' }); }
//     if (password.length < 6) { return res.status(400).json({ message: 'Password must be at least 6 characters long' }); }
//     try {
//         const existingUser = await User.findOne({ username });
//         if (existingUser) { return res.status(400).json({ message: 'Username already exists' }); }
//         const existingEmail = await User.findOne({ email });
//         if (existingEmail) { return res.status(400).json({ message: 'Email already exists' }); }
//         // Prevent users from signing up with the admin's username
//         if (process.env.ADMIN_USERNAME && username === process.env.ADMIN_USERNAME) {
//             return res.status(400).json({ message: 'This username is reserved.' });
//         }
//         const newUser = new User({ username, password, email });
//         await newUser.save();
//         const sessionId = uuidv4(); 
//         res.status(201).json({
//             _id: newUser._id,
//             username: newUser.username,
//             sessionId: sessionId,
//             message: 'User registered successfully',
//         });
//     } catch (error) {
//         console.error('Signup Error:', error);
//         if (error.code === 11000) { return res.status(400).json({ message: 'Username or email already exists.' }); }
//         res.status(500).json({ message: 'Server error during signup' });
//     }
// });


// // --- @route   POST /api/auth/signin (SIMPLIFIED) ---
// router.post('/signin', async (req, res) => {
//     const { username, password } = req.body;
//     if (!username || !password) { return res.status(400).json({ message: 'Please provide username and password' }); }

//     try {
//         // ==================================================================
//         //  START OF THE DEFINITIVE FIX: Simplified Login Logic
//         // ==================================================================

//         // The logic is now universal. It finds any user (admin or regular) by their credentials.
//         // The User.findByCredentials method handles password comparison.
//         console.log(`>>> Attempting login for: ${username}`);
//         const user = await User.findByCredentials(username, password);

//         // If no user is found (or password doesn't match), return an error.
//         if (!user) { 
//             return res.status(401).json({ message: 'Invalid credentials' });
//         }

//         const sessionId = uuidv4();
        
//         // The backend determines if the API key prompt is necessary for this user.
//         const needsApiKeyPrompt = !user.hasProvidedApiKeys && user.apiKeyAccessRequest.status === 'none';

//         // The response now includes the role directly from the database record.
//         res.status(200).json({
//             _id: user._id, // This is now always a real MongoDB ObjectId
//             username: user.username,
//             sessionId: sessionId,
//             needsApiKeyPrompt: needsApiKeyPrompt,
//             role: user.role,
//             message: 'Login successful',
//         });

//         // ==================================================================
//         //  END OF THE DEFINITIVE FIX
//         // ==================================================================

//     } catch (error) {
//         console.error('Signin Error:', error);
//         res.status(500).json({ message: 'Server error during signin' });
//     }
// });


// // --- @route   POST /api/auth/request-access ---
// router.post('/request-access', tempAuth, async (req, res) => {
//     const userId = req.user.id; 
//     try {
//         const user = await User.findById(userId);
//         if (!user) { return res.status(404).json({ message: 'User not found.' }); }
//         user.apiKeyAccessRequest.status = 'pending';
//         user.apiKeyAccessRequest.requestedAt = Date.now();
//         user.hasProvidedApiKeys = true; 
//         await user.save();

//         // Notify admin via email
//         if (process.env.ADMIN_NOTIFY_EMAIL) {
//             const subject = `Admin Key Access Request from ${user.username}`;
//             const text = `User ${user.username} has requested access to admin API keys.\n\nLogin to the admin panel to approve or deny this request.`;
//             sendEmail(process.env.ADMIN_NOTIFY_EMAIL, subject, text).catch(console.error);
//         }

//         res.status(200).json({ message: 'Your request for API key access has been sent to the administrator.' });
//     } catch (error) {
//         console.error('Error during API key access request:', error);
//         res.status(500).json({ message: 'Server error while submitting your request.' });
//     }
// });

// module.exports = router;

// server/routes/auth.js
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { tempAuth } = require('../middleware/authMiddleware');
require('dotenv').config();

const router = express.Router();

// --- @route   POST /api/auth/signup ---
router.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) { return res.status(400).json({ message: 'Please provide username and password' }); }
    if (password.length < 6) { return res.status(400).json({ message: 'Password must be at least 6 characters long' }); }
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) { return res.status(400).json({ message: 'Username already exists' }); }
        
        // Prevent users from signing up with the admin's username
        if (process.env.ADMIN_USERNAME && username === process.env.ADMIN_USERNAME) {
            return res.status(400).json({ message: 'This username is reserved.' });
        }

        const newUser = new User({ username, password });
        await newUser.save();
        const sessionId = uuidv4();
        res.status(201).json({
            _id: newUser._id,
            username: newUser.username,
            sessionId: sessionId,
            message: 'User registered successfully',
        });
    } catch (error) {
        console.error('Signup Error:', error);
        if (error.code === 11000) { return res.status(400).json({ message: 'Username already exists.' }); }
        res.status(500).json({ message: 'Server error during signup' });
    }
});


// --- @route   POST /api/auth/signin (SIMPLIFIED) ---
router.post('/signin', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) { return res.status(400).json({ message: 'Please provide username and password' }); }

    try {
        // ==================================================================
        //  START OF THE DEFINITIVE FIX: Simplified Login Logic
        // ==================================================================

        // The logic is now universal. It finds any user (admin or regular) by their credentials.
        // The User.findByCredentials method handles password comparison.
        console.log(`>>> Attempting login for: ${username}`);
        const user = await User.findByCredentials(username, password);

        // If no user is found (or password doesn't match), return an error.
        if (!user) { 
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const sessionId = uuidv4();
        
        // The backend determines if the API key prompt is necessary for this user.
        const needsApiKeyPrompt = !user.hasProvidedApiKeys && user.apiKeyAccessRequest.status === 'none';

        // The response now includes the role directly from the database record.
        res.status(200).json({
            _id: user._id, // This is now always a real MongoDB ObjectId
            username: user.username,
            sessionId: sessionId,
            needsApiKeyPrompt: needsApiKeyPrompt,
            role: user.role,
            message: 'Login successful',
        });

        // ==================================================================
        //  END OF THE DEFINITIVE FIX
        // ==================================================================

    } catch (error) {
        console.error('Signin Error:', error);
        res.status(500).json({ message: 'Server error during signin' });
    }
});


// --- @route   POST /api/auth/request-access ---
router.post('/request-access', tempAuth, async (req, res) => {
    const userId = req.user.id; 
    try {
        const user = await User.findById(userId);
        if (!user) { return res.status(404).json({ message: 'User not found.' }); }
        user.apiKeyAccessRequest.status = 'pending';
        user.apiKeyAccessRequest.requestedAt = Date.now();
        user.hasProvidedApiKeys = true; 
        await user.save();
        res.status(200).json({ message: 'Your request for API key access has been sent to the administrator.' });
    } catch (error) {
        console.error('Error during API key access request:', error);
        res.status(500).json({ message: 'Server error while submitting your request.' });
    }
});

module.exports = router;