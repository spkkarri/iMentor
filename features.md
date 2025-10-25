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


| Feature | iMentor Application | Gemini (Standard Web Interface) | Grok | ChatGPT |
| :--- | :--- | :--- | :--- | :--- |
| **End-to-End Locally Hosted** | ✅ **Yes**. Can be fully deployed on-premises using Ollama for the LLM, ensuring no data leaves the local network. | ❌ **No**. A cloud-based service. | ❌ **No**. A cloud-based service. | ❌ **No**. A cloud-based service. |
| **Custom Model Support** | ✅ **Yes**. Supports fine-tuned models and a wide range of open-source models via its Ollama integration. | ❌ **No**. Uses proprietary Google models. | ❌ **No**. Uses the proprietary Grok-1 model. | ❌ **No**. Uses proprietary OpenAI models. |
| **Data Privacy** | ✅ **Excellent**. When self-hosted, all user data, documents, and chat histories remain within the user's infrastructure. | ⚠️ **Managed**. Data is sent to Google's servers and is subject to their privacy policy and data usage terms. | ⚠️ **Managed**. Data is sent to xAI's servers and is subject to their privacy policy. | ⚠️ **Managed**. Data is sent to OpenAI's servers and is subject to their privacy policy (with some opt-out controls). |
| **User Privacy** | ✅ **Excellent**. User data is stored in a self-managed database, providing full control over access and retention. | ⚠️ **Managed**. User history is stored on Google's platform. | ⚠️ **Managed**. User history is stored on xAI's platform. | ⚠️ **Managed**. User history is stored on OpenAI's platform. |
| **Knowledge Graph (KG)** | ✅ **Yes**. A core feature. It automatically builds, stores (in Neo4j), and visualizes knowledge graphs from documents and live chat sessions. | ❌ **No**. Can generate graph *descriptions* (like Mermaid code) but has no integrated, persistent KG system. | ❌ **No**. | ❌ **No**. Can generate graph descriptions but has no integrated KG system. |
| **Graph RAG** | ✅ **Yes**. The reasoning process can query the structured knowledge graph for facts to enhance the context provided to the LLM, leading to more accurate answers. | ❌ **No**. | ❌ **No**. | ❌ **No**. |
| **Unlimited Document Upload**| ✅ **Yes**. Document storage is limited only by the capacity of the host server's storage. | ❌ **No**. Has limits on the number and size of files that can be uploaded per session. | ❌ **No**. Does not support document uploads. | ❌ **No**. Has limits on the number and size of files that can be uploaded per session. |
| **Cost** | 💵 **Flexible**. The software is open-source. Costs are related to hosting infrastructure and optional commercial LLM API fees. Can be virtually free with local hosting and Ollama. | 💰 **Subscription/API**. Free tier available. More powerful models and features require a subscription or pay-per-use API access. | 💰 **Subscription**. Included with the X Premium+ subscription. | 💰 **Subscription/API**. Free tier available (GPT-3.5). Full capabilities require a ChatGPT Plus subscription. |
| **Learning Plan Design** | ✅ **Yes**. A dedicated, interactive feature that generates a step-by-step curriculum with trackable modules and integrated chat sessions. | ❌ **No**. Can generate a study plan as plain text but does not provide an interactive, stateful tool. | ❌ **No**. Can generate a plan as text. | ❌ **No**. Can generate a study plan as plain text but not as an interactive tool. |
| **Running Custom Code** | ✅ **Yes**. Features a full, secure code execution environment with a dedicated UI, test case management, and AI-powered analysis. | ✅ **Yes**. Can execute Python code snippets in a sandboxed environment. | ❌ **No**. | ✅ **Yes**. The "Code Interpreter" tool allows for sandboxed Python execution. |
| **Prompt Enhancing** | ✅ **Yes**. A built-in "Prompt Coach" analyzes user queries and suggests improvements with explanations to help users ask better questions. | ❌ **No**. | ❌ **No**. | ❌ **No**. |
| **Quiz Generation** | ✅ **Yes**. A dedicated tool to upload a document and automatically generate a complete, interactive multiple-choice quiz. | ❌ **No**. Can generate quiz questions as text via prompting, but not as a ready-to-use tool. | ❌ **No**. | ❌ **No**. Can generate quiz questions as text, but not as a tool. |
| **Document Analysis** | ✅ **Excellent**. One-click generation of FAQs, Key Topics, Mind Maps, and Audio Podcasts from any selected document. | ⚠️ **Manual**. Can perform these tasks, but requires the user to write specific, detailed prompts for each one. | ❌ **No**. | ⚠️ **Manual**. Can perform these tasks, but requires detailed, manual prompting for each. |                                                      | ❌ **No**.                                                          |
| **Real-time Web Access**      | ✅ **Yes**, can be enabled on a per-query basis.                                                                 | ✅ **Yes**, integrated with Google Search.                         | ✅ **Yes**, integrated with X (Twitter) and the web.                 | ✅ **Yes** (with Plus subscription).                                |
