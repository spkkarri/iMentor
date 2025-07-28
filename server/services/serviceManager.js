// server/services/serviceManager.js

const langchainVectorStore = require('./LangchainVectorStore');
const DocumentProcessor = require('./documentProcessor');
const GeminiAI = require('./geminiAI'); // <-- Use the consolidated service
const DeepSearchService = require('../deep_search/services/deepSearchService');
const DuckDuckGoService = require('../utils/duckduckgo');
const personalizationService = require('./personalizationService');

class ServiceManager {
  constructor() {
    this.vectorStore = null;
    this.documentProcessor = null;
    this.geminiAI = null; // <-- Simplified
    this.deepSearchServices = new Map();
    this.duckDuckGo = null;
    this.personalizationService = null;
  }

  async initialize() {
    this.vectorStore = langchainVectorStore; 
    await this.vectorStore.initialize();

    this.documentProcessor = new DocumentProcessor(this.vectorStore);
    
    // --- MODIFICATION: Initialize the single GeminiAI service ---
    this.geminiAI = GeminiAI; // It initializes itself in its constructor
    
    this.duckDuckGo = new DuckDuckGoService();
    this.personalizationService = personalizationService;

    console.log('✅ All services initialized successfully.');
  }

  getDeepSearchService(userId) {
    if (!userId) {
      throw new Error('userId is required for DeepSearchService');
    }
    
    if (!this.deepSearchServices.has(userId)) {
      const deepSearchService = new DeepSearchService(userId, this.geminiAI, this.duckDuckGo);
      this.deepSearchServices.set(userId, deepSearchService);
      console.log(`Created DeepSearchService for user: ${userId}`);
    }
    
    return this.deepSearchServices.get(userId);
  }

  getServices() {
    return {
      vectorStore: this.vectorStore,
      documentProcessor: this.documentProcessor,
      geminiAI: this.geminiAI, // <-- Simplified
      duckDuckGo: this.duckDuckGo,
      personalizationService: this.personalizationService,
    };
  }
}

const serviceManager = new ServiceManager();
module.exports = serviceManager;