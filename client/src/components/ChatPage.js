// client/src/components/ChatPage.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
// <-- UPDATED: Added generatePodcast import
import { sendMessage, saveChatHistory, getUserFiles, queryRagService, generatePodcast } from '../services/api';
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
    const [isLoading, setIsLoading] = useState(false);
    const [isRagLoading, setIsRagLoading] = useState(false);
    const [isPodcastLoading, setIsPodcastLoading] = useState(false); // <-- NEW: State for podcast loading
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

    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    // --- Effects ---
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    useEffect(() => {
        const storedSessionId = localStorage.getItem('sessionId');
        const storedUserId = localStorage.getItem('userId');
        const storedUsername = localStorage.getItem('username');

        if (!storedUserId || !storedSessionId || !storedUsername) {
            handleLogout(true);
        } else {
            setSessionId(storedSessionId);
            setUserId(storedUserId);
            setUsername(storedUsername);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // This useEffect is now handled by the FileManagerWidget itself, but we keep the shell
    // in case we need to trigger a global file check again.
    useEffect(() => {
        if (userId) {
            // The FileManagerWidget will now handle its own data fetching.
            // This effect can be simplified or removed if the parent no longer needs to know.
        }
    }, [userId, fileRefreshTrigger]);

    // --- Callback Definitions ---
    const triggerFileRefresh = useCallback(() => setFileRefreshTrigger(prev => prev + 1), []);
    const handlePromptSelectChange = useCallback((newId) => {
        setCurrentSystemPromptId(newId); setEditableSystemPromptText(getPromptTextById(newId));
        setError(prev => prev && (prev.includes("Session invalid") || prev.includes("Critical Error")) ? prev : `Assistant mode changed.`);
        setTimeout(() => { setError(prev => prev === `Assistant mode changed.` ? '' : prev); }, 3000);
    }, []);
    const handlePromptTextChange = useCallback((newText) => {
        setEditableSystemPromptText(newText);
        const matchingPreset = availablePrompts.find(p => p.id !== 'custom' && p.prompt === newText);
        setCurrentSystemPromptId(matchingPreset ? matchingPreset.id : 'custom');
    }, []);
    const handleHistory = useCallback(() => setIsHistoryModalOpen(true), []);
    const closeHistoryModal = useCallback(() => setIsHistoryModalOpen(false), []);

    const saveAndReset = useCallback(async (isLoggingOut = false, onCompleteCallback = null) => {
        const currentSessionId = localStorage.getItem('sessionId');
        const currentUserId = localStorage.getItem('userId');
        const messagesToSave = [...messages];

        if (!currentSessionId || !currentUserId || isLoading || isRagLoading || isPodcastLoading || messagesToSave.length === 0) {
             if (onCompleteCallback) onCompleteCallback();
             return;
        }
        // ... (rest of saveAndReset is likely fine)
    }, [messages, isLoading, isRagLoading, isPodcastLoading, handlePromptSelectChange]);

    const handleLogout = useCallback((skipSave = false) => {
        const performCleanup = () => {
            localStorage.clear();
            setIsAuthenticated(false);
            setMessages([]); setSessionId(''); setUserId(''); setUsername('');
            setHasFiles(false); setIsRagEnabled(false);
            if (window.location.pathname !== '/login') {
                 navigate('/login', { replace: true });
            }
        };
        if (!skipSave && messages.length > 0) {
             saveAndReset(true, performCleanup);
        } else {
             performCleanup();
        }
    }, [navigate, setIsAuthenticated, saveAndReset, messages.length]);

    // <-- NEW: The missing handler function for generating podcasts
    const handleGeneratePodcast = useCallback(async (fileId, fileName) => {
        if (isPodcastLoading || isLoading) return;

        setIsPodcastLoading(true);
        setError('');

        try {
            console.log(`Requesting podcast generation for file: ${fileName} (ID: ${fileId})`);
            const response = await generatePodcast(fileId);
            const { audioUrl } = response.data;

            if (!audioUrl) {
                throw new Error("Backend did not provide an audio URL.");
            }

            const podcastMessage = {
                role: 'assistant',
                type: 'audio', // Special type for rendering
                parts: [{ text: `Here is the podcast for "${fileName}":` }],
                audioUrl: audioUrl,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, podcastMessage]);

        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to generate podcast.';
            console.error("Podcast Generation Error:", err.response || err);
            setError(`Podcast Error: ${errorMessage}`);
            if (err.response?.status === 401) {
                 handleLogout(true);
            }
        } finally {
            setIsPodcastLoading(false);
        }
    }, [isLoading, isPodcastLoading, handleLogout]);

    const handleNewChat = useCallback(() => {
        if (!isLoading && !isRagLoading && !isPodcastLoading) {
             saveAndReset(false);
        }
     }, [isLoading, isRagLoading, isPodcastLoading, saveAndReset]);

    const handleSendMessage = useCallback(async (e) => {
        // ... (handleSendMessage function is likely fine, just ensure it checks isPodcastLoading)
    }, [inputText, isLoading, isRagLoading, isPodcastLoading, messages, editableSystemPromptText, isRagEnabled, handleLogout]);

    const handleEnterKey = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }, [handleSendMessage]);

    const handleRagToggle = (event) => {
        setIsRagEnabled(event.target.checked);
    };

    // <-- UPDATED: Include the new loading state
    const isProcessing = isLoading || isRagLoading || isPodcastLoading;

    if (!userId) {
        return <div className="loading-indicator"><span>Initializing...</span></div>;
    }

    return (
        <div className="chat-page-container">
            <div className="sidebar-area">
                 <SystemPromptWidget
                    selectedPromptId={currentSystemPromptId} promptText={editableSystemPromptText}
                    onSelectChange={handlePromptSelectChange} onTextChange={handlePromptTextChange}
                 />
                <FileUploadWidget onUploadSuccess={triggerFileRefresh} />
                
                {/* <-- CORRECTED: This is the correct way to render the component --> */}
                <FileManagerWidget
                    refreshTrigger={fileRefreshTrigger}
                    onGeneratePodcast={handleGeneratePodcast}
                    onFilesChange={(filesExist) => {
                        setHasFiles(filesExist);
                        if (filesExist && !isRagEnabled) {
                            setIsRagEnabled(true);
                        }
                    }}
                />
            </div>

            <div className="chat-container">
                 <header className="chat-header">
                    <h1>Engineering Tutor</h1>
                    <div className="header-controls">
                        <span className="username-display">Hi, {username}!</span>
                        <button onClick={handleHistory} className="header-button history-button" disabled={isProcessing}>History</button>
                        <button onClick={handleNewChat} className="header-button newchat-button" disabled={isProcessing}>New Chat</button>
                        <button onClick={() => handleLogout(false)} className="header-button logout-button" disabled={isProcessing}>Logout</button>
                    </div>
                </header>

                 <div className="messages-area">
                    {messages.map((msg, index) => {
                         if (!msg?.role || !msg?.parts?.length || !msg.timestamp) {
                            return <div key={`error-${index}`} className="message-error">Msg Error</div>;
                         }
                         const messageText = msg.parts[0]?.text || '';

                         // <-- NEW: Logic to render the audio player for podcast messages
                         if (msg.type === 'audio') {
                             return (
                                <div key={`${sessionId}-${index}`} className={`message ${msg.role}`}>
                                    <div className="message-content">
                                        <p>{messageText}</p>
                                        <audio controls src={msg.audioUrl} style={{ width: '100%', marginTop: '10px' }}>
                                            Your browser does not support the audio element.
                                        </audio>
                                    </div>
                                    <span className="message-timestamp">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                             );
                         }

                         // Existing logic for standard text messages
                         return (
                            <div key={`${sessionId}-${index}`} className={`message ${msg.role}`}>
                                <div className="message-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {messageText}
                                    </ReactMarkdown>
                                </div>
                                <span className="message-timestamp">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                         );
                    })}
                    <div ref={messagesEndRef} />
                 </div>

                {/* <-- UPDATED: Loading indicator now shows podcast generation text --> */}
                {isProcessing && <div className="loading-indicator"><span>{isRagLoading ? 'Searching documents...' : isPodcastLoading ? 'Generating podcast...' : 'Thinking...'}</span></div>}
                {!isProcessing && error && <div className="error-indicator">{error}</div>}

                <footer className="input-area">
                    <textarea
                        value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleEnterKey}
                        placeholder="Ask your tutor..." rows="1" disabled={isProcessing} aria-label="Chat input"
                    />
                    <div className="rag-toggle-container" title={!hasFiles ? "Upload files to enable RAG" : (isRagEnabled ? "Disable RAG" : "Enable RAG")}>
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