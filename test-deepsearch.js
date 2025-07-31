#!/usr/bin/env node

/**
 * DeepSearch End-to-End Test Script
 * Tests the complete DeepSearch flow from client to server
 */

const axios = require('axios');

const SERVER_URL = 'http://localhost:3000';
const CLIENT_URL = 'http://localhost:3005';

// Test configuration
const TEST_CONFIG = {
    username: 'testuser',
    password: 'testpass',
    queries: [
        'What is artificial intelligence?',
        'Latest developments in quantum computing 2024',
        'How does machine learning work?'
    ]
};

class DeepSearchTester {
    constructor() {
        this.authToken = null;
        this.sessionId = null;
        this.userId = null;
    }

    async login() {
        try {
            console.log('🔐 Logging in...');
            const response = await axios.post(`${SERVER_URL}/api/auth/login`, {
                username: TEST_CONFIG.username,
                password: TEST_CONFIG.password
            });

            this.authToken = response.data.token;
            this.userId = response.data.user.id;
            console.log('✅ Login successful');
            return true;
        } catch (error) {
            console.error('❌ Login failed:', error.response?.data || error.message);
            return false;
        }
    }

    async createSession() {
        try {
            console.log('📝 Creating chat session...');
            const response = await axios.post(`${SERVER_URL}/api/chat/session`, {}, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });

            this.sessionId = response.data.sessionId;
            console.log('✅ Session created:', this.sessionId);
            return true;
        } catch (error) {
            console.error('❌ Session creation failed:', error.response?.data || error.message);
            return false;
        }
    }

    async testDeepSearchService() {
        try {
            console.log('🧪 Testing DeepSearch service directly...');
            const response = await axios.post(`${SERVER_URL}/api/chat/test-deep-search`, {
                query: 'What is artificial intelligence?'
            }, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });

            console.log('✅ DeepSearch service test passed');
            console.log('📊 Results:', {
                success: response.data.success,
                step: response.data.step,
                hasMetadata: !!response.data.metadata,
                searchType: response.data.metadata?.searchType
            });
            return true;
        } catch (error) {
            console.error('❌ DeepSearch service test failed:', error.response?.data || error.message);
            return false;
        }
    }

    async testDeepSearchMessage(query) {
        try {
            console.log(`🔍 Testing DeepSearch with query: "${query}"`);
            
            const response = await axios.post(`${SERVER_URL}/api/chat/message`, {
                query: query,
                sessionId: this.sessionId,
                history: [],
                systemPrompt: 'You are a helpful AI assistant.',
                deepSearch: true
            }, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });

            const { response: message, metadata } = response.data;
            
            console.log('✅ DeepSearch message test passed');
            console.log('📊 Response details:', {
                messageLength: message.length,
                searchType: metadata?.searchType,
                sourcesCount: metadata?.sources?.length || 0,
                hasMetadata: !!metadata
            });

            if (metadata?.searchType) {
                console.log(`🎯 Search type: ${metadata.searchType}`);
            }

            return true;
        } catch (error) {
            console.error(`❌ DeepSearch message test failed for "${query}":`, error.response?.data || error.message);
            return false;
        }
    }

    async testWebSearch(query) {
        try {
            console.log(`🌐 Testing WebSearch with query: "${query}"`);
            
            const response = await axios.post(`${SERVER_URL}/api/chat/message`, {
                query: query,
                sessionId: this.sessionId,
                history: [],
                systemPrompt: 'You are a helpful AI assistant.',
                webSearch: true
            }, {
                headers: { Authorization: `Bearer ${this.authToken}` }
            });

            const { response: message, metadata } = response.data;
            
            console.log('✅ WebSearch message test passed');
            console.log('📊 Response details:', {
                messageLength: message.length,
                searchType: metadata?.searchType,
                sourcesCount: metadata?.sources?.length || 0
            });

            return true;
        } catch (error) {
            console.error(`❌ WebSearch message test failed for "${query}":`, error.response?.data || error.message);
            return false;
        }
    }

    async runAllTests() {
        console.log('🚀 Starting DeepSearch End-to-End Tests\n');

        // Test 1: Login
        if (!(await this.login())) {
            console.log('❌ Test suite failed at login');
            return;
        }

        // Test 2: Create Session
        if (!(await this.createSession())) {
            console.log('❌ Test suite failed at session creation');
            return;
        }

        // Test 3: DeepSearch Service Test
        if (!(await this.testDeepSearchService())) {
            console.log('❌ Test suite failed at service test');
            return;
        }

        // Test 4: DeepSearch Messages
        let deepSearchPassed = 0;
        for (const query of TEST_CONFIG.queries) {
            if (await this.testDeepSearchMessage(query)) {
                deepSearchPassed++;
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
        }

        // Test 5: WebSearch Messages
        let webSearchPassed = 0;
        for (const query of TEST_CONFIG.queries) {
            if (await this.testWebSearch(query)) {
                webSearchPassed++;
            }
            await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
        }

        // Results Summary
        console.log('\n📊 Test Results Summary:');
        console.log(`✅ Login: Passed`);
        console.log(`✅ Session Creation: Passed`);
        console.log(`✅ Service Test: Passed`);
        console.log(`🔍 DeepSearch Messages: ${deepSearchPassed}/${TEST_CONFIG.queries.length} passed`);
        console.log(`🌐 WebSearch Messages: ${webSearchPassed}/${TEST_CONFIG.queries.length} passed`);

        const totalTests = 3 + TEST_CONFIG.queries.length * 2;
        const passedTests = 3 + deepSearchPassed + webSearchPassed;
        
        console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
        
        if (passedTests === totalTests) {
            console.log('🎉 All tests passed! DeepSearch is working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Check the logs above for details.');
        }
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const tester = new DeepSearchTester();
    tester.runAllTests().catch(console.error);
}

module.exports = DeepSearchTester;
