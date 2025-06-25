const DeepSearchService = require('../deep_search/services/deepSearchService');
const DuckDuckGoService = require('../utils/duckduckgo');
const geminiServiceDS = require('../services/geminiServiceDS');

// Initialize services
const duckDuckGoService = new DuckDuckGoService();
let deepSearchService = null;

/**
 * Get deep search services
 * @returns {Object} Services object
 */
function getDeepSearchServices() {
    return {
        duckDuckGoService,
        geminiServiceDS
    };
}

/**
 * Get deep search service instance
 * @param {string} userId - The user ID for the service
 * @returns {DeepSearchService} Deep search service instance
 */
function getDeepSearchService(userId = 'default') {
    if (!deepSearchService) {
        deepSearchService = new DeepSearchService(userId);
    }
    return deepSearchService;
}

module.exports = {
    getDeepSearchServices,
    getDeepSearchService
};
