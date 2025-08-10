import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendMessage as apiSendMessage, saveChatHistory } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';
import { FaMicrophone, FaStop, FaPaperPlane } from 'react-icons/fa';

import FileUploadWidget from './FileUploadWidget';
import HistoryModal from './HistoryModal';
import ModelSwitcher from './ModelSwitcher';

import './ChatPage.css';

const ChatPage = () => {
    // Core state
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [loadingStates, setLoadingStates] = useState({ listening: false });
    
    // User and session state
    const [sessionId, setSessionId] = useState('');
    const [userId, setUserId] = useState('');
    const [username, setUsername] = useState('');
    
    // UI state
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [isDarkTheme, setIsDarkTheme] = useState(() => {
        const saved = localStorage.getItem('isDarkTheme');
        return saved ? JSON.parse(saved) : false;
    });
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('isSidebarOpen');
        return saved ? JSON.parse(saved) : true;
    });
    const [activeTab, setActiveTab] = useState('settings');
    
    // Model state
    const [selectedModel, setSelectedModel] = useState(() => {
        const saved = localStorage.getItem('selectedModel');
        return saved || 'gemini-flash';
    });

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const navigate = useNavigate();

    // Initialize user session
    useEffect(() => {
        const initializeSession = () => {
            const storedUserId = localStorage.getItem('userId');
            const storedUsername = localStorage.getItem('username');
            const storedSessionId = localStorage.getItem('sessionId');

            if (!storedUserId || !storedUsername) {
                navigate('/login');
                return;
            }

            setUserId(storedUserId);
            setUsername(storedUsername);
            setSessionId(storedSessionId || uuidv4());
        };

        initializeSession();
    }, [navigate]);

    // Save theme preference
    useEffect(() => {
        localStorage.setItem('isDarkTheme', JSON.stringify(isDarkTheme));
    }, [isDarkTheme]);

    // Save sidebar state
    useEffect(() => {
        localStorage.setItem('isSidebarOpen', JSON.stringify(isSidebarOpen));
    }, [isSidebarOpen]);

    // Save selected model
    useEffect(() => {
        localStorage.setItem('selectedModel', selectedModel);
    }, [selectedModel]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Logout handler
    const handleLogout = useCallback((clearHistory = true) => {
        if (clearHistory) {
            localStorage.removeItem('userId');
            localStorage.removeItem('username');
            localStorage.removeItem('sessionId');
        }
        navigate('/login');
    }, [navigate]);

    // New chat handler
    const handleNewChat = useCallback(() => {
        setMessages([]);
        setSessionId(uuidv4());
        setError('');
        localStorage.setItem('sessionId', sessionId);
    }, [sessionId]);

    // Model change handler
    const handleModelChange = useCallback((model) => {
        setSelectedModel(model);
    }, []);

    // Theme toggle
    const toggleTheme = useCallback(() => {
        setIsDarkTheme(prev => !prev);
    }, []);

    // Sidebar toggle
    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    // Send message handler
    const handleSendMessage = useCallback(async () => {
        const trimmedInput = inputText.trim();
        if (!trimmedInput || isProcessing) return;

        const newUserMessage = { 
            id: uuidv4(), 
            role: 'user', 
            parts: [{ text: trimmedInput }], 
            timestamp: new Date() 
        };
        
        setMessages(prev => [...prev, newUserMessage]);
        setInputText('');
        setIsProcessing(true);
        setError('');

        try {
            const response = await apiSendMessage({
                query: trimmedInput,
                sessionId,
                userId,
                model: selectedModel,
                systemPrompt: "You are a helpful AI assistant."
            });

            if (response.data?.response) {
                const assistantMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    parts: [{ text: response.data.response }],
                    timestamp: new Date()
                };
                setMessages(prev => [...prev, assistantMessage]);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send message');
        } finally {
            setIsProcessing(false);
        }
    }, [inputText, isProcessing, sessionId, userId, selectedModel]);

    // Speech recognition handlers
    const handleStartMicButtonClick = useCallback(() => {
        if (!('webkitSpeechRecognition' in window)) {
            setError('Speech recognition not supported');
            return;
        }

        const recognition = new window.webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setLoadingStates(prev => ({ ...prev, listening: true }));
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInputText(transcript);
        };
        recognition.onerror = (e) => setError(`Speech recognition error: ${e.error}`);
        recognition.onend = () => setLoadingStates(prev => ({ ...prev, listening: false }));

        recognition.start();
        recognitionRef.current = recognition;
    }, []);

    const handleStopMicButtonClick = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
    }, []);

    // Keyboard handler
    const handleEnterKey = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }, [handleSendMessage]);

    // File upload handler
    const handleUploadSuccess = useCallback((newFile) => {
        console.log('File uploaded:', newFile);
    }, []);

    // History modal handlers
    const handleLoadSession = useCallback((session) => {
        setMessages(session.messages || []);
        setSessionId(session.sessionId);
        setShowHistoryModal(false);
    }, []);

    if (!userId) {
        return (
            <div className="loading-indicator">
                <span>Initializing...</span>
            </div>
        );
    }

    return (
        <div className="chat-page-container" data-theme={isDarkTheme ? 'dark' : 'light'}>
            {/* Sidebar */}
            <div className={`sidebar-area ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo-section">
                        <div className="logo-icon">G</div>
                        <h1 className="app-title">Gemini AI</h1>
                    </div>
                    <button className="theme-toggle" onClick={toggleTheme}>
                        {isDarkTheme ? '☀️' : '🌙'}
                    </button>
                </div>

                <div className="sidebar-content">
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">AI Model</div>
                        <ModelSwitcher 
                            selectedModel={selectedModel} 
                            onModelChange={handleModelChange}
                            isSidebarOpen={isSidebarOpen}
                            userId={userId}
                        />
                    </div>

                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Quick Actions</div>
                        <div className="sidebar-item" onClick={() => setActiveTab('upload')}>
                            <div className="sidebar-item-icon">📁</div>
                            <div className="sidebar-item-text">Upload Files</div>
                        </div>
                        <div className="sidebar-item" onClick={() => setShowHistoryModal(true)}>
                            <div className="sidebar-item-icon">🕒</div>
                            <div className="sidebar-item-text">Chat History</div>
                        </div>
                        <div className="sidebar-item" onClick={handleNewChat}>
                            <div className="sidebar-item-icon">✏️</div>
                            <div className="sidebar-item-text">New Chat</div>
                        </div>
                    </div>

                    {activeTab === 'upload' && (
                        <div className="sidebar-section">
                            <div className="sidebar-section-title">Upload Files</div>
                            <FileUploadWidget onUploadSuccess={handleUploadSuccess} />
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat Container */}
            <div className="chat-container">
                <header className="chat-header">
                    <div className="header-left">
                        <button className="mobile-menu-btn" onClick={toggleSidebar}>
                            ☰
                        </button>
                        <h1 className="chat-title">Gemini AI Assistant</h1>
                    </div>
                    <div className="header-controls">
                        <span className="username-display">{username}</span>
                        <button className="header-btn" onClick={handleNewChat} disabled={isProcessing}>
                            ✏️ New
                        </button>
                        <button className="logout-button" onClick={() => handleLogout(false)} disabled={isProcessing}>
                            Logout
                        </button>
                    </div>
                </header>

                {/* Chat Messages */}
                <div className="chat-messages">
                    {messages.length === 0 ? (
                        <div className="welcome-screen">
                            <h1 className="welcome-title">Hello, {username}</h1>
                            <p className="welcome-subtitle">How can I help you today?</p>
                            <div className="suggestion-chips">
                                <div className="suggestion-chip" onClick={() => setInputText("Explain quantum computing")}>
                                    Explain quantum computing
                                </div>
                                <div className="suggestion-chip" onClick={() => setInputText("Write a creative story")}>
                                    Write a creative story
                                </div>
                                <div className="suggestion-chip" onClick={() => setInputText("Help me plan a trip")}>
                                    Help me plan a trip
                                </div>
                                <div className="suggestion-chip" onClick={() => setInputText("Solve a math problem")}>
                                    Solve a math problem
                                </div>
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, index) => {
                            if (!msg?.role || !msg?.parts?.length) return null;
                            const messageText = msg.parts[0]?.text || '';
                            const timestamp = msg.timestamp ? 
                                new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                            return (
                                <div key={index} className={`message ${msg.role}`}>
                                    <div className="message-content">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {messageText}
                                        </ReactMarkdown>
                                    </div>
                                    <div className="message-timestamp">{timestamp}</div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Chat Input */}
                <div className="chat-input-container">
                    <div className="input-wrapper">
                        <textarea
                            className="input-field"
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={handleEnterKey}
                            placeholder="Message Gemini..."
                            disabled={isProcessing}
                            rows={1}
                        />
                        <div className="input-actions">
                            {loadingStates.listening ? (
                                <button 
                                    type="button" 
                                    className="input-action-btn stop-mic-btn" 
                                    title="Stop microphone" 
                                    onClick={handleStopMicButtonClick}
                                >
                                    <FaStop />
                                </button>
                            ) : (
                                <button 
                                    type="button" 
                                    className="input-action-btn" 
                                    title="Use microphone" 
                                    onClick={handleStartMicButtonClick} 
                                    disabled={isProcessing}
                                >
                                    <FaMicrophone />
                                </button>
                            )}
                            <button 
                                type="submit" 
                                className="input-action-btn send-btn" 
                                title="Send message" 
                                disabled={isProcessing || !inputText.trim()} 
                                onClick={handleSendMessage}
                            >
                                <FaPaperPlane />
                            </button>
                        </div>
                    </div>
                </div>

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
