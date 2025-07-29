import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    sendMessage as apiSendMessage, saveChatHistory,
    getUserFiles, deleteUserFile, renameUserFile, generateMindMap, getFileOverview,
} from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';
import { FaPlus, FaMicrophone, FaEdit, FaSave, FaTimes, FaCopy, FaStop, FaPaperPlane } from 'react-icons/fa';

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
    const [isRagEnabled, setIsRagEnabled] = useState(false); // Kept for potential future use
    const [isDeepSearchEnabled, setIsDeepSearchEnabled] = useState(false); // Added from 'main'
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [currentlySpeakingIndex, setCurrentlySpeakingIndex] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const navigate = useNavigate();
    const isProcessing = Object.values(loadingStates).some(Boolean);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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
                deepSearch: isDeepSearchEnabled // Pass deep search flag to API
            };
            const response = await apiSendMessage(payload);
            const assistantMessage = {
                id: uuidv4(),
                role: 'assistant',
                parts: [{ text: response.data.response }],
                followUpQuestions: response.data.followUpQuestions || [],
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
    }, [inputText, isProcessing, loadingStates, messages, sessionId, editableSystemPromptText, isDeepSearchEnabled, handleLogout]);

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
            const response = await apiSendMessage(payload);
            const assistantMessage = {
                id: uuidv4(),
                role: 'assistant',
                parts: [{ text: response.data.response }],
                followUpQuestions: response.data.followUpQuestions || [],
                timestamp: new Date()
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            setError(err.response?.data?.error || 'Chat error.');
        } finally {
            setLoadingStates(prev => ({ ...prev, chat: false }));
        }
    }, [editingMessage, messages, sessionId, editableSystemPromptText, isDeepSearchEnabled]);

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
                        const isEditingThisMessage = editingMessage?.id === msg.id;

                        return (
                            <div key={msg.id || index} className={`message-wrapper ${msg.role}`}>
                                <div className={`message-content ${msg.type || ''}`}>
                                    {isEditingThisMessage ? (
                                        <div className="edit-message-container">
                                            <textarea value={editingMessage.text} onChange={(e) => setEditingMessage({ ...editingMessage, text: e.target.value })} className="edit-message-textarea" autoFocus />
                                            <div className="edit-message-controls">
                                                <button onClick={handleSaveEdit} className="edit-message-button save"><FaSave /> Save & Submit</button>
                                                <button onClick={() => setEditingMessage(null)} className="edit-message-button cancel"><FaTimes /> Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {msg.type === 'mindmap' && msg.mermaidData ? (
                                                <MindMap mermaidData={msg.mermaidData} />
                                            ) : (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: ({ node, inline, className, children, ...props }) => !inline && /language-(\w+)/.exec(className || '') ? <CodeBlock language={/language-(\w+)/.exec(className || '')[1]} value={String(children).replace(/\n$/, '')} /> : <code className={className} {...props}>{children}</code> }}>
                                                    {messageText}
                                                </ReactMarkdown>
                                            )}
                                            <div className="message-footer">
                                                {msg.role === 'assistant' && (
                                                    <button onClick={() => handleTextToSpeech(messageText, index)} className={`tts-button ${currentlySpeakingIndex === index ? 'speaking' : ''}`} title="Read aloud" disabled={isProcessing}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/><path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z"/><path d="M8.707 11.182A4.486 4.486 0 0 0 10.025 8a4.486 4.486 0 0 0-1.318-3.182L8 5.525A3.489 3.489 0 0 1 9.025 8 3.49 3.49 0 0 1 8 10.475l.707.707zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z"/></svg>
                                                    </button>
                                                )}
                                                <span className="message-timestamp">{timestamp}</span>
                                                {msg.role === 'user' && !isProcessing && (
                                                    <button onClick={() => setEditingMessage({ id: msg.id, text: messageText })} className="edit-message-icon" title="Edit message"><FaEdit /></button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                                {msg.role === 'assistant' && msg.followUpQuestions?.length > 0 && (
                                    <div className="faq-container">
                                        {msg.followUpQuestions.map((faq, i) => (
                                            <button key={i} className="faq-button" onClick={() => handleSendMessage(null, faq)} disabled={isProcessing}>{faq}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>
                <div className="modern-input-bar">
                    <div className="input-bar-left">
                        <button type="button" className={`input-action-btn${isDeepSearchEnabled ? ' active' : ''}`} title="Deep Research" onClick={() => setIsDeepSearchEnabled(v => !v)} disabled={isProcessing}>DS</button>
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
            </div>
            {showHistoryModal && <HistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} onLoadSession={handleLoadSession} />}
        </div>
    );
};

export default ChatPage;