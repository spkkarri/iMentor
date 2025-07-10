// client/src/components/ChatPage.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
// Assuming sendMessage from api.js will handle the actual POST to your Node.js backend's /api/chat/message
import { sendMessage, saveChatHistory, getUserFiles, queryRagService } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';

import SystemPromptWidget, { availablePrompts, getPromptTextById } from './SystemPromptWidget';
import HistoryModal from './HistoryModal';
import FileUploadWidget from './FileUploadWidget';
import FileManagerWidget from './FileManagerWidget';

import './ChatPage.css';

const ChatPage = ({ setIsAuthenticated }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false); // General loading for LLM response
    const [isRagLoading, setIsRagLoading] = useState(false); // Specific loading for RAG query
    const [error, setError] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [userId, setUserId] = useState('');
    const [username, setUsername] = useState('');
    const [currentSystemPromptId, setCurrentSystemPromptId] = useState('friendly');
    const [editableSystemPromptText, setEditableSystemPromptText] = useState(() => getPromptTextById('friendly'));
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0);
    const [hasFiles, setHasFiles] = useState(false);
    const [isRagEnabled, setIsRagEnabled] = useState(false);

    // --- NEW STATE FOR LLM PROVIDER CHOICE ---
    const [selectedLlmProvider, setSelectedLlmProvider] = useState('gemini'); // Default to 'gemini'

    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    // --- Effects --- (Keep your existing useEffects)
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    useEffect(() => {
        const storedSessionId = localStorage.getItem('sessionId');
        const storedUserId = localStorage.getItem('userId');
        const storedUsername = localStorage.getItem('username');
        if (!storedUserId || !storedSessionId || !storedUsername) {
            console.warn("ChatPage Mount: Missing auth info. Redirecting to login.");
            handleLogout(true);
        } else {
            setSessionId(storedSessionId);
            setUserId(storedUserId);
            setUsername(storedUsername);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const checkUserFiles = async () => {
            const currentUserId = localStorage.getItem('userId');
            if (!currentUserId) {
                setHasFiles(false); setIsRagEnabled(false); return;
            }
            try {
                const response = await getUserFiles();
                const filesExist = response.data && response.data.length > 0;
                setHasFiles(filesExist);
                setIsRagEnabled(filesExist);
            } catch (err) {
                console.error("Error checking user files:", err);
                if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
                     handleLogout(true);
                } else {
                    setError("Could not check user files."); setHasFiles(false); setIsRagEnabled(false);
                }
            }
        };
        if (userId) { checkUserFiles(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, fileRefreshTrigger]);

    // --- Callback Definitions --- (Keep your existing callbacks)
    const triggerFileRefresh = useCallback(() => setFileRefreshTrigger(prev => prev + 1), []);
    const handlePromptSelectChange = useCallback((newId) => { /* ... your code ... */ }, []);
    const handlePromptTextChange = useCallback((newText) => { /* ... your code ... */ }, []);
    const handleHistory = useCallback(() => setIsHistoryModalOpen(true), []);
    const closeHistoryModal = useCallback(() => setIsHistoryModalOpen(false), []);

    const saveAndReset = useCallback(async (isLoggingOut = false, onCompleteCallback = null) => {
        // ... your existing saveAndReset logic ...
        // No changes needed here regarding llmProvider directly, as it saves client-side messages
    }, [messages, isLoading, isRagLoading, handlePromptSelectChange]);

    const handleLogout = useCallback((skipSave = false) => {
        // ... your existing handleLogout logic ...
        // It already clears localStorage, which is good.
        // Consider if you want to reset selectedLlmProvider to default on logout.
        setSelectedLlmProvider('gemini'); // Optional: reset on logout
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate, setIsAuthenticated, saveAndReset, messages.length]);

    const handleNewChat = useCallback(() => {
        // ... your existing handleNewChat logic ...
    }, [isLoading, isRagLoading, saveAndReset]);


    // --- MODIFIED handleSendMessage ---
    const handleSendMessage = useCallback(async (e) => {
        if (e) e.preventDefault();
        const textToSend = inputText.trim();
        const currentSessionId = localStorage.getItem('sessionId');
        const currentUserId = localStorage.getItem('userId'); // Already used by interceptor, but good to have if needed

        if (!textToSend || isLoading || isRagLoading || !currentSessionId || !currentUserId) {
            if (!currentSessionId || !currentUserId) {
                 setError("Session invalid. Please refresh or log in again.");
                 if (!currentUserId) handleLogout(true);
            }
            return;
        }

        const newUserMessage = { role: 'user', parts: [{ text: textToSend }], timestamp: new Date() };
        const previousMessages = messages; // To rollback UI on error
        setMessages(prev => [...prev, newUserMessage]);
        setInputText('');
        setError('');

        let relevantDocsFromRag = []; // Renamed for clarity
        let ragQueryError = null;

        if (isRagEnabled) {
            setIsRagLoading(true);
            try {
                console.log("[Client] RAG Enabled: Querying /api/chat/rag endpoint...");
                const ragResponse = await queryRagService({ message: textToSend }); // queryRagService from api.js
                relevantDocsFromRag = ragResponse.data.relevantDocs || [];
                console.log(`[Client] RAG Query returned ${relevantDocsFromRag.length} documents.`);
            } catch (err) {
                console.error("[Client] RAG Query Error:", err.response || err);
                ragQueryError = err.response?.data?.message || "Failed to retrieve documents for RAG.";
                if (err.response?.status === 401) {
                     console.warn("[Client] Received 401 during RAG query, logging out.");
                     handleLogout(true);
                     setIsRagLoading(false); return;
                }
            } finally {
                setIsRagLoading(false);
            }
        } else {
            console.log("[Client] RAG Disabled: Skipping RAG query.");
        }

        setIsLoading(true); // General loading for LLM call
        const historyForAPI = previousMessages.map(msg => ({ // Ensure history format matches backend expectation
            role: msg.role,
            parts: msg.parts.map(part => ({ text: part.text || '' }))
        }));
        const systemPromptToSend = editableSystemPromptText;

        try {
            if (ragQueryError) { // Display RAG error if it occurred
                 setError(prev => prev ? `${prev} | RAG Error: ${ragQueryError}` : `RAG Error: ${ragQueryError}`);
            }

            console.log(`[Client] Sending message to /api/chat/message. Provider: ${selectedLlmProvider}, RAG Enabled: ${isRagEnabled}, Docs Sent: ${isRagEnabled ? relevantDocsFromRag.length : 'N/A'}`);
            
            // --- CONSTRUCT PAYLOAD WITH LLM PROVIDER ---
            const messagePayload = {
                query: textToSend,
                history: historyForAPI,
                sessionId: currentSessionId,
                systemPrompt: systemPromptToSend,
                isRagEnabled: isRagEnabled,
                relevantDocs: isRagEnabled ? relevantDocsFromRag : [], // Send docs if RAG was used
                llmProvider: selectedLlmProvider // <<< KEY ADDITION
                // If you add specific Ollama model selection later, send it here too:
                // ollamaModelName: (selectedLlmProvider === 'ollama' ? 'phi3:latest' : undefined)
            };

            const sendMessageResponse = await sendMessage(messagePayload); // sendMessage from api.js

            const modelReplyData = sendMessageResponse.data; // Node.js backend returns { reply, thinking, references, session_id }
            
            if (modelReplyData?.reply?.role && modelReplyData?.reply?.parts?.length > 0) {
                // Construct the message object similar to how history is loaded
                const botMessage = {
                    ...modelReplyData.reply, // Should include role, parts, timestamp
                    // Assuming backend 'reply' object is already in the correct message structure
                    // If backend sends thinking/references separately, add them here for display
                    thinking: modelReplyData.thinking || null,
                    references: modelReplyData.references || []
                };
                setMessages(prev => [...prev, botMessage]);
            } else {
                throw new Error("Invalid reply structure received from backend.");
            }
            // Clear general error if previous one wasn't a session invalidation error
            setError(prev => prev && (prev.includes("Session invalid") || prev.includes("Critical Error")) ? prev : '');

        } catch (err) {
            const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to get response.';
            setError(prev => prev ? `${prev} | Chat Error: ${errorMessage}` : `Chat Error: ${errorMessage}`);
            console.error("[Client] Send Message Error:", err.response || err);
            setMessages(previousMessages); // Rollback UI to state before sending user message
            if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
                 console.warn("[Client] Received 401 sending message, logging out.");
                 handleLogout(true);
            }
        } finally {
            setIsLoading(false);
        }
    }, [inputText, isLoading, isRagLoading, messages, editableSystemPromptText, isRagEnabled, handleLogout, selectedLlmProvider]); // Added selectedLlmProvider

    // ... (keep handleEnterKey, handleRagToggle, isProcessing) ...
    const handleEnterKey = useCallback((e) => { /* ... */ }, [handleSendMessage]);
    const handleRagToggle = (event) => { /* ... */ };
    const isProcessing = isLoading || isRagLoading;


    if (!userId) { /* ... your loading indicator ... */ }

    return (
        <div className="chat-page-container">
            <div className="sidebar-area">
                 {/* ... SystemPromptWidget, FileUploadWidget, FileManagerWidget ... */}
                 <SystemPromptWidget
                    selectedPromptId={currentSystemPromptId} promptText={editableSystemPromptText}
                    onSelectChange={handlePromptSelectChange} onTextChange={handlePromptTextChange}
                 />
                <FileUploadWidget onUploadSuccess={triggerFileRefresh} />
                <FileManagerWidget refreshTrigger={fileRefreshTrigger} />
            </div>

            <div className="chat-container">
                 <header className="chat-header">
                    <h1>Engineering Tutor</h1>
                    <div className="header-controls">
                        {/* --- LLM PROVIDER SELECTION DROPDOWN --- */}
                        <div style={{ marginRight: '15px' }}>
                            <label htmlFor="llm-provider-select" style={{ marginRight: '5px', fontSize: '0.8rem' }}>AI Engine:</label>
                            <select
                                id="llm-provider-select"
                                value={selectedLlmProvider}
                                onChange={(e) => setSelectedLlmProvider(e.target.value)}
                                disabled={isProcessing}
                                style={{ fontSize: '0.8rem', padding: '2px 5px', borderRadius: '4px' }}
                            >
                                <option value="gemini">Cloud AI (Gemini)</option>
                                <option value="ollama">Local AI (Ollama)</option>
                                {/* Add more specific Ollama models here if backend supports it */}
                                {/* <option value="ollama_phi3">Local AI (Phi-3)</option> */}
                                {/* <option value="ollama_mistral">Local AI (Mistral)</option> */}
                            </select>
                        </div>
                        <span className="username-display">Hi, {username}!</span>
                        {/* ... History, New Chat, Logout buttons ... */}
                        <button onClick={handleHistory} className="header-button history-button" disabled={isProcessing}>History</button>
                        <button onClick={handleNewChat} className="header-button newchat-button" disabled={isProcessing}>New Chat</button>
                        <button onClick={() => handleLogout(false)} className="header-button logout-button" disabled={isProcessing}>Logout</button>
                    </div>
                </header>

                 <div className="messages-area">
                    {/* ... your existing messages mapping ... */}
                    {/* MODIFIED TO INCLUDE THINKING AND REFERENCES IF PRESENT ON BOT MESSAGE OBJECT */}
                    {messages.map((msg, index) => {
                         if (!msg?.role || !msg?.parts?.length || !msg.timestamp) {
                            console.warn("Rendering invalid message structure at index", index, msg);
                            return <div key={`error-${index || uuidv4()}`} className="message-error">Msg Error</div>;
                         }
                         const messageText = msg.parts[0]?.text || '';
                         const isBot = msg.role === 'model' || msg.role === 'bot'; // Handle both 'model' and 'bot' for role

                         return (
                            <div key={`${msg.sessionId || sessionId}-${index}-${msg.timestamp}`} className={`message ${msg.role}`}> {/* More robust key */}
                                <div className="message-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {messageText}
                                    </ReactMarkdown>
                                </div>
                                {isBot && msg.thinking && (
                                    <details className="message-thinking-client">
                                        <summary>Show Reasoning</summary>
                                        <pre><code>{msg.thinking}</code></pre>
                                    </details>
                                )}
                                {isBot && msg.references && msg.references.length > 0 && (
                                    <div className="message-references-client">
                                        <strong>References:</strong>
                                        <ul>
                                            {msg.references.map((ref, refIdx) => (
                                                <li key={refIdx} title={ref.content_preview || ref.chunk_content || ''}>
                                                    [{ref.number || refIdx + 1}] {ref.source} (Score: {ref.score ? ref.score.toFixed(3) : 'N/A'})
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                <span className="message-timestamp">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                         );
                    })}
                    <div ref={messagesEndRef} />
                 </div>

                {/* ... your existing loading/error indicators and input-area footer ... */}
                {isProcessing && <div className="loading-indicator"><span>{isRagLoading ? 'Searching documents...' : 'Thinking...'}</span></div>}
                {!isProcessing && error && <div className="error-indicator">{error}</div>}

                <footer className="input-area">
                    {/* ... your textarea, RAG toggle, send button ... */}
                     <textarea
                        value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleEnterKey}
                        placeholder="Ask your tutor..." rows="1" disabled={isProcessing} aria-label="Chat input"
                    />
                    <div className="rag-toggle-container" title={!hasFiles ? "Upload files to enable RAG" : (isRagEnabled ? "Disable RAG (Retrieval-Augmented Generation)" : "Enable RAG (Retrieval-Augmented Generation)")}>
                        <input type="checkbox" id="rag-toggle" checked={isRagEnabled} onChange={handleRagToggle}
                               disabled={!hasFiles || isProcessing} aria-label="Enable RAG" />
                        <label htmlFor="rag-toggle">RAG</label>
                    </div>
                    <button onClick={handleSendMessage} disabled={isProcessing || !inputText.trim()} title="Send Message" aria-label="Send message">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                </footer>
            </div>

            <HistoryModal isOpen={isHistoryModalOpen} onClose={closeHistoryModal} />
        </div>
    );
};

export default ChatPage;