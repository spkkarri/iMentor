// server/routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');
const { auditLog } = require('../utils/logger');
require('dotenv').config();

const router = express.Router();
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';

router.post('/signup', async (req, res) => {
  const {
    email, password, apiKey, ollamaUrl, preferredLlmProvider, requestAdminKey,
    name, college, universityNumber, degreeType, branch, year,
    learningStyle, currentGoals
  } = req.body;

  if (!email || !password || !name || !college || !universityNumber || !degreeType || !branch || !year || !learningStyle) {
    return res.status(400).json({ message: 'All required profile fields must be completed to sign up.' });
  }
  if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }
  if (preferredLlmProvider === 'gemini' && !requestAdminKey && (!apiKey || apiKey.trim() === '')) {
    return res.status(400).json({ message: 'A Gemini API Key is required unless you request one from the admin.' });
  }
  if (preferredLlmProvider === 'ollama' && (!ollamaUrl || ollamaUrl.trim() === '')) {
    return res.status(400).json({ message: 'An Ollama URL is required when Ollama is selected.' });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const newUser = new User({
      email,
      username: email.split('@')[0] + uuidv4().substring(0, 4),
      password,
      preferredLlmProvider: preferredLlmProvider || 'gemini',
      apiKeyRequestStatus: requestAdminKey ? 'pending' : 'none',
      encryptedApiKey: requestAdminKey ? null : (preferredLlmProvider === 'gemini' ? apiKey : null),
      ollamaUrl: (preferredLlmProvider === 'ollama') ? ollamaUrl.trim() : '',
      profile: {
        name, college, universityNumber, degreeType, branch, year,
        learningStyle, currentGoals: currentGoals || ''
      },
      hasCompletedOnboarding: false
    });

    await newUser.save();

  // --- ADDED AUDIT LOG ---
  // We pass `req` so the logger can get IP, but also manually add user info
  // because `req.user` isn't set until a user is logged in.
  auditLog(req, 'USER_SIGNUP_SUCCESS', { 
      email: newUser.email, 
      userId: newUser._id.toString() 
  });
  // --- END ---

  const payload = {
    userId: newUser._id,
    email: newUser.email,
    username: newUser.username,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRATION });

    res.status(201).json({
      token,
      _id: newUser._id,
      email: newUser.email,
      username: newUser.username,
      hasCompletedOnboarding: newUser.hasCompletedOnboarding,
      isNewUser: true,
      message: "User registered successfully",
    });

  } catch (error) {
    console.error('Signup Error:', error);
    if (error.code === 11000) {
        return res.status(400).json({ message: 'An account with this email or username already exists.' });
    }
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return res.status(400).json({ message: messages.join(', ') });
    }
    res.status(500).json({ message: 'Server error during signup.' });
  }
});

router.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password.' });
  }

  try {
      const ADMIN_EMAIL = process.env.FIXED_ADMIN_USERNAME || 'admin@admin.com';
      const ADMIN_PASSWORD = process.env.FIXED_ADMIN_PASSWORD || 'admin123';

      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
          // --- THIS IS THE NEW, CORRECT LOCATION FOR THE ADMIN LOGIN LOG ---
          auditLog(req, 'ADMIN_LOGIN_SUCCESS', { username: email });
          // --- END ---
          
          console.log("Admin login successful via special auth check.");
          return res.status(200).json({
              isAdminLogin: true,
              message: 'Admin login successful',
          });
      }

      const user = await User.findByCredentials(email, password);
      if (!user) {
          auditLog(req, 'USER_LOGIN_FAILURE', { email: email, reason: 'Invalid credentials' });
          return res.status(401).json({ message: 'Invalid email address or password.' });
      }

      req.user = user; 
      auditLog(req, 'USER_LOGIN_SUCCESS', { email: user.email });

      const payload = { userId: user._id, email: user.email };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRATION });

    res.status(200).json({
      token,
      _id: user._id,
      email: user.email,
      username: user.username,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      message: "Login successful",
    });
  } catch (error) {
      console.error('Signin Error:', error);
      res.status(500).json({ message: 'Server error during signin.' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized.' });
  }
  res.status(200).json({
    _id: req.user._id,
    email: req.user.email,
    username: req.user.username,
    hasCompletedOnboarding: req.user.hasCompletedOnboarding
  });
});

router.post('/complete-onboarding', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        user.hasCompletedOnboarding = true;
        await user.save();
        res.status(200).json({ message: 'Onboarding marked as complete.' });
    } catch (error) {
        console.error('Error completing onboarding:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;