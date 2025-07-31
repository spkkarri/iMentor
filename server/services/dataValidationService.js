/**
 * Data Validation Service for Training Data
 * Validates and preprocesses data for machine learning training
 */

class DataValidationService {
    constructor() {
        this.validationRules = {
            text: {
                minLength: 10,
                maxLength: 10000,
                allowedCharacters: /^[\w\s\.,!?;:'"()\-\[\]{}@#$%^&*+=<>\/\\|`~]*$/,
                encoding: 'utf-8'
            },
            conversational: {
                minTurns: 2,
                maxTurns: 50,
                requiredFields: ['input', 'output'],
                maxTurnLength: 2000
            },
            classification: {
                minSamples: 10,
                maxClasses: 1000,
                requiredFields: ['text', 'label']
            },
            qa: {
                requiredFields: ['question', 'answer'],
                minQuestionLength: 5,
                minAnswerLength: 1,
                maxQuestionLength: 500,
                maxAnswerLength: 2000
            }
        };
    }

    /**
     * Validate training data based on format and requirements
     */
    async validateTrainingData(data, format, options = {}) {
        try {
            const validationResult = {
                isValid: true,
                errors: [],
                warnings: [],
                statistics: {},
                cleanedData: []
            };

            if (!data || !Array.isArray(data) || data.length === 0) {
                validationResult.isValid = false;
                validationResult.errors.push('Data is empty or not an array');
                return validationResult;
            }

            switch (format) {
                case 'conversational':
                    return await this.validateConversationalData(data, options);
                case 'text_classification':
                    return await this.validateClassificationData(data, options);
                case 'question_answer':
                    return await this.validateQAData(data, options);
                case 'text_generation':
                    return await this.validateTextGenerationData(data, options);
                case 'custom':
                    return await this.validateCustomData(data, options);
                default:
                    validationResult.isValid = false;
                    validationResult.errors.push(`Unsupported format: ${format}`);
                    return validationResult;
            }
        } catch (error) {
            return {
                isValid: false,
                errors: [`Validation failed: ${error.message}`],
                warnings: [],
                statistics: {},
                cleanedData: []
            };
        }
    }

    async validateConversationalData(data, options) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            statistics: {
                totalConversations: data.length,
                totalTurns: 0,
                avgTurnsPerConversation: 0,
                avgInputLength: 0,
                avgOutputLength: 0
            },
            cleanedData: []
        };

        const rules = this.validationRules.conversational;
        let totalTurns = 0;
        let totalInputLength = 0;
        let totalOutputLength = 0;

        for (let i = 0; i < data.length; i++) {
            const conversation = data[i];
            const conversationErrors = [];

            // Check if conversation has required structure
            if (!conversation.turns && !conversation.messages) {
                if (conversation.input && conversation.output) {
                    // Single turn conversation
                    conversation.turns = [{ input: conversation.input, output: conversation.output }];
                } else {
                    conversationErrors.push(`Conversation ${i}: Missing turns/messages or input/output fields`);
                    continue;
                }
            }

            const turns = conversation.turns || conversation.messages || [];
            
            if (turns.length < rules.minTurns) {
                conversationErrors.push(`Conversation ${i}: Too few turns (${turns.length}, minimum ${rules.minTurns})`);
            }

            if (turns.length > rules.maxTurns) {
                result.warnings.push(`Conversation ${i}: Many turns (${turns.length}), consider splitting`);
            }

            const cleanedTurns = [];
            for (let j = 0; j < turns.length; j++) {
                const turn = turns[j];
                
                // Validate required fields
                if (!turn.input && !turn.user && !turn.human) {
                    conversationErrors.push(`Conversation ${i}, Turn ${j}: Missing input field`);
                    continue;
                }

                if (!turn.output && !turn.assistant && !turn.bot && !turn.ai) {
                    conversationErrors.push(`Conversation ${i}, Turn ${j}: Missing output field`);
                    continue;
                }

                // Normalize field names
                const normalizedTurn = {
                    input: turn.input || turn.user || turn.human || '',
                    output: turn.output || turn.assistant || turn.bot || turn.ai || ''
                };

                // Validate text length
                if (normalizedTurn.input.length > rules.maxTurnLength) {
                    result.warnings.push(`Conversation ${i}, Turn ${j}: Input too long (${normalizedTurn.input.length} chars)`);
                    normalizedTurn.input = normalizedTurn.input.substring(0, rules.maxTurnLength);
                }

                if (normalizedTurn.output.length > rules.maxTurnLength) {
                    result.warnings.push(`Conversation ${i}, Turn ${j}: Output too long (${normalizedTurn.output.length} chars)`);
                    normalizedTurn.output = normalizedTurn.output.substring(0, rules.maxTurnLength);
                }

                // Clean text
                normalizedTurn.input = this.cleanText(normalizedTurn.input);
                normalizedTurn.output = this.cleanText(normalizedTurn.output);

                if (normalizedTurn.input.length === 0 || normalizedTurn.output.length === 0) {
                    conversationErrors.push(`Conversation ${i}, Turn ${j}: Empty input or output after cleaning`);
                    continue;
                }

                cleanedTurns.push(normalizedTurn);
                totalInputLength += normalizedTurn.input.length;
                totalOutputLength += normalizedTurn.output.length;
            }

            if (conversationErrors.length > 0) {
                result.errors.push(...conversationErrors);
                if (conversationErrors.length > turns.length / 2) {
                    continue; // Skip conversation if more than half the turns are invalid
                }
            }

            if (cleanedTurns.length > 0) {
                result.cleanedData.push({
                    id: conversation.id || i,
                    turns: cleanedTurns,
                    metadata: conversation.metadata || {}
                });
                totalTurns += cleanedTurns.length;
            }
        }

        // Calculate statistics
        result.statistics.totalTurns = totalTurns;
        result.statistics.avgTurnsPerConversation = result.cleanedData.length > 0 ? 
            totalTurns / result.cleanedData.length : 0;
        result.statistics.avgInputLength = totalTurns > 0 ? totalInputLength / totalTurns : 0;
        result.statistics.avgOutputLength = totalTurns > 0 ? totalOutputLength / totalTurns : 0;

        result.isValid = result.errors.length === 0 && result.cleanedData.length > 0;
        return result;
    }

    async validateClassificationData(data, options) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            statistics: {
                totalSamples: data.length,
                uniqueLabels: 0,
                labelDistribution: {},
                avgTextLength: 0
            },
            cleanedData: []
        };

        const rules = this.validationRules.classification;
        const labelCounts = {};
        let totalTextLength = 0;

        for (let i = 0; i < data.length; i++) {
            const sample = data[i];
            const sampleErrors = [];

            // Check required fields
            if (!sample.text && !sample.input && !sample.content) {
                sampleErrors.push(`Sample ${i}: Missing text field`);
                continue;
            }

            if (!sample.label && !sample.class && !sample.category) {
                sampleErrors.push(`Sample ${i}: Missing label field`);
                continue;
            }

            // Normalize fields
            const normalizedSample = {
                text: sample.text || sample.input || sample.content || '',
                label: sample.label || sample.class || sample.category || ''
            };

            // Clean and validate text
            normalizedSample.text = this.cleanText(normalizedSample.text);
            normalizedSample.label = normalizedSample.label.toString().trim();

            if (normalizedSample.text.length === 0) {
                sampleErrors.push(`Sample ${i}: Empty text after cleaning`);
                continue;
            }

            if (normalizedSample.label.length === 0) {
                sampleErrors.push(`Sample ${i}: Empty label`);
                continue;
            }

            // Track label distribution
            labelCounts[normalizedSample.label] = (labelCounts[normalizedSample.label] || 0) + 1;
            totalTextLength += normalizedSample.text.length;

            if (sampleErrors.length === 0) {
                result.cleanedData.push({
                    id: sample.id || i,
                    text: normalizedSample.text,
                    label: normalizedSample.label,
                    metadata: sample.metadata || {}
                });
            } else {
                result.errors.push(...sampleErrors);
            }
        }

        // Validate label distribution
        const uniqueLabels = Object.keys(labelCounts);
        result.statistics.uniqueLabels = uniqueLabels.length;
        result.statistics.labelDistribution = labelCounts;
        result.statistics.avgTextLength = result.cleanedData.length > 0 ? 
            totalTextLength / result.cleanedData.length : 0;

        // Check minimum samples per label
        for (const [label, count] of Object.entries(labelCounts)) {
            if (count < rules.minSamples) {
                result.warnings.push(`Label "${label}" has only ${count} samples (minimum recommended: ${rules.minSamples})`);
            }
        }

        if (uniqueLabels.length > rules.maxClasses) {
            result.warnings.push(`Too many classes (${uniqueLabels.length}), consider grouping similar labels`);
        }

        result.isValid = result.errors.length === 0 && result.cleanedData.length > 0;
        return result;
    }

    async validateQAData(data, options) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            statistics: {
                totalPairs: data.length,
                avgQuestionLength: 0,
                avgAnswerLength: 0
            },
            cleanedData: []
        };

        const rules = this.validationRules.qa;
        let totalQuestionLength = 0;
        let totalAnswerLength = 0;

        for (let i = 0; i < data.length; i++) {
            const pair = data[i];
            const pairErrors = [];

            // Check required fields
            if (!pair.question && !pair.q && !pair.input) {
                pairErrors.push(`QA Pair ${i}: Missing question field`);
                continue;
            }

            if (!pair.answer && !pair.a && !pair.output && !pair.response) {
                pairErrors.push(`QA Pair ${i}: Missing answer field`);
                continue;
            }

            // Normalize fields
            const normalizedPair = {
                question: pair.question || pair.q || pair.input || '',
                answer: pair.answer || pair.a || pair.output || pair.response || ''
            };

            // Clean text
            normalizedPair.question = this.cleanText(normalizedPair.question);
            normalizedPair.answer = this.cleanText(normalizedPair.answer);

            // Validate lengths
            if (normalizedPair.question.length < rules.minQuestionLength) {
                pairErrors.push(`QA Pair ${i}: Question too short (${normalizedPair.question.length} chars)`);
            }

            if (normalizedPair.question.length > rules.maxQuestionLength) {
                result.warnings.push(`QA Pair ${i}: Question very long (${normalizedPair.question.length} chars)`);
                normalizedPair.question = normalizedPair.question.substring(0, rules.maxQuestionLength);
            }

            if (normalizedPair.answer.length < rules.minAnswerLength) {
                pairErrors.push(`QA Pair ${i}: Answer too short`);
            }

            if (normalizedPair.answer.length > rules.maxAnswerLength) {
                result.warnings.push(`QA Pair ${i}: Answer very long (${normalizedPair.answer.length} chars)`);
                normalizedPair.answer = normalizedPair.answer.substring(0, rules.maxAnswerLength);
            }

            if (pairErrors.length === 0) {
                result.cleanedData.push({
                    id: pair.id || i,
                    question: normalizedPair.question,
                    answer: normalizedPair.answer,
                    metadata: pair.metadata || {}
                });
                totalQuestionLength += normalizedPair.question.length;
                totalAnswerLength += normalizedPair.answer.length;
            } else {
                result.errors.push(...pairErrors);
            }
        }

        // Calculate statistics
        result.statistics.avgQuestionLength = result.cleanedData.length > 0 ? 
            totalQuestionLength / result.cleanedData.length : 0;
        result.statistics.avgAnswerLength = result.cleanedData.length > 0 ? 
            totalAnswerLength / result.cleanedData.length : 0;

        result.isValid = result.errors.length === 0 && result.cleanedData.length > 0;
        return result;
    }

    async validateTextGenerationData(data, options) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            statistics: {
                totalTexts: data.length,
                avgTextLength: 0,
                minLength: Infinity,
                maxLength: 0
            },
            cleanedData: []
        };

        const rules = this.validationRules.text;
        let totalLength = 0;

        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const itemErrors = [];

            let text = item.text || item.content || item.input || '';
            if (typeof text !== 'string') {
                text = String(text);
            }

            text = this.cleanText(text);

            if (text.length < rules.minLength) {
                itemErrors.push(`Text ${i}: Too short (${text.length} chars, minimum ${rules.minLength})`);
            }

            if (text.length > rules.maxLength) {
                result.warnings.push(`Text ${i}: Very long (${text.length} chars), truncating`);
                text = text.substring(0, rules.maxLength);
            }

            if (itemErrors.length === 0 && text.length > 0) {
                result.cleanedData.push({
                    id: item.id || i,
                    text: text,
                    metadata: item.metadata || {}
                });
                totalLength += text.length;
                result.statistics.minLength = Math.min(result.statistics.minLength, text.length);
                result.statistics.maxLength = Math.max(result.statistics.maxLength, text.length);
            } else {
                result.errors.push(...itemErrors);
            }
        }

        result.statistics.avgTextLength = result.cleanedData.length > 0 ? 
            totalLength / result.cleanedData.length : 0;

        if (result.statistics.minLength === Infinity) {
            result.statistics.minLength = 0;
        }

        result.isValid = result.errors.length === 0 && result.cleanedData.length > 0;
        return result;
    }

    async validateCustomData(data, options) {
        const result = {
            isValid: true,
            errors: [],
            warnings: [],
            statistics: {
                totalItems: data.length,
                fieldAnalysis: {}
            },
            cleanedData: []
        };

        const { requiredFields = [], fieldTypes = {} } = options;

        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const itemErrors = [];

            // Check required fields
            for (const field of requiredFields) {
                if (!(field in item) || item[field] === null || item[field] === undefined) {
                    itemErrors.push(`Item ${i}: Missing required field "${field}"`);
                }
            }

            // Validate field types
            for (const [field, expectedType] of Object.entries(fieldTypes)) {
                if (field in item) {
                    const actualType = typeof item[field];
                    if (actualType !== expectedType) {
                        itemErrors.push(`Item ${i}: Field "${field}" should be ${expectedType}, got ${actualType}`);
                    }
                }
            }

            if (itemErrors.length === 0) {
                result.cleanedData.push({
                    id: item.id || i,
                    ...item
                });
            } else {
                result.errors.push(...itemErrors);
            }
        }

        result.isValid = result.errors.length === 0 && result.cleanedData.length > 0;
        return result;
    }

    /**
     * Clean and normalize text
     */
    cleanText(text) {
        if (typeof text !== 'string') {
            text = String(text);
        }

        // Remove excessive whitespace
        text = text.replace(/\s+/g, ' ').trim();
        
        // Remove control characters except newlines and tabs
        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        // Normalize quotes
        text = text.replace(/[""]/g, '"').replace(/['']/g, "'");
        
        return text;
    }

    /**
     * Generate data quality report
     */
    generateQualityReport(validationResult) {
        const { isValid, errors, warnings, statistics, cleanedData } = validationResult;
        
        const report = {
            overall: isValid ? 'PASS' : 'FAIL',
            summary: {
                totalItems: statistics.totalItems || statistics.totalConversations || statistics.totalPairs || statistics.totalTexts || 0,
                validItems: cleanedData.length,
                errorCount: errors.length,
                warningCount: warnings.length,
                successRate: cleanedData.length > 0 ? 
                    (cleanedData.length / (statistics.totalItems || statistics.totalConversations || statistics.totalPairs || statistics.totalTexts || 1)) * 100 : 0
            },
            issues: {
                errors: errors,
                warnings: warnings
            },
            statistics: statistics,
            recommendations: this.generateRecommendations(validationResult)
        };

        return report;
    }

    generateRecommendations(validationResult) {
        const recommendations = [];
        const { errors, warnings, statistics, cleanedData } = validationResult;

        if (errors.length > 0) {
            recommendations.push('Fix data validation errors before training');
        }

        if (warnings.length > 0) {
            recommendations.push('Review warnings to improve data quality');
        }

        if (cleanedData.length < 100) {
            recommendations.push('Consider adding more training data for better model performance');
        }

        if (statistics.labelDistribution) {
            const labels = Object.keys(statistics.labelDistribution);
            const counts = Object.values(statistics.labelDistribution);
            const maxCount = Math.max(...counts);
            const minCount = Math.min(...counts);
            
            if (maxCount / minCount > 10) {
                recommendations.push('Data is imbalanced - consider balancing class distribution');
            }
        }

        return recommendations;
    }
}

module.exports = new DataValidationService();
