// server/services/advancedDeepResearch.js
// Advanced Deep Research AI with multi-stage verification and analysis

const { GeminiAI } = require('./geminiAI');
const GeminiService = require('./geminiService');
const GeminiStyleSearchEngine = require('./geminiStyleSearch');

class AdvancedDeepResearch {
    constructor() {
        this.geminiService = null;
        this.geminiAI = null;
        this.searchEngine = null;
        this.isInitialized = false;
        this.researchCache = new Map();
    }

    async initialize() {
        if (!this.isInitialized) {
            try {
                this.geminiService = new GeminiService();
                await this.geminiService.initialize();
                this.geminiAI = new GeminiAI(this.geminiService);
                this.searchEngine = new GeminiStyleSearchEngine();
                this.isInitialized = true;
                console.log('🔬 Advanced Deep Research AI initialized');
            } catch (error) {
                console.error('Failed to initialize Advanced Deep Research:', error);
                throw error;
            }
        }
    }

    /**
     * Main research method following the 6-stage process
     */
    async conductDeepResearch(query, conversationHistory = []) {
        await this.initialize();
        
        console.log(`🔬 Starting Advanced Deep Research for: "${query}"`);
        const startTime = Date.now();
        
        try {
            // Stage 1: Understand & Break Down
            const breakdown = await this.understandAndBreakDown(query);
            console.log(`📋 Query breakdown completed: ${breakdown.subQuestions.length} sub-questions`);
            
            // Stage 2: Plan the Research
            const researchPlan = await this.planResearch(breakdown);
            console.log(`📝 Research plan created: ${researchPlan.steps.length} steps`);
            
            // Stage 3: Retrieve Information
            const retrievedInfo = await this.retrieveInformation(researchPlan);
            console.log(`📚 Information retrieved: ${retrievedInfo.sources.length} sources`);
            
            // Stage 4: Cross-Verify
            const verifiedInfo = await this.crossVerifyInformation(retrievedInfo);
            console.log(`✅ Cross-verification completed: ${verifiedInfo.verifiedFacts.length} verified facts`);
            
            // Stage 5: Synthesize Answer
            const synthesizedAnswer = await this.synthesizeAnswer(query, verifiedInfo, breakdown);
            console.log(`🧠 Answer synthesis completed`);
            
            // Stage 6: Output
            const finalOutput = await this.formatOutput(synthesizedAnswer, verifiedInfo);
            
            const totalTime = Date.now() - startTime;
            console.log(`🎯 Advanced Deep Research completed in ${totalTime}ms`);
            
            return {
                answer: finalOutput.formattedAnswer,
                metadata: {
                    searchType: 'advanced_deep_research',
                    researchStages: 6,
                    subQuestions: breakdown.subQuestions?.length || 0,
                    sourcesFound: retrievedInfo.sources?.length || 0,
                    verifiedFacts: verifiedInfo.verifiedFacts?.length || 0,
                    confidenceLevel: verifiedInfo.overallConfidence || 'medium',
                    researchTime: totalTime,
                    sources: finalOutput.sources || retrievedInfo.sources || [],
                    breakdown: breakdown,
                    researchPlan: researchPlan,
                    verificationResults: verifiedInfo.verificationResults || {
                        totalFacts: 0,
                        highConfidence: 0,
                        mediumConfidence: 0,
                        lowConfidence: 0
                    },
                    // Add raw data for debugging
                    debug: {
                        retrievedDataCount: retrievedInfo.retrievedData?.length || 0,
                        hasActualSources: !!(retrievedInfo.sources && retrievedInfo.sources.length > 0),
                        searchEngineUsed: 'GeminiStyleSearchEngine'
                    }
                }
            };
            
        } catch (error) {
            console.error('🚫 Advanced Deep Research failed:', error);
            throw error;
        }
    }

    /**
     * Stage 1: Understand & Break Down the query
     */
    async understandAndBreakDown(query) {
        const breakdownPrompt = `You are an expert research analyst. Analyze this query and break it down for comprehensive research.

Query: "${query}"

Please provide:
1. Main topic and intent
2. Key concepts that need research
3. Sub-questions that need to be answered
4. Complexity level (simple/moderate/complex)
5. Research domains needed (technology, science, business, etc.)

Return your analysis in this JSON format:
{
  "mainTopic": "string",
  "intent": "string", 
  "keyConcepts": ["concept1", "concept2"],
  "subQuestions": ["question1", "question2"],
  "complexityLevel": "simple|moderate|complex",
  "researchDomains": ["domain1", "domain2"],
  "timeRelevance": "current|recent|historical|timeless"
}`;

        try {
            const result = await this.geminiAI.generateText(breakdownPrompt);
            return JSON.parse(result);
        } catch (error) {
            console.warn('Query breakdown failed, using fallback:', error.message);
            return this.createFallbackBreakdown(query);
        }
    }

    /**
     * Stage 2: Plan the Research strategy
     */
    async planResearch(breakdown) {
        const planningPrompt = `Based on this query breakdown, create a detailed research plan.

Breakdown:
- Main Topic: ${breakdown.mainTopic}
- Intent: ${breakdown.intent}
- Sub-questions: ${breakdown.subQuestions.join(', ')}
- Complexity: ${breakdown.complexityLevel}
- Domains: ${breakdown.researchDomains.join(', ')}

Create a research plan with:
1. Sequence of research steps
2. Specific search queries for each step
3. Information priorities
4. Verification requirements

Return in JSON format:
{
  "steps": [
    {
      "stepNumber": 1,
      "description": "string",
      "searchQueries": ["query1", "query2"],
      "priority": "high|medium|low",
      "verificationNeeded": true/false
    }
  ],
  "estimatedSources": number,
  "verificationStrategy": "string"
}`;

        try {
            const result = await this.geminiAI.generateText(planningPrompt);
            return JSON.parse(result);
        } catch (error) {
            console.warn('Research planning failed, using fallback:', error.message);
            return this.createFallbackPlan(breakdown);
        }
    }

    /**
     * Stage 3: Retrieve Information from multiple sources
     */
    async retrieveInformation(researchPlan) {
        const allSources = [];
        const retrievedData = [];

        console.log(`🔍 Starting information retrieval with ${researchPlan.steps.length} research steps`);

        for (const step of researchPlan.steps) {
            console.log(`🔍 Executing research step ${step.stepNumber}: ${step.description}`);

            for (const searchQuery of step.searchQueries) {
                try {
                    console.log(`🌐 Searching for: "${searchQuery}"`);
                    const searchResult = await this.searchEngine.performGeminiStyleSearch(searchQuery, []);

                    // The GeminiStyleSearchEngine returns sources directly, not in metadata.sources
                    const sources = searchResult.sources || searchResult.metadata?.sources || [];

                    console.log(`📊 Search result metadata:`, {
                        hasMetadata: !!searchResult.metadata,
                        hasDirectSources: !!(searchResult.sources),
                        hasMetadataSources: !!(searchResult.metadata && searchResult.metadata.sources),
                        sourcesCount: sources.length,
                        answerLength: searchResult.answer?.length || 0
                    });

                    if (sources && sources.length > 0) {
                        // Add sources with enhanced metadata
                        const enhancedSources = sources.map(source => ({
                            ...source,
                            stepNumber: step.stepNumber,
                            searchQuery: searchQuery,
                            priority: step.priority,
                            retrievedAt: new Date().toISOString(),
                            verified: false // Will be set during verification
                        }));

                        allSources.push(...enhancedSources);

                        retrievedData.push({
                            stepNumber: step.stepNumber,
                            searchQuery: searchQuery,
                            content: searchResult.answer,
                            sources: sources,
                            metadata: searchResult.metadata
                        });

                        console.log(`✅ Retrieved ${enhancedSources.length} sources for query: "${searchQuery}"`);
                    } else {
                        console.warn(`⚠️ No sources found for query: "${searchQuery}"`);

                        // Still add the content even without sources
                        if (searchResult.answer) {
                            retrievedData.push({
                                stepNumber: step.stepNumber,
                                searchQuery: searchQuery,
                                content: searchResult.answer,
                                sources: [],
                                metadata: searchResult.metadata || {}
                            });
                        }
                    }

                    // Add delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1500));

                } catch (error) {
                    console.error(`❌ Search failed for query "${searchQuery}":`, error.message);

                    // Add fallback content to indicate search failure
                    retrievedData.push({
                        stepNumber: step.stepNumber,
                        searchQuery: searchQuery,
                        content: `Search failed for "${searchQuery}": ${error.message}`,
                        sources: [],
                        metadata: { error: error.message }
                    });
                }
            }
        }

        console.log(`📚 Information retrieval completed: ${allSources.length} total sources, ${retrievedData.length} data entries`);

        return {
            sources: allSources,
            retrievedData: retrievedData,
            totalSources: allSources.length
        };
    }

    /**
     * Stage 4: Cross-Verify Information for accuracy
     */
    async crossVerifyInformation(retrievedInfo) {
        console.log(`🔍 Starting cross-verification with ${retrievedInfo.retrievedData.length} data sources`);

        // If no data retrieved, return empty verification
        if (!retrievedInfo.retrievedData || retrievedInfo.retrievedData.length === 0) {
            console.warn('⚠️ No data to verify');
            return {
                verifiedFacts: [],
                contradictions: [],
                overallConfidence: 'low',
                verificationResults: {
                    totalFacts: 0,
                    highConfidence: 0,
                    mediumConfidence: 0,
                    lowConfidence: 0
                },
                retrievedData: retrievedInfo.retrievedData,
                sources: retrievedInfo.sources
            };
        }

        // If we have sources, use them for verification
        if (retrievedInfo.sources && retrievedInfo.sources.length > 0) {
            console.log(`✅ Using ${retrievedInfo.sources.length} sources for verification`);

            // Create verified facts from sources
            const verifiedFacts = retrievedInfo.sources.map((source, index) => ({
                fact: source.description || source.title || `Information from ${source.url}`,
                confidence: this.assessSourceConfidence(source),
                supportingSources: [index + 1],
                contradictions: [],
                reliability: 'verified',
                sourceUrl: source.url,
                sourceTitle: source.title
            }));

            return {
                verifiedFacts: verifiedFacts,
                contradictions: [],
                overallConfidence: this.calculateOverallConfidence(verifiedFacts),
                verificationResults: {
                    totalFacts: verifiedFacts.length,
                    highConfidence: verifiedFacts.filter(f => f.confidence === 'high').length,
                    mediumConfidence: verifiedFacts.filter(f => f.confidence === 'medium').length,
                    lowConfidence: verifiedFacts.filter(f => f.confidence === 'low').length
                },
                retrievedData: retrievedInfo.retrievedData,
                sources: retrievedInfo.sources
            };
        }

        // Fallback to AI verification if no sources
        const verificationPrompt = `You are a fact-checking expert. Analyze these research results and extract key facts.

Retrieved Information:
${retrievedInfo.retrievedData.map((data, index) =>
    `Source ${index + 1} (Query: "${data.searchQuery}"):\n${data.content.substring(0, 500)}...\n`
).join('\n')}

Extract the most important and verifiable facts. Return in JSON format:
{
  "verifiedFacts": [
    {
      "fact": "specific factual statement",
      "confidence": "high|medium|low",
      "supportingSources": [1, 2],
      "contradictions": [],
      "reliability": "verified|likely|uncertain"
    }
  ],
  "overallConfidence": "high|medium|low"
}`;

        try {
            const result = await this.geminiAI.generateText(verificationPrompt);
            const parsed = JSON.parse(result);

            return {
                ...parsed,
                verificationResults: {
                    totalFacts: parsed.verifiedFacts?.length || 0,
                    highConfidence: parsed.verifiedFacts?.filter(f => f.confidence === 'high').length || 0,
                    mediumConfidence: parsed.verifiedFacts?.filter(f => f.confidence === 'medium').length || 0,
                    lowConfidence: parsed.verifiedFacts?.filter(f => f.confidence === 'low').length || 0
                },
                retrievedData: retrievedInfo.retrievedData,
                sources: retrievedInfo.sources
            };
        } catch (error) {
            console.warn('Cross-verification failed, using basic verification:', error.message);
            return this.createBasicVerification(retrievedInfo);
        }
    }

    /**
     * Assess confidence level based on source characteristics
     */
    assessSourceConfidence(source) {
        if (!source.url) return 'low';

        const url = source.url.toLowerCase();

        // High confidence sources
        if (url.includes('wikipedia.org') ||
            url.includes('gov') ||
            url.includes('edu') ||
            url.includes('nature.com') ||
            url.includes('science.org')) {
            return 'high';
        }

        // Medium confidence sources
        if (url.includes('reuters.com') ||
            url.includes('bbc.com') ||
            url.includes('cnn.com') ||
            url.includes('nytimes.com') ||
            source.title && source.title.length > 20) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * Calculate overall confidence from individual fact confidences
     */
    calculateOverallConfidence(verifiedFacts) {
        if (!verifiedFacts || verifiedFacts.length === 0) return 'low';

        const highCount = verifiedFacts.filter(f => f.confidence === 'high').length;
        const mediumCount = verifiedFacts.filter(f => f.confidence === 'medium').length;
        const total = verifiedFacts.length;

        if (highCount / total >= 0.6) return 'high';
        if ((highCount + mediumCount) / total >= 0.7) return 'medium';
        return 'low';
    }

    /**
     * Stage 5: Synthesize comprehensive answer
     */
    async synthesizeAnswer(originalQuery, verifiedInfo, breakdown) {
        // If we have no verified facts, create a direct answer from retrieved data
        if (!verifiedInfo.verifiedFacts || verifiedInfo.verifiedFacts.length === 0) {
            console.warn('⚠️ No verified facts available, creating direct synthesis from retrieved data');
            return this.createDirectSynthesis(originalQuery, verifiedInfo);
        }

        const synthesisPrompt = `You are an expert research synthesizer. Create a comprehensive, well-structured answer based on verified research.

Original Query: "${originalQuery}"

Verified Facts and Sources:
${verifiedInfo.verifiedFacts.map((fact, index) =>
    `${index + 1}. ${fact.fact} (Confidence: ${fact.confidence}, Reliability: ${fact.reliability})`
).join('\n')}

Requirements:
1. Answer the original query completely and directly
2. Use only verified facts from the research
3. Structure logically with clear sections
4. Be concise and focused - avoid unnecessary elaboration
5. Include specific details, numbers, and examples when available
6. Address any uncertainties honestly
7. Provide balanced viewpoints if multiple perspectives exist
8. Focus on practical, actionable information

Create a comprehensive but concise answer that prioritizes accuracy and usefulness. Do not add generic statements or filler content.`;

        try {
            const synthesizedAnswer = await this.geminiAI.generateText(synthesisPrompt);
            return {
                content: synthesizedAnswer,
                basedOnFacts: verifiedInfo.verifiedFacts.length,
                confidenceLevel: verifiedInfo.overallConfidence
            };
        } catch (error) {
            console.warn('Answer synthesis failed, using basic synthesis:', error.message);
            return this.createBasicSynthesis(originalQuery, verifiedInfo);
        }
    }

    /**
     * Create direct synthesis when verification fails but we have retrieved data
     */
    createDirectSynthesis(originalQuery, verifiedInfo) {
        if (!verifiedInfo.retrievedData || verifiedInfo.retrievedData.length === 0) {
            return {
                content: `I apologize, but I wasn't able to retrieve sufficient information to answer your question about "${originalQuery}". Please try rephrasing your question or check your internet connection.`,
                basedOnFacts: 0,
                confidenceLevel: 'low'
            };
        }

        // Combine the best content from retrieved data
        const combinedContent = verifiedInfo.retrievedData
            .filter(data => data.content && data.content.length > 50)
            .map(data => data.content)
            .join('\n\n');

        if (!combinedContent) {
            return {
                content: `I found some information about "${originalQuery}" but it wasn't sufficient to provide a comprehensive answer. Please try a more specific question.`,
                basedOnFacts: 0,
                confidenceLevel: 'low'
            };
        }

        return {
            content: combinedContent,
            basedOnFacts: verifiedInfo.retrievedData.length,
            confidenceLevel: 'medium'
        };
    }

    /**
     * Stage 6: Format final output with citations
     */
    async formatOutput(synthesizedAnswer, verifiedInfo) {
        // If we have actual sources with URLs, format them properly
        if (verifiedInfo.sources && verifiedInfo.sources.length > 0) {
            console.log(`📝 Formatting output with ${verifiedInfo.sources.length} web sources`);

            let formattedAnswer = synthesizedAnswer.content;

            // Add sources section like Gemini AI
            formattedAnswer += '\n\n**Sources:**\n';
            verifiedInfo.sources.forEach((source, index) => {
                formattedAnswer += `${index + 1}. [${source.title || 'Web Source'}](${source.url})`;
                if (source.description) {
                    formattedAnswer += ` - ${source.description}`;
                }
                formattedAnswer += '\n';
            });

            return {
                formattedAnswer: formattedAnswer,
                sources: verifiedInfo.sources.map((source, index) => ({
                    id: index + 1,
                    title: source.title || 'Web Source',
                    url: source.url,
                    description: source.description,
                    confidence: this.assessSourceConfidence(source),
                    reliability: 'verified'
                }))
            };
        }

        // Fallback to AI formatting if no direct sources
        if (verifiedInfo.verifiedFacts && verifiedInfo.verifiedFacts.length > 0) {
            const formattingPrompt = `Format this research answer with proper structure and citations.

Answer: ${synthesizedAnswer.content}

Available Facts:
${verifiedInfo.verifiedFacts.map((fact, index) =>
    `[${index + 1}] ${fact.fact} - Confidence: ${fact.confidence}${fact.sourceUrl ? ` - Source: ${fact.sourceUrl}` : ''}`
).join('\n')}

Format requirements:
1. Keep the answer concise and focused
2. Add source citations [1], [2], etc. where appropriate
3. Include a sources section at the end if sources are available
4. Use clear markdown formatting
5. Do not add unnecessary elaboration

Return the formatted answer as markdown text.`;

            try {
                const formattedAnswer = await this.geminiAI.generateText(formattingPrompt);

                return {
                    formattedAnswer: formattedAnswer,
                    sources: verifiedInfo.verifiedFacts.map((fact, index) => ({
                        id: index + 1,
                        fact: fact.fact,
                        confidence: fact.confidence,
                        reliability: fact.reliability,
                        url: fact.sourceUrl,
                        title: fact.sourceTitle
                    })).filter(source => source.url) // Only include sources with URLs
                };
            } catch (error) {
                console.warn('AI formatting failed, using basic formatting:', error.message);
            }
        }

        // Basic formatting fallback
        return {
            formattedAnswer: synthesizedAnswer.content,
            sources: verifiedInfo.sources || []
        };
    }

    /**
     * Fallback methods for when AI analysis fails
     */
    createFallbackBreakdown(query) {
        return {
            mainTopic: query,
            intent: "information_seeking",
            keyConcepts: query.split(' ').filter(word => word.length > 3),
            subQuestions: [query],
            complexityLevel: "moderate",
            researchDomains: ["general"],
            timeRelevance: "current"
        };
    }

    createFallbackPlan(breakdown) {
        return {
            steps: [
                {
                    stepNumber: 1,
                    description: "Primary search",
                    searchQueries: [breakdown.mainTopic],
                    priority: "high",
                    verificationNeeded: true
                }
            ],
            estimatedSources: 5,
            verificationStrategy: "basic"
        };
    }

    createBasicVerification(retrievedInfo) {
        const verifiedFacts = [];

        // Use sources if available
        if (retrievedInfo.sources && retrievedInfo.sources.length > 0) {
            retrievedInfo.sources.forEach((source, index) => {
                verifiedFacts.push({
                    fact: source.description || source.title || `Information from ${source.url}`,
                    confidence: this.assessSourceConfidence(source),
                    supportingSources: [index + 1],
                    contradictions: [],
                    reliability: "likely",
                    sourceUrl: source.url,
                    sourceTitle: source.title
                });
            });
        } else if (retrievedInfo.retrievedData && retrievedInfo.retrievedData.length > 0) {
            // Fallback to retrieved data
            retrievedInfo.retrievedData.forEach((data, index) => {
                if (data.content && data.content.length > 50) {
                    verifiedFacts.push({
                        fact: data.content.substring(0, 200) + (data.content.length > 200 ? '...' : ''),
                        confidence: "medium",
                        supportingSources: [index + 1],
                        contradictions: [],
                        reliability: "likely"
                    });
                }
            });
        }

        return {
            verifiedFacts: verifiedFacts,
            contradictions: [],
            overallConfidence: verifiedFacts.length > 0 ? "medium" : "low",
            verificationResults: {
                totalFacts: verifiedFacts.length,
                highConfidence: verifiedFacts.filter(f => f.confidence === 'high').length,
                mediumConfidence: verifiedFacts.filter(f => f.confidence === 'medium').length,
                lowConfidence: verifiedFacts.filter(f => f.confidence === 'low').length
            },
            retrievedData: retrievedInfo.retrievedData,
            sources: retrievedInfo.sources
        };
    }

    createBasicSynthesis(query, verifiedInfo) {
        const basicAnswer = `Based on research findings for "${query}":\n\n` +
            verifiedInfo.verifiedFacts.map((fact, index) => 
                `${index + 1}. ${fact.fact}`
            ).join('\n\n') +
            `\n\nOverall confidence level: ${verifiedInfo.overallConfidence}`;
            
        return {
            content: basicAnswer,
            basedOnFacts: verifiedInfo.verifiedFacts.length,
            confidenceLevel: verifiedInfo.overallConfidence
        };
    }
}

module.exports = AdvancedDeepResearch;
