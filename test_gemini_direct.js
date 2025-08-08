// test_gemini_direct.js
// Direct test of Gemini service to diagnose the issue

require('dotenv').config({ path: './server/.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiDirect() {
    console.log('🔍 Testing Gemini Service Directly');
    console.log('=================================\n');
    
    try {
        // Test 1: Check API key
        console.log('🔍 Step 1: API Key Check');
        console.log('========================');
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.log('❌ GEMINI_API_KEY not found in environment');
            return;
        }
        
        console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');
        
        // Test 2: Initialize Gemini
        console.log('\n🔍 Step 2: Gemini Initialization');
        console.log('===============================');
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        
        console.log('✅ Gemini service initialized');
        
        // Test 3: Simple generation test
        console.log('\n🔍 Step 3: Simple Generation Test');
        console.log('================================');
        
        const prompt = "Say hello in a friendly way";
        console.log('📤 Sending prompt:', prompt);
        
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        
        console.log('✅ Generation successful!');
        console.log('📥 Response:', text.substring(0, 100) + '...');
        
        // Test 4: Chat-style generation
        console.log('\n🔍 Step 4: Chat-Style Generation');
        console.log('===============================');
        
        const chatPrompt = `You are a helpful AI assistant. Respond to this message: "hi"
        
        Please respond in a friendly, conversational manner.`;
        
        console.log('📤 Sending chat prompt...');
        
        const chatResult = await model.generateContent(chatPrompt);
        const chatResponse = chatResult.response;
        const chatText = chatResponse.text();
        
        console.log('✅ Chat generation successful!');
        console.log('📥 Chat Response:', chatText.substring(0, 150) + '...');
        
        // Test 5: Diagnosis
        console.log('\n🔍 Step 5: Diagnosis');
        console.log('===================');
        
        console.log('✅ GEMINI SERVICE IS WORKING CORRECTLY');
        console.log('');
        console.log('🔧 The issue is likely in:');
        console.log('1. Chat controller routing');
        console.log('2. User authentication');
        console.log('3. Session management');
        console.log('4. Model selection logic');
        
        console.log('\n🎯 NEXT STEPS:');
        console.log('1. Check server logs when sending a message');
        console.log('2. Verify user session is valid');
        console.log('3. Check model selection in frontend');
        console.log('4. Verify chat endpoint routing');
        
    } catch (error) {
        console.error('\n❌ GEMINI TEST FAILED');
        console.error('=====================');
        console.error('Error:', error.message);
        
        if (error.message.includes('API_KEY_INVALID')) {
            console.log('\n🔧 SOLUTION: Invalid API Key');
            console.log('1. Check your Gemini API key in .env file');
            console.log('2. Verify the key is active in Google AI Studio');
            console.log('3. Make sure there are no extra spaces or quotes');
        } else if (error.message.includes('QUOTA_EXCEEDED')) {
            console.log('\n🔧 SOLUTION: Quota Exceeded');
            console.log('1. Check your Gemini API quota');
            console.log('2. Wait for quota reset');
            console.log('3. Consider upgrading your plan');
        } else if (error.message.includes('PERMISSION_DENIED')) {
            console.log('\n🔧 SOLUTION: Permission Denied');
            console.log('1. Enable Gemini API in Google Cloud Console');
            console.log('2. Check API key permissions');
            console.log('3. Verify billing is enabled');
        } else {
            console.log('\n🔧 SOLUTION: Network/Other Error');
            console.log('1. Check internet connection');
            console.log('2. Verify firewall settings');
            console.log('3. Try again in a few minutes');
        }
    }
}

// Run the test
testGeminiDirect();
