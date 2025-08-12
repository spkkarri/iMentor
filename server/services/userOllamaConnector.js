// server/services/userOllamaConnector.js
// User-specific Ollama connector that uses user's provided Ollama URL

const OllamaConnector = require('./modelConnectors/ollamaConnector');
const User = require('../models/User');

class UserOllamaConnector {
    constructor() {
        this.userConnectors = new Map(); // Cache user-specific connectors
    }

    /**
     * Get or create Ollama connector for a specific user
     */
    async getUserOllamaConnector(userId) {
        try {
            // Check if we already have a connector for this user
            if (this.userConnectors.has(userId)) {
                return this.userConnectors.get(userId);
            }

            // Get user's Ollama URL from database
            const user = await User.findById(userId).select('ollamaUrl');
            if (!user) {
                throw new Error('User not found');
            }

            const ollamaUrl = user.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
            console.log(`🦙 Creating Ollama connector for user ${userId} with URL: ${ollamaUrl}`);

            // Create new connector with user's URL
            const connector = new OllamaConnector(ollamaUrl);
            await connector.initialize();

            // Cache the connector
            this.userConnectors.set(userId, {
                connector: connector,
                url: ollamaUrl,
                lastUsed: Date.now(),
                userId: userId
            });

            return this.userConnectors.get(userId);

        } catch (error) {
            console.error(`Failed to get Ollama connector for user ${userId}:`, error.message);
            
            // Fallback to default connector using .env URL
            const fallbackConnector = new OllamaConnector(process.env.OLLAMA_URL || 'http://localhost:11434');
            try {
                await fallbackConnector.initialize();
                return {
                    connector: fallbackConnector,
                    url: process.env.OLLAMA_URL || 'http://localhost:11434',
                    lastUsed: Date.now(),
                    userId: userId,
                    isFallback: true
                };
            } catch (fallbackError) {
                console.error('Even fallback Ollama connector failed:', fallbackError.message);
                return null;
            }
        }
    }

    /**
     * Generate response using user's Ollama server
     */
    async generateUserResponse(userId, query, options = {}) {
        const userConnector = await this.getUserOllamaConnector(userId);
        
        if (!userConnector || !userConnector.connector.isAvailable) {
            throw new Error('Ollama not available for this user');
        }

        // Update last used timestamp
        userConnector.lastUsed = Date.now();

        return await userConnector.connector.generateChatResponse(query, options.model, options);
    }

    /**
     * Generate conversation response using user's Ollama server
     */
    async generateUserConversationResponse(userId, messages, options = {}) {
        const userConnector = await this.getUserOllamaConnector(userId);
        
        if (!userConnector || !userConnector.connector.isAvailable) {
            throw new Error('Ollama not available for this user');
        }

        // Update last used timestamp
        userConnector.lastUsed = Date.now();

        return await userConnector.connector.generateConversationResponse(messages, options.model, options);
    }

    /**
     * Get available models for user's Ollama server
     */
    async getUserAvailableModels(userId) {
        const userConnector = await this.getUserOllamaConnector(userId);
        
        if (!userConnector || !userConnector.connector.isAvailable) {
            return [];
        }

        return userConnector.connector.availableModels;
    }

    /**
     * Test user's Ollama connection
     */
    async testUserConnection(userId) {
        try {
            const userConnector = await this.getUserOllamaConnector(userId);
            
            if (!userConnector) {
                return {
                    success: false,
                    error: 'Failed to create Ollama connector',
                    url: 'unknown'
                };
            }

            const testResult = await userConnector.connector.test();
            
            return {
                ...testResult,
                url: userConnector.url,
                isFallback: userConnector.isFallback || false,
                modelsCount: userConnector.connector.availableModels.length
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                url: 'unknown'
            };
        }
    }

    /**
     * Update user's Ollama URL
     */
    async updateUserOllamaUrl(userId, newUrl) {
        try {
            // Validate URL
            new URL(newUrl);

            // Update in database
            await User.findByIdAndUpdate(userId, { ollamaUrl: newUrl });

            // Remove cached connector to force recreation with new URL
            this.userConnectors.delete(userId);

            console.log(`🔄 Updated Ollama URL for user ${userId}: ${newUrl}`);
            
            // Test new connection
            const testResult = await this.testUserConnection(userId);
            
            return {
                success: true,
                message: 'Ollama URL updated successfully',
                newUrl: newUrl,
                connectionTest: testResult
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to update Ollama URL: ${error.message}`
            };
        }
    }

    /**
     * Get user's Ollama status and configuration
     */
    async getUserOllamaStatus(userId) {
        try {
            const user = await User.findById(userId).select('ollamaUrl username');
            if (!user) {
                return {
                    success: false,
                    error: 'User not found'
                };
            }

            const userConnector = this.userConnectors.get(userId);
            const connectionTest = await this.testUserConnection(userId);

            return {
                success: true,
                user: {
                    id: userId,
                    username: user.username,
                    ollamaUrl: user.ollamaUrl
                },
                connection: {
                    isConnected: userConnector ? userConnector.connector.isAvailable : false,
                    lastUsed: userConnector ? new Date(userConnector.lastUsed).toISOString() : null,
                    isCached: this.userConnectors.has(userId)
                },
                test: connectionTest,
                models: connectionTest.success ? await this.getUserAvailableModels(userId) : []
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clean up old cached connectors (call periodically)
     */
    cleanupOldConnectors(maxAgeMinutes = 30) {
        const now = Date.now();
        const maxAge = maxAgeMinutes * 60 * 1000;

        for (const [userId, userConnector] of this.userConnectors.entries()) {
            if (now - userConnector.lastUsed > maxAge) {
                console.log(`🧹 Cleaning up old Ollama connector for user ${userId}`);
                this.userConnectors.delete(userId);
            }
        }
    }

    /**
     * Get system-wide status of all user connectors
     */
    getSystemStatus() {
        const connectors = Array.from(this.userConnectors.entries()).map(([userId, userConnector]) => ({
            userId: userId,
            url: userConnector.url,
            isAvailable: userConnector.connector.isAvailable,
            lastUsed: new Date(userConnector.lastUsed).toISOString(),
            modelsCount: userConnector.connector.availableModels.length,
            isFallback: userConnector.isFallback || false
        }));

        return {
            totalUsers: connectors.length,
            activeConnections: connectors.filter(c => c.isAvailable).length,
            connectors: connectors
        };
    }
}

// Export singleton instance
module.exports = new UserOllamaConnector();
