// client/src/components/ChatPage.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    sendMessage as apiSendMessage, saveChatHistory, queryRagService, generatePodcast, generateMindMap,
    getUserFiles, deleteUserFile, renameUserFile, performDeepSearch,
} from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';

import SystemPromptWidget, { availablePrompts, getPromptTextById } from './SystemPromptWidget';
import FileUploadWidget from './FileUploadWidget';
import FileManagerWidget from './FileManagerWidget';
import MindMap from './MindMap'; // Restored for mind map rendering
import HistoryModal from './HistoryModal';

import './ChatPage.css';

const ChatPage = ({ setIsAuthenticated }) => {
    console.log('--- ChatPage Component Re-rendered ---');

    // Moved loadingStates definition before its use to fix no-use-before-define
    const [loadingStates, setLoadingStates] = useState({
        chat: false,
        files: false,
        podcast: false,
        mindMap: false,
        deepSearch: false,
        listening: false
    });

    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [error, setError] = useState(''); // Keep error state for displaying UI errors
    const [sessionId, setSessionId] = useState('');
    const [userId, setUserId] = useState('');
    const [username, setUsername] = useState('');
    const [currentSystemPromptId, setCurrentSystemPromptId] = useState('friendly');
    const [editableSystemPromptText, setEditableSystemPromptText] = useState(() => getPromptTextById('friendly'));
    const [files, setFiles] = useState([]);
    const [fileError, setFileError] = useState('');
    const [isRagEnabled, setIsRagEnabled] = useState(false);
    const [isDeepSearchEnabled, setIsDeepSearchEnabled] = useState(false);
    const [activeFileForRag, setActiveFileForRag] = useState(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    
    useEffect(() => {
        console.log('[Debug] Loading states changed:', loadingStates);
    }, [loadingStates]);

    useEffect(() => {
        console.log('[Debug] Messages state changed, new count:', messages.length);
    }, [messages]);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const navigate = useNavigate();

    const isProcessing = Object.values(loadingStates).some(Boolean);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

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
    }, [messages.length, setIsAuthenticated, navigate, saveAndReset]);

    const hasUserId = !!userId;

    useEffect(() => {
        const handleStorage = (event) => {
            if (event.key === 'userId' && !event.newValue) {
                setIsAuthenticated(false);
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [setIsAuthenticated]);

    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        const storedUsername = localStorage.getItem('username');
        if (!storedUserId || !storedUsername) {
            setIsAuthenticated(false);
        } else {
            setIsAuthenticated(true);
        }
    }, [setIsAuthenticated]);

    useEffect(() => {
        const storedUserId = String(localStorage.getItem('userId'));
        const storedUsername = localStorage.getItem('username');
        console.log('ChatPage: storedUserId:', storedUserId, 'storedUsername:', storedUsername);
        if (!storedUserId || !storedUsername) {
            handleLogout(true);
        } else {
            setUserId(storedUserId);
            setUsername(storedUsername);
            const newSessionId = uuidv4();
            setSessionId(newSessionId);
            localStorage.setItem('sessionId', newSessionId);
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            recognition.onstart = () => setLoadingStates(prev => ({ ...prev, listening: true }));
            recognition.onresult = (event) => setInputText(event.results[0][0].transcript);
            recognition.onerror = (e) => setError(`STT Error: ${e.error}`);
            recognition.onend = () => setLoadingStates(prev => ({ ...prev, listening: false }));
            recognitionRef.current = recognition;
        } else {
            console.warn('Web Speech API is not supported in this browser.');
        }
        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        };
    }, [handleLogout]);

    const fetchFiles = useCallback(async () => {
        if (!userId) return;
        setLoadingStates(prev => ({ ...prev, files: true }));
        try {
            const response = await getUserFiles();
            const filesData = response.data || [];
            setFiles(filesData);
        } catch (err) {
            setFileError('Could not load files.');
        } finally {
            setLoadingStates(prev => ({ ...prev, files: false }));
        }
    }, [userId]);

    useEffect(() => {
        if (userId) {
            fetchFiles();
        }
    }, [userId, fetchFiles]);

    const handleNewChat = useCallback(() => {
        if (!isProcessing) saveAndReset(false);
    }, [isProcessing, saveAndReset]);

    const handleSendMessage = useCallback(async (e) => {
        if (e) e.preventDefault();
        const trimmedInput = inputText.trim();
        if (!trimmedInput || isProcessing) return;

        console.log('[Debug] handleSendMessage triggered.');
        if (loadingStates.listening) recognitionRef.current?.stop();

        const newUserMessage = { role: 'user', parts: [{ text: trimmedInput }], timestamp: new Date() };
        const historyToSend = [...messages, newUserMessage];
        setMessages(historyToSend);
        setInputText('');
        setError('');

        if (isDeepSearchEnabled) {
            console.log('[Debug] Performing Deep Search with query:', trimmedInput);
            setLoadingStates(prev => ({ ...prev, deepSearch: true }));
            try {
                const response = await performDeepSearch(trimmedInput);
                console.log('[Debug] Deep Search API Success:', response.data);
                const deepSearchResult = {
                    role: 'assistant', type: 'deep_search',
                    parts: [{ text: response.data.message }],
                    timestamp: new Date(), metadata: response.data.metadata
                };
                setMessages(prev => [...prev, deepSearchResult]);
            } catch (err) {
                console.error('[Debug] Deep Search API Error:', err.response || err);
                const errorMessage = err.response?.data?.message || 'Deep search failed.';
                setError(`Deep Search Error: ${errorMessage}`);
                setMessages(prev => prev.slice(0, -1));
                if (err.response?.status === 401) handleLogout(true);
            } finally {
                setLoadingStates(prev => ({ ...prev, deepSearch: false }));
            }
        } else if (isRagEnabled) {
            console.log('[Debug] Performing RAG Query with query:', trimmedInput, 'and file:', activeFileForRag?.name);
            setLoadingStates(prev => ({ ...prev, chat: true }));
            try {
                const ragPayload = { query: trimmedInput, history: historyToSend, sessionId };
                if (activeFileForRag) ragPayload.fileId = activeFileForRag.id;
                console.log('[Debug] RAG Payload:', ragPayload);
                const response = await queryRagService(ragPayload);
                console.log('[Debug] RAG API Success:', response.data);
                const assistantMessage = {
                    role: 'assistant', type: 'rag',
                    parts: [{ text: response.data.message }],
                    timestamp: new Date(), metadata: response.data.metadata
                };
                setMessages(prev => [...prev, assistantMessage]);
            } catch (err) {
                console.error('[Debug] RAG API Error:', err.response || err);
                const errorMessage = err.response?.data?.message || 'RAG query failed.';
                setError(`RAG Error: ${errorMessage}`);
                setMessages(prev => prev.slice(0, -1));
                if (err.response?.status === 401) handleLogout(true);
            } finally {
                setLoadingStates(prev => ({ ...prev, chat: false }));
            }
        } else {
            console.log('[Debug] Performing standard chat message with query:', trimmedInput);
            setLoadingStates(prev => ({ ...prev, chat: true }));
            try {
                const payload = { query: trimmedInput, history: historyToSend, sessionId, systemPrompt: editableSystemPromptText };
                console.log('[Debug] Standard Chat Payload:', payload);
                const response = await apiSendMessage(payload);
                console.log('[Debug] Standard Chat API Success:', response.data);
                const assistantMessage = {
                    role: 'assistant',
                    parts: [{ text: response.data.message }],
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, assistantMessage]);
            } catch (err) {
                console.error('[Debug] Standard Chat API Error:', err.response || err);
                const errorMessage = err.response?.data?.error || 'Chat error.';
                setError(errorMessage);
                setMessages(prev => prev.slice(0, -1));
                if (err.response?.status === 401) handleLogout(true);
            } finally {
                setLoadingStates(prev => ({ ...prev, chat: false }));
            }
        }
    }, [inputText, isProcessing, loadingStates, isDeepSearchEnabled, isRagEnabled, messages, editableSystemPromptText, handleLogout, activeFileForRag, sessionId]);

    const handleMicButtonClick = useCallback(() => {
        if (!recognitionRef.current) return;
        if (loadingStates.listening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    }, [loadingStates.listening]);

    const handleDeleteFile = async (fileId, fileName) => {
        if (window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
            try {
                await deleteUserFile(fileId);
                fetchFiles();
            } catch (err) {
                setFileError(`Could not delete ${fileName}.`);
            }
        }
    };

    const handleRenameFile = async (fileId, newName) => {
        try {
            await renameUserFile(fileId, newName);
            fetchFiles();
        } catch (err) {
            setFileError(`Could not rename file.`);
        }
    };

    const handleChatWithFile = useCallback((fileId, fileName) => {
        setActiveFileForRag({ id: fileId, name: fileName });
        setIsRagEnabled(true);
        setMessages(prev => [...prev, {
            role: 'system',
            parts: [{ text: `Now chatting with file: **${fileName}**` }],
            timestamp: new Date()
        }]);
    }, []);

    const handleGeneratePodcast = useCallback(async (fileId, fileName) => {
        if (isProcessing) return;
        setLoadingStates(prev => ({ ...prev, podcast: true }));
        setError('');
        try {
            setMessages(prev => [...prev, { role: 'user', parts: [{ text: `Requesting a podcast for "${fileName}"...` }], timestamp: new Date() }]);
            const response = await generatePodcast(fileId);
            const isAudioFile = response.data.podcastUrl && (response.data.podcastUrl.endsWith('.mp3') || response.data.podcastUrl.endsWith('.wav'));
            if (isAudioFile) {
            const podcastMessage = { 
                    role: 'assistant', type: 'audio',
                    parts: [{ text: `🎧 Podcast generated successfully!` }], 
                    audioUrl: response.data.podcastUrl, timestamp: new Date()
            };
            setMessages(prev => [...prev, podcastMessage]);
                console.log('Audio URL:', response.data.podcastUrl);
            } else {
                const errorMessage = { role: 'assistant', parts: [{ text: `❌ Podcast generation failed. Audio could not be generated.` }], timestamp: new Date() };
                setMessages(prev => [...prev, errorMessage]);
                setError('Podcast generation failed. Audio could not be generated.');
            }
        } catch (err) {
            console.error('Podcast generation error:', err);
            let errorMessageText = err.response?.data?.message || 'Failed to generate podcast.';
            // User-friendly error for not enough content
            if (errorMessageText.includes('Not enough content in file')) {
                errorMessageText = 'The selected file does not have enough content to generate a podcast. Please upload a longer or more detailed file.';
            }
            setError(`Podcast Error: ${errorMessageText}`);
            setMessages(prev => [...prev, { role: 'assistant', parts: [{ text: `Error generating podcast: ${errorMessageText}` }], timestamp: new Date() }]);
        } finally {
            setLoadingStates(prev => ({ ...prev, podcast: false }));
        }
    }, [isProcessing]);

    const handleGenerateMindMap = useCallback(async (fileId, fileName) => {
        if (isProcessing) return;
        setLoadingStates(prev => ({ ...prev, mindMap: true }));
        setError('');
        setMessages(prev => [...prev, { role: 'user', parts: [{ text: `Generate a mind map for the file: ${fileName}` }], timestamp: new Date() }]);
        try {
            const response = await generateMindMap(fileId);
            if (response.data && (response.data.nodes || response.data.mindmap)) {
                const mindMapData = response.data.mindmap || response.data;
                const mindMapMessage = { 
                    role: 'assistant', type: 'mindmap',
                    parts: [{ text: `Here is the mind map for "${fileName}":` }], 
                    mindMapData: mindMapData, timestamp: new Date()
                };
            setMessages(prev => [...prev, mindMapMessage]);
            } else {
                throw new Error('Invalid mind map data received from server');
            }
        } catch (err) {
            console.error('Mind map generation error:', err);
            const errorMessageText = err.response?.data?.message || err.message || 'Failed to generate mind map.';
            setError(`Mind Map Error: ${errorMessageText}`);
            const errorMsg = { role: 'assistant', parts: [{ text: `❌ Mind Map Error: ${errorMessageText}` }], timestamp: new Date() };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoadingStates(prev => ({ ...prev, mindMap: false }));
        }
    }, [isProcessing]);

    const handlePromptSelectChange = useCallback((newId) => {
        setCurrentSystemPromptId(newId);
        setEditableSystemPromptText(getPromptTextById(newId));
    }, []);

    const handlePromptTextChange = useCallback((newText) => {
        setEditableSystemPromptText(newText);
        const matchingPreset = availablePrompts.find(p => p.id !== 'custom' && p.prompt === newText);
        setCurrentSystemPromptId(matchingPreset ? matchingPreset.id : 'custom');
    }, []);

    const handleLoadSession = useCallback((sessionData) => {
        if (sessionData && sessionData.messages) {
            setMessages(sessionData.messages);
            if (sessionData.systemPrompt) {
                setEditableSystemPromptText(sessionData.systemPrompt);
            }
            if (sessionData.sessionId) {
                setSessionId(sessionData.sessionId);
                localStorage.setItem('sessionId', sessionData.sessionId);
            }
        }
    }, []);

    const handleEnterKey = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }, [handleSendMessage]);

    const isInitializing = !userId;

    if (isInitializing) {
        return <div className="loading-indicator"><span>Initializing...</span></div>;
    }

    return (
        <div className="chat-page-container">
            <div className="sidebar-area">
                <SystemPromptWidget selectedPromptId={currentSystemPromptId} promptText={editableSystemPromptText} onSelectChange={handlePromptSelectChange} onTextChange={handlePromptTextChange} />
                <FileUploadWidget onUploadSuccess={fetchFiles} />
                <FileManagerWidget
                    files={files}
                    isLoading={loadingStates.files}
                    error={fileError}
                    onDeleteFile={handleDeleteFile}
                    onRenameFile={handleRenameFile}
                    onGeneratePodcast={handleGeneratePodcast}
                    onGenerateMindMap={handleGenerateMindMap}
                    onChatWithFile={handleChatWithFile}
                    isProcessing={isProcessing}
                />
            </div>
            <div className="chat-container">
                <header className="chat-header">
                    <h1>Engineering Tutor</h1>
                    <div className="header-controls">
                        <span className="username-display">Hi, {username}!</span>
                        <button onClick={() => setShowHistoryModal(true)} className="header-button" disabled={isProcessing}>History</button>
                        <button onClick={handleNewChat} className="header-button" disabled={isProcessing}>New Chat</button>
                        <button onClick={() => handleLogout(false)} className="header-button" disabled={isProcessing}>Logout</button>
                    </div>
                </header>
                <div className="messages-area" ref={messagesEndRef}>
                    {messages.map((msg, index) => {
                        if (!msg?.role || !msg?.parts?.length) return null;
                        const messageText = msg.parts[0]?.text || '';
                        const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        
                        return (
                            <div key={index} className={`message-wrapper ${msg.role}`}>
                                <div className={`message-content ${msg.type || ''}`}>
                                    <div className="message-header">
                                        <span className="message-role">{msg.role === 'assistant' ? 'AI Assistant' : username}</span>
                                        <span className="message-timestamp">{timestamp}</span>
                                    </div>
                                    {msg.type === 'mindmap' && msg.mindMapData ? (
                                        <div id={`mindmap-container-${index}`} className="mindmap-container">
                                            <MindMap mindMapData={msg.mindMapData} />
                                        </div>
                                    ) : msg.type === 'audio' && msg.audioUrl ? (
                                        <div className="audio-player-container">
                                            <p>{messageText}</p>
                                            <audio controls src={msg.audioUrl} />
                                        </div>
                                    ) : (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{messageText}</ReactMarkdown>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <form onSubmit={handleSendMessage} className="message-input-form">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleEnterKey}
                        placeholder="Type your message, or use the mic..."
                        className="message-input"
                        disabled={isProcessing}
                    />
                    <div className="toggle-container" title="Toggle Deep Search">
                        <input 
                            type="checkbox" 
                            id="deep-search-toggle" 
                            checked={isDeepSearchEnabled} 
                            onChange={e => {
                                const checked = e.target.checked;
                                setIsDeepSearchEnabled(checked);
                                if (checked) setIsRagEnabled(false);
                            }}
                            disabled={isProcessing}
                        />
                        <label htmlFor="deep-search-toggle">Deep Search</label>
                    </div>
                    <div className="toggle-container" title="Toggle RAG">
                        <input 
                            type="checkbox" 
                            id="rag-toggle" 
                            checked={isRagEnabled} 
                            onChange={e => {
                                const checked = e.target.checked;
                                setIsRagEnabled(checked);
                                if (checked) setIsDeepSearchEnabled(false);
                            }}
                            disabled={isProcessing}
                        />
                        <label htmlFor="rag-toggle">RAG</label>
                    </div>
                    <button type="submit" className="send-button" disabled={isProcessing || !inputText.trim()}>Send</button>
                    <button type="button" onClick={handleMicButtonClick} className={`mic-button ${loadingStates.listening ? 'listening' : ''}`} disabled={isProcessing}>
                        🎤
                    </button>
                </form>
                {error && <p className="error-message">{error}</p>}
            </div>
            {showHistoryModal && (
                <HistoryModal
                    isOpen={showHistoryModal}
                    onClose={() => setShowHistoryModal(false)}
                    onLoadSession={handleLoadSession}
                />
            )}
        </div>
    );
};

export default ChatPage;