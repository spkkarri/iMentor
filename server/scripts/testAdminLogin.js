// server/scripts/testAdminLogin.js
// Script to test admin login functionality

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function testAdminLogin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot');
        console.log('✅ Connected to MongoDB');
        
        // Find admin user
        const admin = await User.findOne({ username: 'admin@gmail.com' });
        
        if (!admin) {
            console.log('❌ Admin user not found');
            return;
        }
        
        console.log('✅ Admin user found:');
        console.log('- ID:', admin._id);
        console.log('- Username:', admin.username);
        console.log('- Email:', admin.email);
        console.log('- Password hash:', admin.password.substring(0, 20) + '...');
        
        // Test password comparison
        const testPassword = 'admin123';
        const isMatch = await bcrypt.compare(testPassword, admin.password);
        
        console.log('\n🔐 Password Test:');
        console.log('- Test password:', testPassword);
        console.log('- Password match:', isMatch ? '✅ SUCCESS' : '❌ FAILED');
        
        if (!isMatch) {
            console.log('\n🔧 Fixing password...');
            const newHashedPassword = await bcrypt.hash('admin123', 10);
            admin.password = newHashedPassword;
            await admin.save();
            
            // Test again
            const isMatchAfterFix = await bcrypt.compare('admin123', admin.password);
            console.log('- Password match after fix:', isMatchAfterFix ? '✅ SUCCESS' : '❌ STILL FAILED');
        }
        
        console.log('\n🎯 Login Test Summary:');
        console.log('- Username: admin@gmail.com');
        console.log('- Password: admin123');
        console.log('- Status:', isMatch ? '✅ READY TO LOGIN' : '❌ LOGIN WILL FAIL');
        
    } catch (error) {
        console.error('❌ Error testing admin login:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n📤 Disconnected from MongoDB');
        process.exit(0);
    }
}

testAdminLogin();
