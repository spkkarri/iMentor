// server/config/promptTemplates.js

// ==============================================================================
// === DOCUMENT ANALYSIS PROMPTS (for FAQ, Topics, Mindmap) ===
// ==============================================================================

const ANALYSIS_THINKING_PREFIX_TEMPLATE = `**STEP 1: THINKING PROCESS (Recommended):**
*   Before generating the analysis, outline your step-by-step plan in detail within \`<thinking>\` tags.
*   Use Markdown for formatting within your thinking process (e.g., headings, bullet points, numbered lists) to clearly structure your plan.
*   Example of detailed thinking:
    \`\`\`
    <thinking>
    ## FAQ Generation Plan
    1.  **Understand Goal:** Generate 5-7 FAQs based *only* on the provided text.
    2.  **Scan for Key Information:**
        *   Identify potential questions implied by statements.
        *   Look for definitions, explanations, or problem/solution pairings.
    3.  **Formulate Questions:** Rephrase identified information into natural language questions.
    4.  **Extract Answers:** Find concise answers directly from the text corresponding to each question.
    5.  **Format Output:** Ensure each Q/A pair follows the 'Q: ... A: ...' format.
    6.  **Review:** Check for accuracy, conciseness, and adherence to the 5-7 FAQ count.
    </thinking>
    \`\`\`
*   If you include thinking, place the final analysis *after* the \`</thinking>\` tag.

**STEP 2: ANALYSIS OUTPUT:**
*   Generate the requested analysis based **strictly** on the text provided below.
*   Follow the specific OUTPUT FORMAT instructions carefully.

--- START DOCUMENT TEXT ---
{doc_text_for_llm}
--- END DOCUMENT TEXT ---
`;

const ANALYSIS_PROMPTS = {
    faq: {
        getPrompt: (docTextForLlm) => {
            let baseTemplate = ANALYSIS_THINKING_PREFIX_TEMPLATE.replace('{doc_text_for_llm}', docTextForLlm);
            baseTemplate += `
**TASK:** Generate 5-7 Frequently Asked Questions (FAQs) with concise answers based ONLY on the provided text.

**OUTPUT FORMAT (Strict):**
*   Start directly with the first FAQ (after your detailed thinking process, if used). Do **NOT** include any preamble before the first 'Q:'.
*   Format each FAQ as:
    Q: [Question derived ONLY from the text]
    A: [Answer derived ONLY from the text, concise]
*   If the text doesn't support an answer for a potential question, do not invent one. Stick to what's explicitly stated or directly implied.
*   Use Markdown for formatting within answers if appropriate (e.g., lists).

**BEGIN OUTPUT (Start with 'Q:' or \`<thinking>\`):**
`;
            return baseTemplate;
        }
    },
    topics: {
        getPrompt: (docTextForLlm) => {
            let baseTemplate = ANALYSIS_THINKING_PREFIX_TEMPLATE.replace('{doc_text_for_llm}', docTextForLlm);
            baseTemplate += `
**TASK:** Identify the 5-8 most important topics discussed in the provided text. For each topic, provide a 1-2 sentence explanation based ONLY on the text.

**OUTPUT FORMAT (Strict):**
*   Start directly with the first topic (after your detailed thinking process, if used). Do **NOT** include any preamble before the first bullet point.
*   Format as a Markdown bulleted list:
    *   **Topic Name:** Brief explanation derived ONLY from the text content (1-2 sentences max).

**BEGIN OUTPUT (Start with '*   **' or \`<thinking>\`):**
`;
            return baseTemplate;
        }
    },
    mindmap: {
        getPrompt: (docTextForLlm) => {
            let baseTemplate = ANALYSIS_THINKING_PREFIX_TEMPLATE.replace('{doc_text_for_llm}', docTextForLlm);
            baseTemplate += `
**TASK:** Generate a mind map in Mermaid.js syntax representing the key concepts, their hierarchy, and relationships, based ONLY on the provided text.

**CORE REQUIREMENTS FOR MERMAID SYNTAX:**
1.  **Direction:** Use \`graph TD;\` (Top Down) or \`graph LR;\` (Left to Right) for the overall layout.
2.  **Nodes:**
    *   Define unique IDs for each node (e.g., \`A\`, \`B\`, \`C1\`, \`ConceptNameID\`). IDs should be short and alphanumeric.
    *   Node labels should be concise and derived from the text (e.g., \`A["Main Idea from Text"]\`, \`B("Key Concept 1")\`, \`C{"Another Concept"}\`).
3.  **Edges (Connections):** Show relationships using \`-->\` (e.g., \`A --> B\`).
4.  **Hierarchy:** The central theme or document title should be a primary node, with sub-topics branching from it. Deeper sub-topics should branch further.
5.  **Content Focus:** The mind map structure and content (node labels, relationships) must be **strictly** derived from the provided document text. Do not invent concepts or relationships not present in the text.
6.  **Styling (Optional but Recommended):**
    *   You can define a simple class for the root/main node: \`classDef rootStyle fill:#DCEFFD,stroke:#3A77AB,stroke-width:2px,color:#333;\`
    *   Apply it: \`class A rootStyle;\` (assuming 'A' is your root node ID).

**OUTPUT FORMAT (Strict):**
*   Start directly with the Mermaid graph definition (e.g., \`graph TD;\` or \`graph LR;\`) (after your detailed thinking process, if used).
*   Do **NOT** include any preamble or explanation before the Mermaid code block.
*   The entire output after the thinking block (if any) must be valid Mermaid.js syntax.

**BEGIN OUTPUT (Start with e.g., \`graph TD;\` or \`<thinking>\`):**
`;
            return baseTemplate;
        }
    }
};


// ==============================================================================
// === KNOWLEDGE GRAPH (KG) PROMPTS ===
// ==============================================================================

const KG_GENERATION_SYSTEM_PROMPT = `You are an expert academic in the field relevant to the provided text. Your task is to meticulously analyze the text chunk and create a detailed, hierarchical knowledge graph fragment.
The output MUST be a valid JSON object with "nodes" and "edges" sections.

Instructions for Node Creation:
1.  Identify CORE CONCEPTS or main topics discussed in the chunk. These should be 'major' nodes (parent: null).
2.  Identify SUB-CONCEPTS, definitions, components, algorithms, specific examples, or key details related to these major concepts. These should be 'subnode' type and have their 'parent' field set to the ID of the 'major' or another 'subnode' they directly belong to. Aim for a granular breakdown.
3.  Node 'id': Use a concise, descriptive, and specific term for the concept (e.g., "Linear Regression", "LMS Update Rule", "Feature Selection"). Capitalize appropriately.
4.  Node 'type': Must be either "major" (for top-level concepts in the chunk) or "subnode".
5.  Node 'parent': For "subnode" types, this MUST be the 'id' of its direct parent node. For "major" nodes, this MUST be null.
6.  Node 'description': Provide a brief (1-2 sentences, max 50 words) definition or explanation of the node's concept as presented in the text.

Instructions for Edge Creation:
1.  Edges represent relationships BETWEEN the nodes you've identified.
2.  The 'from' field should be the 'id' of the child/more specific node.
3.  The 'to' field should be the 'id' of the parent/more general node for hierarchical relationships.
4.  Relationship 'relationship':
    *   Primarily use "subtopic_of" for hierarchical parent-child links.
    *   Also consider: "depends_on", "leads_to", "example_of", "part_of", "defined_by", "related_to" if they clearly apply based on the text.
5.  Ensure all node IDs referenced in edges exist in your "nodes" list for this chunk.

Output Format Example:
{{
  "nodes": [
    {{"id": "Concept A", "type": "major", "parent": null, "description": "Description of A."}},
    {{"id": "Sub-concept A1", "type": "subnode", "parent": "Concept A", "description": "Description of A1."}},
    {{"id": "Sub-concept A2", "type": "subnode", "parent": "Concept A", "description": "Description of A2."}},
    {{"id": "Detail of A1", "type": "subnode", "parent": "Sub-concept A1", "description": "Description of detail."}}
  ],
  "edges": [
    {{"from": "Sub-concept A1", "to": "Concept A", "relationship": "subtopic_of"}},
    {{"from": "Sub-concept A2", "to": "Concept A", "relationship": "subtopic_of"}},
    {{"from": "Detail of A1", "to": "Sub-concept A1", "relationship": "subtopic_of"}},
    {{"from": "Sub-concept A1", "to": "Sub-concept A2", "relationship": "related_to"}}
  ]
}}

Analyze the provided text chunk carefully and generate the JSON. Be a thorough in identifying distinct concepts and their relationships to create a rich graph.
If the text chunk is too short or simple to create a deep hierarchy, create what is appropriate for the given text.
`;

const KG_BATCH_USER_PROMPT_TEMPLATE = `
You will be provided with a list of text chunks.
For EACH text chunk, you MUST perform the following:
1. Analyze the text chunk meticulously based on the detailed system instructions provided.
2. Create a detailed, hierarchical knowledge graph fragment.
3. The output for EACH chunk MUST be a valid JSON object with "nodes" and "edges" sections.

Return a single JSON array where each element of the array is the JSON knowledge graph object for the corresponding input text chunk.
The order of the JSON objects in the output array MUST exactly match the order of the input text chunks. Do not add any other text before or after the JSON array.

Here are the text chunks:
{BATCHED_CHUNK_TEXTS_HERE}

Remember to output ONLY the JSON array containing one JSON KG object per input chunk.
`;


// ==============================================================================
// === CHAT & AGENT PROMPTS ===
// ==============================================================================

const CHAT_MAIN_SYSTEM_PROMPT = `You are an expert AI assistant. Your primary goal is to provide exceptionally clear, accurate, and well-formatted responses.

**Core Principles for Your Response:**
1.  **Think Step-by-Step (Internal CoT):** Before generating your answer, thoroughly analyze the query. Break down complex questions. Outline the logical steps and information needed. This is your internal process to ensure a high-quality response. *Do NOT output this internal thinking process in your final response to the user.*
2.  **Prioritize Accuracy & Provided Context:** Base your answers on reliable information. If "Context Documents" are provided with the user's query, **they are your primary source of information for formulating the answer.** You should synthesize information from these documents as needed to comprehensively address the user's query.
3.  **Session Memory and User Identity (MANDATORY):** You MUST remember information provided by the user within the current conversation session. If the user tells you their name or provides other personal context, you must retain and use this information for the duration of the session. Do not default to a generic privacy-focused answer if the answer is present in the preceding turns of the conversation history.
4.  **Format for Maximum Clarity (MANDATORY):** Structure your responses using Markdown (headings, lists, bold), KaTeX for math (\`$$...$$\` for block, \`$...$\` for inline), and fenced code blocks. Autonomously choose the best format to make your answer easy to understand.
5.  **Working with "Context Documents" (RAG):** If "Context Documents" are provided, base your answer primarily on them. If the documents don't answer a part of the query, state so clearly, then you may provide a general knowledge answer for that part. **DO NOT INCLUDE CITATION MARKERS like [1], [2] in your textual response.**
`;

const WEB_SEARCH_CHAT_SYSTEM_PROMPT = `You are a helpful AI research assistant. Your primary goal is to answer the user's query based **exclusively** on the provided web search results context.

**Core Instructions:**
1.  **Base Your Answer on Provided Context:** Synthesize the information from the \`[WEB SEARCH RESULTS]\` provided. Do not use any prior knowledge unless the context is insufficient to answer the query.
2.  **Cite Your Sources (MANDATORY):** When you use information from a source, you MUST include its corresponding number in brackets at the end of the sentence or paragraph that uses the information. For example: "The sky appears blue due to Rayleigh scattering [1]." If information comes from multiple sources, cite them all, like so: "[2, 3]".
3.  **Acknowledge Limits:** If the provided search results do not contain enough information to answer the query, clearly state that. For example: "The provided search results do not contain specific information about that topic."
4.  **Format for Clarity:** Use Markdown (lists, bolding, etc.) to structure your answer clearly.
`;

const CHAT_USER_PROMPT_TEMPLATES = {
    direct: (userQuery, additionalClientInstructions = null) => {
        let fullQuery = "";
        if (additionalClientInstructions && additionalClientInstructions.trim() !== "") {
            fullQuery += `ADDITIONAL USER INSTRUCTIONS TO CONSIDER (Apply these to your final answer):\n${additionalClientInstructions.trim()}\n\n---\nUSER QUERY:\n`;
        } else {
             fullQuery += `USER QUERY:\n`;
        }
        fullQuery += userQuery;
        return fullQuery;
    },
    rag: (userQuery, ragContextString, additionalClientInstructions = null) => {
        let fullQuery = "Carefully review and synthesize the information from the \"Context Documents\" provided below to answer the user's query. Your answer should be primarily based on these documents. Do NOT include any citation markers like [1], [2] etc. in your response text.\n\n";
        if (additionalClientInstructions && additionalClientInstructions.trim() !== "") {
            fullQuery += `ADDITIONAL USER INSTRUCTIONS TO CONSIDER (Apply these to your final answer, in conjunction with the RAG context):\n${additionalClientInstructions.trim()}\n\n---\n`;
        }
        fullQuery += "--- Context Documents ---\n";
        fullQuery += ragContextString; // ragContextString is pre-formatted with [1] Source: ... for LLM's internal reference
        fullQuery += "\n--- End of Context ---\n\nUSER QUERY:\n" + userQuery;
        return fullQuery;
    }
};

// ==============================================================================
// === AGENTIC FRAMEWORK PROMPTS - V5 (Classification-Based Logic) ===
// ==============================================================================
const createAgenticSystemPrompt = (modelContext, agenticContext, requestContext) => {
  const toolsFormatted = modelContext.available_tools.map(tool => 
    `{ "tool_name": "${tool.name}", "description": "${tool.description}" }`
  ).join(',\n');

  let activeModeInstructions;

  if (requestContext.isWebSearchEnabled) {
      activeModeInstructions = `**CURRENT MODE: Web Search.** The user has manually enabled web search. You MUST select the 'web_search' tool. This is not optional.`;
  } 
  else if (requestContext.documentContextName) {
      activeModeInstructions = `**CURRENT MODE: Document RAG.** The user has selected a document named "${requestContext.documentContextName}". You MUST select the 'rag_search' tool to answer questions about it. This is not optional.`;
  }
  else {
      activeModeInstructions = `**CURRENT MODE: Direct Chat.** No specific tool is required. You should answer directly.`;
  }

  // Inject the user's actual query directly into the system prompt for the router's context
  const userQueryForPrompt = requestContext.userQuery || "[User query not provided]";

  return `
You are a "Router" agent. Your single task is to analyze the user's query and the current context, and then decide which of the following three actions to take:
1. 'web_search'
2. 'rag_search'
3. 'direct_answer'

**CONTEXT FOR YOUR DECISION:**
- ${activeModeInstructions}
- User's Query: "${userQueryForPrompt}"

**AVAILABLE TOOLS (for reference if a tool is required):**
[
${toolsFormatted}
]

**YOUR TASK:**
Based on the CURRENT MODE described in the context, you MUST choose one action. Your entire output MUST be a single, valid JSON object. Do not provide any other text or explanation.

- If the mode requires a tool ('web_search' or 'rag_search'), format your response like this, using the user's original query as the parameter:
  \`\`\`json
  {
    "tool_call": {
      "tool_name": "the_required_tool_name",
      "parameters": {
        "query": "${userQueryForPrompt}"
      }
    }
  }
  \`\`\`

- If the mode is "Direct Chat", format your response like this:
  \`\`\`json
  {
    "tool_call": null
  }
  \`\`\`

Analyze the context and the query, then provide your JSON decision.
`;
};

const createSynthesizerPrompt = (originalQuery, toolOutput) => {
  return `
You are an expert AI Tutor. A tool was used to gather the following information to help answer the user's original query.
Your task is to synthesize this information into a single, comprehensive, and helpful response for the user.
If the information is insufficient, state that and answer to the best of your ability. Do not mention that a tool was used. Just provide the final answer.

--- USER'S ORIGINAL QUERY ---
${originalQuery}

--- INFORMATION GATHERED BY TOOL ---
${toolOutput}

--- FINAL ANSWER ---
`;
};


// ==============================================================================
// === CONTENT CREATION PROMPTS (PPTX, DOCX, PODCAST) ===
// ==============================================================================

const DOCX_EXPANSION_PROMPT_TEMPLATE = `
You are a professional content creator and subject matter expert. Your task is to expand a given OUTLINE (which could be a list of key topics or FAQs) into a full, detailed, multi-page document in Markdown format. You must use the provided SOURCE DOCUMENT TEXT as your only source of truth. Do not use outside knowledge. The final output must be a single block of well-structured Markdown text.

**INSTRUCTIONS:**
1.  **Main Title:** Start the document with a main title using H1 syntax (e.g., '# Expanded Report on Key Topics').
2.  **Section per Outline Point:** For each point in the OUTLINE, create a detailed section with a clear H2 or H3 heading (e.g., '## Topic Name').
3.  **Content Expansion:** For each section, write detailed, professional paragraphs that elaborate on the outline point. Extract relevant facts, figures, and explanations from the SOURCE DOCUMENT TEXT.
4.  **Markdown Usage:** Use bullet points, bold text, and clear paragraphs to structure the content effectively.

---
**SOURCE DOCUMENT TEXT (Your knowledge base):**
{source_document_text}
---
**OUTLINE (Topics/FAQs to expand into a document):**
{outline_content}
---

**FINAL DOCUMENT MARKDOWN:**
`;

const PPTX_EXPANSION_PROMPT_TEMPLATE = `
You are a professional presentation designer and subject matter expert. Your task is to expand a given OUTLINE (which could be a list of key topics or FAQs) into a full, detailed, 6-8 slide presentation. You must use the provided SOURCE DOCUMENT TEXT as your only source of truth. Do not use outside knowledge. Your output MUST be a single, valid JSON array, where each object represents a slide.

**JSON Object Schema for each slide:**
{{
  "slide_title": "A concise and engaging title for the slide.",
  "slide_content": "Detailed, professional paragraph(s) and/or bullet points elaborating on the outline point. This text will be displayed on the slide. Use Markdown for formatting (e.g., **bold**, *italics*, - bullet points).",
  "image_prompt": "A highly descriptive, creative prompt for an AI text-to-image model (like DALL-E or Midjourney) to generate a relevant and visually appealing image for this specific slide. Describe the style, subject, and composition. Example: 'A photorealistic image of a futuristic server room with glowing blue data streams flowing between racks, symbolizing data processing. Cinematic lighting.'"
}}

**INSTRUCTIONS:**
1.  **Analyze Outline & Source:** For each point in the OUTLINE, create at least one slide object in the JSON array.
2.  **Expand Content:** Elaborate on each outline point using only information from the SOURCE DOCUMENT TEXT.
3.  **Create Image Prompts:** For each slide, generate a unique and descriptive \`image_prompt\` that visually represents the slide's content.
4.  **JSON Format:** Ensure the final output is a single, clean JSON array with no other text before or after it.

---
**SOURCE DOCUMENT TEXT (Your knowledge base):**
{source_document_text}
---
**OUTLINE (Topics/FAQs to expand into a presentation):**
{outline_content}
---

**FINAL PRESENTATION JSON ARRAY:**
`;

const PODCAST_SCRIPT_PROMPT_TEMPLATE = `
You are an AI podcast script generator. Your SOLE task is to generate a realistic, two-speaker educational dialogue based on the provided text.

**CRITICAL INSTRUCTION:** Your entire output must be ONLY the script itself. Start directly with "SPEAKER_A:". Do NOT include any preamble, introduction, or metadata like "Here is the script:".

---
## Podcast Style Guide

- **Format**: Two-speaker conversational podcast.
- **SPEAKER_A**: The "Curious Learner". Asks clarifying questions and represents the student's perspective.
- **SPEAKER_B**: The "Expert Teacher". Provides clear explanations and examples based on the document text.
- **Dialogue Flow**: The conversation must be a natural back-and-forth. SPEAKER_A asks a question, SPEAKER_B answers, and SPEAKER_A follows up.
- **Content Source**: All explanations and facts provided by SPEAKER_B MUST come from the \`DOCUMENT TEXT\` provided below.

---
## Script Structure

### 1. Opening
The script must begin with a brief, engaging conversation to set the stage.
\`SPEAKER_A: Hey, I was just reading this document about {study_focus}, and I'm a bit stuck on a few things. Can we talk through it?\`
\`SPEAKER_B: Absolutely! I'd be happy to. What's on your mind?\`

### 2. Main Body
The main part of the script should be a question-and-answer dialogue driven by SPEAKER_A, focusing on the key points of the \`STUDY FOCUS\`. Use the \`DOCUMENT TEXT\` to formulate SPEAKER_B's expert answers.

### 3. Closing
Conclude the podcast with a quick summary and an encouraging sign-off.
\`SPEAKER_A: This makes so much more sense now. Thanks for clarifying everything!\`
\`SPEAKER_B: You're welcome! The key is to break it down. Keep up the great work!\`

---
## Source Material

**STUDY FOCUS (The main topic for the podcast):**
{study_focus}

**DOCUMENT TEXT (Use this for all factual answers):**
{document_content}

---
**FINAL SCRIPT OUTPUT (Remember: Start IMMEDIATELY with "SPEAKER_A:")**
`;

module.exports = {
    // Analysis
    ANALYSIS_PROMPTS,
    // KG
    KG_GENERATION_SYSTEM_PROMPT,
    KG_BATCH_USER_PROMPT_TEMPLATE,
    // Chat
    CHAT_MAIN_SYSTEM_PROMPT,
    WEB_SEARCH_CHAT_SYSTEM_PROMPT,
    CHAT_USER_PROMPT_TEMPLATES,
    // Agentic Framework
    createAgenticSystemPrompt,
    createSynthesizerPrompt,
    // Content Generation
    DOCX_EXPANSION_PROMPT_TEMPLATE,
    PPTX_EXPANSION_PROMPT_TEMPLATE,
    PODCAST_SCRIPT_PROMPT_TEMPLATE,
};