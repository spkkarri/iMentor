/**
 * Cohere AI Service
 * Free tier with good text generation capabilities
 */

const axios = require('axios');

class CohereAI {
    constructor() {
        this.apiUrl = 'https://api.cohere.ai/v1';
        this.apiKey = process.env.Cohere_API_Key || process.env.COHERE_API_KEY || 'trial-key';
        this.models = ['command', 'command-light', 'base'];
        this.currentModelIndex = 0;
        this.requestCount = 0;
        this.dailyLimit = 100; // Free tier limit
        this.isEnabled = true;
    }

    getCurrentModel() {
        return this.models[this.currentModelIndex];
    }

    switchToNextModel() {
        this.currentModelIndex = (this.currentModelIndex + 1) % this.models.length;
        console.log(`🔄 Switched to Cohere model: ${this.getCurrentModel()}`);
    }

    async generateText(prompt, maxTokens = 500) {
        if (!this.isEnabled || this.requestCount >= this.dailyLimit) {
            throw new Error('Cohere AI quota exceeded');
        }

        let attempts = 0;
        const maxAttempts = this.models.length;

        while (attempts < maxAttempts) {
            try {
                this.requestCount++;
                
                const response = await axios.post(
                    `${this.apiUrl}/generate`,
                    {
                        model: this.getCurrentModel(),
                        prompt: prompt,
                        max_tokens: maxTokens,
                        temperature: 0.7,
                        k: 0,
                        stop_sequences: [],
                        return_likelihoods: 'NONE'
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.apiKey}`,
                            'Cohere-Version': '2022-12-06'
                        },
                        timeout: 30000
                    }
                );

                if (response.data?.generations?.[0]?.text) {
                    const text = response.data.generations[0].text.trim();
                    console.log(`✅ Cohere AI success with ${this.getCurrentModel()} (${this.requestCount}/${this.dailyLimit})`);
                    return text;
                }

                throw new Error('No generated text in response');

            } catch (error) {
                console.error(`Cohere AI error with ${this.getCurrentModel()}:`, error.message);
                
                if (error.response?.status === 429 || error.response?.status === 402) {
                    console.warn(`🚫 Cohere model ${this.getCurrentModel()} rate limited`);
                    this.switchToNextModel();
                    attempts++;
                    continue;
                }
                
                if (attempts === maxAttempts - 1) {
                    throw new Error('All Cohere AI models failed');
                }
                
                this.switchToNextModel();
                attempts++;
            }
        }

        throw new Error('Failed to generate text with Cohere AI');
    }

    async summarize(text) {
        if (!this.isEnabled || this.requestCount >= this.dailyLimit) {
            throw new Error('Cohere AI quota exceeded');
        }

        try {
            this.requestCount++;
            
            const response = await axios.post(
                `${this.apiUrl}/summarize`,
                {
                    text: text,
                    length: 'medium',
                    format: 'paragraph',
                    model: 'summarize-xlarge',
                    extractiveness: 'medium',
                    temperature: 0.3
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Cohere-Version': '2022-12-06'
                    },
                    timeout: 30000
                }
            );

            if (response.data?.summary) {
                console.log(`✅ Cohere summarization success (${this.requestCount}/${this.dailyLimit})`);
                return response.data.summary;
            }

            throw new Error('No summary in response');

        } catch (error) {
            console.error('Cohere summarization error:', error.message);
            throw new Error('Failed to summarize with Cohere AI');
        }
    }

    getStatus() {
        return {
            service: 'CohereAI',
            enabled: this.isEnabled,
            currentModel: this.getCurrentModel(),
            requestCount: this.requestCount,
            dailyLimit: this.dailyLimit,
            remaining: this.dailyLimit - this.requestCount,
            availableModels: this.models.length
        };
    }

    reset() {
        this.requestCount = 0;
        this.isEnabled = true;
        this.currentModelIndex = 0;
        console.log('🔄 Cohere AI quota reset');
    }
}

module.exports = CohereAI;
