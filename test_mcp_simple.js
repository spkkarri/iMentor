// Simple MCP Test Script
const axios = require('axios');

const BASE_URL = 'http://localhost:5007/api';

async function testMCP() {
    console.log('🧪 Testing MCP System...\n');

    const headers = {
        'X-User-ID': 'test-user-123',
        'Content-Type': 'application/json'
    };

    try {
        // Test 1: Check MCP Status
        console.log('1️⃣ Testing MCP Status...');
        const statusResponse = await axios.get(`${BASE_URL}/agents/status`, { headers });
        console.log('✅ Status:', statusResponse.data.data.available ? 'Available' : 'Not Available');
        console.log('📊 Agents:', statusResponse.data.data.agents.length);
        console.log('');

        // Test 2: Test Research Query
        console.log('2️⃣ Testing Research Agent...');
        const researchResponse = await axios.post(`${BASE_URL}/agents/search`, {
            input: 'What is machine learning?',
            sessionId: 'test_session',
            userId: 'test-user-123',
            history: []
        }, { headers });
        
        console.log('✅ Agent Used:', researchResponse.data.data.agent_used);
        console.log('📝 Response Preview:', researchResponse.data.data.response.substring(0, 100) + '...');
        console.log('');

        // Test 3: Test Coding Query
        console.log('3️⃣ Testing Coding Agent...');
        const codingResponse = await axios.post(`${BASE_URL}/agents/search`, {
            input: 'Write a Python function to calculate factorial',
            sessionId: 'test_session',
            userId: 'test-user-123',
            history: []
        }, { headers });
        
        console.log('✅ Agent Used:', codingResponse.data.data.agent_used);
        console.log('📝 Response Preview:', codingResponse.data.data.response.substring(0, 100) + '...');
        console.log('');

        // Test 4: Test Analysis Query
        console.log('4️⃣ Testing Analysis Agent...');
        const analysisResponse = await axios.post(`${BASE_URL}/agents/search`, {
            input: 'Analyze sales data trends',
            sessionId: 'test_session',
            userId: 'test-user-123',
            history: []
        }, { headers });
        
        console.log('✅ Agent Used:', analysisResponse.data.data.agent_used);
        console.log('📝 Response Preview:', analysisResponse.data.data.response.substring(0, 100) + '...');
        console.log('');

        // Test 5: Test Creative Query
        console.log('5️⃣ Testing Creative Agent...');
        const creativeResponse = await axios.post(`${BASE_URL}/agents/search`, {
            input: 'Write a haiku about programming',
            sessionId: 'test_session',
            userId: 'test-user-123',
            history: []
        }, { headers });
        
        console.log('✅ Agent Used:', creativeResponse.data.data.agent_used);
        console.log('📝 Response Preview:', creativeResponse.data.data.response.substring(0, 100) + '...');
        console.log('');

        console.log('🎉 All MCP tests completed successfully!');
        console.log('🔗 You can now test MCP in the web interface by:');
        console.log('   1. Opening http://localhost:3004');
        console.log('   2. Clicking the "🤖 MCP Agents" button');
        console.log('   3. Asking questions to see different agents respond');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('💡 Make sure the server is running on port 5007');
        }
    }
}

testMCP();
