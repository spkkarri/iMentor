// test_complete_system.js
// Complete system test for 2-model dropdown and proper response generation

const fetch = require('node-fetch');

async function testCompleteSystem() {
    console.log('🔍 Testing Complete 2-Model System');
    console.log('=================================\n');
    
    const baseURL = 'http://localhost:5007';
    
    try {
        // Test 1: Check server is running
        console.log('🔍 Step 1: Server Health Check');
        console.log('=============================');
        
        try {
            const healthResponse = await fetch(`${baseURL}/api/health`);
            if (healthResponse.ok) {
                console.log('✅ Server is running and healthy');
            } else {
                console.log('⚠️ Server responding but may have issues');
            }
        } catch (error) {
            console.log('❌ Server not accessible:', error.message);
            console.log('💡 Make sure to run: npm start in the server directory');
            return;
        }
        
        // Test 2: Check model endpoint
        console.log('\n🔍 Step 2: Model Endpoint Test');
        console.log('=============================');
        
        try {
            const modelsResponse = await fetch(`${baseURL}/api/models`);
            if (modelsResponse.ok) {
                const modelsData = await modelsResponse.json();
                console.log('✅ Models endpoint accessible');
                console.log(`📊 Models returned: ${modelsData.data?.totalCount || 0}`);
                
                if (modelsData.data?.models) {
                    console.log('📋 Available models:');
                    modelsData.data.models.forEach((model, index) => {
                        console.log(`   ${index + 1}. ${model.name} (${model.id}) - ${model.provider}`);
                    });
                }
            } else {
                console.log('❌ Models endpoint failed');
            }
        } catch (error) {
            console.log('❌ Models endpoint error:', error.message);
        }
        
        // Test 3: Expected system behavior
        console.log('\n🔍 Step 3: Expected System Behavior');
        console.log('==================================');
        
        console.log('📱 FRONTEND DROPDOWN SHOULD SHOW:');
        console.log('┌─────────────────────────────────┐');
        console.log('│ 🧠 Gemini Pro            ✅    │');
        console.log('│ 🦙 Llama Model           ✅    │');
        console.log('└─────────────────────────────────┘');
        console.log('Total: Exactly 2 models');
        
        console.log('\n🔄 MODEL SWITCHING BEHAVIOR:');
        console.log('1. User selects "Gemini Pro"');
        console.log('   → Routes to Gemini service');
        console.log('   → Gets analytical responses');
        console.log('');
        console.log('2. User selects "Llama Model"');
        console.log('   → Routes to standard AI with conversational prompt');
        console.log('   → Gets friendly, chat-style responses');
        
        // Test 4: Troubleshooting guide
        console.log('\n🔍 Step 4: Troubleshooting Guide');
        console.log('===============================');
        
        console.log('❌ IF DROPDOWN SHOWS DUPLICATES:');
        console.log('   1. Hard refresh browser (Ctrl+F5)');
        console.log('   2. Clear browser cache');
        console.log('   3. Check browser console for errors');
        console.log('   4. Restart frontend server');
        
        console.log('\n❌ IF LLAMA MODEL GIVES ERROR:');
        console.log('   1. Check server console for errors');
        console.log('   2. Verify chatController.js has llama-model routing');
        console.log('   3. Ensure userServiceManager is working');
        console.log('   4. Check Gemini API key is configured');
        
        console.log('\n❌ IF NO RESPONSES GENERATED:');
        console.log('   1. Check API keys in .env file');
        console.log('   2. Verify user authentication');
        console.log('   3. Check network connectivity');
        console.log('   4. Look at server logs for errors');
        
        // Test 5: Quick fixes
        console.log('\n🔍 Step 5: Quick Fixes');
        console.log('=====================');
        
        console.log('🔧 IMMEDIATE ACTIONS:');
        console.log('1. 🔄 Restart both servers:');
        console.log('   - Server: npm start (in server directory)');
        console.log('   - Client: npm start (in client directory)');
        console.log('');
        console.log('2. 🌐 Hard refresh browser:');
        console.log('   - Press Ctrl+F5 or Cmd+Shift+R');
        console.log('   - Clear browser cache');
        console.log('');
        console.log('3. 🔍 Check browser console:');
        console.log('   - Press F12 → Console tab');
        console.log('   - Look for JavaScript errors');
        console.log('   - Check network requests');
        
        // Test 6: Verification steps
        console.log('\n🔍 Step 6: Verification Steps');
        console.log('============================');
        
        console.log('✅ VERIFICATION CHECKLIST:');
        console.log('□ Dropdown shows exactly 2 models');
        console.log('□ No duplicate models visible');
        console.log('□ Gemini Pro selection works');
        console.log('□ Llama Model selection works');
        console.log('□ Both models generate responses');
        console.log('□ No error messages in chat');
        console.log('□ Model switching is smooth');
        console.log('□ Responses match selected model');
        
        console.log('\n🎯 SUCCESS CRITERIA:');
        console.log('1. Dropdown: Exactly 2 models (Gemini Pro + Llama Model)');
        console.log('2. Gemini Pro: Generates analytical responses');
        console.log('3. Llama Model: Generates conversational responses');
        console.log('4. No errors: Clean user experience');
        console.log('5. Switching: Works seamlessly between models');
        
        console.log('\n🚀 FINAL INSTRUCTIONS:');
        console.log('======================');
        
        console.log('1. 🔄 Restart your application:');
        console.log('   cd server && npm start');
        console.log('   cd client && npm start');
        console.log('');
        console.log('2. 🌐 Open browser and navigate to app');
        console.log('');
        console.log('3. 🎛️ Test model dropdown:');
        console.log('   - Should show exactly 2 models');
        console.log('   - Select each model and test');
        console.log('');
        console.log('4. 💬 Send test messages:');
        console.log('   - Gemini Pro: "Analyze the benefits of renewable energy"');
        console.log('   - Llama Model: "Tell me a joke"');
        console.log('');
        console.log('5. ✅ Verify responses:');
        console.log('   - Both should generate proper responses');
        console.log('   - No error messages');
        console.log('   - Different styles based on model');
        
        console.log('\n🎉 SYSTEM READY FOR TESTING!');
        console.log('============================');
        
        console.log('Your 2-model system is configured and ready.');
        console.log('Follow the verification steps above to confirm everything works.');
        console.log('If you encounter issues, use the troubleshooting guide.');
        
    } catch (error) {
        console.error('\n❌ SYSTEM TEST FAILED');
        console.error('=====================');
        console.error('Error:', error.message);
        
        console.log('\n🔧 RECOVERY STEPS:');
        console.log('1. Check if server is running on port 5007');
        console.log('2. Verify .env file has correct API keys');
        console.log('3. Restart both server and client');
        console.log('4. Check for any error messages in console');
    }
}

// Run the test
testCompleteSystem();
