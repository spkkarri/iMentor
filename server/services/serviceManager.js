// Ensure environment variables are loaded
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const langchainVectorStore = require('./LangchainVectorStore');
const DocumentProcessor = require('./documentProcessor');
const { GeminiAI } = require('./geminiAI'); // Corrected import to use the consolidated service
const GeminiService = require('./geminiService'); // Import the GeminiService class
const DeepSearchService = require('../deep_search/services/deepSearchService');
const EnhancedDeepSearchService = require('./enhancedDeepSearchService');
const MultiModelService = require('./multiModelService');
const DuckDuckGoService = require('./duckduckgo');
const personalizationService = require('./personalizationService');
const MetricsCollector = require('../monitoring/metricsCollector');

class ServiceManager {
  constructor() {
    this.vectorStore = null;
    this.documentProcessor = null;
    this.geminiAI = null; // Simplified, now directly references the initialized GeminiAI instance
    this.deepSearchServices = new Map();
    this.enhancedDeepSearchServices = new Map();
    this.multiModelService = null;
    this.duckDuckGo = null;
    this.personalizationService = null;
    this.useEnhancedSearch = process.env.USE_ENHANCED_SEARCH !== 'false'; // Default to true
    this.metricsCollector = null;
  }

  async initialize() {
    this.vectorStore = langchainVectorStore;
    await this.vectorStore.initialize();

    this.documentProcessor = new DocumentProcessor(this.vectorStore);

    // Initialize the single GeminiAI service
    // Instantiate and initialize the GeminiService
    const geminiService = new GeminiService();
    await geminiService.initialize();
    
    // Instantiate the GeminiAI class with the geminiService instance
    this.geminiAI = new GeminiAI(geminiService);

    this.duckDuckGo = new DuckDuckGoService();
    this.personalizationService = personalizationService;

    // Initialize metrics collector
    console.log('Initializing Metrics Collector...');
    this.metricsCollector = new MetricsCollector({
      logDirectory: require('path').join(__dirname, '..', 'logs'),
      metricsInterval: 60000, // 1 minute
      enableFileLogging: true
    });

    // Initialize multi-model service if enhanced search is enabled
    if (this.useEnhancedSearch) {
      try {
        console.log('Initializing Multi-Model Service...');
        this.multiModelService = new MultiModelService();
        await this.multiModelService.initialize();
        console.log('Multi-Model Service initialized successfully');
      } catch (error) {
        console.warn('Failed to initialize Multi-Model Service:', error.message);
        console.warn('Falling back to standard search functionality');
        this.useEnhancedSearch = false;
      }
    }

    console.log('All services initialized successfully.');
  }

  getDeepSearchService(userId) {
    if (!userId) {
      console.error('[ServiceManager] userId is required for DeepSearchService');
      throw new Error('userId is required for DeepSearchService');
    }

    console.log(`[ServiceManager] Getting DeepSearchService for user: ${userId}`);
    console.log(`[ServiceManager] Enhanced search enabled: ${this.useEnhancedSearch}`);
    console.log(`[ServiceManager] MultiModel service available: ${!!this.multiModelService}`);

    try {
      // Use enhanced search service if available, otherwise fall back to standard
      if (this.useEnhancedSearch && this.multiModelService) {
        if (!this.enhancedDeepSearchServices.has(userId)) {
          console.log(`[ServiceManager] Creating Enhanced DeepSearchService for user: ${userId}`);

          if (!this.geminiAI) {
            console.error('[ServiceManager] GeminiAI service not available');
            throw new Error('GeminiAI service not initialized');
          }

          if (!this.duckDuckGo) {
            console.error('[ServiceManager] DuckDuckGo service not available');
            throw new Error('DuckDuckGo service not initialized');
          }

          const enhancedService = new EnhancedDeepSearchService(userId, this.geminiAI, this.duckDuckGo);
          this.enhancedDeepSearchServices.set(userId, enhancedService);
          console.log(`Created Enhanced DeepSearchService for user: ${userId}`);
        }
        return this.enhancedDeepSearchServices.get(userId);
      } else {
        // Standard deep search service
        if (!this.deepSearchServices.has(userId)) {
          console.log(`[ServiceManager] Creating Standard DeepSearchService for user: ${userId}`);

          if (!this.geminiAI) {
            console.error('[ServiceManager] GeminiAI service not available');
            throw new Error('GeminiAI service not initialized');
          }

          if (!this.duckDuckGo) {
            console.error('[ServiceManager] DuckDuckGo service not available');
            throw new Error('DuckDuckGo service not initialized');
          }

          const deepSearchService = new DeepSearchService(userId, this.geminiAI, this.duckDuckGo);
          this.deepSearchServices.set(userId, deepSearchService);
          console.log(`Created Standard DeepSearchService for user: ${userId}`);
        }
        return this.deepSearchServices.get(userId);
      }
    } catch (error) {
      console.error(`[ServiceManager] Error creating DeepSearchService for user ${userId}:`, error);
      throw error;
    }
  }

  getServices() {
    return {
      vectorStore: this.vectorStore,
      documentProcessor: this.documentProcessor,
      geminiAI: this.geminiAI, // Simplified
      duckDuckGo: this.duckDuckGo,
      personalizationService: this.personalizationService,
      multiModelService: this.multiModelService,
      metricsCollector: this.metricsCollector
    };
  }

  /**
   * Get metrics collector instance
   */
  getMetricsCollector() {
    return this.metricsCollector;
  }

  /**
   * Get comprehensive service status
   */
  async getServiceStatus() {
    const status = {
      vectorStore: !!this.vectorStore,
      documentProcessor: !!this.documentProcessor,
      geminiAI: !!this.geminiAI,
      duckDuckGo: !!this.duckDuckGo,
      personalizationService: !!this.personalizationService,
      enhancedSearchEnabled: this.useEnhancedSearch,
      multiModelService: null,
      activeDeepSearchServices: this.deepSearchServices.size,
      activeEnhancedServices: this.enhancedDeepSearchServices.size
    };

    if (this.multiModelService) {
      try {
        status.multiModelService = await this.multiModelService.getStatus();
      } catch (error) {
        status.multiModelService = { error: error.message };
      }
    }

    return status;
  }

  /**
   * Cleanup all services
   */
  async cleanup() {
    console.log('Cleaning up ServiceManager...');

    // Cleanup enhanced deep search services
    for (const [userId, service] of this.enhancedDeepSearchServices) {
      try {
        if (service.shutdown) {
          await service.shutdown();
        }
      } catch (error) {
        console.error(`Error shutting down enhanced service for user ${userId}:`, error);
      }
    }
    this.enhancedDeepSearchServices.clear();

    // Cleanup standard deep search services
    for (const [userId, service] of this.deepSearchServices) {
      try {
        if (service.shutdown) {
          await service.shutdown();
        }
      } catch (error) {
        console.error(`Error shutting down service for user ${userId}:`, error);
      }
    }
    this.deepSearchServices.clear();

    // Cleanup multi-model service
    if (this.multiModelService) {
      try {
        await this.multiModelService.shutdown();
      } catch (error) {
        console.error('Error shutting down multi-model service:', error);
      }
    }

    console.log('ServiceManager cleanup completed');
  }
}

const serviceManager = new ServiceManager();
module.exports = serviceManager;