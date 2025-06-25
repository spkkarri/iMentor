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
import MindMap from './MindMap';
import HistoryModal from './HistoryModal';

import './ChatPage.css';

const ChatPage = ({ setIsAuthenticated }) => {
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
    const [error, setError] = useState('');
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
    const [currentlySpeakingIndex, setCurrentlySpeakingIndex] = useState(null);

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
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
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
            setFiles(response.data || []);
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

        if (loadingStates.listening) recognitionRef.current?.stop();

        const newUserMessage = { role: 'user', parts: [{ text: trimmedInput }], timestamp: new Date() };
        setMessages(prev => [...prev, newUserMessage]);
        setInputText('');
        setError('');

        const historyToSend = [...messages, newUserMessage];

        if (isDeepSearchEnabled) {
            setLoadingStates(prev => ({ ...prev, deepSearch: true }));
            try {
                const response = await performDeepSearch(trimmedInput);
                const deepSearchResult = {
                    role: 'assistant', type: 'deep_search',
                    parts: [{ text: response.data.message }],
                    timestamp: new Date(), metadata: response.data.metadata
                };
                setMessages(prev => [...prev, deepSearchResult]);
            } catch (err) {
                setError(`Deep Search Error: ${err.response?.data?.message || 'Deep search failed.'}`);
                setMessages(prev => prev.slice(0, -1));
                if (err.response?.status === 401) handleLogout(true);
            } finally {
                setLoadingStates(prev => ({ ...prev, deepSearch: false }));
            }
        } else if (isRagEnabled) {
            setLoadingStates(prev => ({ ...prev, chat: true }));
            try {
                const ragPayload = { query: trimmedInput, history: historyToSend, sessionId, fileId: activeFileForRag?.id };
                const response = await queryRagService(ragPayload);
                const assistantMessage = {
                    role: 'assistant', type: 'rag',
                    parts: [{ text: response.data.message }],
                    timestamp: new Date(), metadata: response.data.metadata
                };
                setMessages(prev => [...prev, assistantMessage]);
            } catch (err) {
                setError(`RAG Error: ${err.response?.data?.message || 'RAG query failed.'}`);
                setMessages(prev => prev.slice(0, -1));
                if (err.response?.status === 401) handleLogout(true);
            } finally {
                setLoadingStates(prev => ({ ...prev, chat: false }));
            }
        } else {
            setLoadingStates(prev => ({ ...prev, chat: true }));
            try {
                const payload = { query: trimmedInput, history: historyToSend, sessionId, systemPrompt: editableSystemPromptText };
                const response = await apiSendMessage(payload);
                const assistantMessage = {
                    role: 'assistant',
                    parts: [{ text: response.data.message }],
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, assistantMessage]);
            } catch (err) {
                setError(err.response?.data?.error || 'Chat error.');
                setMessages(prev => prev.slice(0, -1));
                if (err.response?.status === 401) handleLogout(true);
            } finally {
                setLoadingStates(prev => ({ ...prev, chat: false }));
            }
        }
    }, [inputText, isProcessing, loadingStates, messages, isDeepSearchEnabled, isRagEnabled, activeFileForRag, sessionId, editableSystemPromptText, handleLogout]);

    const handleMicButtonClick = useCallback(() => {
        if (!recognitionRef.current) return;
        if (loadingStates.listening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    }, [loadingStates.listening]);

    const handleTextToSpeech = useCallback((text, index) => {
        if (!('speechSynthesis' in window)) {
            setError('Sorry, your browser does not support text-to-speech.');
            return;
        }
        window.speechSynthesis.cancel();
        if (currentlySpeakingIndex === index) {
            setCurrentlySpeakingIndex(null);
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setCurrentlySpeakingIndex(null);
        utterance.onerror = () => {
            setError('An error occurred during speech synthesis.');
            setCurrentlySpeakingIndex(null);
        };
        setCurrentlySpeakingIndex(index);
        window.speechSynthesis.speak(utterance);
    }, [currentlySpeakingIndex]);

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
        setMessages(prev => [...prev, { role: 'user', parts: [{ text: `Requesting a podcast for "${fileName}"...` }], timestamp: new Date() }]);
        try {
            const response = await generatePodcast(fileId);
            const isAudioFile = response.data.podcastUrl?.endsWith('.mp3') || response.data.podcastUrl?.endsWith('.wav');
            if (isAudioFile) {
                const podcastMessage = {
                    role: 'assistant', type: 'audio',
                    parts: [{ text: `🎧 Podcast generated successfully!` }],
                    audioUrl: response.data.podcastUrl, timestamp: new Date()
                };
                setMessages(prev => [...prev, podcastMessage]);
            } else {
                throw new Error('Podcast generation failed. Audio could not be generated.');
            }
        } catch (err) {
            let errorMessageText = err.response?.data?.message || err.message || 'Failed to generate podcast.';
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
            const mindMapData = response.data?.mindmap || response.data;
            if (mindMapData?.nodes) {
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
            const errorMessageText = err.response?.data?.message || err.message || 'Failed to generate mind map.';
            setError(`Mind Map Error: ${errorMessageText}`);
            setMessages(prev => [...prev, { role: 'assistant', parts: [{ text: `❌ Mind Map Error: ${errorMessageText}` }], timestamp: new Date() }]);
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
        if (sessionData?.messages) {
            setMessages(sessionData.messages);
            setEditableSystemPromptText(sessionData.systemPrompt || getPromptTextById('friendly'));
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
                                    </div>
                                    
                                    {/* Main message body */}
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

                                    {/* ✅ MODIFIED: Footer is now below the content */}
                                    <div className="message-footer">
                                        {msg.role === 'assistant' && (
                                            <button
                                                onClick={() => handleTextToSpeech(messageText, index)}
                                                className={`tts-button ${currentlySpeakingIndex === index ? 'speaking' : ''}`}
                                                title="Read aloud"
                                                disabled={isProcessing}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                    <path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/>
                                                    <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z"/>
                                                    <path d="M8.707 11.182A4.486 4.486 0 0 0 10.025 8a4.486 4.486 0 0 0-1.318-3.182L8 5.525A3.489 3.489 0 0 1 9.025 8 3.49 3.49 0 0 1 8 10.475l.707.707zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z"/>
                                                </svg>
                                            </button>
                                        )}
                                        <span className="message-timestamp">{timestamp}</span>
                                    </div>
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
                    <button type="submit" className="send-button" title="Send message" disabled={isProcessing || !inputText.trim()}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                           <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94l18-9a.75.75 0 0 0 0-1.88l-18-9Z"/>
                        </svg>
                    </button>
                    <button type="button" onClick={handleMicButtonClick} className={`mic-button ${loadingStates.listening ? 'listening' : ''}`} title="Use microphone" disabled={isProcessing}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a8 8 0 0 0 7 7.93V22h2v-2.07A8 8 0 0 0 21 12v-2h-2z"/>
                        </svg>
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