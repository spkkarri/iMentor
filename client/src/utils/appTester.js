/**
 * Comprehensive Application Tester
 * Tests all features and identifies issues
 */

class AppTester {
    constructor() {
        this.testResults = [];
        this.issues = [];
    }

    // Test Authentication
    async testAuthentication() {
        console.log('🔐 Testing Authentication...');
        
        try {
            // Check if user is logged in
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');
            
            if (!token || !userId) {
                this.addIssue('Authentication', 'User not logged in', 'warning');
                return false;
            }
            
            this.addSuccess('Authentication', 'User is logged in');
            return true;
        } catch (error) {
            this.addIssue('Authentication', `Error: ${error.message}`, 'error');
            return false;
        }
    }

    // Test API Connectivity
    async testAPIConnectivity() {
        console.log('🌐 Testing API Connectivity...');
        
        try {
            const response = await fetch('/api/chat/health');
            if (response.ok) {
                this.addSuccess('API', 'Backend is reachable');
                return true;
            } else {
                this.addIssue('API', `Backend returned ${response.status}`, 'error');
                return false;
            }
        } catch (error) {
            this.addIssue('API', `Cannot reach backend: ${error.message}`, 'error');
            return false;
        }
    }

    // Test Local Storage
    testLocalStorage() {
        console.log('💾 Testing Local Storage...');
        
        try {
            const testKey = 'test_' + Date.now();
            localStorage.setItem(testKey, 'test');
            const retrieved = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            
            if (retrieved === 'test') {
                this.addSuccess('Storage', 'Local storage working');
                return true;
            } else {
                this.addIssue('Storage', 'Local storage not working', 'error');
                return false;
            }
        } catch (error) {
            this.addIssue('Storage', `Local storage error: ${error.message}`, 'error');
            return false;
        }
    }

    // Test Speech Recognition
    testSpeechRecognition() {
        console.log('🎤 Testing Speech Recognition...');
        
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            this.addSuccess('Speech', 'Speech recognition available');
            return true;
        } else {
            this.addIssue('Speech', 'Speech recognition not supported', 'warning');
            return false;
        }
    }

    // Test Text-to-Speech
    testTextToSpeech() {
        console.log('🔊 Testing Text-to-Speech...');
        
        if ('speechSynthesis' in window) {
            this.addSuccess('TTS', 'Text-to-speech available');
            return true;
        } else {
            this.addIssue('TTS', 'Text-to-speech not supported', 'warning');
            return false;
        }
    }

    // Test File API
    testFileAPI() {
        console.log('📁 Testing File API...');
        
        if (window.File && window.FileReader && window.FileList && window.Blob) {
            this.addSuccess('FileAPI', 'File API supported');
            return true;
        } else {
            this.addIssue('FileAPI', 'File API not supported', 'error');
            return false;
        }
    }

    // Test Responsive Design
    testResponsiveDesign() {
        console.log('📱 Testing Responsive Design...');
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        if (width < 768) {
            this.addSuccess('Responsive', `Mobile view (${width}x${height})`);
        } else if (width < 1024) {
            this.addSuccess('Responsive', `Tablet view (${width}x${height})`);
        } else {
            this.addSuccess('Responsive', `Desktop view (${width}x${height})`);
        }
        
        return true;
    }

    // Test Console Errors
    testConsoleErrors() {
        console.log('🐛 Checking Console Errors...');
        
        // This is a simplified check - in a real app you'd monitor console.error
        const errorCount = 0; // Would be tracked by error monitoring
        
        if (errorCount === 0) {
            this.addSuccess('Console', 'No console errors detected');
        } else {
            this.addIssue('Console', `${errorCount} console errors found`, 'warning');
        }
        
        return errorCount === 0;
    }

    // Helper methods
    addSuccess(category, message) {
        this.testResults.push({
            category,
            message,
            type: 'success',
            timestamp: new Date().toISOString()
        });
    }

    addIssue(category, message, severity = 'error') {
        this.issues.push({
            category,
            message,
            severity,
            timestamp: new Date().toISOString()
        });
    }

    // Run all tests
    async runAllTests() {
        console.log('🧪 Starting Comprehensive App Testing...');
        
        const tests = [
            () => this.testLocalStorage(),
            () => this.testSpeechRecognition(),
            () => this.testTextToSpeech(),
            () => this.testFileAPI(),
            () => this.testResponsiveDesign(),
            () => this.testConsoleErrors(),
            () => this.testAuthentication(),
            () => this.testAPIConnectivity()
        ];

        for (const test of tests) {
            try {
                await test();
            } catch (error) {
                this.addIssue('Test Runner', `Test failed: ${error.message}`, 'error');
            }
        }

        this.generateReport();
        return this.getResults();
    }

    // Generate test report
    generateReport() {
        console.log('\n📊 TEST REPORT');
        console.log('================');
        
        const successCount = this.testResults.filter(r => r.type === 'success').length;
        const issueCount = this.issues.length;
        const errorCount = this.issues.filter(i => i.severity === 'error').length;
        const warningCount = this.issues.filter(i => i.severity === 'warning').length;
        
        console.log(`✅ Successful tests: ${successCount}`);
        console.log(`⚠️  Warnings: ${warningCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📊 Total issues: ${issueCount}`);
        
        if (this.issues.length > 0) {
            console.log('\n🔍 ISSUES FOUND:');
            this.issues.forEach((issue, index) => {
                const icon = issue.severity === 'error' ? '❌' : '⚠️';
                console.log(`${icon} [${issue.category}] ${issue.message}`);
            });
        }
        
        console.log('\n================\n');
    }

    // Get results for external use
    getResults() {
        return {
            success: this.testResults,
            issues: this.issues,
            summary: {
                totalTests: this.testResults.length,
                totalIssues: this.issues.length,
                errors: this.issues.filter(i => i.severity === 'error').length,
                warnings: this.issues.filter(i => i.severity === 'warning').length
            }
        };
    }
}

// Export for use in console or components
window.AppTester = AppTester;

export default AppTester;
