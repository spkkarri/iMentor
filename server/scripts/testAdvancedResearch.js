// server/scripts/testAdvancedResearch.js
// Test script for Advanced Deep Research functionality

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const AdvancedDeepResearch = require('../services/advancedDeepResearch');

async function testAdvancedResearch() {
    try {
        console.log('🧪 Testing Advanced Deep Research System');
        console.log('=====================================\n');
        
        const researchEngine = new AdvancedDeepResearch();
        
        // Test query
        const testQuery = "What are the latest developments in artificial intelligence in 2024?";
        console.log(`📝 Test Query: "${testQuery}"`);
        console.log('⏱️ Starting research...\n');
        
        const startTime = Date.now();
        const result = await researchEngine.conductDeepResearch(testQuery, []);
        const endTime = Date.now();
        
        console.log('\n🎯 RESEARCH RESULTS');
        console.log('==================');
        console.log(`⏱️ Total Time: ${endTime - startTime}ms`);
        console.log(`🔬 Research Stages: ${result.metadata.researchStages}`);
        console.log(`📚 Sources Found: ${result.metadata.sourcesFound}`);
        console.log(`✅ Verified Facts: ${result.metadata.verifiedFacts}`);
        console.log(`🎯 Confidence Level: ${result.metadata.confidenceLevel}`);
        
        console.log('\n📊 VERIFICATION BREAKDOWN');
        console.log('========================');
        if (result.metadata.verificationResults) {
            console.log(`🟢 High Confidence: ${result.metadata.verificationResults.highConfidence}`);
            console.log(`🟡 Medium Confidence: ${result.metadata.verificationResults.mediumConfidence}`);
            console.log(`🟠 Low Confidence: ${result.metadata.verificationResults.lowConfidence}`);
        }
        
        console.log('\n🌐 SOURCES');
        console.log('=========');
        if (result.metadata.sources && result.metadata.sources.length > 0) {
            result.metadata.sources.slice(0, 5).forEach((source, index) => {
                console.log(`${index + 1}. ${source.title || 'Untitled'}`);
                console.log(`   URL: ${source.url || 'No URL'}`);
                console.log(`   Confidence: ${source.confidence || 'Unknown'}`);
                console.log('');
            });
            
            if (result.metadata.sources.length > 5) {
                console.log(`... and ${result.metadata.sources.length - 5} more sources`);
            }
        } else {
            console.log('❌ No sources found');
        }
        
        console.log('\n📝 ANSWER PREVIEW');
        console.log('================');
        const answerPreview = result.answer.substring(0, 300);
        console.log(answerPreview + (result.answer.length > 300 ? '...' : ''));
        
        console.log('\n🔍 DEBUG INFO');
        console.log('=============');
        if (result.metadata.debug) {
            console.log(`Retrieved Data Count: ${result.metadata.debug.retrievedDataCount}`);
            console.log(`Has Actual Sources: ${result.metadata.debug.hasActualSources}`);
            console.log(`Search Engine Used: ${result.metadata.debug.searchEngineUsed}`);
        }
        
        console.log('\n✅ Test completed successfully!');
        
        // Test assessment
        if (result.metadata.sourcesFound > 0 && result.metadata.verifiedFacts > 0) {
            console.log('🎉 SYSTEM STATUS: WORKING CORRECTLY');
            console.log('✅ Sources are being retrieved');
            console.log('✅ Facts are being verified');
            console.log('✅ Research process is complete');
        } else {
            console.log('⚠️ SYSTEM STATUS: NEEDS ATTENTION');
            if (result.metadata.sourcesFound === 0) {
                console.log('❌ No sources being retrieved - check search engine');
            }
            if (result.metadata.verifiedFacts === 0) {
                console.log('❌ No facts being verified - check verification process');
            }
        }
        
    } catch (error) {
        console.error('\n❌ TEST FAILED');
        console.error('==============');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\n🔧 TROUBLESHOOTING TIPS');
        console.log('======================');
        console.log('1. Check if Gemini API key is configured');
        console.log('2. Verify internet connection for web searches');
        console.log('3. Check if all required services are initialized');
        console.log('4. Review server logs for detailed error information');
    }
    
    process.exit(0);
}

// Run the test
testAdvancedResearch();
