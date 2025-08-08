// server/routes/auth.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// @route   POST /api/auth/signup
// @desc    Register a new user with username and password
// @access  Public
router.post('/signup', async (req, res) => {
    // Updated to include Ollama URL and API keys configuration
    const {
        username,
        password,
        ollamaUrl,
        geminiApiKey,
        deepseekApiKey,
        qwenApiKey,
        useOwnKeys
    } = req.body;

    // --- Validation for username and password ---
    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide a username and password.' });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    // --- Validate Ollama URL if provided ---
    if (ollamaUrl && ollamaUrl.trim()) {
        try {
            new URL(ollamaUrl);
        } catch (error) {
            return res.status(400).json({
                message: 'Please provide a valid Ollama URL (e.g., http://localhost:11434 or http://your-server:11434)'
            });
        }
    }

    try {
        // Check if username already exists
        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ message: 'Username is already taken.' });
        }

        // Create a new user. The password will be hashed automatically by the
        // pre-save hook we added to the User model.
        const userData = {
            username,
            password,
            ollamaUrl: ollamaUrl && ollamaUrl.trim() ? ollamaUrl.trim() : 'http://localhost:11434',
            apiKeys: {
                gemini: geminiApiKey && geminiApiKey.trim() ? geminiApiKey.trim() : '',
                deepseek: deepseekApiKey && deepseekApiKey.trim() ? deepseekApiKey.trim() : '',
                qwen: qwenApiKey && qwenApiKey.trim() ? qwenApiKey.trim() : ''
            },
            useOwnKeys: useOwnKeys || false
        };
        user = new User(userData);
        await user.save();

        // Create JWT
        const payload = { user: { id: user.id } };
        if (!process.env.JWT_SECRET) {
            console.error('FATAL ERROR: JWT_SECRET is not defined in your environment.');
            return res.status(500).send('Server configuration error.');
        }
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5d' }, (err, token) => {
            if (err) throw err;
            res.status(201).json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    ollamaUrl: user.ollamaUrl,
                    useOwnKeys: user.useOwnKeys,
                    hasApiKeys: {
                        gemini: !!(user.apiKeys?.gemini),
                        deepseek: !!(user.apiKeys?.deepseek),
                        qwen: !!(user.apiKeys?.qwen)
                    }
                }
            });
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET /api/auth/me
// @desc    Get current user info from token
// @access  Private
router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        // Always return both id and _id for frontend compatibility
        res.json({ user: { ...user.toObject(), id: user._id } });
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token is not valid' });
        }
        console.error('Unexpected error in /me:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// @route   POST /api/auth/signin
// @desc    Authenticate user with username and password & get token
// @access  Public
router.post('/signin', async (req, res) => {
    const { username, password } = req.body;

    console.log(`[Auth] Sign-in attempt for username: ${username}, received body: ${JSON.stringify(req.body)}`);

    if (!username || !password) {
        console.log('[Auth] Missing username or password.');
        return res.status(400).json({ message: 'Please provide a username and password.' });
    }

    try {
        // Find user by username
        let user = await User.findOne({ username });
        console.log(`[Auth] User found: ${user ? user.username : 'None'}`);
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`[Auth] Password comparison result: ${isMatch}`);
        if (!isMatch) {
            console.log(`[Auth] Invalid password for user: ${username}`);
            return res.status(400).json({ message: 'Invalid credentials.' });
        }

        // Create JWT
        const payload = { user: { id: user.id } };
        console.log(`[Auth] JWT_SECRET defined: ${!!process.env.JWT_SECRET}`);
        if (!process.env.JWT_SECRET) {
            console.error('FATAL ERROR: JWT_SECRET is not defined in your environment.');
            return res.status(500).send('Server configuration error.');
        }
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5d' }, (err, token) => {
            if (err) {
                console.error('[Auth] JWT Sign Error:', err.message, 'for user:', username);
                throw err;
            }
            console.log('[Auth] Sign-in successful, JWT generated for user:', username);
            res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    isAdmin: user.username === 'admin@gmail.com' || user.email === 'admin@gmail.com'
                }
            });
        });
    } catch (err) {
        console.error(`[Auth] Server error during sign-in for ${username}:`, err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;