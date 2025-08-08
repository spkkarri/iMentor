// server/scripts/setupAdmin.js
// Script to create admin user for the system

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const UserApiKeys = require('../models/UserApiKeys');

async function setupAdmin() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot');
        console.log('✅ Connected to MongoDB');

        // Check if admin user already exists
        const existingAdmin = await User.findOne({
            $or: [
                { email: 'admin@gmail.com' },
                { username: 'admin@gmail.com' }
            ]
        });
        
        let adminUser;

        if (existingAdmin) {
            console.log('ℹ️ Admin user already exists');

            // Update password if needed
            const hashedPassword = await bcrypt.hash('admin123', 10);
            existingAdmin.password = hashedPassword;
            await existingAdmin.save();
            console.log('✅ Admin password updated');

            adminUser = existingAdmin;
        } else {
            // Create admin user
            const hashedPassword = await bcrypt.hash('admin123', 10);

            adminUser = new User({
                username: 'admin@gmail.com',
                email: 'admin@gmail.com',
                password: hashedPassword
            });

            await adminUser.save();
            console.log('✅ Admin user created');
        }

        // Check if admin API keys configuration exists
        const existingAdminApiKeys = await UserApiKeys.findOne({ userId: adminUser._id });

        if (!existingAdminApiKeys) {
            // Create admin API keys configuration
            const adminApiKeys = new UserApiKeys({
                userId: adminUser._id,
                email: 'admin@gmail.com',
                useAdminKeys: true,
                adminAccessStatus: 'approved',
                adminAccessApprovedAt: new Date(),
                adminAccessApprovedBy: 'system',
                adminAccessReason: 'System administrator account',
                preferredService: 'admin'
            });

            await adminApiKeys.save();
            console.log('✅ Admin API keys configuration created');
        } else {
            console.log('ℹ️ Admin API keys configuration already exists');
        }

        console.log('\n🎉 Admin setup complete!');
        console.log('📧 Email: admin@gmail.com');
        console.log('🔑 Password: admin123');
        console.log('\n⚠️ Please change the admin password after first login!');
        
    } catch (error) {
        console.error('❌ Error setting up admin:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📤 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run the setup
setupAdmin();
