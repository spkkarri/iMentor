// test_gemini_simple.js
// Simple test of Gemini service

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    console.log('🔍 Testing Gemini Service');
    console.log('========================\n');
    
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        console.log('API Key:', apiKey ? 'Found' : 'Missing');
        
        if (!apiKey) {
            console.log('❌ No API key found');
            return;
        }
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        console.log('📤 Testing simple generation...');
        const result = await model.generateContent("Say hello");
        const response = result.response;
        const text = response.text();
        
        console.log('✅ SUCCESS! Gemini is working');
        console.log('📥 Response:', text);
        
        return true;
        
    } catch (error) {
        console.error('❌ FAILED:', error.message);
        
        if (error.message.includes('API_KEY_INVALID')) {
            console.log('🔧 Fix: Check your API key');
        } else if (error.message.includes('QUOTA_EXCEEDED')) {
            console.log('🔧 Fix: API quota exceeded');
        } else {
            console.log('🔧 Fix: Check network/permissions');
        }
        
        return false;
    }
}

testGemini();
