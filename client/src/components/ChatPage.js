import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    sendMessage as apiSendMessage,
    queryRagService,
    performDeepSearch,
    getUserFiles,
    deleteUserFile,
    renameUserFile,
    generatePodcast,
    generateMindMap
} from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';
import {
    FaMicrophone,
    FaStop,
    FaPaperPlane,
    FaBars,
    FaUpload,
    FaPlus,
    FaHistory,
    FaFolder,
    FaCog,
    FaSun,
    FaMoon,
    FaUser,
    FaSearch,
    FaDatabase
} from 'react-icons/fa';

import FileUploadWidget from './FileUploadWidget';
import HistorySidebarWidget from './HistorySidebarWidget';
import FileManagerWidget from './FileManagerWidget';
import DSAWidget from './DSAWidget';
import MediaRenderer from './MediaRenderer';
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
    const [isDarkTheme, setIsDarkTheme] = useState(() => {
        const saved = localStorage.getItem('isDarkTheme');
        return saved ? JSON.parse(saved) : false;
    });
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('isSidebarOpen');
        return saved ? JSON.parse(saved) : true;
    });
    const [activeTab, setActiveTab] = useState('upload');
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);

    // RAG and search state
    const [isRagEnabled, setIsRagEnabled] = useState(false);
    const [isDeepSearchEnabled, setIsDeepSearchEnabled] = useState(false);
    const [isMcpEnabled, setIsMcpEnabled] = useState(() => {
        const saved = localStorage.getItem('mcpEnabled');
        return saved !== null ? JSON.parse(saved) : false;
    });
    const [selectedFiles, setSelectedFiles] = useState([]);

    // File management state
    const [userFiles, setUserFiles] = useState([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    const [fileError, setFileError] = useState('');
    
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

    // Load user files
    const loadUserFiles = useCallback(async () => {
        if (!userId) return;

        setIsLoadingFiles(true);
        setFileError('');
        try {
            const response = await getUserFiles();
            setUserFiles(response.data || []);
        } catch (err) {
            setFileError('Failed to load files');
            console.error('Error loading files:', err);
        } finally {
            setIsLoadingFiles(false);
        }
    }, [userId]);

    // Load files when user changes
    useEffect(() => {
        if (userId) {
            loadUserFiles();
        }
    }, [userId, loadUserFiles]);

    // Save theme preference
    useEffect(() => {
        localStorage.setItem('isDarkTheme', JSON.stringify(isDarkTheme));
    }, [isDarkTheme]);

    // Save sidebar state
    useEffect(() => {
        localStorage.setItem('isSidebarOpen', JSON.stringify(isSidebarOpen));
    }, [isSidebarOpen]);

    // Save MCP state
    useEffect(() => {
        localStorage.setItem('mcpEnabled', JSON.stringify(isMcpEnabled));
    }, [isMcpEnabled]);

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

    // Close profile dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showProfileDropdown && !event.target.closest('.profile-dropdown')) {
                setShowProfileDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showProfileDropdown]);

    // MCP search handler
    const handleMcpSearch = useCallback(async (query) => {
        if (!query.trim() || isProcessing) return;

        const newUserMessage = {
            id: uuidv4(),
            role: 'user',
            parts: [{ text: query.trim() }],
            timestamp: new Date()
        };
        setMessages(prev => [...prev, newUserMessage]);
        setError('');
        setIsProcessing(true);

        try {
            console.log('🤖 MCP search enabled for query:', query);

            const response = await fetch('/api/agents/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': userId
                },
                body: JSON.stringify({
                    input: query.trim(),
                    history: [...messages, newUserMessage],
                    sessionId,
                    systemPrompt: 'You are a helpful AI assistant with specialized agents.'
                })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'MCP search failed');

            const assistantMessage = {
                id: uuidv4(),
                role: 'assistant',
                parts: [{ text: data.data.response }],
                timestamp: new Date(),
                metadata: data.data.metadata
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            console.error('MCP search error:', err);
            setError(err.message || 'MCP search failed');
            setMessages(prev => prev.slice(0, -1)); // Remove user message on error
        } finally {
            setIsProcessing(false);
        }
    }, [messages, sessionId, isProcessing]);

    // Send message handler
    const handleSendMessage = useCallback(async () => {
        const trimmedInput = inputText.trim();
        if (!trimmedInput || isProcessing) return;

        // Check if MCP is enabled and handle MCP search
        if (isMcpEnabled) {
            setInputText(''); // Clear input immediately for MCP
            return handleMcpSearch(trimmedInput);
        }

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
            let response;
            let responseText = '';
            let metadata = {};

            if (isDeepSearchEnabled) {
                // Use deep search
                response = await performDeepSearch(trimmedInput, messages);
                responseText = response.data?.response || response.data?.answer || 'No response received';
                metadata = { searchType: 'deep-search', enhanced: true };
            } else if (isRagEnabled) {
                if (selectedFiles.length === 0) {
                    // Show error if RAG is enabled but no files selected
                    setError('Please select at least one document for RAG search, or disable RAG mode.');
                    setIsProcessing(false);
                    return;
                }
                // Use RAG with selected files
                response = await queryRagService({
                    query: trimmedInput,
                    sessionId,
                    userId,
                    model: selectedModel,
                    systemPrompt: "You are a helpful AI assistant. Use the provided documents to answer questions accurately.",
                    fileIds: selectedFiles
                });
                responseText = response.data?.response || 'No response received';
                metadata = {
                    searchType: 'rag',
                    sources: response.data?.sources || [],
                    documentsFound: response.data?.documentsFound || 0,
                    enhanced: true,
                    filesUsed: selectedFiles.length
                };
            } else {
                // Standard message
                response = await apiSendMessage({
                    query: trimmedInput,
                    sessionId,
                    userId,
                    model: selectedModel,
                    systemPrompt: "You are a helpful AI assistant."
                });
                responseText = response.data?.response || 'No response received';
                metadata = { searchType: 'standard' };
            }

            if (responseText) {
                const assistantMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    parts: [{ text: responseText }],
                    timestamp: new Date(),
                    metadata,
                    media: response.data?.media || null
                };
                setMessages(prev => [...prev, assistantMessage]);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send message');
        } finally {
            setIsProcessing(false);
        }
    }, [inputText, isProcessing, sessionId, userId, selectedModel, isRagEnabled, isDeepSearchEnabled, isMcpEnabled, selectedFiles, messages, handleMcpSearch]);

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
        loadUserFiles(); // Reload files after upload
    }, [loadUserFiles]);

    // File management handlers
    const handleDeleteFile = useCallback(async (fileId, fileName) => {
        if (window.confirm(`Delete "${fileName}"?`)) {
            try {
                await deleteUserFile(fileId);
                loadUserFiles();
                // Remove from selected files if it was selected
                setSelectedFiles(prev => prev.filter(id => id !== fileId));
            } catch (err) {
                setFileError('Failed to delete file');
            }
        }
    }, [loadUserFiles]);

    const handleRenameFile = useCallback(async (fileId, currentName) => {
        const newName = prompt('Enter new name:', currentName);
        if (newName && newName !== currentName) {
            try {
                await renameUserFile(fileId, newName);
                loadUserFiles();
            } catch (err) {
                setFileError('Failed to rename file');
            }
        }
    }, [loadUserFiles]);

    const handleGeneratePodcast = useCallback(async (fileId, fileName) => {
        try {
            await generatePodcast(fileId);
            alert(`Podcast generation started for "${fileName}"`);
        } catch (err) {
            setFileError('Failed to generate podcast');
        }
    }, []);

    const handleGenerateMindMap = useCallback(async (fileId, fileName) => {
        try {
            await generateMindMap(fileId);
            alert(`Mind map generation started for "${fileName}"`);
        } catch (err) {
            setFileError('Failed to generate mind map');
        }
    }, []);



    // DSA query handler
    const handleDSAQuery = useCallback((query, type, metadata) => {
        // Set the input text and trigger send
        setInputText(query);
        // Add a small delay to ensure the input is set before sending
        setTimeout(() => {
            handleSendMessage();
        }, 100);
    }, [handleSendMessage]);

    // History modal handlers
    const handleLoadSession = useCallback((sessionId) => {
        // Load session by ID - the HistorySidebarWidget will handle the details
        console.log('Loading session:', sessionId);
        // You might want to implement session loading logic here
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
            {/* Mobile Overlay */}
            {isSidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}

            {/* Sidebar */}
            <div className={`sidebar-area ${isSidebarOpen ? 'open' : ''}`}>
                {/* Sidebar Icon Navigation */}
                <div className="sidebar-icon-nav">
                    <button
                        className={`sidebar-icon-item ${activeTab === 'upload' ? 'active' : ''}`}
                        onClick={() => setActiveTab('upload')}
                        title="Upload Files"
                    >
                        <FaUpload />
                    </button>
                    <button
                        className={`sidebar-icon-item ${activeTab === 'new' ? 'active' : ''}`}
                        onClick={() => setActiveTab('new')}
                        title="New Chat"
                    >
                        <FaPlus />
                    </button>
                    <button
                        className={`sidebar-icon-item ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                        title="Chat History"
                    >
                        <FaHistory />
                    </button>
                    <button
                        className={`sidebar-icon-item ${activeTab === 'files' ? 'active' : ''}`}
                        onClick={() => setActiveTab('files')}
                        title="My Files"
                    >
                        <FaFolder />
                    </button>

                    {/* Settings at bottom */}
                    <div className="sidebar-icon-spacer"></div>
                    <button
                        className={`sidebar-icon-item ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                        title="Settings"
                    >
                        <FaCog />
                    </button>
                </div>

                {/* Sidebar Content Area */}
                <div className="sidebar-content-area">
                    {/* Upload Files Tab */}
                    {activeTab === 'upload' && (
                        <div className="sidebar-tab-content">
                            <h3 className="sidebar-tab-title">Upload Files</h3>
                            <FileUploadWidget onUploadSuccess={handleUploadSuccess} />



                            {/* DSA Learning Widget */}
                            <DSAWidget onDSAQuery={handleDSAQuery} />
                        </div>
                    )}

                    {/* New Chat Tab */}
                    {activeTab === 'new' && (
                        <div className="sidebar-tab-content">
                            <h3 className="sidebar-tab-title">New Chat</h3>
                            <button className="new-chat-btn" onClick={handleNewChat} disabled={isProcessing}>
                                <FaPlus />
                                <span>Start New Chat</span>
                            </button>
                        </div>
                    )}

                    {/* Chat History Tab */}
                    {activeTab === 'history' && (
                        <div className="sidebar-tab-content">
                            <HistorySidebarWidget onLoadSession={handleLoadSession} />
                        </div>
                    )}

                    {/* My Files Tab */}
                    {activeTab === 'files' && (
                        <div className="sidebar-tab-content">
                            <FileManagerWidget
                                files={userFiles}
                                isLoading={isLoadingFiles}
                                error={fileError}
                                onDeleteFile={handleDeleteFile}
                                onRenameFile={handleRenameFile}
                                onGeneratePodcast={handleGeneratePodcast}
                                onGenerateMindMap={handleGenerateMindMap}
                                isProcessing={isProcessing}
                                onActionTaken={() => setIsSidebarOpen(false)}
                            />
                        </div>
                    )}

                    {/* Settings Tab */}
                    {activeTab === 'settings' && (
                        <div className="sidebar-tab-content">
                            <h3 className="sidebar-tab-title">Settings</h3>

                            {/* Assistant Mode Section */}
                            <div className="settings-section">
                                <h4 className="settings-section-title">Assistant Mode</h4>
                                <div className="setting-item">
                                    <label>AI Model Selection</label>
                                    <ModelSwitcher
                                        selectedModel={selectedModel}
                                        onModelChange={handleModelChange}
                                        isSidebarOpen={isSidebarOpen}
                                        userId={userId}
                                    />
                                </div>
                            </div>

                            {/* API Keys Section */}
                            <div className="settings-section">
                                <h4 className="settings-section-title">API Configuration</h4>
                                <div className="setting-item">
                                    <label>API Keys Setup</label>
                                    <button className="config-btn">Configure API Keys</button>
                                </div>
                            </div>

                            {/* Theme Section */}
                            <div className="settings-section">
                                <h4 className="settings-section-title">Appearance</h4>
                                <div className="setting-item">
                                    <label>Theme</label>
                                    <button className="theme-toggle-btn" onClick={toggleTheme}>
                                        {isDarkTheme ? <FaSun /> : <FaMoon />}
                                        <span>{isDarkTheme ? 'Light Mode' : 'Dark Mode'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat Container */}
            <div className="chat-container">
                <header className="chat-header">
                    <div className="header-left">
                        <button className="hamburger-btn" onClick={toggleSidebar} title="Toggle sidebar">
                            <FaBars />
                        </button>
                        <h1 className="chat-title">TutorAI</h1>
                    </div>
                    <div className="header-controls">
                        {/* Theme Toggle */}
                        <button className="theme-toggle-header" onClick={toggleTheme} title="Toggle theme">
                            {isDarkTheme ? <FaSun /> : <FaMoon />}
                        </button>

                        {/* Profile Dropdown */}
                        <div className="profile-dropdown">
                            <button
                                className="profile-btn"
                                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                                title="Profile menu"
                            >
                                <FaUser />
                                <span className="username-text">{username}</span>
                            </button>

                            {showProfileDropdown && (
                                <div className="profile-dropdown-menu">
                                    <div className="profile-info">
                                        <FaUser />
                                        <span>{username}</span>
                                    </div>
                                    <hr />
                                    <button
                                        className="dropdown-item"
                                        onClick={handleNewChat}
                                        disabled={isProcessing}
                                    >
                                        <FaPlus />
                                        <span>New Chat</span>
                                    </button>

                                    <hr />
                                    <button
                                        className="dropdown-item logout-item"
                                        onClick={() => handleLogout(false)}
                                        disabled={isProcessing}
                                    >
                                        <span>Logout</span>
                                    </button>
                                </div>
                            )}
                        </div>
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
                            const metadata = msg.metadata || {};

                            return (
                                <div key={index} className={`message ${msg.role}`}>
                                    <div className="message-content">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {messageText}
                                        </ReactMarkdown>
                                        {metadata.searchType && metadata.searchType !== 'standard' && (
                                            <div className="message-metadata">
                                                <div className="search-type-badge">
                                                    {metadata.searchType === 'rag' && <><FaDatabase /> RAG Search</>}
                                                    {metadata.searchType === 'deep-search' && <><FaSearch /> Deep Search</>}
                                                    {metadata.enhanced && <span className="enhanced-badge">Enhanced</span>}
                                                </div>
                                                {metadata.sources && metadata.sources.length > 0 && (
                                                    <div className="sources">
                                                        <small>Sources: {metadata.sources.join(', ')}</small>
                                                    </div>
                                                )}
                                                {metadata.documentsFound > 0 && (
                                                    <div className="documents-found">
                                                        <small>{metadata.documentsFound} documents found</small>
                                                    </div>
                                                )}
                                                {metadata.filesUsed > 0 && (
                                                    <div className="files-used">
                                                        <small>{metadata.filesUsed} file(s) searched</small>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {/* Media Content for Deep Search */}
                                        {msg.role === 'assistant' && metadata.searchType === 'enhanced_deep_search' && msg.media && (
                                            <MediaRenderer
                                                media={msg.media}
                                            />
                                        )}
                                    </div>
                                    <div className="message-timestamp">{timestamp}</div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>



                {/* Mode Selection Buttons - Same Row as Current MCP Button */}
                <div className="mode-buttons-row">
                    <button
                        className={`mode-btn ${isRagEnabled ? 'active' : ''}`}
                        onClick={() => {
                            setIsRagEnabled(!isRagEnabled);
                            if (!isRagEnabled) {
                                setIsDeepSearchEnabled(false);
                                setIsMcpEnabled(false);
                            }
                        }}
                        disabled={isProcessing}
                        title="RAG Mode - Search your uploaded documents"
                    >
                        <FaDatabase className="btn-icon" />
                        <span>RAG Mode</span>
                    </button>

                    <button
                        className={`mode-btn ${isDeepSearchEnabled ? 'active' : ''}`}
                        onClick={() => {
                            setIsDeepSearchEnabled(!isDeepSearchEnabled);
                            if (!isDeepSearchEnabled) {
                                setIsRagEnabled(false);
                                setIsMcpEnabled(false);
                            }
                        }}
                        disabled={isProcessing}
                        title="Deep Search - Web search + document analysis"
                    >
                        <FaSearch className="btn-icon" />
                        <span>Deep Search</span>
                    </button>

                    <button
                        className={`mode-btn ${isMcpEnabled ? 'active' : ''}`}
                        onClick={() => {
                            setIsMcpEnabled(!isMcpEnabled);
                            if (!isMcpEnabled) {
                                setIsRagEnabled(false);
                                setIsDeepSearchEnabled(false);
                            }
                        }}
                        disabled={isProcessing}
                        title="MCP Agents - AI agents for specialized tasks"
                    >
                        <span className="btn-icon">🤖</span>
                        <span>MCP Agents</span>
                    </button>
                </div>

                {/* File Selection for RAG Mode */}
                {isRagEnabled && (
                    <div className="rag-file-selection">
                        <div className="file-selection-header">
                            <FaDatabase className="selection-icon" />
                            <span>Select documents to search:</span>
                        </div>
                        <div className="file-selection-grid">
                            {userFiles.length > 0 ? (
                                userFiles.map(file => (
                                    <label key={file._id} className="file-selection-item">
                                        <input
                                            type="checkbox"
                                            checked={selectedFiles.includes(file._id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedFiles(prev => [...prev, file._id]);
                                                } else {
                                                    setSelectedFiles(prev => prev.filter(id => id !== file._id));
                                                }
                                            }}
                                        />
                                        <span className="file-name">{file.originalname}</span>
                                    </label>
                                ))
                            ) : (
                                <div className="no-files-message">
                                    No files uploaded. Upload files in the sidebar to use RAG mode.
                                </div>
                            )}
                        </div>
                        {selectedFiles.length > 0 && (
                            <div className="selected-count">
                                {selectedFiles.length} file(s) selected for search
                            </div>
                        )}
                    </div>
                )}

                {/* Chat Input */}
                <div className="chat-input-container">
                    <div className={`input-wrapper ${isRagEnabled ? 'rag-mode' : isDeepSearchEnabled ? 'deep-search-mode' : isMcpEnabled ? 'mcp-mode' : ''}`}>
                        {(isRagEnabled || isDeepSearchEnabled || isMcpEnabled) && (
                            <div className="mode-indicator">
                                {isRagEnabled && (
                                    <span className="mode-badge rag-badge">
                                        <FaDatabase /> RAG Mode
                                    </span>
                                )}
                                {isDeepSearchEnabled && (
                                    <span className="mode-badge deep-search-badge">
                                        <FaSearch /> Deep Search
                                    </span>
                                )}
                                {isMcpEnabled && (
                                    <span className="mode-badge mcp-badge">
                                        🤖 MCP Agents
                                    </span>
                                )}
                            </div>
                        )}
                        <div className="input-field-container">
                            <textarea
                                className="input-field"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={handleEnterKey}
                                placeholder={
                                    isRagEnabled
                                        ? "Ask questions about your documents..."
                                        : isDeepSearchEnabled
                                            ? "Ask anything - I'll search the web for comprehensive answers..."
                                            : isMcpEnabled
                                                ? "Ask anything - AI agents will help you..."
                                                : "Message Gemini..."
                                }
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


                </div>

                {error && <p className="error-message">{error}</p>}
            </div>
        </div>
    );
};

export default ChatPage;
