#!/usr/bin/env node
// server/scripts/promoteUser.js
// Utility script to manually promote a user to admin (emergency use)

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const AdminSetup = require('../utils/adminSetup');

async function promoteUser() {
    if (process.argv.length < 3) {
        console.log('\n📋 Usage: node promoteUser.js <email-or-username>');
        console.log('Example: node promoteUser.js user@example.com');
        console.log('Example: node promoteUser.js username123\n');
        process.exit(1);
    }

    const userIdentifier = process.argv[2];

    try {
        console.log('\n🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/chatbot');
        console.log('✅ Connected to MongoDB');

        const adminSetup = new AdminSetup();
        const promotedUser = await adminSetup.promoteUserToAdmin(userIdentifier);

        console.log('\n🎉 User promotion completed successfully!');
        console.log(`📧 User: ${promotedUser.email || promotedUser.username}`);
        console.log(`🆔 ID: ${promotedUser._id}`);
        console.log(`👑 Admin Status: ${promotedUser.isAdmin}`);

        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB\n');

    } catch (error) {
        console.error('\n❌ Failed to promote user:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    promoteUser();
}

module.exports = promoteUser;
