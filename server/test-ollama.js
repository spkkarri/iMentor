// Test script to verify Ollama connection
require('dotenv').config();
const { OllamaService } = require('./services/ollamaService');

async function testOllama() {
    console.log('🦙 Testing Ollama connection...');
    console.log('📍 Ollama URL:', process.env.OLLAMA_URL);
    
    try {
        const ollamaService = new OllamaService();
        
        // Test connection
        console.log('\n1️⃣ Testing connection...');
        const isConnected = await ollamaService.checkConnection();
        
        if (isConnected) {
            console.log('✅ Connection successful!');
            
            // Get available models
            console.log('\n2️⃣ Getting available models...');
            const models = await ollamaService.getAvailableModels();
            console.log('📋 Available models:', models.map(m => m.name));
            
            // Test chat response
            console.log('\n3️⃣ Testing chat response...');
            const response = await ollamaService.generateChatResponse(
                "Hello! Can you tell me a short joke?",
                [],
                [],
                "You are a helpful AI assistant."
            );
            console.log('💬 Chat response:', response.response);
            
            console.log('\n🎉 All tests passed! Ollama is working correctly.');
            
        } else {
            console.log('❌ Connection failed!');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testOllama();
