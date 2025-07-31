/**
 * Comprehensive Test Suite for Multi-Model LLM System
 * Tests all components of the multi-model architecture
 */

const request = require('supertest');
const app = require('../server');
const serviceManager = require('../services/serviceManager');
const MultiModelService = require('../services/multiModelService');
const EnhancedDeepSearchService = require('../services/enhancedDeepSearchService');
const MetricsCollector = require('../monitoring/metricsCollector');
const config = require('../config/multiModelConfig');

describe('Multi-Model LLM System', () => {
  let authToken;
  let testUserId = 'test-user-123';

  beforeAll(async () => {
    // Initialize services for testing
    await serviceManager.initialize();
    
    // Mock authentication token (you may need to adjust this based on your auth system)
    authToken = 'test-token-123';
  });

  afterAll(async () => {
    // Cleanup
    await serviceManager.cleanup();
  });

  describe('Configuration Management', () => {
    test('should load default configuration', () => {
      const allConfig = config.getAll();
      
      expect(allConfig).toBeDefined();
      expect(allConfig.system).toBeDefined();
      expect(allConfig.subjects).toBeDefined();
      expect(allConfig.classification).toBeDefined();
      expect(allConfig.routing).toBeDefined();
    });

    test('should get enabled subjects', () => {
      const subjects = config.getEnabledSubjects();
      
      expect(Array.isArray(subjects)).toBe(true);
      expect(subjects.length).toBeGreaterThan(0);
      
      // Check that all subjects have required properties
      subjects.forEach(subject => {
        expect(subject).toHaveProperty('id');
        expect(subject).toHaveProperty('name');
        expect(subject).toHaveProperty('keywords');
        expect(subject).toHaveProperty('enabled', true);
      });
    });

    test('should validate configuration', () => {
      const validation = config.validate();
      
      expect(validation).toHaveProperty('valid');
      expect(validation).toHaveProperty('errors');
      
      if (!validation.valid) {
        console.warn('Configuration validation errors:', validation.errors);
      }
    });

    test('should get and set configuration values', () => {
      const originalValue = config.get('system.enabled');
      
      // Test setting a value
      const success = config.set('system.testValue', 'test123');
      expect(success).toBe(true);
      
      // Test getting the value
      const retrievedValue = config.get('system.testValue');
      expect(retrievedValue).toBe('test123');
      
      // Test getting non-existent value
      const nonExistent = config.get('nonexistent.path', 'default');
      expect(nonExistent).toBe('default');
    });
  });

  describe('Query Classification', () => {
    let enhancedService;

    beforeAll(() => {
      enhancedService = new EnhancedDeepSearchService(testUserId, {}, {});
    });

    test('should classify mathematics queries correctly', () => {
      const mathQueries = [
        'What is 2 + 2?',
        'Solve the equation x² + 5x + 6 = 0',
        'Calculate the derivative of x³',
        'What is the area of a circle with radius 5?'
      ];

      mathQueries.forEach(query => {
        const classification = enhancedService.classifyQuery(query);
        expect(classification.subject).toBe('mathematics');
        expect(classification.confidence).toBeGreaterThan(0);
      });
    });

    test('should classify programming queries correctly', () => {
      const programmingQueries = [
        'How do you create a function in Python?',
        'What is a for loop?',
        'Explain object-oriented programming',
        'How to debug JavaScript code?'
      ];

      programmingQueries.forEach(query => {
        const classification = enhancedService.classifyQuery(query);
        expect(classification.subject).toBe('programming');
        expect(classification.confidence).toBeGreaterThan(0);
      });
    });

    test('should classify science queries correctly', () => {
      const scienceQueries = [
        'What is photosynthesis?',
        'Explain Newton\'s laws of motion',
        'What is the periodic table?',
        'How does DNA replication work?'
      ];

      scienceQueries.forEach(query => {
        const classification = enhancedService.classifyQuery(query);
        expect(classification.subject).toBe('science');
        expect(classification.confidence).toBeGreaterThan(0);
      });
    });

    test('should handle ambiguous queries', () => {
      const ambiguousQueries = [
        'Hello, how are you?',
        'What is the weather like?',
        'Tell me a joke'
      ];

      ambiguousQueries.forEach(query => {
        const classification = enhancedService.classifyQuery(query);
        expect(classification.subject).toBe('general');
        expect(classification.confidence).toBe(0);
      });
    });

    test('should use pattern matching for mathematical expressions', () => {
      const mathExpressions = [
        '15 + 27 = ?',
        'x = 5',
        '3.14159',
        '50%'
      ];

      mathExpressions.forEach(query => {
        const classification = enhancedService.classifyQuery(query);
        expect(classification.subject).toBe('mathematics');
      });
    });
  });

  describe('Multi-Model Service', () => {
    let multiModelService;

    beforeAll(async () => {
      multiModelService = new MultiModelService();
      // Note: We may not be able to fully initialize in test environment
    });

    test('should initialize service configuration', () => {
      expect(multiModelService).toBeDefined();
      expect(multiModelService.subjects).toBeDefined();
      expect(multiModelService.fallbackModel).toBe('general');
    });

    test('should check subject availability', () => {
      expect(multiModelService.canHandleSubject('mathematics')).toBe(true);
      expect(multiModelService.canHandleSubject('programming')).toBe(true);
      expect(multiModelService.canHandleSubject('nonexistent')).toBe(false);
    });

    test('should provide fallback response when service unavailable', async () => {
      const query = 'What is 2 + 2?';
      const fallbackResponse = multiModelService.getFallbackResponse(query);
      
      expect(fallbackResponse).toBeDefined();
      expect(fallbackResponse.message).toContain(query);
      expect(fallbackResponse.metadata.fallback_used).toBe(true);
      expect(fallbackResponse.metadata.model_used).toBe('fallback');
    });
  });

  describe('Metrics Collection', () => {
    let metricsCollector;

    beforeAll(() => {
      metricsCollector = new MetricsCollector({
        enableFileLogging: false, // Disable for testing
        metricsInterval: 1000 // Short interval for testing
      });
    });

    test('should initialize with default metrics', () => {
      const metrics = metricsCollector.getMetrics();
      
      expect(metrics.system.totalRequests).toBe(0);
      expect(metrics.system.successfulRequests).toBe(0);
      expect(metrics.system.failedRequests).toBe(0);
      expect(metrics.routing.totalRoutes).toBe(0);
      expect(metrics.classification.totalClassifications).toBe(0);
    });

    test('should record request metrics', () => {
      const requestTracker = metricsCollector.recordRequest({
        query: 'test query',
        subject: 'mathematics'
      });

      // Simulate request completion
      requestTracker.finish(true, 150);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.system.totalRequests).toBe(1);
      expect(metrics.system.successfulRequests).toBe(1);
      expect(metrics.system.averageResponseTime).toBe(150);
    });

    test('should record model usage', () => {
      metricsCollector.recordModelUsage('mathematics', 'mathematics', 200, true);
      metricsCollector.recordModelUsage('mathematics', 'mathematics', 180, true);
      metricsCollector.recordModelUsage('mathematics', 'mathematics', 250, false);

      const metrics = metricsCollector.getMetrics();
      const mathModel = metrics.models.get('mathematics');
      
      expect(mathModel).toBeDefined();
      expect(mathModel.totalUsage).toBe(3);
      expect(mathModel.successfulUsage).toBe(2);
      expect(mathModel.failedUsage).toBe(1);
      expect(mathModel.averageResponseTime).toBe(190); // (200 + 180) / 2
    });

    test('should record routing metrics', () => {
      metricsCollector.recordRouting({
        subject: 'programming',
        success: true,
        fallbackUsed: false,
        routingTime: 50
      });

      metricsCollector.recordRouting({
        subject: 'science',
        success: true,
        fallbackUsed: true,
        routingTime: 75
      });

      const metrics = metricsCollector.getMetrics();
      expect(metrics.routing.totalRoutes).toBe(2);
      expect(metrics.routing.successfulRoutes).toBe(2);
      expect(metrics.routing.fallbackRoutes).toBe(1);
      expect(metrics.routing.averageRoutingTime).toBe(62.5); // (50 + 75) / 2
    });

    test('should record classification metrics', () => {
      metricsCollector.recordClassification({
        subject: 'mathematics',
        confidence: 0.9,
        accurate: true
      });

      metricsCollector.recordClassification({
        subject: 'programming',
        confidence: 0.7,
        accurate: false
      });

      const metrics = metricsCollector.getMetrics();
      expect(metrics.classification.totalClassifications).toBe(2);
      expect(metrics.classification.accurateClassifications).toBe(1);
      expect(metrics.classification.averageConfidence).toBe(0.8); // (0.9 + 0.7) / 2
    });

    test('should generate performance summary', () => {
      const summary = metricsCollector.getPerformanceSummary();
      
      expect(summary).toHaveProperty('uptime');
      expect(summary).toHaveProperty('requests');
      expect(summary).toHaveProperty('routing');
      expect(summary).toHaveProperty('classification');
      expect(summary).toHaveProperty('models');
      expect(summary).toHaveProperty('system');

      expect(summary.requests.successRate).toBeGreaterThanOrEqual(0);
      expect(summary.requests.successRate).toBeLessThanOrEqual(100);
    });
  });

  describe('API Endpoints', () => {
    test('should get multi-model service status', async () => {
      const response = await request(app)
        .get('/api/multi-model/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('enhancedSearchEnabled');
    });

    test('should classify queries via API', async () => {
      const response = await request(app)
        .post('/api/multi-model/classify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: 'What is 2 + 2?' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('subject');
      expect(response.body.data).toHaveProperty('confidence');
      expect(response.body.data.subject).toBe('mathematics');
    });

    test('should get available subjects', async () => {
      const response = await request(app)
        .get('/api/multi-model/subjects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      // Check subject structure
      response.body.data.forEach(subject => {
        expect(subject).toHaveProperty('id');
        expect(subject).toHaveProperty('name');
        expect(subject).toHaveProperty('description');
        expect(subject).toHaveProperty('keywords');
      });
    });

    test('should handle invalid classification requests', async () => {
      const response = await request(app)
        .post('/api/multi-model/classify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({}) // Missing query
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Query is required');
    });

    test('should get monitoring health check', async () => {
      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status', 'healthy');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('memory');
    });

    test('should get monitoring metrics', async () => {
      const response = await request(app)
        .get('/api/monitoring/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('system');
      expect(response.body.data).toHaveProperty('routing');
      expect(response.body.data).toHaveProperty('classification');
    });

    test('should get performance summary', async () => {
      const response = await request(app)
        .get('/api/monitoring/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('requests');
      expect(response.body.data.requests).toHaveProperty('successRate');
    });
  });

  describe('Integration Tests', () => {
    test('should handle end-to-end query processing', async () => {
      const testQuery = 'What is the quadratic formula?';
      
      const response = await request(app)
        .post('/api/multi-model/query')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: testQuery })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('response');
      expect(response.body.data).toHaveProperty('metadata');
      expect(response.body.data.query).toBe(testQuery);
    });

    test('should maintain metrics during query processing', async () => {
      const metricsCollector = serviceManager.getMetricsCollector();
      const initialMetrics = metricsCollector.getMetrics();
      const initialRequests = initialMetrics.system.totalRequests;

      // Process a query
      await request(app)
        .post('/api/multi-model/query')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: 'Test query for metrics' });

      // Check that metrics were updated
      const updatedMetrics = metricsCollector.getMetrics();
      expect(updatedMetrics.system.totalRequests).toBeGreaterThan(initialRequests);
    });

    test('should handle service degradation gracefully', async () => {
      // Test with a complex query that might trigger fallback
      const complexQuery = 'This is a very complex query that might not be easily classified and could potentially trigger fallback mechanisms in the system';
      
      const response = await request(app)
        .post('/api/multi-model/query')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: complexQuery })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('response');
      // Should still get a response even if fallback is used
    });
  });

  describe('Performance Benchmarks', () => {
    test('should classify queries within acceptable time', async () => {
      const testQueries = [
        'What is 2 + 2?',
        'How do you create a Python function?',
        'What is photosynthesis?',
        'When did World War II end?',
        'Who wrote Romeo and Juliet?'
      ];

      const startTime = Date.now();
      
      for (const query of testQueries) {
        await request(app)
          .post('/api/multi-model/classify')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ query });
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / testQueries.length;
      
      // Classification should be fast (under 100ms per query on average)
      expect(averageTime).toBeLessThan(100);
    });

    test('should handle concurrent requests', async () => {
      const concurrentRequests = 5;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/multi-model/classify')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ query: `Test query ${i}` });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});

// Helper function to create test data
function createTestData() {
  return {
    mathQueries: [
      'What is 15 + 27?',
      'Solve x² + 5x + 6 = 0',
      'Calculate the derivative of x³',
      'What is the integral of 2x?'
    ],
    programmingQueries: [
      'How to create a function in Python?',
      'What is a for loop?',
      'Explain recursion',
      'How to debug code?'
    ],
    scienceQueries: [
      'What is photosynthesis?',
      'Explain gravity',
      'What is DNA?',
      'How do cells divide?'
    ]
  };
}

module.exports = {
  createTestData
};
