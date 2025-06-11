// client/src/components/ChatPage.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    sendMessage as apiSendMessage, saveChatHistory, queryRagService, generatePodcast, generateMindMap,
    getUserFiles, deleteUserFile, renameUserFile,
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
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRagLoading, setIsRagLoading] = useState(false);
    const [isPodcastLoading, setIsPodcastLoading] = useState(false);
    const [isMindMapLoading, setIsMindMapLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [userId, setUserId] = useState('');
    const [username, setUsername] = useState('');
    const [currentSystemPromptId, setCurrentSystemPromptId] = useState('friendly');
    const [editableSystemPromptText, setEditableSystemPromptText] = useState(() => getPromptTextById('friendly'));
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [files, setFiles] = useState([]);
    const [isFileLoading, setIsFileLoading] = useState(false);
    const [fileError, setFileError] = useState('');
    const [hasFiles, setHasFiles] = useState(false);
    const [isRagEnabled, setIsRagEnabled] = useState(false);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const mindMapRefs = useRef({});
    const navigate = useNavigate();

    const isProcessing = isLoading || isRagLoading || isPodcastLoading || isMindMapLoading;

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

    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
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

            recognition.onstart = () => setIsListening(true);
            recognition.onresult = (event) => setInputText(event.results[0][0].transcript);
            recognition.onerror = (e) => setError(`STT Error: ${e.error}`);
            recognition.onend = () => setIsListening(false);
            recognitionRef.current = recognition;
        } else {
            console.warn('Web Speech API is not supported in this browser.');
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        };
    }, [handleLogout]);

    const fetchFiles = useCallback(async () => {
        if (!userId) return;
        setIsFileLoading(true);
        setFileError('');
        try {
            const response = await getUserFiles();
            const filesData = response.data || [];
            setFiles(filesData);
            setHasFiles(filesData.length > 0);
            if (filesData.length > 0 && !isRagEnabled) {
                setIsRagEnabled(true);
            }
        } catch (err) {
            setFileError('Could not load files.');
        } finally {
            setIsFileLoading(false);
        }
    }, [userId, isRagEnabled]);

    useEffect(() => {
        if (userId) {
            fetchFiles();
        }
    }, [userId, fetchFiles]);

    const handleNewChat = useCallback(() => {
        if (!isProcessing) saveAndReset(false);
    }, [isProcessing, saveAndReset]);

    const handleLoadSession = useCallback((sessionData) => {
        if (isProcessing) return;
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

    const speak = useCallback((text) => {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.3;
        window.speechSynthesis.speak(utterance);
    }, []);

    const handleSpeakMessage = useCallback((messageText) => {
        speak(messageText);
    }, [speak]);

    const handleSendMessage = useCallback(async (e) => {
        if (e) e.preventDefault();
        const trimmedInput = inputText.trim();
        if (!trimmedInput || isProcessing) return;

        if (isListening) recognitionRef.current?.stop();

        const newUserMessage = { role: 'user', parts: [{ text: trimmedInput }], timestamp: new Date() };
        const historyToSend = [...messages, newUserMessage];
        setMessages(historyToSend);
        setInputText('');
        setError('');
        const setLoading = isRagEnabled ? setIsRagLoading : setIsLoading;
        setLoading(true);

        try {
            const response = isRagEnabled
                ? await queryRagService({ history: historyToSend, systemPrompt: editableSystemPromptText })
                : await apiSendMessage({ history: historyToSend, systemPrompt: editableSystemPromptText });
            
            const assistantMessage = { role: 'assistant', parts: [{ text: response.data.text }], timestamp: new Date() };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'An error occurred.';
            setError(errorMessage);
            setMessages(prev => prev.slice(0, -1));
            if (err.response?.status === 401) handleLogout(true);
        } finally {
            setLoading(false);
        }
    }, [inputText, isProcessing, messages, isRagEnabled, editableSystemPromptText, handleLogout, isListening]);

    const handleMicButtonClick = useCallback(() => {
        if (!recognitionRef.current) return;
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            recognitionRef.current.start();
        }
    }, [isListening]);

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

    const handleGeneratePodcast = useCallback(async (fileId, fileName) => {
        if (isProcessing) return;
        setIsPodcastLoading(true);
        setError('');
        setMessages(prev => [...prev, { role: 'user', parts: [{ text: `Requesting a podcast for the file: ${fileName}` }], timestamp: new Date() }]);
        try {
            const response = await generatePodcast(fileId);
            const podcastMessage = { role: 'assistant', type: 'audio', parts: [{ text: `Here is the podcast for "${fileName}":` }], audioUrl: response.data.audioUrl, timestamp: new Date() };
            setMessages(prev => [...prev, podcastMessage]);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to generate podcast.';
            setError(`Podcast Error: ${errorMessage}`);
        } finally {
            setIsPodcastLoading(false);
        }
    }, [isProcessing]);

    const handleOpenMindMapFullscreen = useCallback((messageIndex) => {
        const mindMapInstance = mindMapRefs.current[messageIndex];
        if (mindMapInstance && typeof mindMapInstance.getSvgData === 'function') {
            try {
                const svgString = mindMapInstance.getSvgData(); // This is no longer async
                if (svgString) {
                    const htmlContent = `
                        <!DOCTYPE html><html lang="en"><head><title>Mind Map Fullscreen</title><style>body{margin:0;padding:20px;background-color:#1a1a1a;display:flex;justify-content:center;align-items:center;height:100vh;box-sizing:border-box;}svg{max-width:100%;max-height:100%;}</style></head><body>${svgString}</body></html>`;
                    const blob = new Blob([htmlContent], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                } else {
                    throw new Error("getSvgData returned empty data.");
                }
            } catch (err) {
                console.error("Failed to get SVG data from MindMap component:", err);
                setError("Could not generate fullscreen mind map.");
            }
        }
    }, []);

    const handleGenerateMindMap = useCallback(async (fileId, fileName) => {
        if (isProcessing) return;
        setIsMindMapLoading(true);
        setError('');
        setMessages(prev => [...prev, { role: 'user', parts: [{ text: `Requesting a mind map for the file: ${fileName}` }], timestamp: new Date() }]);
        try {
            const response = await generateMindMap(fileId);
            const mindMapMessage = { role: 'assistant', type: 'mindmap', parts: [{ text: `Here is the mind map for "${fileName}":` }], mindMapData: response.data, timestamp: new Date() };
            setMessages(prev => [...prev, mindMapMessage]);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to generate mind map.';
            setError(`Mind Map Error: ${errorMessage}`);
        } finally {
            setIsMindMapLoading(false);
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

    const handleHistory = useCallback(() => setIsHistoryModalOpen(true), []);
    const closeHistoryModal = useCallback(() => setIsHistoryModalOpen(false), []);

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
                                <div key={index} className={`message ${msg.role}`}>
                                    <div className="message-content">
                                        <p>{messageText}</p>
                                        <div id={`mindmap-${index}`} className="mindmap-container-for-export">
                                            <MindMap
                                                ref={(el) => (mindMapRefs.current[index] = el)}
                                                mindMapData={msg.mindMapData}
                                            />
                                        </div>
                                        <div className="mindmap-actions">
                                            <button onClick={() => handleOpenMindMapFullscreen(index)} className="mindmap-action-button">
                                                View Fullscreen
                                            </button>
                                        </div>
                                    </div>
                                    <div className="message-footer">
                                        <span className="message-timestamp">{timestamp}</span>
                                        {msg.role === 'assistant' && (
                                            <button onClick={() => handleSpeakMessage(messageText)} className="speaker-icon-button" title="Listen to message">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                        if (msg.type === 'audio') {
                            return (
                                <div key={index} className={`message ${msg.role}`}>
                                    <div className="message-content">
                                        <p>{messageText}</p>
                                        <audio controls src={msg.audioUrl} style={{ width: '100%', marginTop: '10px' }} />
                                    </div>
                                    <div className="message-footer">
                                        <span className="message-timestamp">{timestamp}</span>
                                        {msg.role === 'assistant' && (
                                            <button onClick={() => handleSpeakMessage(messageText)} className="speaker-icon-button" title="Listen to message">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div key={index} className={`message ${msg.role}`}>
                                <div className="message-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{messageText}</ReactMarkdown>
                                </div>
                                <div className="message-footer">
                                    <span className="message-timestamp">{timestamp}</span>
                                    {msg.role === 'assistant' && (
                                        <button onClick={() => handleSpeakMessage(messageText)} className="speaker-icon-button" title="Listen to message">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
                {isProcessing && <div className="loading-indicator"><span>{isMindMapLoading ? 'Generating mind map...' : isPodcastLoading ? 'Generating podcast...' : isRagLoading ? 'Searching documents...' : 'Thinking...'}</span></div>}
                {!isProcessing && error && <div className="error-indicator">{error}</div>}
                <footer className="input-area">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleEnterKey}
                        placeholder="Ask your tutor..."
                        rows="1"
                        disabled={isProcessing || isListening}
                    />
                    <div className="rag-toggle-container" title={!hasFiles ? "Upload files to enable RAG" : "Toggle RAG"}>
                        <input type="checkbox" id="rag-toggle" checked={isRagEnabled} onChange={(e) => setIsRagEnabled(e.target.checked)} disabled={!hasFiles || isProcessing || isListening} />
                        <label htmlFor="rag-toggle">RAG</label>
                    </div>
                    <button
                        onClick={handleMicButtonClick}
                        className={`icon-button mic-button ${isListening ? 'listening' : ''}`}
                        disabled={isProcessing || !recognitionRef.current}
                        title={isListening ? "Stop Voice Input" : "Start Voice Input"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                        </svg>
                    </button>
                    <button onClick={handleSendMessage} disabled={isProcessing || !inputText.trim() || isListening} title="Send Message">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </footer>
            </div>
            <HistoryModal isOpen={isHistoryModalOpen} onClose={closeHistoryModal} onLoadSession={handleLoadSession} />
        </div>
    );
};

export default ChatPage;