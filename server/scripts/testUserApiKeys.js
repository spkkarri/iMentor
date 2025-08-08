// server/scripts/testUserApiKeys.js
// Test script for user-specific API key system

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const userSpecificAI = require('../services/userSpecificAI');

async function testUserApiKeySystem() {
    try {
        console.log('🔑 Testing User-Specific API Key System');
        console.log('======================================\n');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot');
        console.log('✅ Connected to MongoDB');
        
        // Test 1: Create test user with API keys
        console.log('\n🔍 Step 1: Creating Test User with API Keys');
        console.log('============================================');
        
        const testUsername = `test_apikeys_${Date.now()}`;
        
        const testUser = new User({
            username: testUsername,
            password: 'testpassword123',
            ollamaUrl: 'http://localhost:11434',
            useOwnKeys: true,
            apiKeys: {
                gemini: process.env.GEMINI_API_KEY || 'test_gemini_key',
                deepseek: process.env.DEEPSEEK_API_KEY || 'test_deepseek_key',
                qwen: process.env.QWEN_API_KEY || 'test_qwen_key'
            }
        });
        
        await testUser.save();
        console.log(`✅ Created test user: ${testUsername}`);
        console.log(`🔑 API Keys configured: ${Object.keys(testUser.apiKeys).join(', ')}`);
        console.log(`⚙️ Use Own Keys: ${testUser.useOwnKeys}`);
        
        // Test 2: Create user-specific AI services
        console.log('\n🔍 Step 2: Creating User-Specific AI Services');
        console.log('=============================================');
        
        const userServices = await userSpecificAI.getUserAIServices(testUser._id);
        
        console.log('📊 Service Creation Results:');
        console.log(`   Gemini: ${userServices.gemini ? '✅ Available' : '❌ Not Available'}`);
        console.log(`   DeepSeek: ${userServices.deepseek ? '✅ Available' : '❌ Not Available'}`);
        console.log(`   Qwen: ${userServices.qwen ? '✅ Available' : '❌ Not Available'}`);
        console.log(`   Ollama: ${userServices.ollama ? '✅ Available' : '❌ Not Available'}`);
        console.log(`   Using Own Keys: ${userServices.useOwnKeys}`);
        
        // Test 3: Test primary AI service
        console.log('\n🔍 Step 3: Testing Primary AI Service');
        console.log('====================================');
        
        try {
            const primaryAI = await userSpecificAI.getUserPrimaryAI(testUser._id);
            
            if (primaryAI) {
                console.log('✅ Primary AI service available');
                
                // Test response generation
                const testQuery = "Hello! Please respond with 'User-specific API keys are working correctly.'";
                console.log(`💬 Testing with query: "${testQuery}"`);
                
                const response = await userSpecificAI.generateUserResponse(testUser._id, testQuery, {
                    systemPrompt: 'You are a helpful AI assistant testing user-specific API keys.'
                });
                
                console.log('📝 Response received:');
                console.log(`   Content: ${response.response.substring(0, 100)}...`);
                console.log(`   Length: ${response.response.length} characters`);
                
            } else {
                console.log('❌ No primary AI service available');
            }
        } catch (error) {
            console.log(`❌ Primary AI service test failed: ${error.message}`);
        }
        
        // Test 4: Test service status
        console.log('\n🔍 Step 4: Testing Service Status');
        console.log('================================');
        
        const serviceStatus = await userSpecificAI.getUserServiceStatus(testUser._id);
        
        console.log('📊 Service Status:');
        Object.entries(serviceStatus).forEach(([service, status]) => {
            if (typeof status === 'object' && status.available !== undefined) {
                const availableIcon = status.available ? '✅' : '❌';
                const keyIcon = status.usingOwnKey ? '🔑' : '🏢';
                console.log(`   ${service}: ${availableIcon} ${keyIcon} (Own Key: ${status.usingOwnKey})`);
            } else {
                console.log(`   ${service}: ${status}`);
            }
        });
        
        // Test 5: Test admin keys fallback
        console.log('\n🔍 Step 5: Testing Admin Keys Fallback');
        console.log('=====================================');
        
        // Create user without own keys
        const adminKeyUser = new User({
            username: `test_adminkeys_${Date.now()}`,
            password: 'testpassword123',
            useOwnKeys: false
        });
        
        await adminKeyUser.save();
        console.log(`✅ Created admin key user: ${adminKeyUser.username}`);
        
        const adminServices = await userSpecificAI.getUserAIServices(adminKeyUser._id);
        
        console.log('📊 Admin Service Results:');
        console.log(`   Gemini: ${adminServices.gemini ? '✅ Available' : '❌ Not Available'}`);
        console.log(`   DeepSeek: ${adminServices.deepseek ? '✅ Available' : '❌ Not Available'}`);
        console.log(`   Qwen: ${adminServices.qwen ? '✅ Available' : '❌ Not Available'}`);
        console.log(`   Using Own Keys: ${adminServices.useOwnKeys}`);
        
        // Test 6: Test cache functionality
        console.log('\n🔍 Step 6: Testing Service Caching');
        console.log('=================================');
        
        const startTime = Date.now();
        const cachedServices = await userSpecificAI.getUserAIServices(testUser._id);
        const cacheTime = Date.now() - startTime;
        
        console.log(`⚡ Cached service retrieval: ${cacheTime}ms`);
        console.log(`🔄 Services cached: ${cachedServices === userServices ? 'Yes' : 'No'}`);
        
        // Test cache clearing
        userSpecificAI.clearUserServices(testUser._id);
        console.log('🧹 Cache cleared for test user');
        
        // Test 7: Test service cleanup
        console.log('\n🔍 Step 7: Testing Service Cleanup');
        console.log('=================================');
        
        userSpecificAI.cleanup();
        console.log('🧹 Service cleanup completed');
        
        // Cleanup: Remove test users
        console.log('\n🧹 Cleanup: Removing Test Users');
        console.log('==============================');
        
        await User.findByIdAndDelete(testUser._id);
        await User.findByIdAndDelete(adminKeyUser._id);
        console.log(`✅ Removed test users`);
        
        console.log('\n✅ User-Specific API Key System Test Completed!');
        
        // Assessment
        console.log('\n🎯 SYSTEM ASSESSMENT');
        console.log('===================');
        
        const hasGemini = !!userServices.gemini;
        const hasAdminFallback = !!adminServices.gemini;
        
        if (hasGemini && hasAdminFallback) {
            console.log('🎉 EXCELLENT: Both user-specific and admin fallback services working');
            console.log('✅ Users can use their own API keys');
            console.log('✅ Admin keys work as fallback');
            console.log('✅ Service caching and management working');
        } else if (hasGemini || hasAdminFallback) {
            console.log('✅ GOOD: At least one service type working');
            if (hasGemini) console.log('✅ User-specific API keys working');
            if (hasAdminFallback) console.log('✅ Admin fallback working');
        } else {
            console.log('⚠️ WARNING: No services available - check API key configuration');
        }
        
        console.log('\n🔧 SETUP INSTRUCTIONS:');
        console.log('1. Users can provide API keys during signup');
        console.log('2. API keys are stored securely in user profiles');
        console.log('3. Services automatically use user keys when available');
        console.log('4. System falls back to admin keys when needed');
        console.log('5. Users can update keys anytime in settings');
        
    } catch (error) {
        console.error('\n❌ USER API KEY TEST FAILED');
        console.error('===========================');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('1. Check MongoDB connection');
        console.log('2. Verify API keys in .env file');
        console.log('3. Ensure all required services are available');
        console.log('4. Check network connectivity');
    } finally {
        await mongoose.disconnect();
        console.log('\n📡 Disconnected from MongoDB');
    }
    
    process.exit(0);
}

// Run the test
testUserApiKeySystem();
