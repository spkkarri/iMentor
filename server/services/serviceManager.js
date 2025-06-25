// server/services/serviceManager.js

const VectorStore = require('./vectorStore');
const DocumentProcessor = require('./documentProcessor');
const GeminiService = require('./geminiService');
const { GeminiAI } = require('./geminiAI');
const DeepSearchService = require('../deep_search/services/deepSearchService');
const DuckDuckGoService = require('../utils/duckduckgo');

class ServiceManager {
  constructor() {
    this.vectorStore = null;
    this.documentProcessor = null;
    this.geminiService = null;
    this.geminiAI = null;
    this.deepSearchServices = new Map(); // Store per-user instances
    this.duckDuckGo = null;
  }

  async initialize() {
    // Instantiate services in the correct order
    this.vectorStore = new VectorStore();
    await this.vectorStore.initialize();

    // Pass dependencies via constructor (Dependency Injection)
    this.documentProcessor = new DocumentProcessor(this.vectorStore);
    
    this.geminiService = new GeminiService();
    await this.geminiService.initialize();

    // Pass dependencies via constructor
    this.geminiAI = new GeminiAI(this.geminiService);
    
    // Initialize DuckDuckGo service
    this.duckDuckGo = new DuckDuckGoService();

    console.log('✅ All services initialized successfully');
  }

  getDeepSearchService(userId) {
    if (!userId) {
      throw new Error('userId is required for DeepSearchService');
    }
    
    // Create new instance if it doesn't exist for this user
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
      geminiService: this.geminiService,
      geminiAI: this.geminiAI,
      duckDuckGo: this.duckDuckGo
    };
  }
}

// Create a single, shared instance of the ServiceManager
const serviceManager = new ServiceManager();

// Export the manager instance, not the class
module.exports = serviceManager;
