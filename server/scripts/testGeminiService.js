// server/scripts/testGeminiService.js
// Test script to verify Gemini service is working properly

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const GeminiService = require('../services/geminiService');
const { GeminiAI } = require('../services/geminiAI');

async function testGeminiService() {
    try {
        console.log('🧪 Testing Gemini Service Configuration');
        console.log('=====================================\n');
        
        // Check environment variables
        console.log('📋 Environment Check:');
        console.log(`GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'SET ✅' : 'NOT SET ❌'}`);
        if (process.env.GEMINI_API_KEY) {
            console.log(`API Key Length: ${process.env.GEMINI_API_KEY.length} characters`);
            console.log(`API Key Preview: ${process.env.GEMINI_API_KEY.substring(0, 10)}...`);
        }
        console.log('');
        
        // Test GeminiService initialization
        console.log('🔧 Testing GeminiService Initialization:');
        const geminiService = new GeminiService();
        await geminiService.initialize();
        
        console.log(`GenAI Instance: ${geminiService.genAI ? 'CREATED ✅' : 'FAILED ❌'}`);
        console.log(`Model Instance: ${geminiService.model ? 'CREATED ✅' : 'FAILED ❌'}`);
        console.log('');
        
        if (!geminiService.genAI || !geminiService.model) {
            console.log('❌ GeminiService failed to initialize properly');
            console.log('🔧 Troubleshooting:');
            console.log('1. Check if GEMINI_API_KEY is set in .env file');
            console.log('2. Verify the API key is valid');
            console.log('3. Check internet connection');
            return;
        }
        
        // Test GeminiAI wrapper
        console.log('🤖 Testing GeminiAI Wrapper:');
        const geminiAI = new GeminiAI(geminiService);
        
        // Test simple text generation
        console.log('📝 Testing simple text generation...');
        const testPrompt = "What is artificial intelligence? Please provide a brief explanation.";
        
        const startTime = Date.now();
        const response = await geminiAI.generateChatResponse(testPrompt, [], [], "You are a helpful AI assistant.");
        const endTime = Date.now();
        
        console.log(`⏱️ Response Time: ${endTime - startTime}ms`);
        console.log(`📊 Response Type: ${typeof response}`);
        console.log(`📝 Has Response: ${response.response ? 'YES ✅' : 'NO ❌'}`);
        console.log(`❓ Has Follow-ups: ${response.followUpQuestions?.length > 0 ? 'YES ✅' : 'NO ❌'}`);
        console.log('');
        
        console.log('📄 Response Preview:');
        console.log('==================');
        const preview = response.response?.substring(0, 200) || 'No response content';
        console.log(preview + (response.response?.length > 200 ? '...' : ''));
        console.log('');
        
        if (response.followUpQuestions && response.followUpQuestions.length > 0) {
            console.log('❓ Follow-up Questions:');
            response.followUpQuestions.forEach((q, i) => {
                console.log(`${i + 1}. ${q}`);
            });
            console.log('');
        }
        
        // Test with a specific query about agentic AI
        console.log('🎯 Testing Specific Query (Agentic AI):');
        const agenticQuery = "tell me about agentic ai";
        const agenticResponse = await geminiAI.generateChatResponse(agenticQuery, [], [], "You are a helpful AI assistant with knowledge about AI technologies.");
        
        console.log(`📝 Agentic AI Response Length: ${agenticResponse.response?.length || 0} characters`);
        console.log('📄 Agentic AI Response Preview:');
        console.log('==============================');
        const agenticPreview = agenticResponse.response?.substring(0, 300) || 'No response content';
        console.log(agenticPreview + (agenticResponse.response?.length > 300 ? '...' : ''));
        console.log('');
        
        // Check if response indicates knowledge limitation
        const hasKnowledgeLimitation = agenticResponse.response?.toLowerCase().includes('do not have') ||
                                     agenticResponse.response?.toLowerCase().includes('knowledge base') ||
                                     agenticResponse.response?.toLowerCase().includes('cannot provide');
        
        console.log('🔍 Analysis:');
        console.log(`Knowledge Limitation Detected: ${hasKnowledgeLimitation ? 'YES ⚠️' : 'NO ✅'}`);
        
        if (hasKnowledgeLimitation) {
            console.log('');
            console.log('⚠️ ISSUE DETECTED: AI is giving knowledge limitation responses');
            console.log('🔧 Possible Causes:');
            console.log('1. Gemini service not properly initialized');
            console.log('2. API key has restrictions');
            console.log('3. Model configuration issue');
            console.log('4. Fallback response being triggered');
        } else {
            console.log('✅ AI is providing proper knowledge-based responses');
        }
        
        console.log('\n✅ Gemini Service Test Completed!');
        
    } catch (error) {
        console.error('\n❌ GEMINI SERVICE TEST FAILED');
        console.error('=============================');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\n🔧 TROUBLESHOOTING STEPS:');
        console.log('1. Verify GEMINI_API_KEY in .env file');
        console.log('2. Check API key permissions and quotas');
        console.log('3. Test internet connectivity');
        console.log('4. Verify Google AI SDK installation');
        console.log('5. Check for any firewall/proxy issues');
    }
    
    process.exit(0);
}

// Run the test
testGeminiService();
