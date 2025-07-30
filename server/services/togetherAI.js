/**
 * Together AI Service
 * Free tier with multiple open-source models
 */

const axios = require('axios');

class TogetherAI {
    constructor() {
        this.apiUrl = 'https://api.together.xyz/v1/chat/completions';
        // Together AI provides free credits for open-source models
        this.apiKey = process.env.Together_API_Key || process.env.TOGETHER_API_KEY || 'free-tier';
        this.models = [
            'meta-llama/Llama-2-7b-chat-hf',
            'mistralai/Mistral-7B-Instruct-v0.1',
            'NousResearch/Nous-Hermes-2-Yi-34B',
            'teknium/OpenHermes-2.5-Mistral-7B'
        ];
        this.currentModelIndex = 0;
        this.requestCount = 0;
        this.dailyLimit = 200; // Conservative estimate
        this.isEnabled = true;
    }

    getCurrentModel() {
        return this.models[this.currentModelIndex];
    }

    switchToNextModel() {
        this.currentModelIndex = (this.currentModelIndex + 1) % this.models.length;
        console.log(`🔄 Switched to model: ${this.getCurrentModel()}`);
    }

    async generateText(prompt, maxTokens = 500) {
        if (!this.isEnabled || this.requestCount >= this.dailyLimit) {
            throw new Error('Together AI quota exceeded');
        }

        let attempts = 0;
        const maxAttempts = this.models.length;

        while (attempts < maxAttempts) {
            try {
                this.requestCount++;
                
                const response = await axios.post(
                    this.apiUrl,
                    {
                        model: this.getCurrentModel(),
                        messages: [
                            {
                                role: 'user',
                                content: prompt
                            }
                        ],
                        max_tokens: maxTokens,
                        temperature: 0.7,
                        stream: false
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            ...(this.apiKey !== 'free-tier' && { 'Authorization': `Bearer ${this.apiKey}` })
                        },
                        timeout: 30000
                    }
                );

                if (response.data?.choices?.[0]?.message?.content) {
                    const content = response.data.choices[0].message.content.trim();
                    console.log(`✅ Together AI success with ${this.getCurrentModel()} (${this.requestCount}/${this.dailyLimit})`);
                    return content;
                }

                throw new Error('No content in response');

            } catch (error) {
                console.error(`Together AI error with ${this.getCurrentModel()}:`, error.message);
                
                if (error.response?.status === 429 || error.response?.status === 402) {
                    console.warn(`🚫 Model ${this.getCurrentModel()} rate limited or quota exceeded`);
                    this.switchToNextModel();
                    attempts++;
                    continue;
                }
                
                if (attempts === maxAttempts - 1) {
                    throw new Error('All Together AI models failed');
                }
                
                this.switchToNextModel();
                attempts++;
            }
        }

        throw new Error('Failed to generate text with Together AI');
    }

    getStatus() {
        return {
            service: 'TogetherAI',
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
        console.log('🔄 Together AI quota reset');
    }
}

module.exports = TogetherAI;
