// server/scripts/fixAdmin.js
// Script to fix admin user email field

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const UserApiKeys = require('../models/UserApiKeys');

async function fixAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot');
        console.log('✅ Connected to MongoDB');
        
        // Find admin by username
        const admin = await User.findOne({ username: 'admin@gmail.com' });
        
        if (admin) {
            console.log('✅ Found admin user, updating email field...');
            
            // Update the email field
            admin.email = 'admin@gmail.com';
            
            // Also update password to make sure it's correct
            const hashedPassword = await bcrypt.hash('admin123', 10);
            admin.password = hashedPassword;
            
            await admin.save();
            console.log('✅ Admin user updated successfully');
            
            // Verify the update
            const updatedAdmin = await User.findOne({ email: 'admin@gmail.com' });
            if (updatedAdmin) {
                console.log('✅ Verification successful:');
                console.log('- ID:', updatedAdmin._id);
                console.log('- Username:', updatedAdmin.username);
                console.log('- Email:', updatedAdmin.email);
                console.log('- Password hash length:', updatedAdmin.password.length);
            }
            
        } else {
            console.log('❌ Admin user not found, creating new one...');
            
            const hashedPassword = await bcrypt.hash('admin123', 10);
            
            const newAdmin = new User({
                username: 'admin@gmail.com',
                email: 'admin@gmail.com',
                password: hashedPassword
            });
            
            await newAdmin.save();
            console.log('✅ New admin user created');
        }
        
        console.log('\n🎉 Admin fix complete!');
        console.log('📧 Email: admin@gmail.com');
        console.log('🔑 Password: admin123');
        
    } catch (error) {
        console.error('❌ Error fixing admin:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📤 Disconnected from MongoDB');
        process.exit(0);
    }
}

fixAdmin();
