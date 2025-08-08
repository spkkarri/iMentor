// server/scripts/testMultiLLM.js
// Test script for Intelligent Multi-LLM system

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const IntelligentMultiLLM = require('../services/intelligentMultiLLM');

async function testMultiLLMSystem() {
    try {
        console.log('🧠 Testing Intelligent Multi-LLM System');
        console.log('======================================\n');
        
        const multiLLM = new IntelligentMultiLLM();
        
        // Test queries for different conversation types
        const testQueries = [
            {
                query: "Hello! How are you today?",
                expectedType: "general_chat",
                description: "Casual conversation"
            },
            {
                query: "Solve this step by step: If 2x + 5 = 15, what is x?",
                expectedType: "reasoning",
                description: "Mathematical reasoning"
            },
            {
                query: "Write a Python function to sort a list of dictionaries by a specific key",
                expectedType: "technical",
                description: "Programming task"
            },
            {
                query: "Write a short story about a robot learning to paint",
                expectedType: "creative_writing",
                description: "Creative writing"
            },
            {
                query: "What are the latest developments in quantum computing research?",
                expectedType: "research",
                description: "Research query"
            }
        ];
        
        console.log('🔍 Step 1: Testing Model Availability');
        console.log('====================================');
        
        // Initialize the system
        await multiLLM.initialize();
        
        // Get system status
        const stats = multiLLM.getRoutingStats();
        console.log(`📊 Available Models: ${stats.availableModels.length}`);
        stats.availableModels.forEach(model => {
            console.log(`   ✅ ${model.name} - ${model.specialties.join(', ')}`);
        });
        
        console.log('\n🔍 Step 2: Testing Query Routing');
        console.log('===============================');
        
        for (let i = 0; i < testQueries.length; i++) {
            const test = testQueries[i];
            console.log(`\n🧪 Test ${i + 1}: ${test.description}`);
            console.log(`📝 Query: "${test.query}"`);
            
            try {
                // Test routing only
                const routing = await multiLLM.routeQuery(test.query, []);
                
                console.log(`🎯 Selected Model: ${routing.selectedModel.name}`);
                console.log(`📊 Conversation Type: ${routing.conversationType.type} (confidence: ${routing.confidence})`);
                console.log(`💭 Reasoning: ${routing.reasoning}`);
                console.log(`✅ Expected Type: ${test.expectedType} | Actual: ${routing.conversationType.type} | Match: ${routing.conversationType.type === test.expectedType ? 'YES' : 'NO'}`);
                
            } catch (error) {
                console.error(`❌ Routing failed: ${error.message}`);
            }
        }
        
        console.log('\n🔍 Step 3: Testing Full Response Generation');
        console.log('==========================================');
        
        // Test one full response generation
        const testQuery = "Explain how machine learning works in simple terms";
        console.log(`\n🧪 Full Response Test: "${testQuery}"`);
        
        try {
            const startTime = Date.now();
            const response = await multiLLM.generateResponse(testQuery, []);
            const endTime = Date.now();
            
            console.log(`⏱️ Response Time: ${endTime - startTime}ms`);
            console.log(`🤖 Model Used: ${response.model}`);
            console.log(`📊 Conversation Type: ${response.conversationType}`);
            console.log(`🎯 Confidence: ${response.confidence}`);
            console.log(`💭 Routing Reasoning: ${response.reasoning}`);
            console.log(`📝 Response Length: ${response.response.length} characters`);
            
            // Show response preview
            const preview = response.response.substring(0, 200);
            console.log(`📄 Response Preview: ${preview}${response.response.length > 200 ? '...' : ''}`);
            
            if (response.followUpQuestions && response.followUpQuestions.length > 0) {
                console.log(`❓ Follow-up Questions: ${response.followUpQuestions.length}`);
                response.followUpQuestions.forEach((q, i) => {
                    console.log(`   ${i + 1}. ${q}`);
                });
            }
            
        } catch (error) {
            console.error(`❌ Response generation failed: ${error.message}`);
        }
        
        console.log('\n🔍 Step 4: Testing Conversation Context');
        console.log('=====================================');
        
        // Test with conversation history
        const conversationHistory = [
            { role: 'user', content: 'I need help with a coding problem' },
            { role: 'assistant', content: 'I\'d be happy to help with your coding problem. What programming language are you working with?' },
            { role: 'user', content: 'Python. I need to create a function that finds duplicates in a list' }
        ];
        
        const contextQuery = "Can you show me the most efficient way to do this?";
        console.log(`\n🧪 Context Test: "${contextQuery}"`);
        console.log(`📚 Conversation History: ${conversationHistory.length} messages`);
        
        try {
            const contextResponse = await multiLLM.generateResponse(contextQuery, conversationHistory);
            
            console.log(`🤖 Model Used: ${contextResponse.model}`);
            console.log(`📊 Conversation Type: ${contextResponse.conversationType}`);
            console.log(`🎯 Confidence: ${contextResponse.confidence}`);
            console.log(`💭 Context-aware Routing: ${contextResponse.reasoning}`);
            
            const contextPreview = contextResponse.response.substring(0, 150);
            console.log(`📄 Response Preview: ${contextPreview}...`);
            
        } catch (error) {
            console.error(`❌ Context response failed: ${error.message}`);
        }
        
        console.log('\n🔍 Step 5: System Statistics');
        console.log('===========================');
        
        const finalStats = multiLLM.getRoutingStats();
        console.log(`📊 Total Queries Processed: ${finalStats.totalQueries}`);
        console.log(`🔀 Routing Decisions:`);
        Object.entries(finalStats.routingDecisions).forEach(([type, count]) => {
            console.log(`   ${type}: ${count} queries`);
        });
        
        console.log(`🤖 Model Performance:`);
        Object.entries(finalStats.modelPerformance).forEach(([model, count]) => {
            console.log(`   ${model}: ${count} responses`);
        });
        
        console.log('\n📋 Connector Status:');
        if (finalStats.connectorStatus) {
            finalStats.connectorStatus.forEach(connector => {
                const status = connector.available ? '✅' : '❌';
                console.log(`   ${status} ${connector.name}`);
                if (connector.status && connector.status.specialties) {
                    console.log(`      Specialties: ${connector.status.specialties.join(', ')}`);
                }
            });
        }
        
        console.log('\n✅ Multi-LLM System Test Completed!');
        
        // Assessment
        const availableModels = finalStats.availableModels.length;
        const totalConnectors = finalStats.connectorStatus ? finalStats.connectorStatus.length : 0;
        const workingConnectors = finalStats.connectorStatus ? finalStats.connectorStatus.filter(c => c.available).length : 0;
        
        console.log('\n🎯 SYSTEM ASSESSMENT');
        console.log('===================');
        console.log(`📊 Available Models: ${availableModels}/${totalConnectors}`);
        console.log(`🔗 Working Connectors: ${workingConnectors}/${totalConnectors}`);
        
        if (workingConnectors > 1) {
            console.log('🎉 EXCELLENT: Multiple models available for intelligent routing');
        } else if (workingConnectors === 1) {
            console.log('✅ GOOD: At least one model available (likely Gemini fallback)');
        } else {
            console.log('⚠️ WARNING: No models available - check API configurations');
        }
        
        console.log('\n🔧 SETUP INSTRUCTIONS FOR FULL FUNCTIONALITY:');
        console.log('1. Install Ollama and pull Llama 3.2: `ollama pull llama3.2`');
        console.log('2. Set DEEPSEEK_API_KEY in .env file');
        console.log('3. Set QWEN_API_KEY (or DASHSCOPE_API_KEY) in .env file');
        console.log('4. Restart the server to initialize all connectors');
        
    } catch (error) {
        console.error('\n❌ MULTI-LLM TEST FAILED');
        console.error('========================');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('1. Check if Gemini API key is configured');
        console.log('2. Verify internet connection');
        console.log('3. Check if all required dependencies are installed');
        console.log('4. Review server logs for detailed error information');
    }
    
    process.exit(0);
}

// Run the test
testMultiLLMSystem();
