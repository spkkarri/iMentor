import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    sendMessage as apiSendMessage, saveChatHistory,
    getUserFiles, deleteUserFile, renameUserFile, generateMindMap, getFileOverview,
} from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';
import { FaMicrophone, FaSave, FaCopy, FaStop, FaPaperPlane } from 'react-icons/fa';

import SystemPromptWidget, { getPromptTextById } from './SystemPromptWidget';
import FileUploadWidget from './FileUploadWidget';
import FileManagerWidget from './FileManagerWidget';
import MindMap from './MindMap';
import HistoryModal from './HistoryModal';


import './ChatPage.css';

// --- CodeBlock component with Copy functionality ---
const CodeBlock = ({ language, value }) => {
    const [isCopied, setIsCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(value).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };
    return (
        <div className="code-block-wrapper">
            <pre><code className={`language-${language}`}>{value}</code></pre>
            <button onClick={handleCopy} className="copy-code-button" title="Copy code">
                {isCopied ? <><FaSave /> Copied!</> : <><FaCopy /> Copy</>}
            </button>
        </div>
    );
};

const ChatPage = ({ setIsAuthenticated }) => {
    const [loadingStates, setLoadingStates] = useState({ chat: false, files: false, mindMap: false, listening: false });
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
    // const [isRagEnabled, setIsRagEnabled] = useState(false); // Kept for potential future use
    const [isDeepSearchEnabled, setIsDeepSearchEnabled] = useState(() => {
        // Persist DeepSearch state in localStorage
        const saved = localStorage.getItem('deepSearchEnabled');
        return saved !== null ? JSON.parse(saved) : false;
    }); // Added from 'main'
    const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(() => {
        // Persist WebSearch state in localStorage
        const saved = localStorage.getItem('webSearchEnabled');
        return saved !== null ? JSON.parse(saved) : false;
    });
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [currentlySpeakingIndex, setCurrentlySpeakingIndex] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [deepSearchStatus, setDeepSearchStatus] = useState('unknown'); // 'available', 'quota_exceeded', 'unavailable', 'unknown'

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const navigate = useNavigate();
    const isProcessing = Object.values(loadingStates).some(Boolean);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // Persist DeepSearch state to localStorage
    useEffect(() => {
        localStorage.setItem('deepSearchEnabled', JSON.stringify(isDeepSearchEnabled));
    }, [isDeepSearchEnabled]);

    // Persist WebSearch state to localStorage
    useEffect(() => {
        localStorage.setItem('webSearchEnabled', JSON.stringify(isWebSearchEnabled));
    }, [isWebSearchEnabled]);

    // Ensure only one search mode is active at a time
    const handleDeepSearchToggle = useCallback(() => {
        if (!isDeepSearchEnabled && isWebSearchEnabled) {
            setIsWebSearchEnabled(false); // Disable WebSearch when enabling DeepSearch
        }
        setIsDeepSearchEnabled(v => !v);
    }, [isDeepSearchEnabled, isWebSearchEnabled]);

    const handleWebSearchToggle = useCallback(() => {
        if (!isWebSearchEnabled && isDeepSearchEnabled) {
            setIsDeepSearchEnabled(false); // Disable DeepSearch when enabling WebSearch
        }
        setIsWebSearchEnabled(v => !v);
    }, [isWebSearchEnabled, isDeepSearchEnabled]);

    // Function to check DeepSearch service status (currently unused - using response-based status tracking)
    // const checkDeepSearchStatus = useCallback(async () => {
    //     try {
    //         // Make a lightweight test request to check service availability
    //         const testPayload = {
    //             query: "test",
    //             history: [],
    //             sessionId: sessionId || 'test',
    //             systemPrompt: "Test",
    //             deepSearch: true
    //         };
    //
    //         const response = await apiSendMessage(testPayload);
    //         const metadata = response.data.metadata;
    //
    //         if (metadata) {
    //             if (metadata.searchType === 'quota_exceeded_fallback') {
    //                 setDeepSearchStatus('quota_exceeded');
    //             } else if (metadata.searchType === 'offline_deep_search') {
    //                 setDeepSearchStatus('limited');
    //             } else if (metadata.searchType === 'standard_deep_search' || metadata.searchType === 'enhanced_deep_search') {
    //                 setDeepSearchStatus('available');
    //             } else {
    //                 setDeepSearchStatus('unavailable');
    //             }
    //         } else {
    //             setDeepSearchStatus('unavailable');
    //         }
    //     } catch (error) {
    //         console.log('DeepSearch status check failed:', error.message);
    //         setDeepSearchStatus('unavailable');
    //     }
    // }, [sessionId]);

    // Check DeepSearch status periodically when enabled
    useEffect(() => {
        if (isDeepSearchEnabled && sessionId) {
            // Don't run the actual test - just set status based on previous responses
            // This prevents unnecessary API calls
            const lastMessage = messages[messages.length - 1];
            if (lastMessage && lastMessage.metadata) {
                const metadata = lastMessage.metadata;
                if (metadata.searchType === 'quota_exceeded_fallback') {
                    setDeepSearchStatus('quota_exceeded');
                } else if (metadata.searchType === 'offline_deep_search') {
                    setDeepSearchStatus('limited');
                } else if (metadata.searchType === 'standard_deep_search' || metadata.searchType === 'enhanced_deep_search') {
                    setDeepSearchStatus('available');
                } else {
                    setDeepSearchStatus('unknown');
                }
            } else {
                setDeepSearchStatus('unknown');
            }
        } else {
            setDeepSearchStatus('unknown');
        }
    }, [isDeepSearchEnabled, messages, sessionId]);

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
            if (window.speechSynthesis) window.speechSynthesis.cancel();
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
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.onstart = () => setLoadingStates(prev => ({ ...prev, listening: true }));
            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
                    else interimTranscript += event.results[i][0].transcript;
                }
                setInputText(finalTranscript + interimTranscript);
            };
            recognition.onerror = (e) => setError(`STT Error: ${e.error}`);
            recognition.onend = () => setLoadingStates(prev => ({ ...prev, listening: false }));
            recognitionRef.current = recognition;
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

    useEffect(() => { if (userId) fetchFiles(); }, [userId, fetchFiles]);

    const handleNewChat = useCallback(() => { if (!isProcessing) saveAndReset(false); }, [isProcessing, saveAndReset]);

    const handleSendMessage = useCallback(async (e, overrideInput = null) => {
        if (e) e.preventDefault();
        const trimmedInput = (overrideInput || inputText).trim();
        if (!trimmedInput || isProcessing) return;
        if (loadingStates.listening) recognitionRef.current?.stop();

        const newUserMessage = { id: uuidv4(), role: 'user', parts: [{ text: trimmedInput }], timestamp: new Date() };
        setMessages(prev => [...prev, newUserMessage]);
        setInputText('');
        setError('');
        setLoadingStates(prev => ({ ...prev, chat: true }));

        try {
            const payload = {
                query: trimmedInput,
                history: [...messages, newUserMessage],
                sessionId,
                systemPrompt: editableSystemPromptText,
                deepSearch: isDeepSearchEnabled, // Pass deep search flag to API
                webSearch: isWebSearchEnabled   // Pass web search flag to API
            };

            // Add debugging for search modes
            if (isDeepSearchEnabled) {
                console.log('🔍 DeepSearch enabled for query:', trimmedInput);
            } else if (isWebSearchEnabled) {
                console.log('🌐 WebSearch enabled for query:', trimmedInput);
            }

            const response = await apiSendMessage(payload);

            // Check if search was actually used and provide feedback
            const metadata = response.data.metadata;
            let responseText = response.data.response;

            if (isDeepSearchEnabled && metadata) {
                console.log('🔍 DeepSearch metadata:', metadata);

                // Add status indicator to response if DeepSearch had issues
                if (metadata.searchType === 'quota_exceeded_fallback') {
                    responseText = `⚠️ **DeepSearch quota exceeded** - Using fallback response.\n\n${responseText}`;
                } else if (metadata.searchType === 'offline_deep_search') {
                    responseText = `🔄 **DeepSearch offline mode** - Limited web access.\n\n${responseText}`;
                } else if (metadata.searchType === 'standard_deep_search') {
                    responseText = `✅ **DeepSearch active** - Enhanced with web research.\n\n${responseText}`;
                }
            } else if (isWebSearchEnabled && metadata) {
                console.log('🌐 WebSearch metadata:', metadata);
                responseText = `🌐 **WebSearch active** - Enhanced with web results.\n\n${responseText}`;
            } else if ((isDeepSearchEnabled || isWebSearchEnabled) && !metadata) {
                const searchType = isDeepSearchEnabled ? 'DeepSearch' : 'WebSearch';
                console.warn(`${searchType} was enabled but no metadata returned - may have fallen back to standard chat`);
                responseText = `⚠️ **${searchType} unavailable** - Using standard chat mode.\n\n${responseText}`;
            }

            const assistantMessage = {
                id: uuidv4(),
                role: 'assistant',
                parts: [{ text: responseText }],
                followUpQuestions: response.data.followUpQuestions || [],
                timestamp: new Date(),
                metadata: metadata
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            console.error('Chat error:', err);

            // Enhanced error handling for search modes
            let errorMessage = err.response?.data?.error || err.response?.data?.message || 'Chat error.';

            if (isDeepSearchEnabled && err.response?.status === 404) {
                errorMessage = 'DeepSearch found no relevant results. Try rephrasing your question or disable DeepSearch for a general response.';
            } else if (isDeepSearchEnabled && err.response?.status === 500) {
                errorMessage = 'DeepSearch service encountered an error. The service may be temporarily unavailable.';
            } else if (isWebSearchEnabled && err.response?.status === 404) {
                errorMessage = 'WebSearch found no relevant results. Try rephrasing your question or disable WebSearch for a general response.';
            } else if (isWebSearchEnabled && err.response?.status === 500) {
                errorMessage = 'WebSearch service encountered an error. The service may be temporarily unavailable.';
            }

            setError(errorMessage);
            setMessages(prev => prev.slice(0, -1));
            if (err.response?.status === 401) handleLogout(true);
        } finally {
            setLoadingStates(prev => ({ ...prev, chat: false }));
        }
    }, [inputText, isProcessing, loadingStates, messages, sessionId, editableSystemPromptText, isDeepSearchEnabled, handleLogout]);

    // Message editing functionality (currently unused in UI)
    /*
    const handleSaveEdit = useCallback(async () => {
        if (!editingMessage) return;
        const messageIndex = messages.findIndex(m => m.id === editingMessage.id);
        if (messageIndex === -1) return;

        const historyBeforeEdit = messages.slice(0, messageIndex);
        const updatedUserMessage = { ...messages[messageIndex], parts: [{ text: editingMessage.text }] };
        setMessages([...historyBeforeEdit, updatedUserMessage]);
        setEditingMessage(null);
        setLoadingStates(prev => ({ ...prev, chat: true }));

        try {
             const payload = {
                query: editingMessage.text,
                history: [...historyBeforeEdit, updatedUserMessage],
                sessionId,
                systemPrompt: editableSystemPromptText,
                deepSearch: isDeepSearchEnabled // Pass deep search flag to API
            };

            // Add debugging for DeepSearch
            if (isDeepSearchEnabled) {
                console.log('🔍 DeepSearch enabled for edited query:', editingMessage.text);
            }

            const response = await apiSendMessage(payload);

            // Check if DeepSearch was actually used and provide feedback
            const metadata = response.data.metadata;
            let responseText = response.data.response;

            if (isDeepSearchEnabled && metadata) {
                console.log('🔍 DeepSearch metadata:', metadata);

                // Add status indicator to response if DeepSearch had issues
                if (metadata.searchType === 'quota_exceeded_fallback') {
                    responseText = `⚠️ **DeepSearch quota exceeded** - Using fallback response.\n\n${responseText}`;
                } else if (metadata.searchType === 'offline_deep_search') {
                    responseText = `🔄 **DeepSearch offline mode** - Limited web access.\n\n${responseText}`;
                } else if (metadata.searchType === 'standard_deep_search') {
                    responseText = `✅ **DeepSearch active** - Enhanced with web research.\n\n${responseText}`;
                }
            } else if (isDeepSearchEnabled && !metadata) {
                console.warn('🔍 DeepSearch was enabled but no metadata returned - may have fallen back to standard chat');
                responseText = `⚠️ **DeepSearch unavailable** - Using standard chat mode.\n\n${responseText}`;
            }

            const assistantMessage = {
                id: uuidv4(),
                role: 'assistant',
                parts: [{ text: responseText }],
                followUpQuestions: response.data.followUpQuestions || [],
                timestamp: new Date(),
                metadata: metadata
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            console.error('Chat error during edit:', err);

            // Enhanced error handling for DeepSearch
            let errorMessage = err.response?.data?.error || err.response?.data?.message || 'Chat error.';

            if (isDeepSearchEnabled && err.response?.status === 404) {
                errorMessage = 'DeepSearch found no relevant results. Try rephrasing your question or disable DeepSearch for a general response.';
            } else if (isDeepSearchEnabled && err.response?.status === 500) {
                errorMessage = 'DeepSearch service encountered an error. The service may be temporarily unavailable.';
            }

            setError(errorMessage);
        } finally {
            setLoadingStates(prev => ({ ...prev, chat: false }));
        }
    }, [editingMessage, messages, sessionId, editableSystemPromptText, isDeepSearchEnabled]);
    */

    const handleStartMicButtonClick = useCallback(() => { if (recognitionRef.current && !loadingStates.listening) recognitionRef.current.start(); }, [loadingStates.listening]);
    const handleStopMicButtonClick = useCallback(() => { if (recognitionRef.current && loadingStates.listening) recognitionRef.current.stop(); }, [loadingStates.listening]);

    const handleTextToSpeech = useCallback((text, index) => {
        if (!('speechSynthesis' in window)) { setError('TTS not supported.'); return; }
        window.speechSynthesis.cancel();
        if (currentlySpeakingIndex === index) { setCurrentlySpeakingIndex(null); return; }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setCurrentlySpeakingIndex(null);
        utterance.onerror = () => { setError('TTS error.'); setCurrentlySpeakingIndex(null); };
        setCurrentlySpeakingIndex(index);
        window.speechSynthesis.speak(utterance);
    }, [currentlySpeakingIndex]);

    const handleDeleteFile = async (fileId, fileName) => {
        if (window.confirm(`Are you sure you want to delete "${fileName}"? This will also remove it from RAG.`)) {
            try {
                await deleteUserFile(fileId);
                fetchFiles();
            } catch (err) {
                setFileError(`Could not delete ${fileName}.`);
            }
        }
    };

    const handleRenameFile = async (fileId, currentName) => {
        const newName = prompt("Enter new file name:", currentName);
        if (newName && newName.trim() && newName !== currentName) {
            try {
                await renameUserFile(fileId, newName.trim());
                fetchFiles();
            } catch (err) {
                setFileError(`Could not rename file.`);
            }
        }
    };

    const handleUploadSuccess = useCallback(async (newFile) => {
        fetchFiles();
        const tempMessageId = uuidv4();
        setMessages(prev => [...prev, { id: tempMessageId, role: 'system', type: 'system-info', parts: [{ text: `*Generating overview for "${newFile.originalname}"...*` }], timestamp: new Date() }]);
        try {
            const response = await getFileOverview(newFile._id);
            const overviewMessage = { id: uuidv4(), role: 'assistant', type: 'system-info', parts: [{ text: `**Overview of "${newFile.originalname}"**\n\n${response.data.overview}` }], timestamp: new Date() };
            setMessages(prev => [...prev.filter(m => m.id !== tempMessageId), overviewMessage]);
        } catch (err) {
            const errorMessage = { id: uuidv4(), role: 'system', type: 'error', parts: [{ text: `*Error generating overview for "${newFile.originalname}": ${err.response?.data?.message || 'Failed'}` }], timestamp: new Date() };
            setMessages(prev => [...prev.filter(m => m.id !== tempMessageId), errorMessage]);
        }
    }, [fetchFiles]);

    const handleGenerateMindMap = useCallback(async (fileId, fileName) => {
        setLoadingStates(prev => ({ ...prev, mindMap: true }));
        const tempMessageId = uuidv4();
        setMessages(prev => [...prev, { id: tempMessageId, role: 'system', type: 'system-info', parts: [{ text: `*Generating mind map for "${fileName}"...*` }], timestamp: new Date() }]);
        try {
            const response = await generateMindMap(fileId);
            const mindMapMessage = { id: uuidv4(), role: 'assistant', type: 'mindmap', parts: [{ text: `Here is the mind map for "${fileName}".` }], mermaidData: response.data.mermaidData, timestamp: new Date() };
            setMessages(prev => [...prev.filter(m => m.id !== tempMessageId), mindMapMessage]);
        } catch (err) {
            const errorMessage = { id: uuidv4(), role: 'system', type: 'error', parts: [{ text: `*Error generating mind map for "${fileName}": ${err.response?.data?.message || 'Failed'}` }], timestamp: new Date() };
            setMessages(prev => [...prev.filter(m => m.id !== tempMessageId), errorMessage]);
        } finally {
            setLoadingStates(prev => ({ ...prev, mindMap: false }));
        }
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

    const handleEnterKey = useCallback((e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }, [handleSendMessage]);

    if (!userId) return <div className="loading-indicator"><span>Initializing...</span></div>;

    return (
        <div className="chat-page-container">
            <div className="sidebar-area">
                <SystemPromptWidget 
                    selectedPromptId={currentSystemPromptId} 
                    promptText={editableSystemPromptText} 
                    onSelectChange={(id) => { setCurrentSystemPromptId(id); setEditableSystemPromptText(getPromptTextById(id)); }} 
                    onTextChange={(text) => { setEditableSystemPromptText(text); setCurrentSystemPromptId('custom'); }} 
                />
                <FileUploadWidget onUploadSuccess={handleUploadSuccess} />
                <FileManagerWidget 
                    files={files} 
                    isLoading={loadingStates.files} 
                    error={fileError} 
                    onDeleteFile={handleDeleteFile} 
                    onRenameFile={handleRenameFile} 
                    onGenerateMindMap={handleGenerateMindMap} 
                    isProcessing={isProcessing} 
                />
            </div>
            <div className="chat-container">
                <header className="chat-header">
                    <h1>Engineering Tutor</h1>
                    <div className="header-controls">
                        <span className="username-display">Hi, {username}!</span>
                        <button onClick={() => navigate('/training')} className="header-button training-button" disabled={isProcessing} title="LLM Training Dashboard">
                            🧠 Training
                        </button>
                        <button onClick={() => setShowHistoryModal(true)} className="header-button" disabled={isProcessing}>History</button>
                        <button onClick={handleNewChat} className="header-button" disabled={isProcessing}>New Chat</button>
                        <button onClick={() => handleLogout(false)} className="header-button" disabled={isProcessing}>Logout</button>
                    </div>
                </header>
                <div className="messages-area">
                    {messages.map((msg, index) => {
                        if (!msg?.role || !msg?.parts?.length) return null;
                        const messageText = msg.parts[0]?.text || '';
                        const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                        
                        return (
                            <div key={index} className={`message-wrapper ${msg.role}`}>
                                <div className={`message-content ${msg.type || ''}`}>
                                    {/* Main message body */}
                                    {msg.type === 'mindmap' && msg.mindMapData ? (
                                        <div id={`mindmap-container-${index}`} className="mindmap-container">
                                            <MindMap mindMapData={msg.mindMapData} />
                                        </div>
                                    ) : msg.type === 'audio' && msg.audioUrl ? (
                                        <div className="audio-player-container">
                                            <p>{messageText}</p>
                                            <audio controls src={msg.audioUrl} />
                                            {/* Removed Join Now button as per user request */}
                                        </div>
                                    ) : (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{messageText}</ReactMarkdown>
                                    )}

                                    {/* Footer with timestamp and TTS button */}
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
                    <div ref={messagesEndRef} />
                </div>
                <div className="modern-input-bar">
                    <div className="input-bar-left">
                        <button
                            type="button"
                            className={`input-action-btn${isDeepSearchEnabled ? ' active' : ''} ${deepSearchStatus !== 'available' && isDeepSearchEnabled ? 'warning' : ''}`}
                            title={
                                isDeepSearchEnabled
                                    ? `Deep Research: ON ${
                                        deepSearchStatus === 'quota_exceeded' ? '(Quota Exceeded - Using Fallback)' :
                                        deepSearchStatus === 'limited' ? '(Limited Mode - Offline Search)' :
                                        deepSearchStatus === 'unavailable' ? '(Service Unavailable)' :
                                        deepSearchStatus === 'available' ? '(Fully Operational)' :
                                        '(Status Unknown)'
                                    } - Click to disable`
                                    : "Deep Research: OFF - Click to enable AI-enhanced web research"
                            }
                            onClick={handleDeepSearchToggle}
                            disabled={isProcessing}
                        >
                            {isDeepSearchEnabled ? (
                                deepSearchStatus === 'quota_exceeded' ? '⚠️' :
                                deepSearchStatus === 'limited' ? '🔄' :
                                deepSearchStatus === 'unavailable' ? '❌' :
                                deepSearchStatus === 'available' ? '🔍' : '🔍'
                            ) : 'DS'}
                        </button>
                        <button
                            type="button"
                            className={`input-action-btn${isWebSearchEnabled ? ' active' : ''}`}
                            title={
                                isWebSearchEnabled
                                    ? "Web Search: ON - Simple web search enabled - Click to disable"
                                    : "Web Search: OFF - Click to enable simple web search"
                            }
                            onClick={handleWebSearchToggle}
                            disabled={isProcessing}
                        >
                            {isWebSearchEnabled ? '🌐' : 'WS'}
                        </button>
                    </div>
                    <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={handleEnterKey} placeholder="Ask your AI tutor anything..." className="modern-input" disabled={isProcessing} />
                    <div className="input-bar-right">
                        {loadingStates.listening ? (
                            <button type="button" className="input-action-btn stop-mic-btn" title="Stop microphone" onClick={handleStopMicButtonClick}><FaStop /></button>
                        ) : (
                            <button type="button" className="input-action-btn" title="Use microphone" onClick={handleStartMicButtonClick} disabled={isProcessing}><FaMicrophone /></button>
                        )}
                        <button type="submit" className="input-action-btn send-btn" title="Send message" disabled={isProcessing || !inputText.trim()} onClick={handleSendMessage}>
                            <FaPaperPlane />
                        </button>
                    </div>
                </div>
                {error && <p className="error-message">{error}</p>}

                {/* Search status notifications */}
                {isDeepSearchEnabled && deepSearchStatus !== 'unknown' && deepSearchStatus !== 'available' && (
                    <div className={`status-notification ${deepSearchStatus}`}>
                        {deepSearchStatus === 'quota_exceeded' && '⚠️ DeepSearch quota exceeded - using fallback responses'}
                        {deepSearchStatus === 'limited' && '🔄 DeepSearch in limited mode - offline search only'}
                        {deepSearchStatus === 'unavailable' && '❌ DeepSearch service temporarily unavailable'}
                    </div>
                )}
                {isWebSearchEnabled && (
                    <div className="status-notification available">
                        🌐 WebSearch active - Simple web search enabled
                    </div>
                )}
            </div>
            {showHistoryModal && <HistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} onLoadSession={handleLoadSession} />}
        </div>
    );
};

export default ChatPage;