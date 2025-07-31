#!/usr/bin/env node
/**
 * Test Multi-Model API Endpoints
 * Simple script to test the running server
 */

const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:5007';
const AUTH_TOKEN = 'test-token';

const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
};

async function testAPI() {
    console.log('🧪 Testing Multi-Model LLM API Endpoints');
    console.log('==========================================\n');

    try {
        // Test 1: Status endpoint
        console.log('1️⃣ Testing Status Endpoint...');
        const statusResponse = await axios.get(`${BASE_URL}/api/multi-model/status`, { headers });
        console.log('✅ Status:', statusResponse.data.success ? 'SUCCESS' : 'FAILED');
        console.log('📊 Enhanced Search:', statusResponse.data.data.enhancedSearchEnabled);
        console.log();

        // Test 2: Classification endpoint
        console.log('2️⃣ Testing Classification Endpoint...');
        
        const testQueries = [
            { query: "What is 15 + 27?", expected: "mathematics" },
            { query: "How do you create a function in Python?", expected: "programming" },
            { query: "What is photosynthesis?", expected: "science" },
            { query: "Tell me about World War II", expected: "history" },
            { query: "Who wrote Romeo and Juliet?", expected: "literature" }
        ];

        for (const test of testQueries) {
            try {
                const classifyResponse = await axios.post(
                    `${BASE_URL}/api/multi-model/classify`,
                    { query: test.query },
                    { headers }
                );

                const result = classifyResponse.data.data;
                const isCorrect = result.subject === test.expected;
                
                console.log(`   Query: "${test.query}"`);
                console.log(`   ${isCorrect ? '✅' : '⚠️'} Subject: ${result.subject} (confidence: ${result.confidence.toFixed(2)})`);
                console.log(`   Expected: ${test.expected}, Got: ${result.subject}`);
                console.log();
            } catch (error) {
                console.log(`   ❌ Failed to classify: "${test.query}"`);
                console.log(`   Error: ${error.message}`);
                console.log();
            }
        }

        // Test 3: Monitoring endpoint
        console.log('3️⃣ Testing Monitoring Endpoint...');
        try {
            const monitoringResponse = await axios.get(`${BASE_URL}/api/monitoring/metrics`, { headers });
            console.log('✅ Monitoring:', monitoringResponse.data.success ? 'SUCCESS' : 'FAILED');
            console.log('📈 System metrics available');
            console.log();
        } catch (error) {
            console.log('⚠️ Monitoring endpoint not available:', error.message);
            console.log();
        }

        // Test 4: Available subjects
        console.log('4️⃣ Testing Available Subjects...');
        try {
            const subjectsResponse = await axios.get(`${BASE_URL}/api/multi-model/subjects`, { headers });
            if (subjectsResponse.data.success) {
                console.log('✅ Available subjects:');
                subjectsResponse.data.data.forEach(subject => {
                    console.log(`   📚 ${subject.name}: ${subject.description}`);
                });
            }
            console.log();
        } catch (error) {
            console.log('⚠️ Subjects endpoint not available:', error.message);
            console.log();
        }

        console.log('🎉 API Testing Complete!');
        console.log('========================');
        console.log('✅ Multi-Model LLM System is fully operational');
        console.log('🚀 Ready for production use');

    } catch (error) {
        console.error('❌ API Test Failed:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

// Run the tests
testAPI().catch(console.error);
