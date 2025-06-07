// client/src/components/ChatPage.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    sendMessage, saveChatHistory, queryRagService, generatePodcast, generateMindMap, 
    getUserFiles, deleteUserFile, renameUserFile 
} from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';

import SystemPromptWidget, { availablePrompts, getPromptTextById } from './SystemPromptWidget';
import HistoryModal from './HistoryModal';
import FileUploadWidget from './FileUploadWidget';
import FileManagerWidget from './FileManagerWidget';
import MindMap from './MindMap';

import './ChatPage.css';

const ChatPage = ({ setIsAuthenticated }) => {
    // State for chat messages and input
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    
    // State for various loading indicators
    const [isLoading, setIsLoading] = useState(false);
    const [isRagLoading, setIsRagLoading] = useState(false);
    const [isPodcastLoading, setIsPodcastLoading] = useState(false);
    const [isMindMapLoading, setIsMindMapLoading] = useState(false);
    
    // State for UI and session management
    const [error, setError] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [userId, setUserId] = useState('');
    const [username, setUsername] = useState('');
    const [currentSystemPromptId, setCurrentSystemPromptId] = useState('friendly');
    const [editableSystemPromptText, setEditableSystemPromptText] = useState(() => getPromptTextById('friendly'));
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    
    // State for file management, now owned by ChatPage
    const [files, setFiles] = useState([]);
    const [isFileLoading, setIsFileLoading] = useState(false);
    const [fileError, setFileError] = useState('');
    const [hasFiles, setHasFiles] = useState(false);
    const [isRagEnabled, setIsRagEnabled] = useState(false);

    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    // Centralized loading state
    const isProcessing = isLoading || isRagLoading || isPodcastLoading || isMindMapLoading;

    // --- Effects ---

    // Auto-scroll to the latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Initial setup on component mount
    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        const storedUsername = localStorage.getItem('username');
        if (!storedUserId || !storedUsername) {
            handleLogout(true); // Force logout if no user data
        } else {
            setUserId(storedUserId);
            setUsername(storedUsername);
            const newSessionId = uuidv4();
            setSessionId(newSessionId);
            localStorage.setItem('sessionId', newSessionId);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch files whenever the user ID changes
    const fetchFiles = useCallback(async () => {
        if (!userId) return;
        setIsFileLoading(true);
        setFileError('');
        try {
            const response = await getUserFiles();
            const filesData = response.data || [];
            setFiles(filesData);
            const filesExist = filesData.length > 0;
            setHasFiles(filesExist);
            if (filesExist && !isRagEnabled) {
                setIsRagEnabled(true);
            }
        } catch (err) {
            setFileError('Could not load files.');
            setFiles([]);
            setHasFiles(false);
        } finally {
            setIsFileLoading(false);
        }
    }, [userId, isRagEnabled]);

    useEffect(() => {
        if (userId) {
            fetchFiles();
        }
    }, [userId, fetchFiles]);


    // --- Core Handlers ---

    const handleLogout = useCallback((skipSave = false) => {
        const performCleanup = () => {
            localStorage.clear();
            setIsAuthenticated(false);
            navigate('/login', { replace: true });
        };
        if (!skipSave && messages.length > 0) {
             saveAndReset(true, performCleanup);
        } else {
             performCleanup();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages.length]);

    const saveAndReset = useCallback(async (isLoggingOut = false, onCompleteCallback = null) => {
        const currentSessionId = localStorage.getItem('sessionId');
        const currentUserId = localStorage.getItem('userId');
        if (!currentSessionId || !currentUserId || isProcessing || messages.length === 0) {
             if (onCompleteCallback) onCompleteCallback();
             return;
        }
        try {
            const firstUserMessage = messages.find(m => m.role === 'user');
            const chatTitle = firstUserMessage ? firstUserMessage.parts[0].text.substring(0, 50) : 'New Conversation';
            await saveChatHistory({ sessionId: currentSessionId, messages, systemPrompt: editableSystemPromptText, title: chatTitle });
        } catch (saveError) {
            console.error("Failed to save chat history:", saveError);
        } finally {
            if (!isLoggingOut) {
                setMessages([]);
                const newSessionId = uuidv4();
                setSessionId(newSessionId);
                localStorage.setItem('sessionId', newSessionId);
            }
            if (onCompleteCallback) onCompleteCallback();
        }
    }, [messages, isProcessing, editableSystemPromptText]);

    const handleNewChat = useCallback(() => {
        if (!isProcessing) saveAndReset(false);
    }, [isProcessing, saveAndReset]);

    const handleLoadSession = useCallback((sessionData) => {
        if (isProcessing) return alert("Cannot load a session while another operation is in progress.");
        const doLoad = () => {
            setMessages(sessionData.messages);
            setSessionId(sessionData.sessionId);
            setEditableSystemPromptText(sessionData.systemPrompt || getPromptTextById('friendly'));
            const matchingPrompt = availablePrompts.find(p => p.prompt === sessionData.systemPrompt);
            setCurrentSystemPromptId(matchingPrompt ? matchingPrompt.id : 'custom');
            localStorage.setItem('sessionId', sessionData.sessionId);
        };
        if (messages.length > 0) {
            saveAndReset(false, doLoad);
        } else {
            doLoad();
        }
    }, [isProcessing, saveAndReset, messages.length]);

    const handleSendMessage = useCallback(async (e) => {
        if (e) e.preventDefault();
        const trimmedInput = inputText.trim();
        if (!trimmedInput || isProcessing) return;
        const newUserMessage = { role: 'user', parts: [{ text: trimmedInput }], timestamp: new Date() };
        const historyToSend = [...messages, newUserMessage];
        setMessages(historyToSend);
        setInputText('');
        setError('');
        try {
            let response;
            if (isRagEnabled) {
                setIsRagLoading(true);
                response = await queryRagService({ history: historyToSend, systemPrompt: editableSystemPromptText });
            } else {
                setIsLoading(true);
                response = await sendMessage({ history: historyToSend, systemPrompt: editableSystemPromptText });
            }
            const assistantMessage = { role: 'assistant', parts: [{ text: response.data.text }], timestamp: new Date() };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'An error occurred.';
            setError(errorMessage);
            setMessages(prev => prev.slice(0, -1));
            if (err.response?.status === 401) handleLogout(true);
        } finally {
            setIsLoading(false);
            setIsRagLoading(false);
        }
    }, [inputText, isProcessing, messages, isRagEnabled, editableSystemPromptText, handleLogout]);

    // --- File Action Handlers ---

    const handleDeleteFile = async (fileId, fileName) => {
        if (window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
            try {
                await deleteUserFile(fileId);
                fetchFiles(); 
            } catch (err) {
                setFileError(`Could not delete ${fileName}.`);
                setTimeout(() => setFileError(''), 3000);
            }
        }
    };

    const handleRenameFile = async (fileId, newName) => {
        try {
            await renameUserFile(fileId, newName);
            fetchFiles();
        } catch (err) {
            setFileError(`Could not rename file.`);
            setTimeout(() => setFileError(''), 3000);
        }
    };

    const handleGeneratePodcast = useCallback(async (fileId, fileName) => {
        if (isProcessing) return;
        setIsPodcastLoading(true);
        setError('');
        const userMessage = { role: 'user', parts: [{ text: `Requesting a podcast for the file: ${fileName}` }], timestamp: new Date() };
        setMessages(prev => [...prev, userMessage]);
        try {
            const response = await generatePodcast(fileId);
            const { audioUrl } = response.data;
            if (!audioUrl) throw new Error("Backend did not provide an audio URL.");
            const podcastMessage = { role: 'assistant', type: 'audio', parts: [{ text: `Here is the podcast for "${fileName}":` }], audioUrl: audioUrl, timestamp: new Date() };
            setMessages(prev => [...prev, podcastMessage]);
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to generate podcast.';
            setError(`Podcast Error: ${errorMessage}`);
            const errorResponseMessage = { role: 'assistant', parts: [{ text: `I'm sorry, I couldn't generate the podcast. Error: ${errorMessage}` }], timestamp: new Date() };
            setMessages(prev => [...prev, errorResponseMessage]);
        } finally {
            setIsPodcastLoading(false);
        }
    }, [isProcessing]);

    const handleGenerateMindMap = useCallback(async (fileId, fileName) => {
        if (isProcessing) return;
        setIsMindMapLoading(true);
        setError('');
        const userMessage = { role: 'user', parts: [{ text: `Requesting a mind map for the file: ${fileName}` }], timestamp: new Date() };
        setMessages(prev => [...prev, userMessage]);
        try {
            const response = await generateMindMap(fileId);
            const mindMapMessage = { role: 'assistant', type: 'mindmap', parts: [{ text: `Here is the mind map for "${fileName}":` }], nodes: response.data.nodes, edges: response.data.edges, timestamp: new Date() };
            setMessages(prev => [...prev, mindMapMessage]);
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to generate mind map.';
            setError(`Mind Map Error: ${errorMessage}`);
            const errorResponseMessage = { role: 'assistant', parts: [{ text: `I'm sorry, I couldn't generate the mind map. Error: ${errorMessage}` }], timestamp: new Date() };
            setMessages(prev => [...prev, errorResponseMessage]);
        } finally {
            setIsMindMapLoading(false);
        }
    }, [isProcessing]);


    // --- UI Handlers ---

    const handlePromptSelectChange = useCallback((newId) => {
        setCurrentSystemPromptId(newId);
        setEditableSystemPromptText(getPromptTextById(newId));
    }, []);

    const handlePromptTextChange = useCallback((newText) => {
        setEditableSystemPromptText(newText);
        const matchingPreset = availablePrompts.find(p => p.id !== 'custom' && p.prompt === newText);
        setCurrentSystemPromptId(matchingPreset ? matchingPreset.id : 'custom');
    }, []);

    const handleHistory = useCallback(() => setIsHistoryModalOpen(true), []);
    const closeHistoryModal = useCallback(() => setIsHistoryModalOpen(false), []);

    const handleEnterKey = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
    }, [handleSendMessage]);


    if (!userId) {
        return <div className="loading-indicator"><span>Initializing...</span></div>;
    }

    return (
        <div className="chat-page-container">
            <div className="sidebar-area">
                <SystemPromptWidget selectedPromptId={currentSystemPromptId} promptText={editableSystemPromptText} onSelectChange={handlePromptSelectChange} onTextChange={handlePromptTextChange} />
                <FileUploadWidget onUploadSuccess={fetchFiles} />
                <FileManagerWidget
                    files={files}
                    isLoading={isFileLoading}
                    error={fileError}
                    onDeleteFile={handleDeleteFile}
                    onRenameFile={handleRenameFile}
                    onGeneratePodcast={handleGeneratePodcast}
                    onGenerateMindMap={handleGenerateMindMap}
                    isProcessing={isProcessing}
                />
            </div>
            <div className="chat-container">
                <header className="chat-header">
                    <h1>Engineering Tutor</h1>
                    <div className="header-controls">
                        <span className="username-display">Hi, {username}!</span>
                        <button onClick={handleHistory} className="header-button" disabled={isProcessing}>History</button>
                        <button onClick={handleNewChat} className="header-button" disabled={isProcessing}>New Chat</button>
                        <button onClick={() => handleLogout(false)} className="header-button" disabled={isProcessing}>Logout</button>
                    </div>
                </header>
                <div className="messages-area">
                    {messages.map((msg, index) => {
                        if (!msg?.role || !msg?.parts?.length) return null;
                        const messageText = msg.parts[0]?.text || '';
                        const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        if (msg.type === 'mindmap') {
                            return (
                                <div key={index} className={`message ${msg.role}`}><div className="message-content"><p>{messageText}</p><MindMap nodes={msg.nodes} edges={msg.edges} /></div><span className="message-timestamp">{timestamp}</span></div>
                            );
                        }
                        if (msg.type === 'audio') {
                            return (
                                <div key={index} className={`message ${msg.role}`}><div className="message-content"><p>{messageText}</p><audio controls src={msg.audioUrl} style={{ width: '100%', marginTop: '10px' }} /></div><span className="message-timestamp">{timestamp}</span></div>
                            );
                        }
                        return (
                            <div key={index} className={`message ${msg.role}`}><div className="message-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{messageText}</ReactMarkdown></div><span className="message-timestamp">{timestamp}</span></div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
                {isProcessing && <div className="loading-indicator"><span>{isMindMapLoading ? 'Generating mind map...' : isPodcastLoading ? 'Generating podcast...' : isRagLoading ? 'Searching documents...' : 'Thinking...'}</span></div>}
                {!isProcessing && error && <div className="error-indicator">{error}</div>}
                <footer className="input-area">
                    <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleEnterKey} placeholder="Ask your tutor..." rows="1" disabled={isProcessing} />
                    <div className="rag-toggle-container" title={!hasFiles ? "Upload files to enable RAG" : "Toggle RAG"}>
                        <input type="checkbox" id="rag-toggle" checked={isRagEnabled} onChange={(e) => setIsRagEnabled(e.target.checked)} disabled={!hasFiles || isProcessing} />
                        <label htmlFor="rag-toggle">RAG</label>
                    </div>
                    <button onClick={handleSendMessage} disabled={isProcessing || !inputText.trim()} title="Send Message">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                    </button>
                </footer>
            </div>
            <HistoryModal isOpen={isHistoryModalOpen} onClose={closeHistoryModal} onLoadSession={handleLoadSession} />
        </div>
    );
};

export default ChatPage;