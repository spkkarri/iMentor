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
    // State for chat messages and input
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');

    // State for various loading indicators
    const [isLoading, setIsLoading] = useState(false);
    const [isRagLoading, setIsRagLoading] = useState(false);
    const [isPodcastLoading, setIsPodcastLoading] = useState(false);
    const [isMindMapLoading, setIsMindMapLoading] = useState(false);
    const [isListening, setIsListening] = useState(false); // State for microphone listening

    // State for UI and session management
    const [error, setError] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [userId, setUserId] = useState('');
    const [username, setUsername] = useState('');
    const [currentSystemPromptId, setCurrentSystemPromptId] = useState('friendly');
    const [editableSystemPromptText, setEditableSystemPromptText] = useState(() => getPromptTextById('friendly'));
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    // State for file management
    const [files, setFiles] = useState([]);
    const [isFileLoading, setIsFileLoading] = useState(false);
    const [fileError, setFileError] = useState('');
    const [hasFiles, setHasFiles] = useState(false);
    const [isRagEnabled, setIsRagEnabled] = useState(false);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null); // Ref to store the SpeechRecognition instance
    const navigate = useNavigate();

    // Centralized loading state for UI elements
    const isProcessing = isLoading || isRagLoading || isPodcastLoading || isMindMapLoading;

    // --- Effects ---

    // Auto-scroll to the latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Initial setup on component mount for user data, session, and SpeechRecognition
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

        // Initialize SpeechRecognition API
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                setIsListening(true);
                setMessages(prev => [...prev, { role: 'system', parts: [{ text: 'System: Recording started... Speak now.' }], timestamp: new Date() }]);
                setError('');
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInputText(transcript);
                setMessages(prev => [...prev, { role: 'system', parts: [{ text: `System: Transcribed: "${transcript}"` }], timestamp: new Date() }]);
            };

            recognition.onerror = (e) => {
                console.error('Speech recognition error:', e.error);
                setError(`STT Error: ${e.error}`);
                setMessages(prev => [...prev, { role: 'system', parts: [{ text: `System: STT Error: ${e.error}` }], timestamp: new Date() }]);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
                setMessages(prev => [...prev, { role: 'system', parts: [{ text: 'System: Recording stopped.' }], timestamp: new Date() }]);
            };
            recognitionRef.current = recognition;
        } else {
            setError('Speech Recognition not supported in this browser.');
            console.warn('Web Speech API (SpeechRecognition) is not supported in this browser.');
        }

        // Cleanup: Stop recognition when component unmounts
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
            speechSynthesis.cancel(); // Also cancel any ongoing TTS
        };
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
    }, [messages.length, setIsAuthenticated, navigate]);

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


    // Text-to-Speech function (now standalone for on-demand playback)
    const speak = useCallback((text) => {
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel(); // Stop current speech if any
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.3;
        speechSynthesis.speak(utterance);
    }, []);

    // New handler for clicking speaker icon
    const handleSpeakMessage = useCallback((messageText) => {
        speak(messageText);
    }, [speak]);


    const handleSendMessage = useCallback(async (e) => {
        if (e) e.preventDefault();
        const trimmedInput = inputText.trim();
        if (!trimmedInput || isProcessing) return;

        // If actively listening, stop recognition before sending message
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
        }

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
                response = await apiSendMessage({ history: historyToSend, systemPrompt: editableSystemPromptText });
            }
            const assistantMessageText = response.data.text;
            const assistantMessage = { role: 'assistant', parts: [{ text: assistantMessageText }], timestamp: new Date() };
            setMessages(prev => [...prev, assistantMessage]);
            // Removed automatic speak(assistantMessageText);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'An error occurred.';
            setError(errorMessage);
            setMessages(prev => prev.slice(0, -1));
            if (err.response?.status === 401) handleLogout(true);
        } finally {
            setIsLoading(false);
            setIsRagLoading(false);
        }
    }, [inputText, isProcessing, messages, isRagEnabled, editableSystemPromptText, handleLogout, isListening]);

    // Handle Microphone Button Click (starts/stops STT)
    const handleMicButtonClick = useCallback(() => {
        if (!recognitionRef.current) {
            setError("Speech Recognition not supported in this browser or not initialized.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            if (inputText.trim() !== '') {
                setInputText('');
            }
            recognitionRef.current.start();
        }
    }, [isListening, inputText]);


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
            // Removed automatic speak on podcast generation
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to generate podcast.';
            setError(`Podcast Error: ${errorMessage}`);
            const errorResponseMessage = { role: 'assistant', parts: [{ text: `I'm sorry, I couldn't generate the podcast. Error: ${errorMessage}` }], timestamp: new Date() };
            setMessages(prev => [...prev, errorResponseMessage]);
            // Removed automatic speak on podcast error
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
            const mindMapMessage = {
                role: 'assistant',
                type: 'mindmap',
                parts: [{ text: `Here is the mind map for "${fileName}":` }],
                mindMapData: response.data,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, mindMapMessage]);
            // Removed automatic speak on mind map generation
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to generate mind map.';
            setError(`Mind Map Error: ${errorMessage}`);
            const errorResponseMessage = { role: 'assistant', parts: [{ text: `I'm sorry, I couldn't generate the mind map. Error: ${errorMessage}` }], timestamp: new Date() };
            setMessages(prev => [...prev, errorResponseMessage]);
            // Removed automatic speak on mind map error
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

                        // Render MindMap
                        if (msg.type === 'mindmap') {
                            return (
                                <div key={index} className={`message ${msg.role}`}>
                                    <div className="message-content">
                                        <p>{messageText}</p>
                                        <MindMap mindMapData={msg.mindMapData} />
                                    </div>
                                    <span className="message-timestamp">{timestamp}</span>
                                    {msg.role === 'assistant' && (
                                        <button onClick={() => handleSpeakMessage(messageText)} className="speaker-icon-button" title="Listen to message">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                                <path fillRule="evenodd" d="M9.363 3.417c-.843.097-1.659.42-2.352.956l-4.15 3.32A.75.75 0 002.5 8.25v7.5a.75.75 0 001.36.457l4.15-3.32c.693-.536 1.509-.859 2.352-.956A4.502 4.502 0 0012 9.75V8.25a4.502 4.502 0 00-2.637-4.833zM15 9.75a3 3 0 100 6.002.75.75 0 010 1.5 4.5 4.5 0 110-9.002.75.75 0 010 1.5z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            );
                        }
                        // Render Audio/Podcast
                        if (msg.type === 'audio') {
                            return (
                                <div key={index} className={`message ${msg.role}`}>
                                    <div className="message-content">
                                        <p>{messageText}</p>
                                        <audio controls src={msg.audioUrl} style={{ width: '100%', marginTop: '10px' }} />
                                    </div>
                                    <span className="message-timestamp">{timestamp}</span>
                                    {msg.role === 'assistant' && (
                                        <button onClick={() => handleSpeakMessage(messageText)} className="speaker-icon-button" title="Listen to message">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                                <path fillRule="evenodd" d="M9.363 3.417c-.843.097-1.659.42-2.352.956l-4.15 3.32A.75.75 0 002.5 8.25v7.5a.75.75 0 001.36.457l4.15-3.32c.693-.536 1.509-.859 2.352-.956A4.502 4.502 0 0012 9.75V8.25a4.502 4.502 0 00-2.637-4.833zM15 9.75a3 3 0 100 6.002.75.75 0 010 1.5 4.5 4.5 0 110-9.002.75.75 0 010 1.5z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            );
                        }
                        // Render regular text message
                         return (
                            <div key={index} className={`message ${msg.role}`}>
                                <div className="message-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{messageText}</ReactMarkdown>
                                </div>
                                <div className="message-footer"> {/* NEW: Wrap timestamp and speaker button */}
                                    <span className="message-timestamp">{timestamp}</span>
                                    {msg.role === 'assistant' && ( // Only show for assistant messages
                                        <button onClick={() => handleSpeakMessage(messageText)} className="speaker-icon-button" title="Listen to message">
                                            {/* Speaker SVG Icon */}
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 12c0-1.66 1.34-3 3-3 .08 0 .17.01.25.02L12 7.02V16.97l-3.75-2.98c-.08-.01-.16-.02-.25-.02-1.66 0-3-1.34-3-3z"/>
                                            </svg>
                                        </button>
                                    )}
                                </div> {/* END NEW: Wrap */}
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
                    {/* Microphone Button */}
                    <button
                        onClick={handleMicButtonClick}
                        className={`icon-button mic-button ${isListening ? 'listening' : ''}`}
                        disabled={isProcessing || !recognitionRef.current}
                        title={isListening ? "Stop Voice Input" : "Start Voice Input"}
                    >
                        {/* Mic SVG Icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                            <path d="M10.868 18.847c.692 0 1.25-.558 1.25-1.25v-3.5a.75.75 0 011.5 0v3.5A5.25 5.25 0 017.5 14.5v-3.5a.75.75 0 011.5 0v3.5c0 .692.558 1.25 1.25 1.25h1.25z" />
                        </svg>
                    </button>
                    {/* Send Button */}
                    <button onClick={handleSendMessage} disabled={isProcessing || !inputText.trim() || isListening} title="Send Message">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                </footer>
            </div>
            <HistoryModal isOpen={isHistoryModalOpen} onClose={closeHistoryModal} onLoadSession={handleLoadSession} />
        </div>
    );
};

export default ChatPage;