// const geminiService = require('./geminiService');
const { SUMMARIZATION_TYPES, SUMMARIZATION_STYLES } = require('../utils/constants');

class GeminiAI {
    constructor(geminiService) {
        this.geminiService = geminiService;
        if (!this.geminiService || !this.geminiService.genAI) {
            this.logger = {
                debug: console.debug,
                info: console.info,
                warn: console.warn,
                error: console.error
            };
            this.logger.warn('Gemini AI service initialization failed. Using fallback mode.');
        }
    }

    async generateChatResponse(userMessage, documentChunks, chatHistory, systemPrompt = '') {
        const context = this.buildContext(documentChunks);
        const historyString = chatHistory.map(msg => {
            const text = msg.parts && msg.parts[0] && msg.parts[0].text ? msg.parts[0].text : msg.content || '';
            return `${msg.role}: ${text}`;
        }).join('\n');

        // Only add RAG instructions if we actually have document context
        const hasDocuments = documentChunks && documentChunks.length > 0 && context && context !== 'No relevant document context available.';

        const ragInstructions = hasDocuments ? `

## IMPORTANT RAG INSTRUCTIONS:
- You have been provided with relevant document content below
- Base your answer STRICTLY on the information found in these documents
- If the documents don't contain enough information to fully answer the question, clearly state what information is missing
- DO NOT add information that is not explicitly mentioned in the provided documents
- If you cannot find relevant information in the documents, say so clearly
- When listing items (like skills, features, etc.), only include those explicitly mentioned in the documents` : '';

        const normalInstructions = !hasDocuments ? `

## INSTRUCTIONS:
- You are a helpful AI assistant with broad knowledge
- Provide accurate, informative, and helpful responses
- Use your training knowledge to answer questions
- Be conversational and engaging
- If you're unsure about something, acknowledge the uncertainty` : '';

        const prompt = `
${systemPrompt}

${hasDocuments ? `\n\n## Relevant Context from Documents:\n${context}` : ''}
${ragInstructions}
${normalInstructions}

## Conversation History:
${historyString}

## User's Latest Message:
${userMessage}

---
You must respond with ONLY a valid JSON object in the following format. Do not include any text before or after the JSON object.
{
  "response": "Your detailed, helpful, and well-formatted answer to the user's message goes here. Use markdown for formatting like lists, bold text, and code blocks.",
  "followUpQuestions": [
    "A relevant follow-up question the user might ask.",
    "Another interesting, related question.",
    "A third potential follow-up question to encourage further exploration."
  ]
}
`;
        
        try {
            if (!this.geminiService || !this.geminiService.model) {
                console.warn('Gemini AI service not properly initialized. Using fallback response.');
                return this.getFallbackResponse(userMessage, context);
            }
            
            const result = await this.geminiService.model.generateContent(prompt);
            const response = result.response;
            let text = response.text().trim();

            // Clean response to extract JSON
            if (text.startsWith('```json')) {
                text = text.replace(/```json\s*/, '').replace(/\s*```$/, '');
            } else if (text.startsWith('```')) {
                text = text.replace(/```\s*/, '').replace(/\s*```$/, '');
            }

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error("Gemini did not return valid JSON. Response:", text);
                return { response: text, followUpQuestions: [] };
            }

            const parsedResponse = JSON.parse(jsonMatch[0]);
            return {
                response: parsedResponse.response || "I'm sorry, I couldn't generate a proper response.",
                followUpQuestions: parsedResponse.followUpQuestions || []
            };

        } catch (error) {
            console.error('Gemini chat response error:', error.message);
            return this.getFallbackResponse(userMessage, context);
        }
    }

    getFallbackResponse(userMessage, context) {
        const baseResponse = context && context !== 'No relevant document context available.'
            ? `I understand you're asking about: "${userMessage}". Based on the available documents, I can see relevant information, but I'm currently unable to provide a detailed AI-generated response.`
            : `I understand you're asking: "${userMessage}". I'm currently unable to provide an AI-generated response.`;
        
        return {
            response: `${baseResponse} Please try again later or contact support if the issue persists.`,
            followUpQuestions: []
        };
    }



    async generateSummary(documentContent, options = {}) {
        if (!this.geminiService?.model) {
            console.error('Gemini summary error: Gemini service or model is not initialized.');
            throw new Error('Failed to generate summary due to AI service initialization issues.');
        }

        const {
            type = SUMMARIZATION_TYPES.MEDIUM,
            style = SUMMARIZATION_STYLES.FORMAL,
            length,
            focus
        } = options;

        const prompt = `
You are an expert summarizer. Generate a ${style} summary of the following document:

${documentContent.substring(0, 4000)}...

Summary requirements:
1. Type: ${type}
2. Style: ${style}
3. Focus: ${focus || 'main points'}
4. Length: ${length ? `${length} words` : 'appropriate'}

Provide the summary in JSON format with these fields:
- text: The main summary text
- keyPoints: Array of bullet points highlighting main points
- sentiment: Overall sentiment (positive, negative, neutral)
- confidence: Confidence score (0-1)
- metadata: {
    wordCount: number of words,
    readingTime: estimated reading time in minutes,
    topics: array of main topics
}

Respond with ONLY a valid JSON object in this format.`;

        try {
            const result = await this.geminiService.model.generateContent(prompt);
            const response = result.response;
            let text = response.text().trim();

            if (text.startsWith('```json')) {
                text = text.replace(/```json\s*/, '').replace(/\s*```$/, '');
            } else if (text.startsWith('```')) {
                text = text.replace(/```\s*/, '').replace(/\s*```$/, '');
            }

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in response');
            }

            const summary = JSON.parse(jsonMatch[0]);
            
            if (!summary || !summary.text || !summary.keyPoints) {
                throw new Error('Invalid summary format');
            }
            
            return summary;
        } catch (error) {
            console.error('Gemini summary error:', error.message);
            throw new Error('Failed to generate summary');
        }
    }

    async generatePodcastScript(documentContent) {
        const summary = await this.generateSummary(documentContent, {
            type: SUMMARIZATION_TYPES.MEDIUM,
            style: SUMMARIZATION_STYLES.CONVERSATIONAL
        });

        const prompt = `
You are an expert podcast scriptwriter. Based on the following summary and key points, create a podcast script for two hosts (Host A and Host B) discussing the key topics in an engaging, conversational style. The script should be structured as an array of JSON objects, each with:
- speaker: "Host A" or "Host B"
- text: The dialogue text (keep each segment between 2-4 sentences for natural flow)

Summary:
${summary.text}

Key Points:
${summary.keyPoints.join('\n')}

Create a script with 8-12 segments, covering all key points from the summary. Use a friendly, informative tone. Make sure Host A and Host B alternate naturally.

Respond with ONLY a valid JSON array of script segments.
`;

        try {
            const result = await this.geminiService.model.generateContent(prompt);
            const response = result.response;
            let text = response.text().trim();

            if (text.startsWith('```json')) {
                text = text.replace(/```json\s*/, '').replace(/\s*```$/, '');
            } else if (text.startsWith('```')) {
                text = text.replace(/```\s*/, '').replace(/\s*```$/, '');
            }

            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('Invalid JSON response from Gemini');
            }

            const script = JSON.parse(jsonMatch[0]);
            if (!Array.isArray(script) || script.length < 8) {
                throw new Error('Podcast script is too short or invalid');
            }

            return script;
        } catch (error) {
            console.error('Gemini podcast script error:', error.message);
            return [
                { speaker: 'Host A', text: 'Sorry, we could not generate the podcast script today.' },
                { speaker: 'Host B', text: 'Let us move on to another topic!' }
            ];
        }
    }

    async generateMindMapFromTranscript(documentContent, title) {
        if (!this.geminiService || !this.geminiService.model) {
            console.error('Gemini mind map error: Gemini service or model is not initialized.');
            throw new Error('Failed to generate mind map due to AI service initialization issues.');
        }

        const truncatedContent = documentContent.substring(0, 8000);

        const prompt = `
Create a comprehensive mind map in Mermaid syntax for the following document content.

Document: "${title}"
Content:
---
${truncatedContent}
---

Requirements:
1. Output ONLY Mermaid syntax starting with 'mindmap'
2. Create central root: "root((${title}))"
3. Identify 4-6 main themes from the document
4. Add 2-4 subtopics under each main theme
5. Use proper indentation (2 spaces per level)
6. Keep labels concise (max 25 characters)
7. Use descriptive node IDs without spaces (use underscores)
8. Add click events for interactivity

Format:
mindmap
  root((${title}))
    Main_Topic_1
      Subtopic_1_1
      Subtopic_1_2
    Main_Topic_2
      Subtopic_2_1
      Subtopic_2_2
    Main_Topic_3
      Subtopic_3_1

After the mindmap structure, add click events:
click Main_Topic_1 handleMermaidNodeClick
click Subtopic_1_1 handleMermaidNodeClick
click Subtopic_1_2 handleMermaidNodeClick
(continue for all nodes)

Generate the mind map now:
`;

        try {
            const result = await this.geminiService.model.generateContent(prompt);
            const response = await result.response;
            let text = await response.text();
            
            text = text.trim();
            if (text.startsWith('```mermaid')) {
                text = text.replace(/```mermaid\s*/, '').replace(/\s*```$/, '').trim();
            } else if (text.startsWith('```')) {
                text = text.replace(/```\s*/, '').replace(/\s*```$/, '').trim();
            }

            if (text.startsWith('mindmap')) {
                return text;
            } else {
                console.warn("AI did not return valid Mermaid syntax. Response:", text);
                throw new Error("Failed to extract valid Mermaid syntax from the AI's response.");
            }
        } catch (error) {
            console.error('Error generating mind map with Gemini:', error);
            throw new Error('Failed to generate mind map data due to an AI service error.');
        }
    }

    async checkQuota() {
        try {
            const testPrompt = "Hello";
            const result = await this.geminiService.model.generateContent(testPrompt);
            const response = result.response;
            
            return {
                remaining: 100,
                limit: 200,
                status: 'available'
            };
        } catch (error) {
            if (error.message && (
                error.message.includes('quota') ||
                error.message.includes('429') ||
                error.message.includes('Too Many Requests') ||
                error.message.includes('exceeded')
            )) {
                return {
                    remaining: 0,
                    limit: 200,
                    status: 'quota_exceeded'
                };
            }
            
            throw error;
        }
    }

    async generateText(prompt) {
        try {
            const result = await this.geminiService.model.generateContent(prompt);
            const response = result.response;
            return response.text().trim();
        } catch (error) {
            console.error('Gemini text generation error:', error.message);

            // Record failed request (if quota manager exists)
            if (this.quotaManager && typeof this.quotaManager.recordFailure === 'function') {
                this.quotaManager.recordFailure(error);
            }

            throw error; // Throw original error to preserve error details
        }
    }

    /**
     * Check current quota status
     */
    async checkQuota() {
        return this.quotaManager.getQuotaStatus();
    }



    buildContext(documentChunks) {
        if (!Array.isArray(documentChunks)) {
            documentChunks = [];
        }
        if (!documentChunks || documentChunks.length === 0) {
            return 'No relevant document context available.';
        }
        return documentChunks
            .map(chunk => `Document: ${chunk.metadata?.source || 'Unknown'}\n${chunk.content}`)
            .join('\n\n');
    }

    buildSystemPrompt(systemPrompt, context, chatHistory) {
        const basePrompt = systemPrompt || 'You are a helpful AI assistant providing accurate and concise answers.';
        const contextSection = context ? `\n\nRelevant Context:\n${context}` : '';
        const historySection = chatHistory && chatHistory.length > 0
            ? `\n\nConversation History:\n${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`
            : '';
        return `${basePrompt}${contextSection}${historySection}`;
    }

    async synthesizeResults(results, query, decomposition) {
        if (!this.geminiService || !this.geminiService.model) {
            return {
                summary: `I'm sorry, but the AI service is unavailable. I found ${results.length} results for your query: "${query}".`,
                sources: results.map(r => r.metadata?.source || r.source || 'Unknown'),
                aiGenerated: false,
                fallback: true
            };
        }
        try {
            const context = results.map(result => `Source: ${result.metadata.source}\nSnippet: ${result.metadata.snippet}`).join('\n\n');
            const prompt = `Based on the following search results, provide a concise answer to the query: "${query}".\n\nContext:\n${context}`;
            
            const result = await this.geminiService.model.generateContent(prompt);
            const text = this.geminiService._processApiResponse(result.response);

            return {
                summary: text,
                sources: results.map(r => r.metadata?.source || r.source),
                aiGenerated: true,
                decomposition: decomposition || []
            };
        } catch (error) {
            console.error('Error in synthesizeResults:', error);
            throw new Error(`Failed to synthesize results for query: "${query}"`);
        }
    }
}

module.exports = { GeminiAI };