### iMentor: An Overview

iMentor is a comprehensive, AI-powered learning and research platform designed specifically for the higher education environment. It moves beyond a simple question-and-answer chatbot to provide an integrated suite of specialized tools that support students and educators in deep, structured learning.

The core purpose of iMentor is to act as a personalized, 24/7 academic assistant. It leverages powerful Large Language Models (LLMs) like Google's Gemini and open-source models via Ollama, but its true strength lies in the specialized workflows built around the chat interface. It allows users to interact with their own course materials, generate study aids, practice technical skills, and create structured learning plans from a single, cohesive application.

**Key Features Include:**

*   **Advanced Chat & Reasoning:** Features a "Complex Reasoning Mode" that automatically analyzes complex queries to form a multi-step plan before answering, reducing hallucinations and improving accuracy. A "Critical Thinking" mode also provides prompts to help users challenge the AI's answers and explore alternative perspectives.
*   **Retrieval-Augmented Generation (RAG):** Users can interact directly with uploaded documents, allowing the AI to use specific course notes, research papers, or textbooks as its primary source of truth.
*   **Automated Content Analysis & Creation:** Instantly generates summaries, FAQs, mind maps, and even audio podcasts from selected documents to support different learning styles. It can also export generated content to DOCX and PPTX formats.
*   **Personalized Study Plans:** Users can input a learning goal, and the AI will generate a complete, module-based curriculum with actionable steps and seed questions to guide the learning process.
*   **Integrated Academic Tools:** The platform includes a secure code executor for practicing programming, an AI quiz generator to create tests from documents, and an academic integrity checker.
*   **User-Controlled LLM:** Provides the flexibility to switch between different LLM providers (like Gemini or a local Ollama instance) and manage credentials.
*   **Real-time Visualization:** Dynamically creates a "Live Concept Map" to visually represent the topics and relationships discussed during a chat session.

***

### iMentor Tutorial: A Guide for New Students

Welcome to iMentor! This guide will walk you through the essential features to get you started on your personalized learning journey.

#### 1. Getting Started: Logging In

Your administrator will provide you with a username and password. The standard sign-up and email verification process is currently bypassed for streamlined access.

*   Navigate to the iMentor homepage.
*   Click the **"Login"** button.
*   Enter the credentials provided to you.

#### 2. The Main Interface: Your Learning Hub

After logging in, you'll see the main chat interface, which is divided into three main panels.

*   **Left Panel (Assistant Controls):** This is where you manage your chat's context and behavior.
*   **Center Panel (Chat):** This is your main interaction window with the AI.
*   **Right Panel (Advanced Tools):** This panel contains tools for analyzing and creating content from your documents.

#### 3. Mastering the Chat

The chat is your primary tool. Here’s how to make the most of it:

*   **Basic Chat:** Simply type your question in the input box at the bottom and press Enter.
*   **Complex Reasoning (Automatic):** For complex questions, you may notice the AI takes a moment to "think." In the background, it's creating and evaluating multiple plans to find the best way to answer your query. This reduces errors and provides more comprehensive responses.
*   **Enable Critical Thinking:** Click the **brain icon (🧠)** in the chat input bar. When enabled, the AI's responses will be followed by suggested prompts that challenge its own answer, helping you verify claims, consider alternatives, and apply your knowledge.
*   **Voice-to-Text:** Click the **microphone icon (🎤)** to speak your query. The icon will turn red while listening. Your speech will be automatically converted to text in the input box.
*   **Read Aloud:** Every AI response has a **speaker icon (🔊)**. Click it to have the message read out loud.

#### 4. Working with Your Documents (RAG)

iMentor's most powerful feature is its ability to chat with your documents.

1.  **Upload Your Document:**
    *   In the **Left Panel**, open the **"My Knowledge Base"** section.
    *   Use the upload box to add a file (PDF, DOCX, TXT, media files, etc.) or paste a URL (like a YouTube video or webpage).
    *   Wait a few moments for the document to be processed. Once complete, it will appear in your "Knowledge Source List."

2.  **Activate Document Context:**
    *   From the "Knowledge Source List" in the **Left Panel**, simply **click on the document** you wish to discuss. It will become highlighted.
    *   Now, any questions you ask in the chat will be answered *based on the content of that selected document*.

3.  **General Chat:** If you don't select any document, the AI will provide general answers based on its internal knowledge.

#### 5. Analyzing and Creating Content

Once you select a document, the **Right Panel** comes alive with powerful tools.

*   **Document Analysis:**
    *   **FAQ Generator:** Instantly creates a list of frequently asked questions and answers from the text.
    *   **Key Topics Extractor:** Pulls out the most important themes and concepts.
    *   **Mind Map Creator:** Generates a visual mind map of the document's structure (viewable in a modal).
*   **Content Exporters:**
    *   **Podcast Generator:** Creates a 5-15 minute high-quality audio podcast based on the document's content.
    *   **Document Generation:** You can export the generated analysis (like FAQs or Key Topics) directly into a **DOCX** or **PPTX** file.

#### 6. Creating a Personalized Study Plan

If you need a structured approach to learning a new topic, use the Study Plan feature.

1.  Navigate to the **"Study Plan"** page from the top navigation.
2.  Click **"Generate New Plan"** and enter your learning goal (e.g., "Master Python for data science").
3.  The AI will generate a curriculum broken down into modules. The first module is unlocked.
4.  Click **"Start Module"**. This will open a new chat session with a pre-filled "seed question" to kickstart your learning on that topic.
5.  Once you complete a module by marking it as done, the next one will unlock.

#### 7. Other Key Features

*   **Live Concept Map:** In the **Right Panel**, click **"Show Live Map"** to see a real-time knowledge graph that visualizes the new concepts and relationships from your current chat session.
*   **LLM Selection:** In the top navigation bar, click the button with the current LLM name (e.g., "GEMINI") to open a modal where you can switch to a local Ollama model or update your API keys.
*   **Feedback:** Use the **thumbs up (👍)** and **thumbs down (👎)** icons on any AI response to provide feedback, which helps administrators fine-tune the model over time.

***

### iMentor Feature Comparison: Gemini vs. Grok vs. ChatGPT

This table compares the features of the iMentor application against the standard, publicly available versions of other popular AI models. It highlights how iMentor uses a powerful base model (like Gemini) but integrates it into a unique, feature-rich academic platform.

| Feature                       | iMentor Application                                                                                              | Gemini (Standard Web Interface)                                | Grok                                                                 | ChatGPT (GPT-4)                                                     |
| :---------------------------- | :--------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------- | :------------------------------------------------------------------- | :------------------------------------------------------------------ |

| **Advanced Reasoning (ToT)**  | ✅ **Yes**, automatically plans and evaluates multi-step answers for complex queries ("Complex Reasoning").         | ✅ **Yes**, strong inherent reasoning capabilities.                | ✅ **Yes**, capable of complex reasoning.                              | ✅ **Yes**, strong inherent reasoning capabilities.                 |
| **Critical Thinking Prompts** | ✅ **Yes**, provides built-in prompts to verify, challenge, and apply the AI's answers.                           | ❌ **No**, user must manually create these prompts.                | ❌ **No**, user must manually create these prompts.                  | ❌ **No**, user must manually create these prompts.                 |
| **RAG on User Documents**     | ✅ **Yes**, dedicated knowledge base with persistent file storage and context selection.                          | ✅ **Yes**, supports temporary file uploads for context.         | ❌ **No**, primarily focused on real-time web data.                 | ✅ **Yes**, supports temporary file uploads for context.            |
| **Deep Document Analysis**    | ✅ **Yes**, one-click generation of FAQs, Key Topics, Mind Maps, and Podcasts from uploaded docs.                 | ❌ **No**, requires manual prompting to extract this information.  | ❌ **No**.                                                           | ❌ **No**, requires manual prompting to extract this information.   |
| **Live Session KG**           | ✅ **Yes**, generates a real-time, visual "Concept Map" of the topics discussed in the current chat.              | ❌ **No**.                                                     | ❌ **No**.                                                           | ❌ **No**.                                                          |
| **Content Export**            | ✅ **Yes**, native export of generated analysis to **PPTX**, **DOCX**, and **MP3** (Podcast) formats.                 | ❌ **No**, requires manual copy-pasting.                       | ❌ **No**.                                                           | ❌ **No**, requires manual copy-pasting.                            |
| **Personalized Study Plans**  | ✅ **Yes**, dedicated feature to generate, track, and execute multi-module learning curriculums.                  | ❌ **No**, can generate a plan as text but not as an interactive feature. | ❌ **No**, can generate a plan as text.                            | ❌ **No**, can generate a plan as text but not as an interactive feature. |
| **Integrated Code Executor**  | ✅ **Yes**, a full, secure coding environment with AI analysis, test case generation, and error explanation. | ✅ **Yes**, can execute Python code snippets in a sandbox.       | ❌ **No**.                                                           | ✅ **Yes**, can execute Python code snippets in a sandbox.          |
| **Quiz Generation**           | ✅ **Yes**, a dedicated tool to upload a document and automatically generate a multiple-choice quiz.               | ❌ **No**, requires manual prompting.                          | ❌ **No**.                                                           | ❌ **No**, requires manual prompting.                               |
| **User Model Choice**         | ✅ **Yes**, allows switching between cloud (Gemini) and local (Ollama) models.                                   | ❌ **No**.                                                     | ❌ **No**.                                                           | ❌ **No**.                                                          |
| **Real-time Web Access**      | ✅ **Yes**, can be enabled on a per-query basis.                                                                 | ✅ **Yes**, integrated with Google Search.                         | ✅ **Yes**, integrated with X (Twitter) and the web.                 | ✅ **Yes** (with Plus subscription).                                |
