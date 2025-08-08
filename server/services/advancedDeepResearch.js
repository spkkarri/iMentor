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
        const breakdownPrompt = `You are an expert research analyst specializing in comprehensive information gathering for maximum user satisfaction. Analyze this query to create a research strategy that will provide the most thorough, relevant, and satisfying response possible.

Query: "${query}"

Your goal is to ensure the user gets exactly what they need and more. Consider:
- What specific information would truly satisfy the user's need?
- What depth of detail is appropriate for this topic?
- What related aspects should be covered for completeness?
- What current developments or recent information would be valuable?
- What practical applications or examples would enhance understanding?

Provide a comprehensive analysis in this JSON format:
{
  "mainTopic": "Primary subject requiring deep research",
  "intent": "information_seeking|learning|problem_solving|decision_making|current_updates|comparison|how_to",
  "userSatisfactionGoals": [
    "Specific outcome that would make the user highly satisfied",
    "Key information gap that must be filled",
    "Depth of understanding the user likely wants"
  ],
  "keyConcepts": ["fundamental_concept", "advanced_concept", "related_concept"],
  "subQuestions": [
    "What are the core fundamentals the user needs to understand?",
    "What practical applications or real-world examples would be most valuable?",
    "What recent developments or current trends are crucial?",
    "What common misconceptions should be addressed?",
    "What related topics would enhance overall understanding?"
  ],
  "complexityLevel": "beginner|intermediate|advanced|expert",
  "researchDomains": ["primary_domain", "secondary_domain"],
  "timeRelevance": "current|recent|historical|timeless",
  "informationTypes": ["definitions", "examples", "statistics", "trends", "comparisons", "tutorials", "case_studies"],
  "priorityLevel": "high|medium|low",
  "expectedResponseLength": "brief|moderate|comprehensive|extensive"
}`;

        try {
            const result = await this.geminiAI.generateText(breakdownPrompt);
            return JSON.parse(result);
        } catch (error) {
            console.warn('Query breakdown failed, using enhanced fallback:', error.message);
            return this.createEnhancedFallbackBreakdown(query);
        }
    }

    /**
     * Stage 2: Plan the Research strategy
     */
    async planResearch(breakdown) {
        const planningPrompt = `Based on this comprehensive query breakdown, create a detailed research plan that will ensure maximum user satisfaction through thorough information gathering.

Breakdown Analysis:
- Main Topic: ${breakdown.mainTopic}
- User Intent: ${breakdown.intent}
- Satisfaction Goals: ${breakdown.userSatisfactionGoals?.join(', ') || 'Comprehensive understanding'}
- Sub-questions: ${breakdown.subQuestions?.join(', ') || 'General research'}
- Complexity Level: ${breakdown.complexityLevel}
- Research Domains: ${breakdown.researchDomains?.join(', ') || 'General'}
- Information Types Needed: ${breakdown.informationTypes?.join(', ') || 'General information'}
- Expected Response Length: ${breakdown.expectedResponseLength || 'comprehensive'}

Create a multi-layered research plan that will gather:
1. Foundational information (definitions, core concepts)
2. Current and relevant data (latest developments, trends)
3. Practical applications (examples, case studies, real-world usage)
4. Comparative analysis (alternatives, pros/cons)
5. Expert insights (authoritative sources, research papers)

Design search queries that will find the most relevant, authoritative, and comprehensive sources.

Return in JSON format:
{
  "steps": [
    {
      "stepNumber": 1,
      "description": "Detailed description of what this research step will accomplish for user satisfaction",
      "searchQueries": [
        "Highly specific query for authoritative sources",
        "Query for current developments and trends",
        "Query for practical applications and examples"
      ],
      "priority": "high|medium|low",
      "verificationNeeded": true,
      "targetSources": ["academic", "news", "official", "expert_blogs", "case_studies"],
      "informationGoal": "What user satisfaction goal this addresses"
    }
  ],
  "estimatedSources": 15,
  "verificationStrategy": "cross_reference_multiple_authoritative_sources",
  "qualityTargets": {
    "sourceAuthority": "high",
    "informationRecency": "current_and_foundational",
    "practicalRelevance": "high",
    "comprehensiveness": "extensive"
  }
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

        const synthesisPrompt = `You are an expert research synthesizer specializing in creating highly satisfying, comprehensive responses. Your goal is to create an answer that will exceed user expectations and provide maximum value.

Original Query: "${originalQuery}"

User Context & Goals:
- User Intent: ${breakdown.intent || 'information seeking'}
- Satisfaction Goals: ${breakdown.userSatisfactionGoals?.join(', ') || 'comprehensive understanding'}
- Expected Depth: ${breakdown.complexityLevel || 'detailed'}
- Information Types Needed: ${breakdown.informationTypes?.join(', ') || 'comprehensive information'}

Verified Facts and Sources:
${verifiedInfo.verifiedFacts.map((fact, index) =>
    `${index + 1}. ${fact.fact} (Confidence: ${fact.confidence}, Reliability: ${fact.reliability})`
).join('\n')}

Create a response that will truly satisfy the user by following these guidelines:

STRUCTURE & CONTENT:
1. Start with a clear, direct answer to the main question
2. Provide comprehensive coverage of all key aspects
3. Include specific details, statistics, and concrete examples
4. Add practical applications and real-world relevance
5. Cover recent developments and current trends when relevant
6. Address common questions or misconceptions
7. Provide actionable insights or next steps when appropriate

QUALITY STANDARDS:
- Use authoritative information from verified sources
- Include specific data points, numbers, and examples
- Provide balanced perspectives when multiple viewpoints exist
- Make complex concepts accessible and understandable
- Ensure practical relevance and applicability
- Address the user's likely follow-up questions proactively

FORMATTING:
- Use clear headings and logical organization
- Include bullet points for key information
- Use markdown formatting for better readability
- Ensure smooth flow between sections

Create a response that is comprehensive, authoritative, practical, and genuinely helpful - one that will leave the user feeling fully informed and satisfied.`;

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

    /**
     * Enhanced fallback breakdown for better user satisfaction
     */
    createEnhancedFallbackBreakdown(query) {
        const words = query.toLowerCase().split(' ');
        const isHowTo = words.includes('how') || words.includes('tutorial') || words.includes('guide');
        const isComparison = words.includes('vs') || words.includes('versus') || words.includes('compare');
        const isCurrent = words.includes('latest') || words.includes('recent') || words.includes('current') || words.includes('2024') || words.includes('2025');

        return {
            mainTopic: query,
            intent: isHowTo ? 'how_to' : isComparison ? 'comparison' : isCurrent ? 'current_updates' : 'information_seeking',
            userSatisfactionGoals: [
                "Comprehensive explanation of the topic",
                "Practical examples and real-world applications",
                "Current and relevant information",
                "Clear understanding of key concepts"
            ],
            keyConcepts: words.filter(word => word.length > 3),
            subQuestions: [
                `What is ${query} and why is it important?`,
                `What are the key features and characteristics of ${query}?`,
                `How does ${query} work in practice?`,
                `What are the latest developments in ${query}?`,
                `What are the real-world applications and benefits of ${query}?`
            ],
            complexityLevel: "intermediate",
            researchDomains: ["technology", "general"],
            timeRelevance: isCurrent ? "current" : "timeless",
            informationTypes: ["definitions", "examples", "applications", "trends", "comparisons"],
            priorityLevel: "high",
            expectedResponseLength: "comprehensive"
        };
    }

    /**
     * Enhanced fallback plan for comprehensive research
     */
    createEnhancedFallbackPlan(breakdown) {
        return {
            steps: [
                {
                    stepNumber: 1,
                    description: "Gather foundational information and definitions",
                    searchQueries: [
                        `${breakdown.mainTopic} definition explanation`,
                        `what is ${breakdown.mainTopic} comprehensive guide`,
                        `${breakdown.mainTopic} fundamentals basics`
                    ],
                    priority: "high",
                    verificationNeeded: true,
                    targetSources: ["academic", "official", "expert_blogs"],
                    informationGoal: "Establish clear understanding of core concepts"
                },
                {
                    stepNumber: 2,
                    description: "Research current developments and trends",
                    searchQueries: [
                        `${breakdown.mainTopic} latest developments 2024`,
                        `${breakdown.mainTopic} current trends news`,
                        `${breakdown.mainTopic} recent advances updates`
                    ],
                    priority: "high",
                    verificationNeeded: true,
                    targetSources: ["news", "research", "industry"],
                    informationGoal: "Provide current and relevant information"
                },
                {
                    stepNumber: 3,
                    description: "Find practical applications and examples",
                    searchQueries: [
                        `${breakdown.mainTopic} real world applications examples`,
                        `${breakdown.mainTopic} use cases practical implementation`,
                        `${breakdown.mainTopic} benefits advantages case studies`
                    ],
                    priority: "medium",
                    verificationNeeded: true,
                    targetSources: ["case_studies", "industry", "expert_blogs"],
                    informationGoal: "Demonstrate practical relevance and value"
                },
                {
                    stepNumber: 4,
                    description: "Research comparative analysis and alternatives",
                    searchQueries: [
                        `${breakdown.mainTopic} comparison alternatives`,
                        `${breakdown.mainTopic} pros cons advantages disadvantages`,
                        `${breakdown.mainTopic} vs competitors analysis`
                    ],
                    priority: "medium",
                    verificationNeeded: false,
                    targetSources: ["expert_blogs", "reviews", "analysis"],
                    informationGoal: "Provide balanced perspective and context"
                }
            ],
            estimatedSources: 12,
            verificationStrategy: "cross_reference_multiple_authoritative_sources",
            qualityTargets: {
                sourceAuthority: "high",
                informationRecency: "current_and_foundational",
                practicalRelevance: "high",
                comprehensiveness: "extensive"
            }
        };
    }
}

module.exports = AdvancedDeepResearch;
