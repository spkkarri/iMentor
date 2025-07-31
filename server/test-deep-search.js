#!/usr/bin/env node
/**
 * Test Deep Search Functionality
 * Tests the deep search service directly without authentication
 */

require('dotenv').config();
const serviceManager = require('./services/serviceManager');

async function testDeepSearch() {
    console.log('🧪 Testing Deep Search Service');
    console.log('===============================\n');

    try {
        // Initialize service manager
        console.log('1️⃣ Initializing ServiceManager...');
        await serviceManager.initialize();
        console.log('✅ ServiceManager initialized\n');

        // Get deep search service
        console.log('2️⃣ Getting Deep Search Service...');
        const deepSearchService = serviceManager.getDeepSearchService('test-user');
        console.log('✅ Deep Search Service obtained\n');

        // Test search
        console.log('3️⃣ Testing Deep Search...');
        console.log('Query: "peanut butter"');
        
        const result = await deepSearchService.performSearch('peanut butter');
        
        console.log('✅ Deep Search completed successfully!');
        console.log('\n📊 Results:');
        console.log('- Success:', !!result);
        console.log('- Has summary:', !!result.summary);
        console.log('- Has sources:', !!result.sources);
        console.log('- Source count:', result.sources ? result.sources.length : 0);
        
        if (result.summary) {
            console.log('\n📝 Summary preview:');
            console.log(result.summary.substring(0, 200) + '...');
        }

        console.log('\n🎉 Deep Search test completed successfully!');
        
    } catch (error) {
        console.error('❌ Deep Search test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testDeepSearch().catch(console.error);
