#!/usr/bin/env node
/**
 * Performance Benchmark Script for Multi-Model LLM System
 * Comprehensive performance testing and validation
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class PerformanceBenchmark {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'http://localhost:3004';
        this.authToken = options.authToken || 'test-token';
        this.outputDir = options.outputDir || path.join(__dirname, '..', 'benchmark-results');
        this.concurrency = options.concurrency || 5;
        this.iterations = options.iterations || 100;
        
        this.results = {
            classification: [],
            routing: [],
            endToEnd: [],
            concurrent: [],
            memory: [],
            errors: []
        };

        this.testQueries = {
            mathematics: [
                'What is 15 + 27?',
                'Solve the equation x² + 5x + 6 = 0',
                'Calculate the derivative of x³',
                'What is the area of a circle with radius 5?',
                'Find the integral of 2x + 3',
                'What is 25% of 80?',
                'Convert 45 degrees to radians',
                'What is the Pythagorean theorem?'
            ],
            programming: [
                'How do you create a function in Python?',
                'What is a for loop?',
                'Explain object-oriented programming',
                'How to debug JavaScript code?',
                'What is recursion?',
                'How to handle exceptions in Python?',
                'What is the difference between == and === in JavaScript?',
                'How to create a REST API?'
            ],
            science: [
                'What is photosynthesis?',
                'Explain Newton\'s laws of motion',
                'What is the periodic table?',
                'How does DNA replication work?',
                'What is the theory of evolution?',
                'Explain the water cycle',
                'What is quantum mechanics?',
                'How do vaccines work?'
            ],
            history: [
                'When did World War II end?',
                'Who was Napoleon Bonaparte?',
                'What caused the American Civil War?',
                'When was the Renaissance period?',
                'Who built the Great Wall of China?',
                'What was the Industrial Revolution?',
                'When did the Roman Empire fall?',
                'Who was Cleopatra?'
            ],
            literature: [
                'Who wrote Romeo and Juliet?',
                'What is a metaphor?',
                'Who wrote Pride and Prejudice?',
                'What is the theme of To Kill a Mockingbird?',
                'Who wrote 1984?',
                'What is iambic pentameter?',
                'Who wrote The Great Gatsby?',
                'What is symbolism in literature?'
            ]
        };
    }

    async run() {
        console.log('🚀 Starting Multi-Model LLM Performance Benchmark');
        console.log('================================================\n');

        try {
            // Ensure output directory exists
            this.ensureOutputDirectory();

            // Run benchmark tests
            await this.benchmarkClassification();
            await this.benchmarkEndToEndQueries();
            await this.benchmarkConcurrentRequests();
            await this.benchmarkMemoryUsage();
            await this.benchmarkAccuracy();

            // Generate report
            await this.generateReport();

            console.log('\n✅ Benchmark completed successfully!');
            console.log(`📊 Results saved to: ${this.outputDir}`);

        } catch (error) {
            console.error('❌ Benchmark failed:', error);
            process.exit(1);
        }
    }

    ensureOutputDirectory() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        const config = {
            method,
            url: `${this.baseUrl}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        };

        if (data) {
            config.data = data;
        }

        const startTime = Date.now();
        try {
            const response = await axios(config);
            const endTime = Date.now();
            return {
                success: true,
                data: response.data,
                responseTime: endTime - startTime,
                status: response.status
            };
        } catch (error) {
            const endTime = Date.now();
            return {
                success: false,
                error: error.message,
                responseTime: endTime - startTime,
                status: error.response?.status || 0
            };
        }
    }

    async benchmarkClassification() {
        console.log('📊 Benchmarking Query Classification...');
        
        const allQueries = Object.values(this.testQueries).flat();
        const results = [];

        for (const query of allQueries) {
            const result = await this.makeRequest('/api/multi-model/classify', 'POST', { query });
            
            results.push({
                query,
                responseTime: result.responseTime,
                success: result.success,
                classification: result.success ? result.data.data : null,
                error: result.error
            });

            if (result.error) {
                this.results.errors.push({
                    test: 'classification',
                    query,
                    error: result.error
                });
            }
        }

        this.results.classification = results;

        const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
        const successRate = (results.filter(r => r.success).length / results.length) * 100;

        console.log(`   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
        console.log(`   Total Queries: ${results.length}\n`);
    }

    async benchmarkEndToEndQueries() {
        console.log('🔄 Benchmarking End-to-End Query Processing...');
        
        const sampleQueries = [
            'What is the quadratic formula?',
            'How do you implement binary search?',
            'Explain photosynthesis in plants',
            'When did the American Revolution start?',
            'Who wrote The Catcher in the Rye?'
        ];

        const results = [];

        for (let i = 0; i < this.iterations; i++) {
            const query = sampleQueries[i % sampleQueries.length];
            const result = await this.makeRequest('/api/multi-model/query', 'POST', { query });
            
            results.push({
                iteration: i + 1,
                query,
                responseTime: result.responseTime,
                success: result.success,
                error: result.error
            });

            if (result.error) {
                this.results.errors.push({
                    test: 'endToEnd',
                    iteration: i + 1,
                    query,
                    error: result.error
                });
            }

            // Progress indicator
            if ((i + 1) % 10 === 0) {
                process.stdout.write(`   Progress: ${i + 1}/${this.iterations}\r`);
            }
        }

        this.results.endToEnd = results;

        const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
        const successRate = (results.filter(r => r.success).length / results.length) * 100;
        const p95ResponseTime = this.calculatePercentile(results.map(r => r.responseTime), 95);
        const p99ResponseTime = this.calculatePercentile(results.map(r => r.responseTime), 99);

        console.log(`\n   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   P95 Response Time: ${p95ResponseTime.toFixed(2)}ms`);
        console.log(`   P99 Response Time: ${p99ResponseTime.toFixed(2)}ms`);
        console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
        console.log(`   Total Iterations: ${results.length}\n`);
    }

    async benchmarkConcurrentRequests() {
        console.log('⚡ Benchmarking Concurrent Request Handling...');
        
        const concurrencyLevels = [1, 2, 5, 10, 20];
        const results = [];

        for (const concurrency of concurrencyLevels) {
            console.log(`   Testing concurrency level: ${concurrency}`);
            
            const promises = [];
            const startTime = Date.now();

            for (let i = 0; i < concurrency; i++) {
                const query = `Concurrent test query ${i}`;
                const promise = this.makeRequest('/api/multi-model/classify', 'POST', { query });
                promises.push(promise);
            }

            const responses = await Promise.all(promises);
            const endTime = Date.now();

            const totalTime = endTime - startTime;
            const avgResponseTime = responses.reduce((sum, r) => sum + r.responseTime, 0) / responses.length;
            const successRate = (responses.filter(r => r.success).length / responses.length) * 100;

            results.push({
                concurrency,
                totalTime,
                avgResponseTime,
                successRate,
                throughput: (concurrency / totalTime) * 1000 // requests per second
            });
        }

        this.results.concurrent = results;

        console.log('   Concurrency Results:');
        results.forEach(result => {
            console.log(`     ${result.concurrency} concurrent: ${result.avgResponseTime.toFixed(2)}ms avg, ${result.throughput.toFixed(2)} req/s`);
        });
        console.log('');
    }

    async benchmarkMemoryUsage() {
        console.log('💾 Benchmarking Memory Usage...');
        
        const results = [];
        const iterations = 50;

        for (let i = 0; i < iterations; i++) {
            // Get memory metrics before request
            const memoryBefore = await this.makeRequest('/api/monitoring/realtime');
            
            // Make a request
            const query = 'Memory usage test query';
            await this.makeRequest('/api/multi-model/query', 'POST', { query });
            
            // Get memory metrics after request
            const memoryAfter = await this.makeRequest('/api/monitoring/realtime');
            
            if (memoryBefore.success && memoryAfter.success) {
                results.push({
                    iteration: i + 1,
                    memoryBefore: memoryBefore.data.data.memoryUsage,
                    memoryAfter: memoryAfter.data.data.memoryUsage,
                    memoryDelta: memoryAfter.data.data.memoryUsage - memoryBefore.data.data.memoryUsage
                });
            }

            // Small delay to allow garbage collection
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.results.memory = results;

        const avgMemoryDelta = results.reduce((sum, r) => sum + r.memoryDelta, 0) / results.length;
        const maxMemoryUsage = Math.max(...results.map(r => r.memoryAfter));

        console.log(`   Average Memory Delta: ${avgMemoryDelta.toFixed(2)}MB`);
        console.log(`   Peak Memory Usage: ${maxMemoryUsage.toFixed(2)}MB`);
        console.log(`   Memory Samples: ${results.length}\n`);
    }

    async benchmarkAccuracy() {
        console.log('🎯 Benchmarking Classification Accuracy...');
        
        const accuracyResults = {};
        let totalCorrect = 0;
        let totalTests = 0;

        for (const [expectedSubject, queries] of Object.entries(this.testQueries)) {
            let correctClassifications = 0;
            
            for (const query of queries) {
                const result = await this.makeRequest('/api/multi-model/classify', 'POST', { query });
                
                if (result.success) {
                    const classifiedSubject = result.data.data.subject;
                    const confidence = result.data.data.confidence;
                    
                    if (classifiedSubject === expectedSubject) {
                        correctClassifications++;
                        totalCorrect++;
                    }
                    
                    totalTests++;
                }
            }
            
            const accuracy = (correctClassifications / queries.length) * 100;
            accuracyResults[expectedSubject] = {
                correct: correctClassifications,
                total: queries.length,
                accuracy: accuracy
            };
            
            console.log(`   ${expectedSubject}: ${accuracy.toFixed(1)}% (${correctClassifications}/${queries.length})`);
        }

        const overallAccuracy = (totalCorrect / totalTests) * 100;
        console.log(`   Overall Accuracy: ${overallAccuracy.toFixed(1)}% (${totalCorrect}/${totalTests})\n`);

        this.results.accuracy = {
            bySubject: accuracyResults,
            overall: {
                correct: totalCorrect,
                total: totalTests,
                accuracy: overallAccuracy
            }
        };
    }

    calculatePercentile(values, percentile) {
        const sorted = values.sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index];
    }

    async generateReport() {
        console.log('📋 Generating Performance Report...');
        
        const report = {
            timestamp: new Date().toISOString(),
            configuration: {
                baseUrl: this.baseUrl,
                concurrency: this.concurrency,
                iterations: this.iterations
            },
            summary: {
                classification: this.summarizeClassification(),
                endToEnd: this.summarizeEndToEnd(),
                concurrent: this.summarizeConcurrent(),
                memory: this.summarizeMemory(),
                accuracy: this.results.accuracy,
                errors: this.results.errors.length
            },
            detailed: this.results
        };

        // Save JSON report
        const jsonPath = path.join(this.outputDir, `benchmark-${Date.now()}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

        // Save CSV summary
        const csvPath = path.join(this.outputDir, `benchmark-summary-${Date.now()}.csv`);
        this.generateCSVReport(report, csvPath);

        // Save human-readable report
        const txtPath = path.join(this.outputDir, `benchmark-report-${Date.now()}.txt`);
        this.generateTextReport(report, txtPath);

        console.log(`   JSON Report: ${jsonPath}`);
        console.log(`   CSV Summary: ${csvPath}`);
        console.log(`   Text Report: ${txtPath}`);
    }

    summarizeClassification() {
        const results = this.results.classification;
        if (results.length === 0) return null;

        const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
        const successRate = (results.filter(r => r.success).length / results.length) * 100;

        return {
            totalQueries: results.length,
            avgResponseTime,
            successRate,
            minResponseTime: Math.min(...results.map(r => r.responseTime)),
            maxResponseTime: Math.max(...results.map(r => r.responseTime))
        };
    }

    summarizeEndToEnd() {
        const results = this.results.endToEnd;
        if (results.length === 0) return null;

        const responseTimes = results.map(r => r.responseTime);
        const avgResponseTime = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
        const successRate = (results.filter(r => r.success).length / results.length) * 100;

        return {
            totalIterations: results.length,
            avgResponseTime,
            successRate,
            p95ResponseTime: this.calculatePercentile(responseTimes, 95),
            p99ResponseTime: this.calculatePercentile(responseTimes, 99),
            minResponseTime: Math.min(...responseTimes),
            maxResponseTime: Math.max(...responseTimes)
        };
    }

    summarizeConcurrent() {
        const results = this.results.concurrent;
        if (results.length === 0) return null;

        return {
            maxConcurrency: Math.max(...results.map(r => r.concurrency)),
            maxThroughput: Math.max(...results.map(r => r.throughput)),
            results: results
        };
    }

    summarizeMemory() {
        const results = this.results.memory;
        if (results.length === 0) return null;

        const avgMemoryDelta = results.reduce((sum, r) => sum + r.memoryDelta, 0) / results.length;
        const maxMemoryUsage = Math.max(...results.map(r => r.memoryAfter));

        return {
            samples: results.length,
            avgMemoryDelta,
            maxMemoryUsage,
            memoryLeakDetected: avgMemoryDelta > 1 // Simple heuristic
        };
    }

    generateCSVReport(report, filePath) {
        const csv = [
            'Metric,Value',
            `Timestamp,${report.timestamp}`,
            `Classification Avg Response Time,${report.summary.classification?.avgResponseTime?.toFixed(2) || 'N/A'}ms`,
            `Classification Success Rate,${report.summary.classification?.successRate?.toFixed(1) || 'N/A'}%`,
            `End-to-End Avg Response Time,${report.summary.endToEnd?.avgResponseTime?.toFixed(2) || 'N/A'}ms`,
            `End-to-End Success Rate,${report.summary.endToEnd?.successRate?.toFixed(1) || 'N/A'}%`,
            `P95 Response Time,${report.summary.endToEnd?.p95ResponseTime?.toFixed(2) || 'N/A'}ms`,
            `P99 Response Time,${report.summary.endToEnd?.p99ResponseTime?.toFixed(2) || 'N/A'}ms`,
            `Max Throughput,${report.summary.concurrent?.maxThroughput?.toFixed(2) || 'N/A'} req/s`,
            `Overall Accuracy,${report.summary.accuracy?.overall?.accuracy?.toFixed(1) || 'N/A'}%`,
            `Total Errors,${report.summary.errors}`
        ].join('\n');

        fs.writeFileSync(filePath, csv);
    }

    generateTextReport(report, filePath) {
        const text = `
Multi-Model LLM Performance Benchmark Report
==========================================

Generated: ${report.timestamp}

CLASSIFICATION PERFORMANCE
-------------------------
Total Queries: ${report.summary.classification?.totalQueries || 'N/A'}
Average Response Time: ${report.summary.classification?.avgResponseTime?.toFixed(2) || 'N/A'}ms
Success Rate: ${report.summary.classification?.successRate?.toFixed(1) || 'N/A'}%
Min Response Time: ${report.summary.classification?.minResponseTime || 'N/A'}ms
Max Response Time: ${report.summary.classification?.maxResponseTime || 'N/A'}ms

END-TO-END PERFORMANCE
---------------------
Total Iterations: ${report.summary.endToEnd?.totalIterations || 'N/A'}
Average Response Time: ${report.summary.endToEnd?.avgResponseTime?.toFixed(2) || 'N/A'}ms
P95 Response Time: ${report.summary.endToEnd?.p95ResponseTime?.toFixed(2) || 'N/A'}ms
P99 Response Time: ${report.summary.endToEnd?.p99ResponseTime?.toFixed(2) || 'N/A'}ms
Success Rate: ${report.summary.endToEnd?.successRate?.toFixed(1) || 'N/A'}%

CONCURRENT PERFORMANCE
---------------------
Max Concurrency Tested: ${report.summary.concurrent?.maxConcurrency || 'N/A'}
Max Throughput: ${report.summary.concurrent?.maxThroughput?.toFixed(2) || 'N/A'} requests/second

MEMORY USAGE
-----------
Memory Samples: ${report.summary.memory?.samples || 'N/A'}
Average Memory Delta: ${report.summary.memory?.avgMemoryDelta?.toFixed(2) || 'N/A'}MB
Peak Memory Usage: ${report.summary.memory?.maxMemoryUsage?.toFixed(2) || 'N/A'}MB
Memory Leak Detected: ${report.summary.memory?.memoryLeakDetected ? 'Yes' : 'No'}

CLASSIFICATION ACCURACY
----------------------
Overall Accuracy: ${report.summary.accuracy?.overall?.accuracy?.toFixed(1) || 'N/A'}%
Total Tests: ${report.summary.accuracy?.overall?.total || 'N/A'}
Correct Classifications: ${report.summary.accuracy?.overall?.correct || 'N/A'}

Subject-Specific Accuracy:
${Object.entries(report.summary.accuracy?.bySubject || {}).map(([subject, data]) => 
    `  ${subject}: ${data.accuracy.toFixed(1)}% (${data.correct}/${data.total})`
).join('\n')}

ERRORS
------
Total Errors: ${report.summary.errors}

${report.detailed.errors.length > 0 ? 
    'Error Details:\n' + report.detailed.errors.map(error => 
        `  ${error.test}: ${error.error}`
    ).join('\n') : 
    'No errors encountered during testing.'
}
`;

        fs.writeFileSync(filePath, text);
    }
}

// Run benchmark if this script is executed directly
if (require.main === module) {
    const benchmark = new PerformanceBenchmark({
        baseUrl: process.env.BENCHMARK_URL || 'http://localhost:3004',
        authToken: process.env.BENCHMARK_TOKEN || 'test-token',
        iterations: parseInt(process.env.BENCHMARK_ITERATIONS) || 50,
        concurrency: parseInt(process.env.BENCHMARK_CONCURRENCY) || 5
    });

    benchmark.run().catch(error => {
        console.error('Benchmark failed:', error);
        process.exit(1);
    });
}

module.exports = PerformanceBenchmark;
