// Test script for web search functionality
const axios = require('axios');

async function testWebSearch() {
    const baseURL = 'http://localhost:5007';
    const testQuery = "which tarins go daily from vozag to hyderabad";
    
    console.log('Testing Web Search Functionality...\n');
    console.log(`Query: "${testQuery}"`);
    
    try {
        const response = await axios.post(`${baseURL}/api/chat/message`, {
            query: testQuery,
            sessionId: 'test-session-' + Date.now(),
            history: [],
            systemPrompt: 'You are a helpful AI assistant.',
            ragEnabled: false,
            deepSearch: false,
            autoDetectWebSearch: true,  // Force enable auto-detection
            multiLLM: false,
            selectedModel: 'gemini-flash'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': '6894d7a71aee1fdee7475382',
                'Authorization': 'Bearer test-token'
            }
        });
        
        console.log('Response received:');
        console.log('Status:', response.status);
        console.log('Search Type:', response.data.metadata?.searchType);
        console.log('Auto-detected:', response.data.metadata?.autoDetected);
        console.log('Confidence:', response.data.metadata?.confidence);
        console.log('Reasoning:', response.data.metadata?.analysisReasoning);
        console.log('\nResponse Preview:');
        console.log(response.data.response?.substring(0, 200) + '...');
        
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testWebSearch().catch(console.error);
