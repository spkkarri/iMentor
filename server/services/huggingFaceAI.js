/**
 * Hugging Face AI Service
 * Free AI inference API with generous limits
 */

const axios = require('axios');

class HuggingFaceAI {
    constructor() {
        // Hugging Face provides free inference API
        this.apiUrl = 'https://api-inference.huggingface.co/models';
        this.apiKey = process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY;
        this.models = {
            text: 'microsoft/DialoGPT-medium',
            textGeneration: 'gpt2',
            summarization: 'facebook/bart-large-cnn',
            questionAnswering: 'deepset/roberta-base-squad2'
        };
        this.requestCount = 0;
        this.dailyLimit = 1000; // Much higher than Gemini
        this.isEnabled = true;
    }

    async generateText(prompt, maxLength = 500) {
        if (!this.isEnabled || this.requestCount >= this.dailyLimit) {
            throw new Error('Hugging Face API quota exceeded');
        }

        try {
            this.requestCount++;
            
            const response = await axios.post(
                `${this.apiUrl}/${this.models.textGeneration}`,
                {
                    inputs: prompt,
                    parameters: {
                        max_length: maxLength,
                        temperature: 0.7,
                        do_sample: true,
                        return_full_text: false
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                    },
                    timeout: 30000
                }
            );

            if (response.data && response.data[0] && response.data[0].generated_text) {
                const generatedText = response.data[0].generated_text.trim();
                console.log(`✅ Hugging Face API success (${this.requestCount}/${this.dailyLimit})`);
                return generatedText;
            }

            throw new Error('No generated text in response');

        } catch (error) {
            console.error('Hugging Face API error:', error.message);
            
            if (error.response?.status === 429) {
                console.warn('🚫 Hugging Face rate limited');
                this.isEnabled = false;
            }
            
            throw new Error('Failed to generate text with Hugging Face');
        }
    }

    async answerQuestion(context, question) {
        if (!this.isEnabled || this.requestCount >= this.dailyLimit) {
            throw new Error('Hugging Face API quota exceeded');
        }

        try {
            this.requestCount++;
            
            const response = await axios.post(
                `${this.apiUrl}/${this.models.questionAnswering}`,
                {
                    inputs: {
                        question: question,
                        context: context
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                    },
                    timeout: 30000
                }
            );

            if (response.data && response.data.answer) {
                console.log(`✅ Hugging Face QA success (${this.requestCount}/${this.dailyLimit})`);
                return response.data.answer;
            }

            throw new Error('No answer in response');

        } catch (error) {
            console.error('Hugging Face QA error:', error.message);
            throw new Error('Failed to answer question with Hugging Face');
        }
    }

    async summarizeText(text) {
        if (!this.isEnabled || this.requestCount >= this.dailyLimit) {
            throw new Error('Hugging Face API quota exceeded');
        }

        try {
            this.requestCount++;
            
            const response = await axios.post(
                `${this.apiUrl}/${this.models.summarization}`,
                {
                    inputs: text,
                    parameters: {
                        max_length: 150,
                        min_length: 50
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
                    },
                    timeout: 30000
                }
            );

            if (response.data && response.data[0] && response.data[0].summary_text) {
                console.log(`✅ Hugging Face summarization success (${this.requestCount}/${this.dailyLimit})`);
                return response.data[0].summary_text;
            }

            throw new Error('No summary in response');

        } catch (error) {
            console.error('Hugging Face summarization error:', error.message);
            throw new Error('Failed to summarize with Hugging Face');
        }
    }

    getStatus() {
        return {
            service: 'HuggingFace',
            enabled: this.isEnabled,
            requestCount: this.requestCount,
            dailyLimit: this.dailyLimit,
            remaining: this.dailyLimit - this.requestCount
        };
    }

    reset() {
        this.requestCount = 0;
        this.isEnabled = true;
        console.log('🔄 Hugging Face quota reset');
    }
}

module.exports = HuggingFaceAI;
