// Test script for quick analysis patterns
const IntelligentPromptAnalyzer = require('./services/intelligentPromptAnalyzer');

function testQuickAnalysis() {
    const analyzer = new IntelligentPromptAnalyzer();
    
    const testQueries = [
        "which tarins go daily from vozag to hyderabad",
        "which trains go from vizag to hyderabad daily",
        "train schedule from mumbai to delhi",
        "explain machine learning"
    ];
    
    console.log('Testing Quick Analysis Patterns...\n');
    
    for (const query of testQueries) {
        console.log(`Query: "${query}"`);
        const result = analyzer.quickAnalysis(query);
        if (result) {
            console.log(`✅ Quick Analysis: ${result.needsWebSearch ? 'WEB SEARCH' : 'STANDARD'} (${result.confidence})`);
            console.log(`   Reasoning: ${result.reasoning}`);
        } else {
            console.log(`❌ Quick Analysis: No pattern matched, needs full analysis`);
        }
        console.log('---');
    }
}

testQuickAnalysis();
