/**
 * Groq AI Service
 * Ultra-fast inference with free tier
 */

const axios = require('axios');

class GroqAI {
    constructor() {
        this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        this.apiKey = process.env.Groq_API_Key || process.env.GROQ_API_KEY || 'free-tier';
        this.models = [
            'llama3-8b-8192',
            'llama3-70b-8192',
            'mixtral-8x7b-32768',
            'gemma-7b-it'
        ];
        this.currentModelIndex = 0;
        this.requestCount = 0;
        this.dailyLimit = 300; // Groq has generous free limits
        this.isEnabled = true;
    }

    getCurrentModel() {
        return this.models[this.currentModelIndex];
    }

    switchToNextModel() {
        this.currentModelIndex = (this.currentModelIndex + 1) % this.models.length;
        console.log(`🔄 Switched to Groq model: ${this.getCurrentModel()}`);
    }

    async generateText(prompt, maxTokens = 500) {
        if (!this.isEnabled || this.requestCount >= this.dailyLimit) {
            throw new Error('Groq AI quota exceeded');
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
                            'Authorization': `Bearer ${this.apiKey}`
                        },
                        timeout: 30000
                    }
                );

                if (response.data?.choices?.[0]?.message?.content) {
                    const content = response.data.choices[0].message.content.trim();
                    console.log(`✅ Groq AI success with ${this.getCurrentModel()} (${this.requestCount}/${this.dailyLimit})`);
                    return content;
                }

                throw new Error('No content in response');

            } catch (error) {
                console.error(`Groq AI error with ${this.getCurrentModel()}:`, error.message);
                
                if (error.response?.status === 429 || error.response?.status === 402) {
                    console.warn(`🚫 Groq model ${this.getCurrentModel()} rate limited`);
                    this.switchToNextModel();
                    attempts++;
                    continue;
                }
                
                if (attempts === maxAttempts - 1) {
                    throw new Error('All Groq AI models failed');
                }
                
                this.switchToNextModel();
                attempts++;
            }
        }

        throw new Error('Failed to generate text with Groq AI');
    }

    getStatus() {
        return {
            service: 'GroqAI',
            enabled: this.isEnabled,
            currentModel: this.getCurrentModel(),
            requestCount: this.requestCount,
            dailyLimit: this.dailyLimit,
            remaining: this.dailyLimit - this.requestCount,
            availableModels: this.models.length,
            speed: 'ultra-fast'
        };
    }

    reset() {
        this.requestCount = 0;
        this.isEnabled = true;
        this.currentModelIndex = 0;
        console.log('🔄 Groq AI quota reset');
    }
}

module.exports = GroqAI;
