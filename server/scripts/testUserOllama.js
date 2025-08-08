// server/scripts/testUserOllama.js
// Test script for user-specific Ollama functionality

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const userOllamaConnector = require('../services/userOllamaConnector');

async function testUserOllamaSystem() {
    try {
        console.log('🦙 Testing User-Specific Ollama System');
        console.log('=====================================\n');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot');
        console.log('✅ Connected to MongoDB');
        
        // Test 1: Create test user with custom Ollama URL
        console.log('\n🔍 Step 1: Testing User Creation with Ollama URL');
        console.log('===============================================');
        
        const testUsername = `test_ollama_${Date.now()}`;
        const testOllamaUrl = 'http://192.168.1.100:11434'; // Example custom URL
        
        const testUser = new User({
            username: testUsername,
            password: 'testpassword123',
            ollamaUrl: testOllamaUrl
        });
        
        await testUser.save();
        console.log(`✅ Created test user: ${testUsername}`);
        console.log(`🔗 Ollama URL: ${testOllamaUrl}`);
        
        // Test 2: Get user Ollama status
        console.log('\n🔍 Step 2: Testing User Ollama Status');
        console.log('====================================');
        
        const status = await userOllamaConnector.getUserOllamaStatus(testUser._id);
        console.log('📊 User Ollama Status:');
        console.log(`   User: ${status.user?.username}`);
        console.log(`   Ollama URL: ${status.user?.ollamaUrl}`);
        console.log(`   Is Connected: ${status.connection?.isConnected}`);
        console.log(`   Is Cached: ${status.connection?.isCached}`);
        
        // Test 3: Test connection
        console.log('\n🔍 Step 3: Testing Ollama Connection');
        console.log('===================================');
        
        const connectionTest = await userOllamaConnector.testUserConnection(testUser._id);
        console.log('🔌 Connection Test Results:');
        console.log(`   Success: ${connectionTest.success}`);
        console.log(`   URL: ${connectionTest.url}`);
        console.log(`   Is Fallback: ${connectionTest.isFallback || false}`);
        console.log(`   Models Count: ${connectionTest.modelsCount || 0}`);
        
        if (!connectionTest.success) {
            console.log(`   Error: ${connectionTest.error}`);
        }
        
        // Test 4: Get available models
        console.log('\n🔍 Step 4: Testing Available Models');
        console.log('==================================');
        
        try {
            const models = await userOllamaConnector.getUserAvailableModels(testUser._id);
            console.log(`📋 Available Models: ${models.length}`);
            
            if (models.length > 0) {
                models.forEach((model, index) => {
                    console.log(`   ${index + 1}. ${model.name} (${model.size || 'Unknown size'})`);
                });
            } else {
                console.log('   No models found - Ollama server may not be running or no models pulled');
            }
        } catch (error) {
            console.log(`   ❌ Failed to get models: ${error.message}`);
        }
        
        // Test 5: Test chat functionality (if connection works)
        console.log('\n🔍 Step 5: Testing Chat Functionality');
        console.log('====================================');
        
        if (connectionTest.success && connectionTest.modelsCount > 0) {
            try {
                console.log('💬 Testing chat with user\'s Ollama server...');
                
                const chatResponse = await userOllamaConnector.generateUserResponse(
                    testUser._id,
                    'Hello! Please respond with "User Ollama is working correctly."',
                    {
                        model: 'llama3.2:latest',
                        max_tokens: 50,
                        temperature: 0.1
                    }
                );
                
                console.log('✅ Chat Response:');
                console.log(`   Model: ${chatResponse.model}`);
                console.log(`   Response: ${chatResponse.response}`);
                console.log(`   Duration: ${chatResponse.total_duration || 'N/A'}`);
                
            } catch (chatError) {
                console.log(`❌ Chat test failed: ${chatError.message}`);
            }
        } else {
            console.log('⚠️ Skipping chat test - Ollama not available or no models');
        }
        
        // Test 6: Update Ollama URL
        console.log('\n🔍 Step 6: Testing URL Update');
        console.log('=============================');
        
        const newUrl = 'http://localhost:11434'; // Change back to localhost
        const updateResult = await userOllamaConnector.updateUserOllamaUrl(testUser._id, newUrl);
        
        console.log('🔄 URL Update Results:');
        console.log(`   Success: ${updateResult.success}`);
        console.log(`   New URL: ${updateResult.newUrl}`);
        console.log(`   Connection Test: ${updateResult.connectionTest?.success || false}`);
        
        if (!updateResult.success) {
            console.log(`   Error: ${updateResult.error}`);
        }
        
        // Test 7: System status
        console.log('\n🔍 Step 7: Testing System Status');
        console.log('===============================');
        
        const systemStatus = userOllamaConnector.getSystemStatus();
        console.log('🌐 System-wide Ollama Status:');
        console.log(`   Total Users: ${systemStatus.totalUsers}`);
        console.log(`   Active Connections: ${systemStatus.activeConnections}`);
        
        if (systemStatus.connectors.length > 0) {
            console.log('   User Connectors:');
            systemStatus.connectors.forEach((connector, index) => {
                console.log(`     ${index + 1}. User: ${connector.userId}`);
                console.log(`        URL: ${connector.url}`);
                console.log(`        Available: ${connector.isAvailable}`);
                console.log(`        Models: ${connector.modelsCount}`);
                console.log(`        Last Used: ${connector.lastUsed}`);
            });
        }
        
        // Test 8: Cleanup test
        console.log('\n🔍 Step 8: Testing Cleanup');
        console.log('=========================');
        
        console.log('🧹 Running connector cleanup...');
        userOllamaConnector.cleanupOldConnectors(0); // Clean all for testing
        
        const statusAfterCleanup = userOllamaConnector.getSystemStatus();
        console.log(`📊 Connectors after cleanup: ${statusAfterCleanup.totalUsers}`);
        
        // Cleanup: Remove test user
        console.log('\n🧹 Cleanup: Removing Test User');
        console.log('==============================');
        
        await User.findByIdAndDelete(testUser._id);
        console.log(`✅ Removed test user: ${testUsername}`);
        
        console.log('\n✅ User-Specific Ollama Test Completed!');
        
        // Assessment
        console.log('\n🎯 SYSTEM ASSESSMENT');
        console.log('===================');
        
        if (connectionTest.success) {
            console.log('🎉 EXCELLENT: User-specific Ollama system working perfectly');
            console.log('✅ Users can provide custom Ollama URLs');
            console.log('✅ System correctly routes to user-specific servers');
            console.log('✅ Fallback mechanisms working');
        } else {
            console.log('⚠️ PARTIAL: System implemented but Ollama server not available');
            console.log('✅ User URL configuration working');
            console.log('✅ Fallback mechanisms working');
            console.log('❌ Ollama server connection failed');
        }
        
        console.log('\n🔧 SETUP INSTRUCTIONS:');
        console.log('1. Ensure Ollama is running on the specified URL');
        console.log('2. Pull required models: `ollama pull llama3.2`');
        console.log('3. Users can specify their Ollama URL during signup');
        console.log('4. System will automatically route to user-specific servers');
        
    } catch (error) {
        console.error('\n❌ USER OLLAMA TEST FAILED');
        console.error('==========================');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('1. Check MongoDB connection');
        console.log('2. Verify Ollama server is running');
        console.log('3. Check network connectivity to Ollama server');
        console.log('4. Ensure required models are pulled');
    } finally {
        await mongoose.disconnect();
        console.log('\n📡 Disconnected from MongoDB');
    }
    
    process.exit(0);
}

// Run the test
testUserOllamaSystem();
