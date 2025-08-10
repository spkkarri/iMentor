import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    sendMessage as apiSendMessage, saveChatHistory,
    loadChatHistory
} from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';
import { FaMicrophone, FaSave, FaCopy, FaStop, FaPaperPlane } from 'react-icons/fa';

import { getPromptTextById } from './SystemPromptWidget';
import FileUploadWidget from './FileUploadWidget';
import MindMap from './MindMap';
import HistoryModal from './HistoryModal';
import ResearchMetadata from './ResearchMetadata';
import ModelSwitcher from './ModelSwitcher';


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
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [currentlySpeakingIndex, setCurrentlySpeakingIndex] = useState(null);

    // Sidebar tab state - default to 'files' to show My Files tab actively
    const [activeTab, setActiveTab] = useState('files'); // 'settings', 'files', 'recents'

    // Theme and sidebar state
    const [isDarkTheme, setIsDarkTheme] = useState(() => {
        const saved = localStorage.getItem('isDarkTheme');
        return saved ? JSON.parse(saved) : false;
    });
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('isSidebarOpen');
        return saved ? JSON.parse(saved) : true;
    });

    // Model switching state
    const [selectedModel, setSelectedModel] = useState(() => {
        // Persist selected model in localStorage
        const saved = localStorage.getItem('selectedModel');
        return saved || 'gemini-flash';
    });
    const [isMultiLLMEnabled, setIsMultiLLMEnabled] = useState(() => {
        // Persist Multi-LLM state in localStorage
        const saved = localStorage.getItem('multiLLMEnabled');
        return saved !== null ? JSON.parse(saved) : false;
    });

    // MCP state
    const [isMcpEnabled] = useState(false);

    const messagesEndRef = useRef(null);
    const recognitionRef = useRef(null);
    const navigate = useNavigate();
    const isProcessing = Object.values(loadingStates).some(Boolean);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    // Persist RAG state to localStorage
    useEffect(() => {
        localStorage.setItem('ragEnabled', JSON.stringify(isRagEnabled));
    }, [isRagEnabled]);

    // Persist DeepSearch state to localStorage
    useEffect(() => {
        localStorage.setItem('deepSearchEnabled', JSON.stringify(isDeepSearchEnabled));
    }, [isDeepSearchEnabled]);

    // Persist WebSearch state to localStorage
    useEffect(() => {
        localStorage.setItem('webSearchEnabled', JSON.stringify(isWebSearchEnabled));
    }, [isWebSearchEnabled]);

    // Persist selected model to localStorage
    useEffect(() => {
        localStorage.setItem('selectedModel', selectedModel);
    }, [selectedModel]);

    // Persist Multi-LLM state to localStorage
    useEffect(() => {
        localStorage.setItem('multiLLMEnabled', JSON.stringify(isMultiLLMEnabled));
    }, [isMultiLLMEnabled]);

    // Persist theme state to localStorage
    useEffect(() => {
        localStorage.setItem('isDarkTheme', JSON.stringify(isDarkTheme));
        document.body.className = isDarkTheme ? 'dark-theme' : 'light-theme';
    }, [isDarkTheme]);

    // Persist sidebar state to localStorage
    useEffect(() => {
        localStorage.setItem('isSidebarOpen', JSON.stringify(isSidebarOpen));
    }, [isSidebarOpen]);

    // Persist MCP state to localStorage
    useEffect(() => {
        localStorage.setItem('mcpEnabled', JSON.stringify(isMcpEnabled));
    }, [isMcpEnabled]);

    // Theme toggle
    const toggleTheme = useCallback(() => {
        setIsDarkTheme(prev => !prev);
    }, []);

    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => {
            const newValue = !prev;
            localStorage.setItem('isSidebarOpen', JSON.stringify(newValue));
            return newValue;
        });
    }, []);

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
                } else if (metadata.searchType === 'standard_deep_search' || metadata.searchType === 'enhanced_deep_search' || metadata.searchType === 'gemini_style_search') {
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

    // Handle model change
    const handleModelChange = useCallback((model) => {
        console.log('🔄 Switching to model:', model.name);
        setSelectedModel(model.id);

        // Enable Multi-LLM if selecting a Multi-LLM model
        if (model.isMultiLLM || model.isOllama) {
            setIsMultiLLMEnabled(true);
        } else {
            setIsMultiLLMEnabled(false);
        }

        // Show notification
        const notification = document.createElement('div');
        notification.className = 'model-switch-notification';
        notification.textContent = `Switched to ${model.name}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }, []);

    // MCP search handler
    const handleMcpSearch = useCallback(async (query) => {
        if (!query.trim() || isProcessing) return;

        const newUserMessage = { id: uuidv4(), role: 'user', parts: [{ text: query.trim() }], timestamp: new Date() };
        setMessages(prev => [...prev, newUserMessage]);
        setError('');
        setLoadingStates(prev => ({ ...prev, chat: true }));

        try {
            console.log('🤖 MCP search enabled for query:', query);

            const response = await fetch('/api/agents/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: query.trim(),
                    history: [...messages, newUserMessage],
                    sessionId,
                    systemPrompt: editableSystemPromptText
                })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'MCP search failed');

            const assistantMessage = {
                id: uuidv4(),
                role: 'assistant',
                parts: [{ text: `🤖 **MCP Agents Active** - Enhanced AI search and analysis.\n\n${data.data.response}` }],
                timestamp: new Date(),
                metadata: data.data.metadata
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            console.error('MCP search error:', err);
            setError(err.message || 'MCP search failed');
            setMessages(prev => prev.slice(0, -1)); // Remove user message on error
        } finally {
            setLoadingStates(prev => ({ ...prev, chat: false }));
        }
    }, [messages, sessionId, editableSystemPromptText, isProcessing]);

    const handleSendMessage = useCallback(async (e, overrideInput = null) => {
        if (e) e.preventDefault();
        const trimmedInput = (overrideInput || inputText).trim();
        if (!trimmedInput || isProcessing) return;
        if (loadingStates.listening) recognitionRef.current?.stop();

        // Check if MCP is enabled and handle MCP search
        if (isMcpEnabled) {
            return handleMcpSearch(trimmedInput);
        }

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
                ragEnabled: isRagEnabled,        // Pass RAG flag to API
                deepSearch: isDeepSearchEnabled, // Pass deep search flag to API
                autoDetectWebSearch: true,       // Enable automatic web search detection
                multiLLM: isMultiLLMEnabled,     // Enable Multi-LLM routing
                selectedModel: selectedModel     // Pass selected model for reference
            };

            // Add debugging for search modes and show appropriate loading message
            if (isRagEnabled) {
                console.log('📚 RAG enabled for query:', trimmedInput);
            } else if (isDeepSearchEnabled) {
                console.log('🔍 Real-Time DeepSearch enabled for query:', trimmedInput);
                // Add a temporary loading message for Deep Search
                const loadingMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    parts: [{ text: '🔍 **Searching the web in real-time...** \n\nFinding the latest information from multiple sources...' }],
                    timestamp: new Date(),
                    isLoading: true
                };
                setMessages(prev => [...prev, loadingMessage]);
            } else {
                console.log('🤖 Auto-detection enabled for query:', trimmedInput);
            }

            const response = await apiSendMessage(payload);

            // Check if search was actually used and provide feedback
            const metadata = response.data.metadata;
            let responseText = response.data.response;

            if (isRagEnabled && metadata && metadata.searchType && metadata.searchType.includes('rag')) {
                console.log('📚 RAG metadata:', metadata);
                const sourceCount = metadata.sources ? metadata.sources.length : 0;
                if (metadata.searchType === 'rag_no_documents') {
                    responseText = `📚 **RAG active** - No sufficiently relevant documents found (relevance threshold: 40%).\n\n${responseText}`;
                } else {
                    responseText = `📚 **RAG active** - Found ${sourceCount} highly relevant document sources.\n\n${responseText}`;
                }
            } else if (isDeepSearchEnabled && metadata) {
                console.log('🔍 DeepSearch metadata:', metadata);

                // Enhanced indicators for real-time deep search
                if (metadata.searchType === 'gemini_style_search') {
                    const sourceCount = metadata.sources ? metadata.sources.length : 0;
                    const searchTime = metadata.searchTime ? `${metadata.searchTime}ms` : 'unknown time';
                    responseText = `🔍 **Real-Time Deep Search** - Found ${sourceCount} sources in ${searchTime}.\n\n${responseText}`;
                } else if (metadata.searchType === 'real_time_search_error') {
                    responseText = `⚠️ **Deep Search unavailable** - Using standard response.\n\n${responseText}`;
                } else if (metadata.searchType === 'quota_exceeded_fallback') {
                    responseText = `⚠️ **DeepSearch quota exceeded** - Using fallback response.\n\n${responseText}`;
                } else if (metadata.searchType === 'offline_deep_search') {
                    responseText = `🔄 **DeepSearch offline mode** - Limited web access.\n\n${responseText}`;
                } else if (metadata.searchType === 'standard_deep_search') {
                    responseText = `✅ **DeepSearch active** - Enhanced with web research.\n\n${responseText}`;
                }
            } else if (metadata && (metadata.searchType === 'auto_web_search' || metadata.searchType === 'manual_web_search')) {
                console.log('🔍 Auto web search metadata:', metadata);

                // Show automatic web search indicators
                const sourceCount = metadata.sources ? metadata.sources.length : 0;
                const searchTime = metadata.searchTime ? `${metadata.searchTime}ms` : 'unknown time';
                const confidence = metadata.confidence || 'medium';

                responseText = `🔍 **Web search automatically activated** - Found ${sourceCount} sources in ${searchTime} (${confidence} confidence).\n\n${responseText}`;

            } else if ((isRagEnabled || isDeepSearchEnabled) && !metadata) {
                const searchType = isRagEnabled ? 'RAG' : 'DeepSearch';
                console.warn(`${searchType} was enabled but no metadata returned - may have fallen back to standard chat`);
                responseText = `⚠️ **${searchType} unavailable** - Using standard chat mode.\n\n${responseText}`;
            }

            const assistantMessage = {
                id: uuidv4(),
                role: 'assistant',
                parts: [{ text: responseText }],
                followUpQuestions: response.data.followUpQuestions || [],
                timestamp: new Date(),
                metadata: metadata,
                downloadUrl: response.data.downloadUrl,
                fileName: response.data.fileName,
                documentType: response.data.documentType
            };

            // Remove loading message and add real response
            if (isDeepSearchEnabled) {
                setMessages(prev => {
                    // Remove the loading message and add the real response
                    const withoutLoading = prev.filter(msg => !msg.isLoading);
                    return [...withoutLoading, assistantMessage];
                });
            } else {
                setMessages(prev => [...prev, assistantMessage]);
            }
        } catch (err) {
            console.error('Chat error:', err);

            // Enhanced error handling for search modes and Ollama service
            let errorMessage = err.response?.data?.error || err.response?.data?.message || 'Chat error.';

            if (err.response?.status === 503 && err.response?.data?.suggestedAction === 'switch_to_gemini') {
                // Ollama service unavailable
                errorMessage = `🦙 ${err.response.data.message}\n\n💡 Available models: ${err.response.data.availableModels?.join(', ') || 'Gemini models'}`;
            } else if (isDeepSearchEnabled && err.response?.status === 404) {
                errorMessage = 'DeepSearch found no relevant results. Try rephrasing your question or disable DeepSearch for a general response.';
            } else if (isDeepSearchEnabled && err.response?.status === 500) {
                errorMessage = 'DeepSearch service encountered an error. The service may be temporarily unavailable.';
            }

            setError(errorMessage);
            setMessages(prev => prev.slice(0, -1));
            if (err.response?.status === 401) handleLogout(true);
        } finally {
            setLoadingStates(prev => ({ ...prev, chat: false }));
        }
    }, [inputText, isProcessing, loadingStates, messages, sessionId, editableSystemPromptText, isRagEnabled, isDeepSearchEnabled, isMcpEnabled, isMultiLLMEnabled, selectedModel, handleLogout, handleMcpSearch]);

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
                ragEnabled: isRagEnabled,        // Pass RAG flag to API
                deepSearch: isDeepSearchEnabled, // Pass deep search flag to API
                webSearch: isWebSearchEnabled   // Pass web search flag to API
            };

            // Add debugging for search modes
            if (isRagEnabled) {
                console.log('📚 RAG enabled for edited query:', editingMessage.text);
            } else if (isDeepSearchEnabled) {
                console.log('🔍 DeepSearch enabled for edited query:', editingMessage.text);
            } else if (isWebSearchEnabled) {
                console.log('🌐 WebSearch enabled for edited query:', editingMessage.text);
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
                metadata: metadata,
                downloadUrl: response.data.downloadUrl,
                fileName: response.data.fileName,
                documentType: response.data.documentType
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            console.error('Chat error during edit:', err);

            // Enhanced error handling for DeepSearch and Ollama service
            let errorMessage = err.response?.data?.error || err.response?.data?.message || 'Chat error.';

            if (err.response?.status === 503 && err.response?.data?.suggestedAction === 'switch_to_gemini') {
                // Ollama service unavailable
                errorMessage = `🦙 ${err.response.data.message}\n\n💡 Available models: ${err.response.data.availableModels?.join(', ') || 'Gemini models'}`;
            } else if (isDeepSearchEnabled && err.response?.status === 404) {
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

    const playPodcast = useCallback((script, index) => {
        if (!('speechSynthesis' in window)) {
            setError('Text-to-speech not supported in your browser.');
            return;
        }

        // If already playing this podcast, pause it
        if (currentlySpeakingIndex === index) {
            if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
                window.speechSynthesis.pause();
                setCurrentlySpeakingIndex(null);
            } else if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
                setCurrentlySpeakingIndex(index);
            }
            return;
        }

        // Stop any current speech and start new podcast
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(script);
        utterance.rate = 0.9; // Slightly slower for better comprehension
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onstart = () => setCurrentlySpeakingIndex(index);
        utterance.onend = () => setCurrentlySpeakingIndex(null);
        utterance.onerror = () => {
            setError('Podcast playback error.');
            setCurrentlySpeakingIndex(null);
        };

        setCurrentlySpeakingIndex(index);
        window.speechSynthesis.speak(utterance);
    }, [currentlySpeakingIndex]);

    const stopPodcast = useCallback(() => {
        window.speechSynthesis.cancel();
        setCurrentlySpeakingIndex(null);
    }, []);

    const handleUploadSuccess = useCallback(async (newFile) => {
        console.log('File uploaded:', newFile);
    }, []);

    const handleGenerateMindMap = useCallback(async (fileId, fileName) => {
        setLoadingStates(prev => ({ ...prev, mindMap: true }));
        const tempMessageId = uuidv4();
        setMessages(prev => [...prev, { id: tempMessageId, role: 'system', type: 'system-info', parts: [{ text: `*Generating mind map for "${fileName}"...*` }], timestamp: new Date() }]);
        try {
            console.log(`🧠 Generating mind map for file: ${fileName} (ID: ${fileId})`);
            const response = await generateMindMap(fileId);
            console.log(`🧠 Mind map API response:`, response.data);

            if (response.data && response.data.mermaidData) {
                console.log(`🧠 Mermaid data received:`, response.data.mermaidData);
                const mindMapMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    type: 'mindmap',
                    parts: [{ text: `🧠 **Mind Map Generated for "${fileName}"**\n\nClick on any node in the mind map below to explore details.` }],
                    mermaidData: response.data.mermaidData,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev.filter(m => m.id !== tempMessageId), mindMapMessage]);
            } else {
                console.error('🧠 No mermaidData in response:', response.data);
                const errorMessage = { id: uuidv4(), role: 'system', type: 'error', parts: [{ text: `*Error: No mind map data received for "${fileName}"*` }], timestamp: new Date() };
                setMessages(prev => [...prev.filter(m => m.id !== tempMessageId), errorMessage]);
            }
        } catch (err) {
            const errorMessage = { id: uuidv4(), role: 'system', type: 'error', parts: [{ text: `*Error generating mind map for "${fileName}": ${err.response?.data?.message || 'Failed'}` }], timestamp: new Date() };
            setMessages(prev => [...prev.filter(m => m.id !== tempMessageId), errorMessage]);
        } finally {
            setLoadingStates(prev => ({ ...prev, mindMap: false }));
        }
    }, []);

    const handleGeneratePodcast = useCallback(async (fileId, fileName) => {
        setLoadingStates(prev => ({ ...prev, podcast: true }));
        const tempMessageId = uuidv4();
        setMessages(prev => [...prev, { id: tempMessageId, role: 'system', type: 'system-info', parts: [{ text: `*Generating podcast for "${fileName}"...*` }], timestamp: new Date() }]);

        try {
            console.log(`🎙️ Generating podcast for file: ${fileName} (ID: ${fileId})`);
            const response = await generatePodcast(fileId, 'single-host');

            if (response.data && response.data.success) {
                // Show success message with podcast player
                const podcastData = response.data;
                const podcastMessage = {
                    id: uuidv4(),
                    role: 'assistant',
                    type: 'podcast',
                    parts: [{ text: `🎙️ **Podcast Generated: ${podcastData.title}**\n\nDuration: ${podcastData.duration_estimate || podcastData.estimated_duration}\n\nClick the play button below to listen to the podcast.` }],
                    podcastData: podcastData,
                    timestamp: new Date()
                };
                setMessages(prev => [...prev.filter(m => m.id !== tempMessageId), podcastMessage]);
            } else {
                const errorMessage = { id: uuidv4(), role: 'system', type: 'error', parts: [{ text: `*Error generating podcast for "${fileName}": ${response.data?.error || 'Unknown error'}*` }], timestamp: new Date() };
                setMessages(prev => [...prev.filter(m => m.id !== tempMessageId), errorMessage]);
            }
        } catch (err) {
            console.error('Podcast generation error:', err);
            const errorMessage = { id: uuidv4(), role: 'system', type: 'error', parts: [{ text: `*Error generating podcast for "${fileName}": ${err.response?.data?.message || err.message}*` }], timestamp: new Date() };
            setMessages(prev => [...prev.filter(m => m.id !== tempMessageId), errorMessage]);
        } finally {
            setLoadingStates(prev => ({ ...prev, podcast: false }));
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
        <div className={`chat-page-container`} data-theme={isDarkTheme ? 'dark' : 'light'}>
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div className="sidebar-overlay" onClick={toggleSidebar}></div>
            )}

            <div className={`sidebar-area ${isSidebarOpen ? 'open' : ''}`}>
                {/* Sidebar Header */}
                <div className="sidebar-header">
                    <div className="logo-section">
                        <div className="logo-icon">G</div>
                        <h1 className="app-title">Gemini AI</h1>
                    </div>
                    <button className="theme-toggle" onClick={() => setIsDarkTheme(!isDarkTheme)}>
                        {isDarkTheme ? '☀️' : '🌙'}
                    </button>
                </div>

                {/* Sidebar Content */}
                <div className="sidebar-content">
                    {/* Model Switcher */}
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">AI Model</div>
                        <ModelSwitcher
                            selectedModel={selectedModel}
                            onModelChange={handleModelChange}
                            isSidebarOpen={isSidebarOpen}
                            userId={userId}
                        />
                    </div>

                    {/* Quick Actions */}
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
                        <div className="sidebar-item" onClick={() => setActiveTab('settings')}>
                            <div className="sidebar-item-icon">⚙️</div>
                            <div className="sidebar-item-text">Settings</div>
                        </div>
                    </div>

                    {/* Recent Chats */}
                    <div className="sidebar-section">
                        <div className="sidebar-section-title">Recent Chats</div>
                        <div className="sidebar-item" onClick={handleNewChat}>
                            <div className="sidebar-item-icon">✏️</div>
                            <div className="sidebar-item-text">New Chat</div>
                        </div>
                    </div>

                    {/* File Upload */}
                    {activeTab === 'upload' && (
                        <div className="sidebar-section">
                            <div className="sidebar-section-title">Upload Files</div>
                            <FileUploadWidget onUploadSuccess={handleUploadSuccess} />
                        </div>
                    )}

                    {/* Settings */}
                    {activeTab === 'settings' && (
                        <div className="sidebar-section">
                            <div className="sidebar-section-title">Settings</div>
                            <div className="sidebar-item">
                                <div className="sidebar-item-icon">🌙</div>
                                <div className="sidebar-item-text">Dark Mode</div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* Main Chat Container */}
            <div className="chat-container">
                <header className="chat-header">
                    <div className="header-left">
                        <button className="mobile-menu-btn" onClick={toggleSidebar} title="Toggle sidebar">
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
                        const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                        // Debug logging for mind map messages
                        if (msg.type === 'mindmap') {
                            console.log(`🧠 Rendering mindmap message ${index}:`, {
                                type: msg.type,
                                hasMermaidData: !!msg.mermaidData,
                                mermaidDataLength: msg.mermaidData?.length,
                                mermaidDataPreview: msg.mermaidData?.substring(0, 100)
                            });
                        }

                        return (
                            <div key={index} className={`message ${msg.role}`}>
                                <div className={`message-content ${msg.type || ''}`}>
                                    {/* Main message body */}
                                    {msg.type === 'mindmap' && msg.mermaidData ? (
                                        <div>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{messageText}</ReactMarkdown>
                                            <div id={`mindmap-container-${index}`} className="mindmap-container">
                                                <MindMap mermaidData={msg.mermaidData} />
                                            </div>
                                        </div>
                                    ) : msg.type === 'audio' && msg.audioUrl ? (
                                        <div className="audio-player-container">
                                            <p>{messageText}</p>
                                            <audio controls src={msg.audioUrl} />
                                            {/* Removed Join Now button as per user request */}
                                        </div>
                                    ) : msg.type === 'podcast' && msg.podcastData ? (
                                        <div className="podcast-player-container">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{messageText}</ReactMarkdown>
                                            <div className="podcast-controls">
                                                <button
                                                    className="podcast-play-btn"
                                                    onClick={() => playPodcast(msg.podcastData.script, index)}
                                                    disabled={currentlySpeakingIndex === index}
                                                >
                                                    {currentlySpeakingIndex === index ? '⏸️ Pause' : '▶️ Play Podcast'}
                                                </button>
                                                <button
                                                    className="podcast-stop-btn"
                                                    onClick={() => stopPodcast()}
                                                    disabled={currentlySpeakingIndex !== index}
                                                >
                                                    ⏹️ Stop
                                                </button>
                                            </div>
                                            <div className="podcast-script">
                                                <details>
                                                    <summary>📄 View Podcast Script</summary>
                                                    <div className="script-content">
                                                        {msg.podcastData.script}
                                                    </div>
                                                </details>
                                            </div>
                                        </div>
                                    ) : msg.metadata?.searchType === 'document_generation' && msg.downloadUrl ? (
                                        <div className="document-generation-container">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{messageText}</ReactMarkdown>
                                            <div className="document-download-section">
                                                <button
                                                    className="document-download-btn"
                                                    onClick={async () => {
                                                        try {
                                                            const token = localStorage.getItem('token');
                                                            const userId = localStorage.getItem('userId');

                                                            const response = await fetch(msg.downloadUrl, {
                                                                method: 'GET',
                                                                headers: {
                                                                    'Authorization': `Bearer ${token}`,
                                                                    'x-user-id': userId
                                                                }
                                                            });

                                                            if (response.ok) {
                                                                const blob = await response.blob();
                                                                const url = window.URL.createObjectURL(blob);
                                                                const link = document.createElement('a');
                                                                link.href = url;
                                                                link.download = msg.fileName || 'document';
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                                window.URL.revokeObjectURL(url);
                                                            } else {
                                                                console.error('Download failed:', response.statusText);
                                                                alert('Download failed. Please try again.');
                                                            }
                                                        } catch (error) {
                                                            console.error('Download error:', error);
                                                            alert('Download failed. Please try again.');
                                                        }
                                                    }}
                                                >
                                                    📄 Download {msg.documentType?.toUpperCase() || 'Document'}
                                                </button>
                                                <div className="document-info">
                                                    <span className="file-name">📁 {msg.fileName}</span>
                                                    <span className="file-type">{msg.documentType?.toUpperCase()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{messageText}</ReactMarkdown>
                                    )}

                                    {/* RAG Sources Display */}
                                    {msg.role === 'assistant' && msg.metadata && msg.metadata.searchType && msg.metadata.searchType.includes('rag') && msg.metadata.sources && msg.metadata.sources.length > 0 && (
                                        <div className="rag-sources">
                                            <div className="sources-header">
                                                📚 <strong>Sources from uploaded documents:</strong>
                                            </div>
                                            <div className="sources-list">
                                                {msg.metadata.sources.map((source, sourceIndex) => (
                                                    <div key={sourceIndex} className="source-item">
                                                        📄 {source}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="sources-footer">
                                                Found {msg.metadata.documentsFound} relevant document chunks
                                            </div>
                                        </div>
                                    )}

                                    {/* Gemini-Style Deep Search Sources Display */}
                                    {msg.role === 'assistant' && msg.metadata && (msg.metadata.searchType === 'real_time_deep_search' || msg.metadata.searchType === 'gemini_style_search') && msg.metadata.sources && msg.metadata.sources.length > 0 && (
                                        <div className="gemini-search-sources">
                                            <div className="sources-header">
                                                🔍 <strong>Real-time web search results:</strong>
                                                {msg.metadata.confidence && (
                                                    <span className={`confidence-badge confidence-${msg.metadata.confidence}`}>
                                                        {msg.metadata.confidence === 'high' ? '🟢 High Confidence' :
                                                            msg.metadata.confidence === 'medium' ? '🟡 Medium Confidence' : '🟠 Low Confidence'}
                                                    </span>
                                                )}
                                                {msg.metadata.intent && (
                                                    <span className="intent-badge">
                                                        Intent: {msg.metadata.intent.replace('_', ' ')}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="sources-list">
                                                {msg.metadata.sources.map((source, sourceIndex) => (
                                                    <div key={sourceIndex} className="source-item gemini-style">
                                                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="source-link">
                                                            🌐 {source.title}
                                                        </a>
                                                        {source.description && (
                                                            <p className="source-description">{source.description}</p>
                                                        )}
                                                        {source.relevanceScore && (
                                                            <div className="source-meta">
                                                                <span className="relevance-score">Relevance: {source.relevanceScore}</span>
                                                                {source.source && <span className="source-type">Source: {source.source}</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="sources-footer">
                                                🔍 Found {msg.metadata.resultsFound || msg.metadata.sources.length} results
                                                {msg.metadata.searchTime && ` • Search time: ${msg.metadata.searchTime}ms`}
                                                {msg.metadata.searchQueries && ` • Queries: ${msg.metadata.searchQueries.length}`}
                                                • Confidence: {msg.metadata.confidence || 'medium'}
                                            </div>
                                        </div>
                                    )}

                                    {/* Advanced Deep Research Metadata */}
                                    {msg.role === 'assistant' && msg.metadata && (
                                        <ResearchMetadata metadata={msg.metadata} />
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
                                                    <path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z" />
                                                    <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z" />
                                                    <path d="M8.707 11.182A4.486 4.486 0 0 0 10.025 8a4.486 4.486 0 0 0-1.318-3.182L8 5.525A3.489 3.489 0 0 1 9.025 8 3.49 3.49 0 0 1 8 10.475l.707.707zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
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

                {/* Search status notifications */}
                {isDeepSearchEnabled && deepSearchStatus !== 'unknown' && deepSearchStatus !== 'available' && (
                    <div className={`status-notification ${deepSearchStatus}`}>
                        {deepSearchStatus === 'quota_exceeded' && '⚠️ DeepSearch quota exceeded - using fallback responses'}
                        {deepSearchStatus === 'limited' && '🔄 DeepSearch in limited mode - offline search only'}
                        {deepSearchStatus === 'unavailable' && '❌ DeepSearch service temporarily unavailable'}
                    </div>
                )}
                {/* WebSearch removed - now uses automatic detection */}
            </div>
            {showHistoryModal && <HistoryModal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} onLoadSession={handleLoadSession} />}
        </div>
    );
};

export default ChatPage;