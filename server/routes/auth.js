// server/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');
require('dotenv').config();

const router = express.Router();
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1h';

// --- @route   POST /api/auth/signup ---
router.post('/signup', async (req, res) => {
  const { email, password, apiKey, preferredLlmProvider } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  if (preferredLlmProvider === 'gemini' && !apiKey) {
    return res.status(400).json({ message: 'Gemini API Key is required when Gemini is selected.' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const newUser = new User({
      email,
      password,
      preferredLlmProvider: preferredLlmProvider || 'gemini',
      encryptedApiKey: apiKey,
    });
    await newUser.save();

    const payload = { userId: newUser._id, email: newUser.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRATION });

    res.status(201).json({
      token,
      _id: newUser._id,
      email: newUser.email,
      sessionId: uuidv4(),
      message: 'User registered successfully',
    });
  } catch (error) {
    console.error('Signup Error:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error during signup.' });
  }
});

// --- @route   POST /api/auth/signin ---
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password.' });
  }

  try {
    // Get the admin credentials from the server's environment variables
    const ADMIN_EMAIL = process.env.FIXED_ADMIN_USERNAME || 'admin@admin.com';
    const ADMIN_PASSWORD = process.env.FIXED_ADMIN_PASSWORD || 'admin123';

    // --- THIS IS THE FIX ---
    // Special check for the admin user BEFORE hitting the database
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        console.log("Admin login successful via special auth check.");
        // The frontend will use this flag to set the admin session state.
        // No JWT is needed for this type of frontend-only admin session management.
        return res.status(200).json({
            isAdminLogin: true, // A flag for the frontend to recognize
            message: 'Admin login successful',
        });
    }
    // --- END OF FIX ---

    // If it's not the admin, proceed with the regular user database lookup
    const user = await User.findByCredentials(email, password);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email address or password.' });
    }

    const payload = { userId: user._id, email: user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRATION });

    res.status(200).json({
      token,
      _id: user._id,
      email: user.email,
      sessionId: uuidv4(),
      message: 'Login successful',
    });
  } catch (error) {
    console.error('Signin Error:', error);
    res.status(500).json({ message: 'Server error during signin.' });
  }
});

// --- @route   GET /api/auth/me ---
router.get('/me', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized.' });
  }
  res.status(200).json({
    _id: req.user._id,
    email: req.user.email,
  });
});

module.exports = router;