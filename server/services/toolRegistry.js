// server/services/toolRegistry.js
const { performWebSearch } = require('./webSearchService.js');
const { queryPythonRagService, queryKgService } = require('./toolExecutionService.js'); // Updated import

const availableTools = {
  web_search: {
    description: "Use this tool to search the internet for real-time, up-to-date information. It is required for questions about current events, recent developments, or any topic where fresh, external information is necessary.",
    execute: async (params, context) => {
        const searchResultsString = await performWebSearch(params.query);
        return {
            references: [],
            toolOutput: searchResultsString || "No results found from web search.",
        };
    },
    requiredParams: ['query'],
  },
  rag_search: {
    description: "Use this tool to search the content of a specific, user-provided document. This is the only way to answer questions specifically about the user's document.",
    execute: async (params, context) => {
        return await queryPythonRagService(
            params.query,
            context.documentContextName,
            false, // criticalThinking (KG) is handled by the agent, not the RAG tool itself
            context.filter
        );
    },
    requiredParams: ['query'],
  },
  // --- NEW TOOL DEFINITION ---
  kg_search: {
    description: "Use this tool to find structured facts and relationships within a document's knowledge graph. This helps in understanding connections between concepts.",
     execute: async (params, context) => {
        const facts = await queryKgService(
            params.query,
            context.documentContextName,
            context.userId // We need the actual user ID for this
        );
        return {
            references: [], // KG facts are in-line, not cited like RAG
            toolOutput: facts,
        };
    },
    requiredParams: ['query'],
  }
};

module.exports = {
    availableTools,
};