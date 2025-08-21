// FusedChatbot/client/src/config/constants.js
export const LLM_OPTIONS = {
    ollama: {
        name: "Ollama (College Server)",
        models: [
            "qwen2.5:14b-instruct",
            "deepseek-r1:latest",
            "llama3.2:latest",
            "deepseek-coder-v2:latest",
        ]
    },
    gemini: { name: "Gemini", models: ["gemini-1.5-flash", "gemini-1.5-pro-latest", "gemini-pro"] },
    groq_llama3: { name: "Groq (Llama3)", models: ["llama3-8b-8192", "llama3-70b-8192"] }
};

// You can add other shared constants here in the future