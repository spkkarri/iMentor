// Test script for MCP API endpoints
const axios = require('axios');

const BASE_URL = 'http://localhost:5007/api';

// Test data
const testUser = {
    id: 'test_user_123',
    username: 'test_user'
};

async function testMCPEndpoints() {
    console.log('Testing MCP API Endpoints...\n');

    try {
        // Test 1: Check MCP Status
        console.log('1. Testing MCP Status...');
        const statusResponse = await axios.get(`${BASE_URL}/agents/status`, {
            headers: {
                'X-User-ID': 'test-user-123',
                'Content-Type': 'application/json'
            }
        });
        console.log('MCP Status:', statusResponse.data);
        console.log('');

        // Test 2: List Available Agents
        console.log('2. Testing Agent List...');
        const agentsResponse = await axios.get(`${BASE_URL}/agents/list`, {
            headers: {
                'X-User-ID': 'test-user-123',
                'Content-Type': 'application/json'
            }
        });
        console.log('Available Agents:', agentsResponse.data);
        console.log('');

        // Test 3: Test Research Agent
        console.log('3. Testing Research Agent...');
        const researchResponse = await axios.post(`${BASE_URL}/agents/search`, {
            input: 'What is artificial intelligence and how does it work?',
            sessionId: 'test_session_123',
            userId: testUser.id,
            history: []
        }, {
            headers: {
                'Authorization': 'Bearer test_token',
                'Content-Type': 'application/json'
            }
        });
        console.log('Research Agent Response:', researchResponse.data);
        console.log('');

        // Test 4: Test Coding Agent
        console.log('4. Testing Coding Agent...');
        const codingResponse = await axios.post(`${BASE_URL}/agents/search`, {
            input: 'Write a Python function to sort a list of numbers',
            sessionId: 'test_session_123',
            userId: testUser.id,
            history: []
        }, {
            headers: {
                'Authorization': 'Bearer test_token',
                'Content-Type': 'application/json'
            }
        });
        console.log('Coding Agent Response:', codingResponse.data);
        console.log('');

        // Test 5: Test Analysis Agent
        console.log('5. Testing Analysis Agent...');
        const analysisResponse = await axios.post(`${BASE_URL}/agents/search`, {
            input: 'Analyze the correlation between temperature and ice cream sales',
            sessionId: 'test_session_123',
            userId: testUser.id,
            history: []
        }, {
            headers: {
                'Authorization': 'Bearer test_token',
                'Content-Type': 'application/json'
            }
        });
        console.log('Analysis Agent Response:', analysisResponse.data);
        console.log('');

        // Test 6: Test Creative Agent
        console.log('6. Testing Creative Agent...');
        const creativeResponse = await axios.post(`${BASE_URL}/agents/search`, {
            input: 'Write a poem about the beauty of coding',
            sessionId: 'test_session_123',
            userId: testUser.id,
            history: []
        }, {
            headers: {
                'Authorization': 'Bearer test_token',
                'Content-Type': 'application/json'
            }
        });
        console.log('Creative Agent Response:', creativeResponse.data);
        console.log('');

        // Test 7: Test Agent Selection
        console.log('7. Testing Manual Agent Selection...');
        const manualResponse = await axios.post(`${BASE_URL}/agents/select`, {
            agent_id: 'coding',
            input: 'Explain object-oriented programming concepts',
            sessionId: 'test_session_123',
            userId: testUser.id,
            history: []
        }, {
            headers: {
                'Authorization': 'Bearer test_token',
                'Content-Type': 'application/json'
            }
        });
        console.log('Manual Agent Selection Response:', manualResponse.data);
        console.log('');

        console.log('All MCP tests completed successfully!');

    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            console.log('Note: Authentication error - this is expected in test environment');
        }
    }
}

// Run tests
testMCPEndpoints();
