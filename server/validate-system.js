#!/usr/bin/env node
/**
 * System Validation Script
 * Validates that all components of the multi-model system are working
 */

console.log('🔍 Multi-Model LLM System Validation');
console.log('=====================================\n');

async function validateSystem() {
    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    function test(name, testFn) {
        try {
            const result = testFn();
            if (result === true || (result && result.success !== false)) {
                console.log(`✅ ${name}`);
                results.passed++;
                results.tests.push({ name, status: 'PASS', result });
            } else {
                console.log(`❌ ${name}: ${result.error || 'Failed'}`);
                results.failed++;
                results.tests.push({ name, status: 'FAIL', error: result.error || 'Failed' });
            }
        } catch (error) {
            console.log(`❌ ${name}: ${error.message}`);
            results.failed++;
            results.tests.push({ name, status: 'ERROR', error: error.message });
        }
    }

    // Test 1: Configuration System
    test('Configuration System', () => {
        const config = require('./config/multiModelConfig');
        const enabled = config.get('system.enabled');
        const subjects = config.getEnabledSubjects();
        return subjects.length > 0;
    });

    // Test 2: Enhanced Deep Search Service
    test('Enhanced Deep Search Service', () => {
        const EnhancedDeepSearchService = require('./services/enhancedDeepSearchService');
        const service = new EnhancedDeepSearchService('test-user', {}, {});
        return service.classifyQuery !== undefined;
    });

    // Test 3: Query Classification
    test('Query Classification', () => {
        const EnhancedDeepSearchService = require('./services/enhancedDeepSearchService');
        const service = new EnhancedDeepSearchService('test-user', {}, {});
        
        const mathResult = service.classifyQuery('Calculate 15 + 27');
        const progResult = service.classifyQuery('How do you create a function in Python?');
        
        return mathResult.subject === 'mathematics' && progResult.subject === 'programming';
    });

    // Test 4: Multi-Model Service
    test('Multi-Model Service', () => {
        const MultiModelService = require('./services/multiModelService');
        const service = new MultiModelService();
        return service.canHandleSubject('mathematics');
    });

    // Test 5: Metrics Collector
    test('Metrics Collector', () => {
        const MetricsCollector = require('./monitoring/metricsCollector');
        const collector = new MetricsCollector({ enableFileLogging: false });
        const metrics = collector.getMetrics();
        return metrics.system !== undefined;
    });

    // Test 6: Service Manager
    test('Service Manager', () => {
        const serviceManager = require('./services/serviceManager');
        return serviceManager.getServices !== undefined;
    });

    // Test 7: API Routes
    test('Multi-Model Routes', () => {
        const multiModelRoutes = require('./routes/multiModel');
        return multiModelRoutes !== undefined;
    });

    test('Monitoring Routes', () => {
        const monitoringRoutes = require('./routes/monitoring');
        return monitoringRoutes !== undefined;
    });

    // Test 8: Authentication Middleware
    test('Authentication Middleware', () => {
        const auth = require('./middleware/auth');
        return auth.auth !== undefined;
    });

    // Test 9: Configuration CLI
    test('Configuration CLI', () => {
        const ConfigManager = require('./scripts/config-manager');
        return ConfigManager !== undefined;
    });

    // Test 10: Setup Script
    test('Setup Script', () => {
        const MultiModelSetup = require('./scripts/setup-multi-model');
        return MultiModelSetup !== undefined;
    });

    // Test 11: Dataset Structure
    test('Dataset Structure', () => {
        const fs = require('fs');
        const path = require('path');
        const datasetsDir = path.join(__dirname, 'ml_training', 'datasets');
        return fs.existsSync(datasetsDir);
    });

    // Test 12: Python Scripts
    test('Python Scripts', () => {
        const fs = require('fs');
        const path = require('path');
        const prepareScript = path.join(__dirname, 'ml_training', 'scripts', 'prepare_datasets.py');
        return fs.existsSync(prepareScript);
    });

    // Test 13: Model Inference Structure
    test('Model Inference Structure', () => {
        const fs = require('fs');
        const path = require('path');
        const inferenceDir = path.join(__dirname, 'ml_inference');
        return fs.existsSync(inferenceDir);
    });

    // Test 14: Subject Keywords
    test('Subject Keywords', () => {
        const config = require('./config/multiModelConfig');
        const subjects = config.getEnabledSubjects();
        return subjects.every(subject => subject.keywords && subject.keywords.length > 0);
    });

    // Test 15: Pattern Matching
    test('Pattern Matching', () => {
        const EnhancedDeepSearchService = require('./services/enhancedDeepSearchService');
        const service = new EnhancedDeepSearchService('test-user', {}, {});
        
        // Test mathematical expression pattern
        const mathExpr = service.classifyQuery('15 + 27 = ?');
        return mathExpr.subject === 'mathematics';
    });

    console.log('\n📊 Validation Results:');
    console.log('======================');
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

    if (results.failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.tests
            .filter(test => test.status !== 'PASS')
            .forEach(test => {
                console.log(`   • ${test.name}: ${test.error}`);
            });
    }

    console.log('\n🎯 System Status:');
    if (results.failed === 0) {
        console.log('🎉 All systems operational! Multi-model LLM system is ready for use.');
    } else if (results.failed <= 3) {
        console.log('⚠️ System mostly operational with minor issues. Core functionality should work.');
    } else {
        console.log('🚨 System has significant issues. Please review failed tests.');
    }

    console.log('\n📚 Next Steps:');
    console.log('1. Start the server: npm start');
    console.log('2. Test API endpoints: POST /api/multi-model/classify');
    console.log('3. Monitor performance: GET /api/monitoring/metrics');
    console.log('4. Configure subjects: node scripts/config-manager.js subjects');

    return results;
}

// Run validation
validateSystem().catch(error => {
    console.error('Validation failed:', error);
    process.exit(1);
});
