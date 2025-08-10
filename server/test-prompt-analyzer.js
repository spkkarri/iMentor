// Test script for prompt analyzer
const IntelligentPromptAnalyzer = require('./services/intelligentPromptAnalyzer');

async function testPromptAnalyzer() {
    const analyzer = new IntelligentPromptAnalyzer();
    
    const testQueries = [
        "which the trains go from vizag to hyderabad daily?",
        "which tarins go daily from vozag to hyderabad",  // Test typo tolerance
        "what is yesterday cricket match score",
        "what is the weather today",
        "explain machine learning",
        "train schedule from mumbai to delhi",
        "current stock price of apple",
        "how to write python code"
    ];
    
    console.log('Testing Prompt Analyzer...\n');
    
    for (const query of testQueries) {
        console.log(`Query: "${query}"`);
        try {
            const result = await analyzer.shouldUseWebSearch(query, []);
            console.log(`Result: ${result.needsWebSearch ? 'WEB SEARCH' : 'STANDARD'} (${result.confidence})`);
            console.log(`Reasoning: ${result.reasoning}`);
            console.log(`Type: ${result.queryType}`);
            console.log('---');
        } catch (error) {
            console.error(`Error: ${error.message}`);
            console.log('---');
        }
    }
}

testPromptAnalyzer().catch(console.error);
