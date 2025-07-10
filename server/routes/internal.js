// server/routes/internal.js
const express = require('express');
const router = express.Router();


const { generateContentWithHistory } = require('../services/geminiService');
// This is the prompt template from the Python file, translated to JS.
// We keep it on the Node.js side to have full control.
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
// `;
// router.post('/generate-analysis', async (req, res) => {
//     const { prompt, provider, model } = req.body;

//     if (!prompt || !provider) {
//         return res.status(400).json({ error: "Missing 'prompt' or 'provider' in request body." });
//     }

//     console.log(`[Node Internal] Received analysis request for provider: ${provider}, model: ${model || 'default'}`);

//     try {
//         let aiResultText;

//         if (provider === 'gemini') {
//             // THE FIX: Call the function ON the geminiService object.
//             const result = await geminiService.generateContentWithHistory([], prompt, null, "You are a helpful document analysis assistant.");
//             if (!result || !result.answer) throw new Error("Gemini service returned an empty result.");
//             aiResultText = result.answer;

//         } else if (provider === 'groq') {
//             if (!model) return res.status(400).json({ error: "Missing 'model' for Groq provider." });
//             // THE FIX: Call the function ON the groqService object.
//             const result = await groqService.generateGroqResponse(model, prompt, [], "You are a helpful and extremely fast document analysis assistant.");
//             if (!result || !result.answer) throw new Error("Groq service returned an empty result.");
//             aiResultText = result.answer;

//         } else {
//             return res.status(400).json({ error: `Unsupported provider specified: ${provider}` });
//         } 
        
//         console.log(`[Node Internal] Successfully generated analysis via ${provider}.`);
//         res.json({ result: aiResultText });

//     } catch (error) {
//         console.error(`[Node Internal] Error during generate-analysis for provider ${provider}:`, error);
//         res.status(500).json({ 
//             error: `Failed to generate analysis via ${provider}.`, 
//             message: error.message 
//         });
//     }
// });

// module.exports = router;

router.post('/llm-task', async (req, res) => {
    const { task_type, document_content, study_focus } = req.body;

    // This endpoint can be expanded later to handle other internal tasks
    if (task_type !== 'podcast_script') {
        return res.status(400).json({ error: "Invalid task_type specified." });
    }

    if (!document_content || !study_focus) {
        return res.status(400).json({ error: "Missing document_content or study_focus for podcast script." });
    }

    console.log('[Node Internal] Received podcast script generation task.');

    try {
        // Construct the full prompt by filling in the template
        let finalPrompt = PODCAST_SCRIPT_PROMPT_TEMPLATE
            .replace('{study_focus}', study_focus)
            .replace('{document_content}', document_content);
        
        // We use the geminiService but don't need history or context, as the full instruction is in the prompt.
        // We are just sending one large prompt as the "currentUserQuery".
        const result = await generateContentWithHistory([], finalPrompt, null, "You are a creative podcast scriptwriter.");

        if (result && result.answer) {
            console.log('[Node Internal] Successfully generated script via Gemini.');
            // The Python service expects a 'result' key
            // NEW, corrected line
            res.json({ result: result.answer });
        } else {
            throw new Error("LLM service returned an empty or invalid result.");
        }

    } catch (error) {
        console.error("[Node Internal] Error during LLM script generation:", error);
        res.status(500).json({ error: "Failed to generate podcast script via LLM.", message: error.message });
    }
});

module.exports = router;