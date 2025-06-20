// server/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');
require('dotenv').config();

const router = express.Router();
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';

// --- @route   POST /api/auth/signup ---
router.post('/signup', async (req, res) => {
  // 1. Destructure all possible fields from the request body
  const { email, password, apiKey, ollamaUrl, preferredLlmProvider } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }
  if (password.length < 6) {
     return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  // 2. Validate provider-specific fields
  if (preferredLlmProvider === 'gemini' && (!apiKey || apiKey.trim() === '')) {
    return res.status(400).json({ message: 'A Gemini API Key is required when Gemini is selected.' });
  }
  if (preferredLlmProvider === 'ollama' && (!ollamaUrl || ollamaUrl.trim() === '')) {
    return res.status(400).json({ message: 'An Ollama URL is required when Ollama is selected.' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    // 3. Create a new user with conditional logic for credentials
    const newUser = new User({
      email,
      password, // Password will be hashed by the pre-save hook
      preferredLlmProvider: preferredLlmProvider || 'gemini',
      // Only save the credential that matches the chosen provider
      encryptedApiKey: (preferredLlmProvider === 'gemini') ? apiKey : null,
      ollamaUrl: (preferredLlmProvider === 'ollama') ? ollamaUrl.trim() : '',
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
    if (error.code === 11000 || error.message.includes('duplicate key error collection')) {
        return res.status(400).json({ message: 'An account with this email already exists.' });
    }
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return res.status(400).json({ message: messages.join(', ') });
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
    const ADMIN_EMAIL = process.env.FIXED_ADMIN_USERNAME || 'admin@admin.com';
    const ADMIN_PASSWORD = process.env.FIXED_ADMIN_PASSWORD || 'admin123';

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        console.log("Admin login successful via special auth check.");
        return res.status(200).json({
            isAdminLogin: true,
            message: 'Admin login successful',
        });
    }

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