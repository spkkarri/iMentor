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
        // Check that the key 'tool_call' exists in the object.
        // It can be an object or null, but it must be present.
        if (jsonResponse && typeof jsonResponse.tool_call !== 'undefined') {
            return jsonResponse.tool_call;
        }
        return null;
    } catch (e) {
        console.warn(`[AgentService] Failed to parse JSON from LLM response: ${e.message}. Response: ${responseText.substring(0, 200)}...`);
        return null;
    }
}

async function processAgenticRequest(userQuery, chatHistory, systemPrompt, requestContext) {
    const { llmProvider, ollamaModel, userId, ollamaUrl } = requestContext;

    // 2. Fetch the user's key (this part is already correct)
    const user = await User.findById(userId).select('+encryptedApiKey');
    if (!user) {
        throw new Error("User not found during agent processing.");
    }
    const userApiKey = user.encryptedApiKey ? decrypt(user.encryptedApiKey) : null;
    if (user.encryptedApiKey && !userApiKey) {
        console.warn(`[AgentService] Failed to decrypt API key for user ${userId}.`);
    }

    // 2. Prepare contexts for the agent
    const modelContext = createModelContext({ availableTools });
    const agenticContext = createAgenticContext({ systemPrompt });
    const agenticSystemPrompt = createAgenticSystemPrompt(
        modelContext, 
        agenticContext, 
        { ...requestContext, userQuery }
    );

    const llmService = llmProvider === 'ollama' ? ollamaService : geminiService;
    const llmOptions = {
        ...(llmProvider === 'ollama' && { model: ollamaModel }),
        apiKey: userApiKey,
        ollamaUrl: ollamaUrl
    };

    // 3. Call the Router agent (using your correct, clean logic)
    console.log(`[AgentService] Performing Router call using ${llmProvider}...`);
    const routerResponseText = await llmService.generateContentWithHistory(
        [], // Router gets no prior chat history to prevent confusion
        "Please analyze the provided context and user query and return your JSON decision.", // A simple instruction
        agenticSystemPrompt,
        llmOptions
    );

    const toolCall = parseToolCall(routerResponseText);

    // 4. Handle Direct Answer path (your correct logic)
    if (!toolCall || !toolCall.tool_name) {
        console.log('[AgentService] Decision: Direct Answer.');
        const directAnswer = await llmService.generateContentWithHistory(
            chatHistory,
            userQuery,
            systemPrompt,
            llmOptions
        );
        return {
            finalAnswer: directAnswer,
            references: [],
            sourcePipeline: `${llmProvider}-agent-direct`,
        };
    }

    // 5. Handle Tool Call path
    console.log(`[AgentService] Decision: Tool Call -> ${toolCall.tool_name}`);
    const mainTool = availableTools[toolCall.tool_name];
    if (!mainTool) {
        return { finalAnswer: "I tried to use a tool that doesn't exist. Please try again.", references: [], sourcePipeline: 'agent-error-unknown-tool' };
    }

    try {
        // 6. Execute tools in parallel (using your clean, correct logic)
        const toolExecutionPromises = [];
        const executedToolNames = [];

        toolExecutionPromises.push(mainTool.execute(toolCall.parameters, requestContext));
        executedToolNames.push(toolCall.tool_name);
        
        let pipeline = `${llmProvider}-agent-${toolCall.tool_name}`;

        if (toolCall.tool_name === 'rag_search' && requestContext.criticalThinkingEnabled) {
            console.log('[AgentService] Critical Thinking enabled. Adding KG search to tool execution.');
            const kgTool = availableTools['kg_search'];
            toolExecutionPromises.push(kgTool.execute(toolCall.parameters, { ...requestContext, userId }));
            executedToolNames.push('kg_search');
            pipeline += '+kg';
        }

        const toolResults = await Promise.all(toolExecutionPromises);
        
        const combinedToolOutput = toolResults.map((result, index) => {
            const toolName = executedToolNames[index];
            return `--- TOOL OUTPUT: ${toolName.toUpperCase()} ---\n${result.toolOutput}`;
        }).join('\n\n');
        
        const combinedReferences = toolResults.flatMap(result => result.references || []);

        // 7. Call the Synthesizer agent to generate the final answer
        console.log(`[AgentService] Performing Synthesizer call using ${llmProvider}...`);
        const synthesizerPrompt = createSynthesizerPrompt(userQuery, combinedToolOutput, toolCall.tool_name);
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