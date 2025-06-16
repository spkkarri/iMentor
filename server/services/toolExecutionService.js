// server/services/toolExecutionService.js
const axios = require('axios');

const PYTHON_SERVICE_URL = process.env.PYTHON_RAG_SERVICE_URL;

async function queryPythonRagService(query, documentContextName, clientFilter = null, k = 5) {
    if (!PYTHON_SERVICE_URL) {
        throw new Error("RAG service is not configured on the server.");
    }
    const searchUrl = `${PYTHON_SERVICE_URL}/query`;
    
    // The payload is now simpler and only contains RAG-specific information.
    const payload = {
        query: query,
        k: k,
        user_id: "agent_user", // The agent queries on behalf of the user
        documentContextName: documentContextName || null
    };
    
    if (clientFilter) {
        payload.filter = clientFilter;
    }

    try {
        const response = await axios.post(searchUrl, payload, { timeout: 30000 });
        const relevantDocs = response.data?.retrieved_documents_list || [];
        const references = relevantDocs.map((doc, index) => ({
            number: index + 1,
            source: doc.metadata?.file_name || doc.metadata?.original_name || 'Unknown Document',
            content_preview: (doc.page_content || "").substring(0, 100) + "...",
        }));
        
        const toolOutput = relevantDocs.length > 0
            ? response.data.formatted_context_snippet
            : "No relevant context was found in the specified documents for this query.";

        return { references, toolOutput };
    } catch (error) {
        const errorMsg = error.response?.data?.error || `Python Service Error: ${error.message}`;
        console.error(`[toolExecutionService] Error calling RAG service:`, errorMsg);
        throw new Error(errorMsg);
    }
}

// This function remains unchanged and correct.
async function queryKgService(query, documentName, userId) {
    if (!PYTHON_SERVICE_URL) {
        throw new Error("Knowledge Graph service is not configured on the server.");
    }
    const kgUrl = `${PYTHON_SERVICE_URL}/query_kg`;
    try {
        const response = await axios.post(kgUrl, {
            query: query,
            document_name: documentName,
            user_id: userId,
        }, { timeout: 20000 });

        return response.data?.facts || "No facts found in knowledge graph.";
    } catch (error) {
        const errorMsg = error.response?.data?.error || `KG Service Error: ${error.message}`;
        console.error(`[toolExecutionService] Error calling KG service:`, errorMsg);
        return `Could not retrieve facts from knowledge graph: ${errorMsg}`;
    }
}

module.exports = {
    queryPythonRagService,
    queryKgService
};