// server/scripts/testNormalChat.js
// Test script to verify normal chat functionality works

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const axios = require('axios');

async function testNormalChat() {
    try {
        console.log('🧪 Testing Normal Chat Functionality');
        console.log('===================================\n');
        
        const baseURL = 'http://localhost:5007';
        
        // Test data
        const testUser = {
            email: 'test@example.com',
            password: 'testpassword'
        };
        
        const testQueries = [
            "tell me about agentic ai",
            "what is machine learning?",
            "explain quantum computing",
            "how does blockchain work?"
        ];
        
        console.log('🔐 Step 1: Setting up authentication...');

        // Use temp auth with test user ID (valid ObjectId format)
        const testUserId = '507f1f77bcf86cd799439011'; // This is a valid test user ID from the middleware
        const headers = {
            'X-User-ID': testUserId,
            'Content-Type': 'application/json'
        };
        console.log('✅ Using temp auth with test user ID\n');
        
        console.log('📝 Step 2: Creating chat session...');
        
        // Create a chat session
        const sessionResponse = await axios.post(`${baseURL}/api/chat/session`, {
            title: 'Test Normal Chat Session',
            systemPrompt: 'You are a helpful AI assistant.'
        }, {
            headers: headers
        });
        
        const sessionId = sessionResponse.data.sessionId;
        console.log(`✅ Session created: ${sessionId}\n`);
        
        console.log('💬 Step 3: Testing normal chat queries...\n');
        
        for (let i = 0; i < testQueries.length; i++) {
            const query = testQueries[i];
            console.log(`🔍 Query ${i + 1}: "${query}"`);
            
            try {
                const startTime = Date.now();
                
                const chatResponse = await axios.post(`${baseURL}/api/chat/message`, {
                    query: query,
                    sessionId: sessionId,
                    history: [],
                    systemPrompt: "You are a helpful AI assistant.",
                    ragEnabled: false,
                    deepSearch: false,
                    autoDetectWebSearch: false
                }, {
                    headers: headers
                });
                
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                
                const response = chatResponse.data.response;
                const metadata = chatResponse.data.metadata;
                
                console.log(`⏱️ Response Time: ${responseTime}ms`);
                console.log(`📊 Search Type: ${metadata?.searchType || 'unknown'}`);
                console.log(`📝 Response Length: ${response?.length || 0} characters`);
                
                // Check for knowledge limitation indicators
                const hasKnowledgeLimitation = response?.toLowerCase().includes('do not have') ||
                                             response?.toLowerCase().includes('knowledge base') ||
                                             response?.toLowerCase().includes('cannot provide');
                
                console.log(`🎯 Knowledge Available: ${hasKnowledgeLimitation ? 'NO ❌' : 'YES ✅'}`);
                
                // Show response preview
                const preview = response?.substring(0, 150) || 'No response';
                console.log(`📄 Preview: ${preview}${response?.length > 150 ? '...' : ''}`);
                
                if (hasKnowledgeLimitation) {
                    console.log('⚠️ WARNING: AI is still giving knowledge limitation responses');
                }
                
                console.log(''); // Empty line for readability
                
            } catch (queryError) {
                console.error(`❌ Query failed: ${queryError.message}`);
                if (queryError.response?.data) {
                    console.error(`Error details:`, queryError.response.data);
                }
                console.log('');
            }
        }
        
        console.log('📊 Test Summary:');
        console.log('===============');
        console.log('✅ Normal chat functionality test completed');
        console.log('🎯 If all queries show "Knowledge Available: YES ✅", the fix is working');
        console.log('⚠️ If any show "Knowledge Available: NO ❌", there may still be issues');
        
    } catch (error) {
        console.error('\n❌ NORMAL CHAT TEST FAILED');
        console.error('==========================');
        console.error('Error:', error.message);
        
        if (error.response?.data) {
            console.error('Response data:', error.response.data);
        }
        
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('1. Make sure the server is running on port 5007');
        console.log('2. Check if authentication is working');
        console.log('3. Verify the chat endpoints are accessible');
        console.log('4. Check server logs for detailed error information');
    }
    
    process.exit(0);
}

// Run the test
testNormalChat();
