// server/scripts/checkUsers.js
// Script to check all users in the database

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const UserApiKeys = require('../models/UserApiKeys');

async function checkAllUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot');
        console.log('✅ Connected to MongoDB');
        
        const allUsers = await User.find({});
        console.log('📊 Total users in database:', allUsers.length);
        
        if (allUsers.length === 0) {
            console.log('❌ No users found in database');
        } else {
            allUsers.forEach((user, index) => {
                console.log(`${index + 1}. ID: ${user._id}`);
                console.log(`   Username: ${user.username}`);
                console.log(`   Email: ${user.email}`);
                console.log(`   Password: ${user.password ? 'Present' : 'Missing'}`);
                console.log('---');
            });
        }
        
        // Specifically look for admin
        const adminByEmail = await User.findOne({ email: 'admin@gmail.com' });
        const adminByUsername = await User.findOne({ username: 'admin@gmail.com' });
        
        console.log('🔍 Admin search results:');
        console.log('By email:', adminByEmail ? 'Found' : 'Not found');
        console.log('By username:', adminByUsername ? 'Found' : 'Not found');
        
        if (adminByEmail) {
            console.log('✅ Admin user details:');
            console.log('- ID:', adminByEmail._id);
            console.log('- Username:', adminByEmail.username);
            console.log('- Email:', adminByEmail.email);
            console.log('- Password hash length:', adminByEmail.password ? adminByEmail.password.length : 0);
        }
        
        // Check UserApiKeys collection
        const apiKeysCount = await UserApiKeys.countDocuments();
        console.log('📊 Total API key configurations:', apiKeysCount);
        
        await mongoose.disconnect();
        console.log('📤 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    process.exit(0);
}

checkAllUsers();
