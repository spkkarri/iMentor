// Update user configuration with new API key
require('dotenv').config();
const mongoose = require('mongoose');
const UserApiKeys = require('./models/UserApiKeys');

async function updateNewKey() {
    try {
        await mongoose.connect('mongodb://localhost:27017/chatbotGeminiDB4');
        console.log('✅ Connected to MongoDB');

        const userId = '687ce8ce0be42bc58d2b2a46';
        const newApiKey = process.env.GEMINI_API_KEY;
        
        console.log('🔑 New API Key:', newApiKey ? newApiKey.substring(0, 15) + '...' : 'NOT SET');
        
        if (!newApiKey) {
            console.log('❌ Please update the .env file with your new API key first');
            return;
        }

        const userApiKeys = await UserApiKeys.findOne({ userId }).select('+geminiApiKey');
        
        if (!userApiKeys) {
            console.log('❌ User not found');
            return;
        }

        // Update with new API key
        userApiKeys.geminiApiKey = newApiKey;
        userApiKeys.preferredService = 'gemini';
        userApiKeys.useAdminKeys = false;
        userApiKeys.geminiKeyValid = true;
        userApiKeys.updatedAt = new Date();
        
        await userApiKeys.save();
        
        console.log('✅ Updated user configuration with new API key');
        console.log('- Preferred Service: gemini');
        console.log('- Use Admin Keys: false');
        console.log('- API Key updated: ✅');
        
        console.log('\n🚀 Next steps:');
        console.log('1. Restart the server (Ctrl+C then node server.js)');
        console.log('2. Try sending a message in the chat');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

updateNewKey();
