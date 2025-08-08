// test_chat_endpoint.js
// Test the chat endpoint directly

const fetch = require('node-fetch');

async function testChatEndpoint() {
    console.log('🔍 Testing Chat Endpoint');
    console.log('========================\n');
    
    const baseURL = 'http://localhost:5007';
    
    try {
        // Test chat endpoint with both models
        const testCases = [
            {
                model: 'gemini-pro',
                message: 'Hello, how are you?',
                description: 'Gemini Pro Model Test'
            },
            {
                model: 'llama-model', 
                message: 'Tell me a joke',
                description: 'Llama Model Test'
            }
        ];
        
        for (const testCase of testCases) {
            console.log(`🔍 ${testCase.description}`);
            console.log('='.repeat(testCase.description.length + 4));
            
            const chatData = {
                query: testCase.message,  // Controller expects 'query', not 'message'
                selectedModel: testCase.model,
                sessionId: 'test-session-123'
            };
            
            console.log('📤 Sending:', JSON.stringify(chatData, null, 2));
            
            try {
                const response = await fetch(`${baseURL}/api/chat/message`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-User-ID': '507f1f77bcf86cd799439011' // Use valid ObjectId test user from middleware
                    },
                    body: JSON.stringify(chatData)
                });
                
                console.log('📊 Status:', response.status, response.statusText);
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('✅ SUCCESS!');
                    console.log('📥 Response:', result.response?.substring(0, 100) + '...');
                    console.log('🤖 Model Used:', result.modelUsed);
                } else {
                    const errorText = await response.text();
                    console.log('❌ FAILED!');
                    console.log('📥 Error:', errorText.substring(0, 200) + '...');
                }
                
            } catch (error) {
                console.log('❌ REQUEST FAILED:', error.message);
            }
            
            console.log(''); // Empty line between tests
        }
        
        console.log('🎯 NEXT STEPS:');
        console.log('1. If both tests succeed → Your chat is working!');
        console.log('2. If authentication fails → You need to login first');
        console.log('3. If model errors → Check server logs');
        console.log('4. If network errors → Check server is running');
        
    } catch (error) {
        console.error('❌ TEST FAILED:', error.message);
    }
}

testChatEndpoint();
