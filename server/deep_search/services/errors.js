class SearchResultError extends Error {
    constructor(message, details = {}, step = 0) {
        super(message);
        this.name = 'SearchResultError';
        this.details = details;
        this.step = step;
        this.timestamp = new Date().toISOString();
        this.metadata = {
            error: true,
            stepFailed: step,
            reason: message,
            ...details
        };
    }

    toResponse() {
        return {
            error: {
                message: this.message,
                type: this.name,
                step: this.step,
                timestamp: this.timestamp,
                details: this.details
            },
            summary: this.message,
            aiGenerated: false,
            sources: [],
            rawResults: [],
            timestamp: this.timestamp,
            confidence: 'Low',
            metadata: this.metadata
        };
    }
}

// Gemini-specific errors
export class GeminiQuotaError extends SearchResultError {
    constructor(quotaInfo) {
        super('Gemini API quota exceeded', { quotaInfo });
        this.name = 'GeminiQuotaError';
    }
}

export class GeminiRateLimitError extends SearchResultError {
    constructor(retryAttempts) {
        super('Gemini API rate limit exceeded', { retryAttempts });
        this.name = 'GeminiRateLimitError';
    }
}

// Query optimization errors
export class QueryOptimizationError extends SearchResultError {
    constructor(message, details = {}) {
        super(message, details, 1);
        this.name = 'QueryOptimizationError';
    }
}

// Web search errors
export class WebSearchError extends SearchResultError {
    constructor(message, details = {}) {
        super(message, details, 3);
        this.name = 'WebSearchError';
    }
}

// Cache errors
export class CacheError extends SearchResultError {
    constructor(message, details = {}) {
        super(message, details, 2);
        this.name = 'CacheError';
    }
}

export default SearchResultError;
