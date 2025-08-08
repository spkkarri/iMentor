// server/scripts/fixAdminPassword.js
// Script to properly fix admin password without double hashing

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function fixAdminPassword() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot');
        console.log('✅ Connected to MongoDB');
        
        // Find admin user
        const admin = await User.findOne({ username: 'admin@gmail.com' });
        
        if (!admin) {
            console.log('❌ Admin user not found');
            return;
        }
        
        console.log('✅ Admin user found, fixing password...');
        
        // Set the plain text password - the pre-save hook will hash it
        admin.password = 'admin123';
        
        // Save the user - this will trigger the pre-save hook to hash the password
        await admin.save();
        
        console.log('✅ Password updated');
        
        // Test the password
        const updatedAdmin = await User.findOne({ username: 'admin@gmail.com' });
        const isMatch = await bcrypt.compare('admin123', updatedAdmin.password);
        
        console.log('\n🔐 Password Test:');
        console.log('- Test password: admin123');
        console.log('- Password match:', isMatch ? '✅ SUCCESS' : '❌ FAILED');
        console.log('- New password hash:', updatedAdmin.password.substring(0, 20) + '...');
        
        if (isMatch) {
            console.log('\n🎉 Admin login is now working!');
            console.log('📧 Username: admin@gmail.com');
            console.log('🔑 Password: admin123');
        } else {
            console.log('\n❌ Password fix failed');
        }
        
    } catch (error) {
        console.error('❌ Error fixing admin password:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📤 Disconnected from MongoDB');
        process.exit(0);
    }
}

fixAdminPassword();
