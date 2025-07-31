// server/scripts/create-test-user.js
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function createTestUser() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/chatbot';
        console.log('Connecting to MongoDB:', mongoUri);
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Check if test user already exists
        const existingUser = await User.findOne({ username: 'testuser' });
        if (existingUser) {
            console.log('Test user already exists:');
            console.log('- ID:', existingUser._id);
            console.log('- Username:', existingUser.username);
            return existingUser;
        }

        // Create test user
        const testUser = new User({
            username: 'testuser',
            password: 'testpassword123' // Will be hashed automatically
        });

        await testUser.save();
        console.log('Test user created successfully:');
        console.log('- ID:', testUser._id);
        console.log('- Username:', testUser.username);
        console.log('\nYou can use this user ID in the training dashboard:');
        console.log('localStorage.setItem("userId", "' + testUser._id + '");');
        console.log('localStorage.setItem("username", "testuser");');

        return testUser;
    } catch (error) {
        console.error('Error creating test user:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the script
createTestUser();
