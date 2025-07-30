const langchainVectorStore = require('./LangchainVectorStore');
const DocumentProcessor = require('./documentProcessor');
const GeminiAI = require('./geminiAI'); // Corrected import to use the consolidated service
const DeepSearchService = require('../deep_search/services/deepSearchService');
const DuckDuckGoService = require('../utils/duckduckgo');
const personalizationService = require('./personalizationService');

class ServiceManager {
  constructor() {
    this.vectorStore = null;
    this.documentProcessor = null;
    this.geminiAI = null; // Simplified, now directly references the initialized GeminiAI instance
    this.deepSearchServices = new Map();
    this.duckDuckGo = null;
    this.personalizationService = null;
  }

  async initialize() {
    this.vectorStore = langchainVectorStore;
    await this.vectorStore.initialize();

    this.documentProcessor = new DocumentProcessor(this.vectorStore);
    
    // MODIFICATION: Initialize the single GeminiAI service
    // GeminiAI service is designed to be a singleton or handle its own initialization.
    // It's likely `new GeminiAI()` should be called if it's a class, or it's directly exported as an instance.
    // Assuming GeminiAI is a class that needs to be instantiated, then it initializes itself.
    // If GeminiAI is directly an object (singleton), then just assign it.
    // Based on `geminiAI.generateText(prompt)` call in HybridRagService, it suggests `geminiAI` is an instantiated object.
    // If `GeminiAI` itself is a class that needs `initialize()` called, ensure that.
    // For simplicity and assuming GeminiAI's constructor handles its own API key setup:
    this.geminiAI = GeminiAI; // This implies GeminiAI is already an instance or a class with static methods
    // If GeminiAI is a class that needs instantiation and initialization:
    // this.geminiAI = new GeminiAI();
    // await this.geminiAI.initialize(); // Assuming it has an initialize method

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
      geminiAI: this.geminiAI, // Simplified
      duckDuckGo: this.duckDuckGo,
      personalizationService: this.personalizationService,
    };
  }
}

const serviceManager = new ServiceManager();
module.exports = serviceManager;