// server/services/agentService.js
const { createAgenticSystemPrompt, createSynthesizerPrompt } = require('../config/promptTemplates.js');
const { availableTools } = require('./toolRegistry.js');
const { createModelContext, createAgenticContext } = require('../protocols/contextProtocols.js');
const geminiService = require('./geminiService.js');
const ollamaService = require('./ollamaService.js');
const User = require('../models/User');
const { decrypt } = require('../utils/crypto');

function parseToolCall(responseText) {
    const jsonMatch = responseText.match(/```(json)?\s*([\s\S]+?)\s*```/);
    const jsonString = jsonMatch ? jsonMatch[2] : responseText;
    try {
        const jsonResponse = JSON.parse(jsonString);
        if (jsonResponse && typeof jsonResponse.tool_call !== 'undefined') {
            return jsonResponse.tool_call;
        }
        return null; // Return null if tool_call key is missing
    } catch (e) {
        console.warn(`[AgentService] Failed to parse JSON from LLM response: ${e.message}`);
        return null;
    }
}

async function processAgenticRequest(userQuery, chatHistory, systemPrompt, requestContext) {
    const { llmProvider, ollamaModel, userId } = requestContext;

    const user = await User.findById(userId).select('+encryptedApiKey');
    if (!user) {
        throw new Error("User not found during agent processing.");
    }
    
    const userApiKey = decrypt(user.encryptedApiKey);

    const modelContext = createModelContext({ availableTools });
    const agenticContext = createAgenticContext({ systemPrompt });
    
    // Pass the userQuery into the context for the new prompt template
    const agenticSystemPrompt = createAgenticSystemPrompt(
        modelContext, 
        agenticContext, 
        { ...requestContext, userQuery }
    );

    const llmService = llmProvider === 'ollama' ? ollamaService : geminiService;
    const llmOptions = {
        ...(llmProvider === 'ollama' && { model: ollamaModel }),
        apiKey: userApiKey,
    };

    console.log(`[AgentService] Performing Router call using ${llmProvider}...`);
    const routerResponseText = await llmService.generateContentWithHistory(
        [], // Router gets no prior chat history to prevent confusion
        "Please analyze the provided context and user query and return your JSON decision.", // A simple instruction
        agenticSystemPrompt,
        llmOptions
    );

    const toolCall = parseToolCall(routerResponseText);

    // If no tool_call object, or if tool_call is explicitly null, answer directly.
    if (!toolCall || !toolCall.tool_name) {
        console.log('[AgentService] Decision: Direct Answer.');
        
        // Perform a second LLM call for the actual conversational response.
        const directAnswer = await llmService.generateContentWithHistory(
            chatHistory,
            userQuery,
            systemPrompt, // Use the original, simpler system prompt for answering
            llmOptions
        );
        
        return {
            finalAnswer: directAnswer,
            references: [],
            sourcePipeline: `${llmProvider}-agent-direct`,
        };
    }

    console.log(`[AgentService] Decision: Tool Call -> ${toolCall.tool_name}`);
    const mainTool = availableTools[toolCall.tool_name];
    if (!mainTool) {
        return { finalAnswer: "I tried to use a tool that doesn't exist. Please try again.", references: [], sourcePipeline: 'agent-error-unknown-tool' };
    }

    try {
        let toolPromises = [mainTool.execute(toolCall.parameters, requestContext)];
        let pipeline = `${llmProvider}-agent-${toolCall.tool_name}`;

        if (toolCall.tool_name === 'rag_search' && requestContext.criticalThinkingEnabled) {
            console.log('[AgentService] Critical Thinking enabled. Adding KG search to tool execution.');
            const kgTool = availableTools['kg_search'];
            toolPromises.push(kgTool.execute(toolCall.parameters, { ...requestContext, userId }));
            pipeline += '+kg';
        }

        const toolResults = await Promise.all(toolPromises);
        
        const combinedToolOutput = toolResults.map((result, index) => {
            const toolName = index === 0 ? toolCall.tool_name : 'kg_search';
            return `--- TOOL OUTPUT: ${toolName.toUpperCase()} ---\n${result.toolOutput}`;
        }).join('\n\n');
        
        const combinedReferences = toolResults.flatMap(result => result.references || []);

        console.log(`[AgentService] Performing Synthesizer call using ${llmProvider}...`);
        const synthesizerPrompt = createSynthesizerPrompt(userQuery, combinedToolOutput);
        const finalAnswer = await llmService.generateContentWithHistory(
            chatHistory, synthesizerPrompt, systemPrompt, llmOptions
        );
        
        return {
            finalAnswer,
            references: combinedReferences,
            sourcePipeline: pipeline,
        };
    } catch (error) {
        console.error(`[AgentService] Error executing tool '${toolCall.tool_name}':`, error);
        return { finalAnswer: `I tried to use a tool, but it failed. Error: ${error.message}.`, references: [], sourcePipeline: `agent-error-tool-failed` };
    }
}

module.exports = {
    processAgenticRequest,
};