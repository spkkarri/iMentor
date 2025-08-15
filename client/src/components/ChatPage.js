import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    sendMessage as apiSendMessage,
    queryRagService,
    performDeepSearch,
    performEnhancedDeepSearchV2,
    getUserFiles,
    deleteUserFile,
    renameUserFile,
    generatePodcast,
    generateMindMap
} from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { v4 as uuidv4 } from 'uuid';
import MediaRenderer from './MediaRenderer';
import DownloadLink from './DownloadLink';
import EnhancedVideoPlayer from './EnhancedVideoPlayer';
// FAQ generation is now handled directly in chat
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
import ModelSwitcher from './ModelSwitcher';
import TutorModeSelector from './TutorModeSelector';
import MindMap from './MindMap';
import ApiKeyManager from './ApiKeyManager';
import { ToastContainer, useToast } from './Toast';
import useNetworkStatus from '../hooks/useNetworkStatus';

import './ChatPage.css';

const ChatPage = () => {
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);
    const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();
    const { isOnline } = useNetworkStatus();

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
        return saved ? JSON.parse(saved) : false; // Default to closed
    });
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);
    const [activeTab, setActiveTab] = useState('upload');
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [showApiKeyManager, setShowApiKeyManager] = useState(true);

    // RAG and search state
    const [isRagEnabled, setIsRagEnabled] = useState(false);
    const [isDeepSearchEnabled, setIsDeepSearchEnabled] = useState(false);
    // MCP is now always enabled in the background for intelligent responses
    const isMcpEnabled = true;
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

    // Tutor mode state
    const [selectedTutorMode, setSelectedTutorMode] = useState(() => {
        const saved = localStorage.getItem('selectedTutorMode');
        return saved || 'friendly-tutor';
    });
    const [tutorModeConfig, setTutorModeConfig] = useState(null);

    const recognitionRef = useRef(null);

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

    // Initialize tutor mode configuration
    useEffect(() => {
        const initializeTutorMode = () => {
            // Default tutor modes
            const defaultModes = [
                {
                    id: 'friendly-tutor',
                    name: 'Friendly Tutor',
                    description: 'Encouraging, patient, and supportive teaching style',
                    systemPrompt: 'You are a friendly and encouraging tutor. Be patient, supportive, and use simple explanations. Always encourage the student and celebrate their progress. Use positive language and break down complex topics into easy-to-understand steps.'
                },
                {
                    id: 'professional-tutor',
                    name: 'Professional Tutor',
                    description: 'Formal, structured, and comprehensive teaching approach',
                    systemPrompt: 'You are a professional tutor with expertise in your field. Provide structured, comprehensive explanations with proper terminology. Be formal yet approachable, and ensure accuracy in all information. Include relevant examples and practical applications.'
                },
                {
                    id: 'code-mentor',
                    name: 'Code Mentor',
                    description: 'Technical programming guidance with best practices',
                    systemPrompt: 'You are an experienced programming mentor. Focus on clean code, best practices, and efficient solutions. Explain programming concepts clearly, provide code examples, suggest improvements, and help debug issues. Always consider performance and maintainability.'
                },
                {
                    id: 'research-assistant',
                    name: 'Research Assistant',
                    description: 'Academic research support with critical thinking',
                    systemPrompt: 'You are a research-oriented academic assistant. Help with critical thinking, analysis, and research methodology. Provide well-sourced information, encourage deeper investigation, and help structure academic arguments. Focus on evidence-based reasoning.'
                }
            ];

            const currentMode = defaultModes.find(mode => mode.id === selectedTutorMode) || defaultModes[0];
            setTutorModeConfig(currentMode);
        };

        initializeTutorMode();
    }, [selectedTutorMode]);

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

    // MCP is always enabled in the background - no need to save state

    // Save selected model
    useEffect(() => {
        localStorage.setItem('selectedModel', selectedModel);
    }, [selectedModel]);

    // Show network status warnings
    useEffect(() => {
        if (!isOnline) {
            showWarning('You are offline. Some features may not work properly.');
        }
    }, [isOnline, showWarning]);

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
        setSelectedFiles([]);
        showSuccess('New chat started!');
        localStorage.setItem('sessionId', sessionId);
    }, [sessionId, showSuccess]);

    // Model change handler
    const handleModelChange = useCallback((model) => {
        console.log('🔄 Model changed to:', model);
        // Handle both string IDs and model objects
        const modelId = typeof model === 'string' ? model : model.id;
        const modelName = typeof model === 'string' ? model : model.name;

        setSelectedModel(modelId);
        localStorage.setItem('selectedModel', modelId);
        showSuccess(`Switched to ${modelName}`);
    }, [showSuccess]);

    // Tutor mode change handler
    const handleTutorModeChange = useCallback((mode) => {
        console.log('🎓 Tutor mode changed to:', mode);
        setSelectedTutorMode(mode.id);
        setTutorModeConfig(mode);
        localStorage.setItem('selectedTutorMode', mode.id);
        showSuccess(`Switched to ${mode.name} mode`);
    }, [showSuccess]);

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

    // Unified MCP search handler - handles both standard and agentic processing

    const handleUnifiedMCPSearch = useCallback(async (query, mode = 'auto') => {
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
            console.log(`🤖 Unified MCP processing query with mode: ${mode}`);

            // Use the unified MCP endpoint
            const response = await fetch('/api/mcp/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'X-User-ID': userId
                },
                body: JSON.stringify({
                    query: query.trim(),
                    userId: userId,
                    sessionId: sessionId,
                    mode: mode, // 'auto', 'standard', or 'agentic'
                    context: {
                        selectedModel: selectedModel,
                        chatHistory: messages.slice(-5), // Last 5 messages for context
                        timestamp: new Date().toISOString()
                    }
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Unified MCP processing failed');

            const responseText = typeof data.data?.result === 'string'
                ? data.data.result
                : (data.data?.response || 'No response received');
            const processingMode = data.data?.processingMode || 'unknown';

            const assistantMessage = {
                id: uuidv4(),
                role: 'assistant',
                parts: [{ text: responseText }],
                timestamp: new Date(),
                metadata: {
                    searchType: 'unified-mcp',
                    processingMode: processingMode,
                    agentsUsed: data.data?.agentsUsed || [],
                    confidence: data.data?.confidence || null,
                    processingTime: data.data?.processingTime || null,
                    mcpVersion: data.metadata?.mcpVersion || '3.0.0-unified'
                }
            };

            setMessages(prev => [...prev, assistantMessage]);

            // Show processing mode info
            if (processingMode === 'agentic') {
                console.log('✨ Used Agentic MCP for complex query processing');
            } else if (processingMode === 'standard') {
                console.log('⚡ Used Standard MCP for efficient processing');
            }

        } catch (err) {
            console.error('Unified MCP search error:', err);
            setError(err.message || 'Unified MCP search failed');
            setMessages(prev => prev.slice(0, -1)); // Remove user message on error
        } finally {
            setIsProcessing(false);
        }
    }, [messages, sessionId, isProcessing, userId, selectedModel]);

    // Send message handler
    const handleSendMessage = useCallback(async () => {
        const trimmedInput = inputText.trim();

        // Validate input
        if (!trimmedInput) {
            showWarning('Please enter a message before sending.');
            return;
        }

        if (isProcessing) {
            showWarning('Please wait for the current message to complete.');
            return;
        }

        // Check network status
        if (!isOnline) {
            showError('You are offline. Please check your internet connection.');
            return;
        }

        // Check message length
        if (trimmedInput.length > 4000) {
            showError('Message is too long. Please keep it under 4000 characters.');
            return;
        }

        // Check if MCP is enabled and handle Unified MCP processing
        if (isMcpEnabled) {
            setInputText(''); // Clear input immediately for MCP
            // Use auto mode for intelligent routing
            return handleUnifiedMCPSearch(trimmedInput, 'auto');
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
                // Use enhanced deep search V2 with rich media content
                console.log(`🔍 Using enhanced deep search V2 with model: ${selectedModel}`);
                response = await performEnhancedDeepSearchV2(trimmedInput, messages, selectedModel);

                // Fix response data access - the API returns data nested under 'data'
                const responseData = response.data?.data || response.data;
                responseText = responseData?.response || responseData?.answer || 'No response received';

                metadata = {
                    searchType: 'enhanced-deep-search-v2',
                    model: selectedModel,
                    hasRichMedia: responseData?.metadata?.hasRichMedia || false,
                    videoCount: responseData?.metadata?.videoCount || 0,
                    blogCount: responseData?.metadata?.blogCount || 0,
                    academicCount: responseData?.metadata?.academicCount || 0
                };
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
                    selectedModel: selectedModel,
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
                // Standard message with tutor mode
                const tutorSystemPrompt = tutorModeConfig?.systemPrompt || "You are a helpful AI assistant.";

                response = await apiSendMessage({
                    query: trimmedInput,
                    sessionId,
                    userId,
                    systemPrompt: tutorSystemPrompt,
                    autoDetectWebSearch: true,  // Enable automatic web search detection
                    selectedModel: selectedModel,
                    tutorMode: tutorModeConfig ? {
                        id: tutorModeConfig.id,
                        name: tutorModeConfig.name,
                        description: tutorModeConfig.description
                    } : null
                });
                responseText = response.data?.response || 'No response received';
                metadata = {
                    searchType: 'standard',
                    tutorMode: tutorModeConfig?.name || 'Default'
                };
            }

            if (responseText) {
                // Fix response data access for rich media content
                const responseData = response.data?.data || response.data;

                const assistantMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    parts: [{ text: responseText }],
                    timestamp: new Date(),
                    metadata,
                    // Rich media content for enhanced deep search V2
                    videos: responseData?.videos || [],
                    blogs: responseData?.blogs || [],
                    academic: responseData?.academic || [],
                    wikipedia: responseData?.wikipedia || [],
                    documentation: responseData?.documentation || [],
                    sources: responseData?.sources || [],
                    // Legacy media support
                    media: responseData?.media || null,
                    // Original query for video player context
                    originalQuery: trimmedInput
                };
                setMessages(prev => [...prev, assistantMessage]);
            }
        } catch (err) {
            console.error('❌ Message send error:', err);

            // Extract detailed error information
            const errorData = err.response?.data || {};
            const suggestions = errorData.suggestions || [];
            const recommendedAction = errorData.recommendedAction;
            const currentModel = errorData.currentModel;

            // Create comprehensive error message
            let errorMessage = errorData.message || err.message || 'Failed to send message';

            if (suggestions.length > 0) {
                errorMessage += '\n\n💡 Suggestions:\n';
                suggestions.forEach((suggestion, index) => {
                    errorMessage += `${index + 1}. ${suggestion}\n`;
                });
            }

            if (recommendedAction) {
                errorMessage += `\n🎯 Recommended: ${recommendedAction}`;
            }

            if (currentModel) {
                errorMessage += `\n\n🤖 Current Model: ${currentModel}`;
            }

            // Add helpful error message to chat
            const errorChatMessage = {
                id: uuidv4(),
                role: 'assistant',
                parts: [{ text: errorMessage }],
                timestamp: new Date(),
                isError: true
            };

            setMessages(prev => [...prev, errorChatMessage]);
            setError(errorData.message || err.message || 'Failed to send message');
            showError(errorData.message || err.message || 'Failed to send message');
        } finally {
            setIsProcessing(false);
        }
    }, [inputText, isProcessing, sessionId, userId, selectedModel, isRagEnabled, isDeepSearchEnabled, isMcpEnabled, selectedFiles, messages, handleUnifiedMCPSearch, showWarning, showError, isOnline]);

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
        showSuccess(`File "${newFile.filename}" uploaded successfully!`);
        loadUserFiles(); // Reload files after upload
    }, [loadUserFiles, showSuccess]);

    // File management handlers
    const handleDeleteFile = useCallback(async (fileId, fileName) => {
        if (window.confirm(`Delete "${fileName}"?`)) {
            try {
                await deleteUserFile(fileId);
                showSuccess(`File "${fileName}" deleted successfully!`);
                loadUserFiles();
                // Remove from selected files if it was selected
                setSelectedFiles(prev => prev.filter(id => id !== fileId));
            } catch (err) {
                const errorMessage = err.response?.data?.message || err.message || 'Unknown error';
                setFileError('Failed to delete file');
                showError(`Failed to delete "${fileName}": ${errorMessage}`);
            }
        }
    }, [loadUserFiles, showSuccess, showError]);

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
        setIsProcessing(true);
        setFileError('');

        try {
            // Add user action message to chat
            const userMessage = {
                id: uuidv4(),
                role: 'user',
                parts: [{ text: `🎙️ Generate podcast for "${fileName}"` }],
                timestamp: new Date()
            };
            setMessages(prev => [...prev, userMessage]);

            console.log('Generating podcast for file:', fileId, fileName);
            console.log(`🎙️ Using model: ${selectedModel} for podcast generation`);
            const response = await generatePodcast(fileId, 'single-host', selectedModel);
            console.log('Podcast response:', response);

            if (response.data && response.data.success) {
                // Add podcast content to chat messages
                const podcastMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    parts: [{ text: response.data.script || response.data.podcastScript || response.data.content || 'Podcast generated successfully!' }],
                    timestamp: new Date(),
                    type: 'podcast',
                    fileName: fileName,
                    audioUrl: response.data.audioUrl,
                    hasAudio: !!response.data.audioUrl,
                    fileSize: response.data.fileSize,
                    duration: response.data.duration_estimate,
                    script: response.data.script
                };
                setMessages(prev => [...prev, podcastMessage]);

                const successMessage = response.data.audioUrl
                    ? `Podcast MP3 generated successfully for "${fileName}"! Audio player and transcript displayed in chat.`
                    : `Podcast script generated for "${fileName}"! Content displayed in chat.`;
                showSuccess(successMessage);
            } else {
                throw new Error(response.data?.message || 'Unknown error');
            }
        } catch (err) {
            console.error('Podcast generation error:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Failed to generate podcast';

            // Check if it's a quota/rate limit error
            if (err.response?.status === 429 || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
                showWarning(`API quota exceeded for "${fileName}". Using fallback podcast generation...`);

                // Fallback: Generate a simple text-based podcast script
                const fallbackScript = `🎙️ PODCAST SCRIPT FOR: ${fileName}

Welcome to your AI-generated podcast! This is a fallback version created when our advanced AI services are temporarily unavailable.

📄 Document: ${fileName}
🤖 Generated by: TutorAI Fallback System
⏰ Generated at: ${new Date().toLocaleString()}

To listen to this content:
1. Use your browser's built-in text-to-speech feature
2. Select the text and use "Speak" or similar option
3. Or copy this text to any text-to-speech application

This fallback ensures you can still access podcast-style content even when our premium AI services are temporarily unavailable.

Thank you for using TutorAI!`;

                // Create a downloadable text file
                const blob = new Blob([fallbackScript], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `podcast-${fileName}-fallback.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                // Also add fallback content to chat
                const fallbackMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    parts: [{ text: fallbackScript }],
                    timestamp: new Date(),
                    type: 'podcast-fallback',
                    fileName: fileName
                };
                setMessages(prev => [...prev, fallbackMessage]);
                showSuccess(`Fallback podcast script generated for "${fileName}"! Content displayed in chat and file downloaded.`);
            } else {
                setFileError(`Podcast Error: ${errorMessage}`);
                showError(`Failed to generate podcast for "${fileName}": ${errorMessage}`);
            }
        } finally {
            setIsProcessing(false);
        }
    }, [showSuccess, showError, showWarning]);

    const handleGenerateMindMap = useCallback(async (fileId, fileName) => {
        setIsProcessing(true);
        setFileError('');

        try {
            // Add user action message to chat
            const userMessage = {
                id: uuidv4(),
                role: 'user',
                parts: [{ text: `🧠 Generate mind map for "${fileName}"` }],
                timestamp: new Date()
            };
            setMessages(prev => [...prev, userMessage]);

            console.log('Generating mind map for file:', fileId, fileName);
            console.log(`🧠 Using model: ${selectedModel} for mind map generation`);
            const response = await generateMindMap(fileId, selectedModel);
            console.log('Mind map response:', response);

            if (response.data && response.data.mermaidData) {
                // Use file content from server response
                const fileContent = response.data.fileContent || '';

                // Add mindmap content to chat messages
                const mindmapMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    parts: [{ text: `## 🧠 Mind Map for "${fileName}"\n\n\`\`\`mermaid\n${response.data.mermaidData}\n\`\`\`` }],
                    timestamp: new Date(),
                    type: 'mindmap',
                    fileName: fileName,
                    mermaidData: response.data.mermaidData,
                    fileContent: fileContent
                };
                setMessages(prev => [...prev, mindmapMessage]);
                showSuccess(`Mind map generated successfully for "${fileName}"! Interactive diagram displayed in chat.`);
            } else {
                throw new Error('No mind map data received');
            }
        } catch (err) {
            console.error('Mind map generation error:', err);
            const errorMessage = err.response?.data?.message || err.message || 'Failed to generate mind map';

            // Check if it's a quota/rate limit error
            if (err.response?.status === 429 || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
                showWarning(`API quota exceeded for "${fileName}". Using fallback mind map generation...`);

                // Fallback: Generate a simple text-based mind map
                const fallbackMindMap = `graph TD
    A["📄 ${fileName}"] --> B["📚 Document Analysis"]
    A --> C["🔍 Key Topics"]
    A --> D["💡 Main Ideas"]

    B --> B1["📊 Content Structure"]
    B --> B2["📝 Summary Points"]
    B --> B3["🎯 Focus Areas"]

    C --> C1["🏷️ Primary Themes"]
    C --> C2["🔗 Connections"]
    C --> C3["📋 Categories"]

    D --> D1["💭 Core Concepts"]
    D --> D2["🚀 Action Items"]
    D --> D3["📈 Insights"]

    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#e8f5e8
    style D fill:#fff3e0`;

                // Create a downloadable Mermaid file
                const blob = new Blob([fallbackMindMap], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `mindmap-${fileName}-fallback.mmd`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                // Also add fallback content to chat
                const fallbackMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    parts: [{ text: `## 🧠 Mind Map for "${fileName}" (Fallback)\n\n\`\`\`mermaid\n${fallbackMindMap}\n\`\`\`` }],
                    timestamp: new Date(),
                    type: 'mindmap-fallback',
                    fileName: fileName,
                    mermaidData: fallbackMindMap
                };
                setMessages(prev => [...prev, fallbackMessage]);
                showSuccess(`Fallback mind map generated for "${fileName}"! Diagram displayed in chat and Mermaid file downloaded.`);
            } else {
                setFileError(`Mind Map Error: ${errorMessage}`);
                showError(`Failed to generate mind map for "${fileName}": ${errorMessage}`);
            }
        } finally {
            setIsProcessing(false);
        }
    }, [showSuccess, showError, showWarning]);

    const handleGenerateFAQ = useCallback(async (fileId, fileName) => {
        setIsProcessing(true);
        setFileError('');

        try {
            // Add user action message to chat
            const userMessage = {
                id: uuidv4(),
                role: 'user',
                parts: [{ text: `❓ Generate FAQs for "${fileName}"` }],
                timestamp: new Date()
            };
            setMessages(prev => [...prev, userMessage]);

            console.log('Generating FAQs for file:', fileId, fileName);
            console.log('User ID:', userId);

            // Call the FAQ generation API
            const requestBody = {
                fileId: fileId,
                fileName: fileName
            };

            console.log('FAQ API request:', requestBody);
            console.log('FAQ API headers:', { 'X-User-ID': userId });

            const response = await fetch('/api/files/generate-faq', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': userId
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to generate FAQs');
            }

            // Format FAQs as a chat message
            const faqText = data.faqs.map((faq, index) =>
                `**Q${index + 1}: ${faq.question}**\n\n${faq.answer}\n\n---\n`
            ).join('\n');

            const faqMessage = {
                id: uuidv4(),
                role: 'assistant',
                parts: [{
                    text: `# 📋 FAQs for "${fileName}"\n\n${faqText}\n\n*Generated ${data.faqs.length} frequently asked questions from the document content.*`
                }],
                timestamp: new Date(),
                metadata: {
                    type: 'faq-generation',
                    fileName: fileName,
                    fileId: fileId,
                    faqCount: data.faqs.length
                }
            };

            setMessages(prev => [...prev, faqMessage]);
            showSuccess(`Generated ${data.faqs.length} FAQs for "${fileName}"! FAQs displayed in chat.`);

        } catch (error) {
            console.error('FAQ generation error:', error);
            const errorMessage = error.message || 'Unknown error occurred';

            // Add error message to chat
            const errorChatMessage = {
                id: uuidv4(),
                role: 'assistant',
                parts: [{ text: `❌ **FAQ Generation Failed**\n\nSorry, I couldn't generate FAQs for "${fileName}". ${errorMessage}` }],
                timestamp: new Date(),
                metadata: { type: 'error', action: 'faq-generation' }
            };
            setMessages(prev => [...prev, errorChatMessage]);

            setFileError(`FAQ Generation Error: ${errorMessage}`);
            showError(`Failed to generate FAQs for "${fileName}": ${errorMessage}`);
        } finally {
            setIsProcessing(false);
        }
    }, [userId, showSuccess, showError]);

    // History modal handlers
    const handleLoadSession = useCallback(async (sessionId) => {
        try {
            setIsProcessing(true);
            console.log('Loading session:', sessionId);

            // Import the API function
            const { getSessionDetails } = await import('../services/api');
            const response = await getSessionDetails(sessionId);

            if (response.data) {
                // Load the session data
                setMessages(response.data.messages || []);
                setSessionId(response.data.sessionId);
                setError('');

                // Close sidebar on mobile after loading
                if (window.innerWidth <= 768) {
                    setIsSidebarOpen(false);
                }

                showSuccess(`Session "${response.data.title || 'Chat'}" loaded successfully!`);
                console.log('Session loaded successfully:', response.data.title);
            }
        } catch (err) {
            console.error('Failed to load session:', err);
            setError(`Failed to load session: ${err.response?.data?.message || err.message}`);
        } finally {
            setIsProcessing(false);
        }
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
            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            {/* Mobile Overlay */}
            {isSidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}

            {/* Sidebar */}
            <div
                className={`sidebar-area ${isSidebarOpen || isSidebarHovered ? 'open' : ''}`}
                onMouseEnter={() => setIsSidebarHovered(true)}
                onMouseLeave={() => setIsSidebarHovered(false)}
            >
                {/* Sidebar Icon Navigation */}
                <div className="sidebar-icon-nav">
                    {/* Hamburger Menu Button */}
                    <button
                        className="sidebar-icon-item hamburger-menu-btn"
                        onClick={toggleSidebar}
                        title="Toggle sidebar"
                    >
                        <FaBars />
                    </button>

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
                                onGenerateFAQ={handleGenerateFAQ}
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
                                <h4 className="settings-section-title">ASSISTANT MODE</h4>

                                {/* Tutor Mode Selection - Main Dropdown */}
                                <div className="setting-item">
                                    <TutorModeSelector
                                        selectedMode={selectedTutorMode}
                                        onModeChange={handleTutorModeChange}
                                        isSidebarOpen={isSidebarOpen || isSidebarHovered}
                                    />
                                </div>

                                {/* AI Model Selection */}
                                <div className="setting-item">
                                    <label>AI Model Selection</label>
                                    <ModelSwitcher
                                        selectedModel={selectedModel}
                                        onModelChange={handleModelChange}
                                        isSidebarOpen={isSidebarOpen || isSidebarHovered}
                                        userId={userId}
                                    />
                                </div>
                            </div>

                            {/* API Keys Section */}
                            <div className="settings-section">
                                <h4 className="settings-section-title">API Configuration</h4>
                                <div className="setting-item">
                                    <label>API Keys Setup</label>
                                    <button
                                        className="config-btn"
                                        onClick={() => setShowApiKeyManager(!showApiKeyManager)}
                                    >
                                        {showApiKeyManager ? 'Hide API Keys' : 'Show API Keys'}
                                    </button>
                                </div>
                                {showApiKeyManager && (
                                    <div className="api-key-manager-container">
                                        <ApiKeyManager
                                            userId={userId}
                                            isSidebarOpen={isSidebarOpen || isSidebarHovered}
                                        />
                                    </div>
                                )}
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
            <div className={`chat-container ${(isSidebarOpen || isSidebarHovered) ? 'sidebar-expanded' : ''}`}>
                <header className="chat-header">
                    <div className="header-left">
                        {/* Mobile Hamburger Button */}
                        <button className="mobile-hamburger-btn" onClick={toggleSidebar} title="Toggle sidebar">
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
                                        {/* Special handling for podcast messages with audio */}
                                        {msg.type === 'podcast' && msg.hasAudio && msg.audioUrl ? (
                                            <div className="podcast-message">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {`## 🎙️ Podcast: ${msg.fileName}\n\n**Duration:** ${msg.duration || 'Unknown'}`}
                                                </ReactMarkdown>

                                                <div className="audio-player-section">
                                                    <h4>🔊 Audio Player</h4>
                                                    <audio
                                                        controls
                                                        style={{width: '100%', margin: '10px 0'}}
                                                        preload="metadata"
                                                    >
                                                        <source src={`http://localhost:5007${msg.audioUrl}`} type="audio/mpeg" />
                                                        Your browser does not support the audio element.
                                                    </audio>
                                                    <p><strong>File Size:</strong> {msg.fileSize || 'Unknown'}</p>
                                                    <p><em>💡 You can download the MP3 by right-clicking the audio player and selecting "Save audio as..."</em></p>
                                                </div>

                                                <div className="transcript-section">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {`---\n\n### 📝 Transcript\n\n${msg.parts[0]?.text?.split('📝 Transcript')[1]?.replace(/^[\n\r]+/, '') || msg.script || 'Transcript not available'}`}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        ) : (msg.type === 'mindmap' || msg.type === 'mindmap-fallback') && msg.mermaidData ? (
                                            <div className="mindmap-message">
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {`## 🧠 Mind Map: ${msg.fileName}`}
                                                </ReactMarkdown>

                                                <div className="mindmap-container">
                                                    <MindMap
                                                        mermaidData={msg.mermaidData}
                                                        fileContent={msg.fileContent || ''}
                                                    />
                                                </div>

                                                <div className="mindmap-info">
                                                    <p><em>💡 Click on any node in the mind map to explore details about that section.</em></p>
                                                    {msg.type === 'mindmap-fallback' && (
                                                        <p><em>⚠️ This is a fallback mind map due to API limitations. A Mermaid file has been downloaded for advanced editing.</em></p>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                rehypePlugins={[rehypeRaw]}
                                                components={{
                                                    // Custom download link handler
                                                    a: ({node, ...props}) => (
                                                        <DownloadLink {...props} />
                                                    ),
                                                    // Custom styling for embedded content
                                                    iframe: ({node, ...props}) => (
                                                        <div className="video-container" style={{margin: '10px 0', textAlign: 'center'}}>
                                                            <iframe
                                                                {...props}
                                                                style={{maxWidth: '100%', height: '315px', width: '560px'}}
                                                                allowFullScreen
                                                            />
                                                        </div>
                                                    ),
                                                    video: ({node, ...props}) => (
                                                        <video controls style={{maxWidth: '100%', margin: '10px 0'}} {...props} />
                                                    ),
                                                    audio: ({node, ...props}) => (
                                                        <audio controls style={{width: '100%', margin: '10px 0'}} {...props} />
                                                    )
                                                }}
                                            >
                                                {messageText}
                                            </ReactMarkdown>
                                        )}
                                        {metadata.searchType && metadata.searchType !== 'standard' && (
                                            <div className="message-metadata">
                                                <div className="search-type-badge">
                                                    {metadata.searchType === 'rag' && <><FaDatabase /> RAG Search</>}
                                                    {metadata.searchType === 'deep-search' && <><FaSearch /> Deep Search</>}
                                                    {metadata.searchType === 'enhanced-deep-search-v2' && <><FaSearch /> Enhanced Deep Search</>}
                                                    {metadata.enhanced && <span className="enhanced-badge">Enhanced</span>}
                                                    {metadata.hasRichMedia && <span className="rich-media-badge">Rich Media</span>}
                                                </div>
                                                {metadata.sources && metadata.sources.length > 0 && (
                                                    <div className="sources">
                                                        <small>Sources: {metadata.sources.map(source =>
                                                            typeof source === 'string' ? source :
                                                            source?.title || source?.url || 'Unknown Source'
                                                        ).join(', ')}</small>
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

                                        {/* MCP Action Verification */}
                                        {msg.role === 'assistant' && msg.verification && (
                                            <div className="verification-indicator">
                                                {msg.verification.real_action ? (
                                                    <span className="real-action-badge">
                                                        ✅ REAL ACTION PERFORMED
                                                    </span>
                                                ) : (
                                                    <span className="simulated-action-badge">
                                                        ⚠️ SIMULATED ACTION
                                                    </span>
                                                )}

                                                {/* Show verification details */}
                                                {!msg.verification.real_action && msg.verification.simulation_reason && (
                                                    <div className="simulation-reason">
                                                        <small>Reason: {msg.verification.simulation_reason}</small>
                                                    </div>
                                                )}

                                                {msg.verification.real_action && msg.verification.github_url && (
                                                    <div className="real-action-link">
                                                        <a href={msg.verification.github_url} target="_blank" rel="noopener noreferrer">
                                                            🔗 View on GitHub
                                                        </a>
                                                    </div>
                                                )}

                                                {msg.verification.real_action && msg.verification.calendar_link && (
                                                    <div className="real-action-link">
                                                        <a href={msg.verification.calendar_link} target="_blank" rel="noopener noreferrer">
                                                            📅 View in Calendar
                                                        </a>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* MCP Agent Suggestions */}
                                        {msg.role === 'assistant' && metadata.suggestions && metadata.suggestions.length > 0 && (
                                            <div className="mcp-suggestions">
                                                <div className="suggestions-header">
                                                    <small>💡 Try asking:</small>
                                                </div>
                                                <div className="suggestion-chips">
                                                    {metadata.suggestions.map((suggestion, idx) => (
                                                        <button
                                                            key={idx}
                                                            className="suggestion-chip"
                                                            onClick={() => setInputText(suggestion)}
                                                            disabled={isProcessing}
                                                        >
                                                            {suggestion}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {/* Rich Media Content for Enhanced Deep Search V2 */}
                                        {msg.role === 'assistant' && metadata.searchType === 'enhanced-deep-search-v2' && (
                                            <div className="enhanced-media-content">
                                                {/* Enhanced Video Player */}
                                                {msg.videos && msg.videos.length > 0 && (
                                                    <EnhancedVideoPlayer
                                                        videos={msg.videos}
                                                        query={msg.originalQuery || 'search results'}
                                                    />
                                                )}

                                                {/* Other Media Content */}
                                                <MediaRenderer
                                                    videos={[]} // Videos handled by EnhancedVideoPlayer
                                                    blogs={msg.blogs || []}
                                                    academic={msg.academic || []}
                                                    wikipedia={msg.wikipedia || []}
                                                    documentation={msg.documentation || []}
                                                    sources={msg.sources || []}
                                                />
                                            </div>
                                        )}
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
                    <div className={`input-wrapper ${isRagEnabled ? 'rag-mode' : isDeepSearchEnabled ? 'deep-search-mode' : ''}`}>

                        {/* Mode Selection Buttons - Inside Chat Input Container */}
                        <div className="mode-buttons-inside-chat">
                            <button
                                className={`mode-btn-inside ${isRagEnabled ? 'active' : ''}`}
                                onClick={() => {
                                    setIsRagEnabled(!isRagEnabled);
                                    if (!isRagEnabled) {
                                        setIsDeepSearchEnabled(false);
                                        // MCP works automatically in the background
                                    }
                                }}
                                disabled={isProcessing}
                                title="RAG Mode - Search your uploaded documents"
                            >
                                <FaDatabase className="btn-icon" />
                                <span>RAG Mode</span>
                            </button>

                            <button
                                className={`mode-btn-inside ${isDeepSearchEnabled ? 'active' : ''}`}
                                onClick={() => {
                                    setIsDeepSearchEnabled(!isDeepSearchEnabled);
                                    if (!isDeepSearchEnabled) {
                                        setIsRagEnabled(false);
                                        // MCP works automatically in the background
                                    }
                                }}
                                disabled={isProcessing}
                                title="Deep Search - Web search + document analysis"
                            >
                                <FaSearch className="btn-icon" />
                                <span>Deep Search</span>
                            </button>

                            {/* MCP Agents now work automatically in the background */}
                        </div>

                        {/* File Selection for RAG Mode - Inside Chat Container */}
                        {isRagEnabled && (
                            <div className="rag-file-selection-inside">
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

                        {(isRagEnabled || isDeepSearchEnabled) && (
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
                                {/* MCP Agents work automatically in the background */}
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
                                            : "Ask TutorAi - AI agents work automatically in the background"
                                }
                                disabled={isProcessing}
                                rows={1}
                            />
                            <div className="input-actions">
                                <div className="character-counter">
                                    <span className={inputText.length > 4000 ? 'over-limit' : inputText.length > 3500 ? 'near-limit' : ''}>
                                        {inputText.length}/4000
                                    </span>
                                </div>

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
                                    disabled={isProcessing || !inputText.trim() || inputText.length > 4000}
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

            {/* FAQ generation is now handled directly in chat */}
        </div>
    );
};

export default ChatPage;
