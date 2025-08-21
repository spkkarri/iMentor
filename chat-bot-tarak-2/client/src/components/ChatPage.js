import './ChatPage.css';
// client/src/components/ChatPage.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';

// --- Services & Configuration ---
import { refinePrompt, sendMessage, sendAgenticMessage, saveChatHistory, getUserFiles, getUserSettings, streamMessage, generatePpt, getPptDownloadUrl } from '../services/api';
import { LLM_OPTIONS } from '../config/constants';
import { useTheme } from '../context/ThemeContext';

// --- Child Components & Utilities ---
import SystemPromptWidget, { getPromptTextById } from './SystemPromptWidget';
import HistoryModal from './HistoryModal';
import FileUploadWidget from './FileUploadWidget';
import FileManagerWidget from './FileManagerWidget';
import AnalysisResultModal from './AnalysisResultModal';
import VoiceInputButton from './VoiceInputButton';
import QuizView from './QuizView';
import QuizModal from './QuizModal';
import FlashcardSuggestion from './FlashcardSuggestion';
import FlashcardList from './FlashcardList';
import { shouldSuggestFlashcards } from '../utils/flashcardDetection';
import { generateFlashcards } from '../api/generateFlashcards';
import { parseFlashcards } from '../utils/parseFlashcards';
import CompilerView from './CompilerView';
import PptGeneratorPanel from './PptGeneratorPanel';
import GenerationStatusModal from './GenerationStatusModal';


// --- Icons ---
// MODIFICATION: Import the icon for our new input area "Options" button.
import { FiFileText, FiMessageSquare, FiDatabase, FiSettings, FiLogOut, FiSun, FiMoon, FiSend, FiPlus, FiArchive, FiShield, FiDownload, FiHelpCircle, FiCode, FiStar, FiX, FiMic, FiLayout, FiCopy, FiCheck, FiMoreVertical, FiSliders } from 'react-icons/fi';
import { PiMagicWand } from 'react-icons/pi';
import { BsMicFill } from 'react-icons/bs';

// ===================================================================================
//  UI Sub-Components
// ===================================================================================

const AssistantSettingsPanel = (props) => (
    <div className="sidebar-panel">
        <SystemPromptWidget
            selectedPromptId={props.currentSystemPromptId}
            promptText={props.editableSystemPromptText}
            onSelectChange={props.handlePromptSelectChange}
            onTextChange={props.handlePromptTextChange}
        />
        <div className="llm-settings-widget">
            <h4>AI Settings</h4>
            <div className="setting-item">
                <label htmlFor="llm-provider-select">Provider:</label>
                <select id="llm-provider-select" value={props.llmProvider} onChange={props.handleLlmProviderChange} disabled={props.isProcessing}>
                    {Object.keys(LLM_OPTIONS).map(key => (
                        <option key={key} value={key}>{LLM_OPTIONS[key].name}</option>
                    ))}
                </select>
            </div>
            {LLM_OPTIONS[props.llmProvider]?.models.length > 0 && (
                <div className="setting-item">
                    <label htmlFor="llm-model-select">Model:</label>
                    <select id="llm-model-select" value={props.llmModelName} onChange={props.handleLlmModelChange} disabled={props.isProcessing}>
                        {LLM_OPTIONS[props.llmProvider].models.map(model => <option key={model} value={model}>{model}</option>)}
                        <option value="">Provider Default</option>
                    </select>
                </div>
            )}
            <div className="setting-item rag-toggle-container" title="Enable Multi-Query for RAG">
                <label htmlFor="multi-query-toggle">Multi-Query (RAG)</label>
                <input type="checkbox" id="multi-query-toggle" checked={props.enableMultiQuery} onChange={props.handleMultiQueryToggle} disabled={props.isProcessing || !props.isRagEnabled} />
            </div>
        </div>
    </div>
);

const DataSourcePanel = (props) => (
    <div className="sidebar-panel">
        <FileUploadWidget onUploadSuccess={props.triggerFileRefresh} />
        <FileManagerWidget refreshTrigger={props.refreshTrigger} onAnalysisComplete={props.onAnalysisComplete} setHasFiles={props.setHasFiles} onFileSelect={props.onFileSelect} activeFile={props.activeFile}/>
    </div>
);


const ThemeToggleButton = () => {
    const { theme, toggleTheme } = useTheme();
    return (
        <button onClick={toggleTheme} className="header-button theme-toggle-button" title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}>
            {theme === 'light' ? <FiMoon size={20} /> : <FiSun size={20} />}
        </button>
    );
};


// ===================================================================================
//  Main ChatPage Component
// ===================================================================================

const ChatPage = ({ performLogout, initialPanel, isSidePanelOpen, onCloseSidePanel }) => {
    // --- State Management ---
    const [activeView, setActiveView] = useState('ASSISTANT');
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [showGradient, setShowGradient] = useState(true);
    
    useEffect(() => {
        if (initialPanel === 'files') {
            setActiveView('DATA');
        } else if (initialPanel === 'ppt') {
            setActiveView('PPT');
        } else {
            setActiveView('ASSISTANT');
        }
    }, [initialPanel]);

    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [username, setUsername] = useState('');
    const [userRole, setUserRole] = useState(null);
    const [currentSystemPromptId, setCurrentSystemPromptId] = useState('friendly');
    const [editableSystemPromptText, setEditableSystemPromptText] = useState(() => getPromptTextById('friendly'));
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0);
    const [hasFiles, setHasFiles] = useState(false);
    const [isRagEnabled, setIsRagEnabled] = useState(false);
    const [llmProvider, setLlmProvider] = useState('gemini');
    const [llmModelName, setLlmModelName] = useState(LLM_OPTIONS['gemini']?.models[0] || '');
    const [enableMultiQuery, setEnableMultiQuery] = useState(true);
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [analysisModalData, setAnalysisModalData] = useState(null);
    const [activeFile, setActiveFile] = useState(localStorage.getItem('activeFile') || null);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [flashcards, setFlashcards] = useState([]);
    const [showFlashcardSuggestion, setShowFlashcardSuggestion] = useState(false);
    const [alreadySuggested, setAlreadySuggested] = useState({});
    const [isCompilerPopupOpen, setIsCompilerPopupOpen] = useState(false);
    const [isAgentMode, setIsAgentMode] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const [isPptGenerating, setIsPptGenerating] = useState(false);
    const [isPptModalOpen, setIsPptModalOpen] = useState(false);
    const [pptModalStatus, setPptModalStatus] = useState('generating');
    const [pptDownloadUrl, setPptDownloadUrl] = useState('');
    const [pptPreviewContent, setPptPreviewContent] = useState(null);
    const [copiedMessageId, setCopiedMessageId] = useState(null);
    
    // MODIFICATION: New state to manage the visibility of the input area dropdown menu.
    const [isInputMenuOpen, setIsInputMenuOpen] = useState(false);


    // --- Refs & Hooks ---
    const scrollContainerRef = useRef(null);
    const navigate = useNavigate();
    // MODIFICATION: New ref to detect clicks outside the input area menu.
    const inputMenuRef = useRef(null);
    const {
        transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition
    } = useSpeechRecognition();

    useEffect(() => {
        setInputText(transcript);
    }, [transcript]);
    
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowGradient(false);
            setIsInitialLoad(false);
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const initializeApp = async () => {
             try {
                const storedSessionId = localStorage.getItem('sessionId') || uuidv4();
                if (!localStorage.getItem('sessionId')) localStorage.setItem('sessionId', storedSessionId);
                setSessionId(storedSessionId);

                const userRole = localStorage.getItem('userRole');
                const username = localStorage.getItem('username');

                if (!userRole || !username) {
                    performLogout();
                    return;
                }
                setUserRole(userRole);
                setUsername(username);

                // --- START OF NEW LOGIC ---
                // Proactively check if the user has any files on initial load.
                try {
                    const filesResponse = await getUserFiles();
                    const userFiles = filesResponse.data || [];
                    if (userFiles.length > 0) {
                        setHasFiles(true);
                        // Optional: Default RAG to 'on' if files exist. The user can still toggle it.
                        setIsRagEnabled(true); 
                    }
                } catch (fileError) {
                    console.error("Could not check for user files on initial load:", fileError);
                    // Do not set an error message for this, as it's a background check.
                }
                // --- END OF NEW LOGIC ---

                const storedKeys = localStorage.getItem('userApiKeys');
                if (!storedKeys || storedKeys === '{}') {
                    const settingsResponse = await getUserSettings();
                    const settings = settingsResponse.data;
                    if (settings && (settings.geminiApiKey || settings.grokApiKey)) {
                        const keysToStore = { gemini: settings.geminiApiKey, groq: settings.grokApiKey, ollama_host: settings.ollamaHost };
                        localStorage.setItem('userApiKeys', JSON.stringify(keysToStore));
                    }
                }
            } catch (error) {
                console.error("Error during app initialization:", error);
                setError("Could not validate user settings.");
            }
        };
        initializeApp();
    }, [performLogout]);

    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    }, [messages]);

    // MODIFICATION: Add a new useEffect to close the INPUT menu when clicking outside of it.
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (inputMenuRef.current && !inputMenuRef.current.contains(event.target)) {
                setIsInputMenuOpen(false);
            }
        };

        if (isInputMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isInputMenuOpen]);


    // --- Handler Functions ---
    const handlePromptSelectChange = useCallback((newId) => {
        setCurrentSystemPromptId(newId);
        setEditableSystemPromptText(getPromptTextById(newId));
    }, []);
    
    const saveAndReset = useCallback(async (isLoggingOut = false, onCompleteCallback = null) => {
        const messagesToSave = messages.filter(m => m.role && m.parts);
        if (messagesToSave.length > 0) {
            setIsLoading(true);
            setError('');
            try {
                await saveChatHistory({ sessionId: localStorage.getItem('sessionId'), messages: messagesToSave });
            } catch (err)
                {
                setError(`Session Error: ${err.response?.data?.message || 'Failed to save session.'}`);
            }
        }
        
        const newSessionId = uuidv4();
        localStorage.setItem('sessionId', newSessionId);
        setSessionId(newSessionId);
        setMessages([]);
        if (!isLoggingOut) handlePromptSelectChange('friendly');
        setIsLoading(false);
        if (onCompleteCallback) onCompleteCallback();
    }, [messages, handlePromptSelectChange]);
    
    const handleSendMessage = useCallback(async (e) => {
        if (e) e.preventDefault();
        const textToSend = inputText.trim();
        if (!textToSend || isLoading) return;
    
        if (listening) SpeechRecognition.stopListening();
        setIsLoading(true);
        setError('');
        
        const newUserMessage = { role: 'user', parts: [{ text: textToSend }], id: uuidv4(), timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, newUserMessage]);
        setInputText('');
        resetTranscript();
    
        const isRAGOrAgent = isRagEnabled || isAgentMode;
    
        try {
            if (isRAGOrAgent) {
                let response;
                if (isAgentMode) {
                    response = await sendAgenticMessage(textToSend);
                } else { 
                    const messageData = {
                        message: textToSend,
                        history: [...messages, newUserMessage],
                        sessionId: localStorage.getItem('sessionId'),
                        systemPrompt: editableSystemPromptText,
                        isRagEnabled,
                        llmProvider,
                        llmModelName,
                        enableMultiQuery,
                        activeFile,
                    };
                    response = await sendMessage(messageData);
                }
    
                if (!response.data) throw new Error("Invalid response from server.");
    
                const replyData = response.data.reply || {
                    role: 'model',
                    parts: [{ text: response.data.agent_response || "Agent task completed." }],
                    agentTrace: response.data.agent_trace,
                    references: response.data.references || [],
                    thinking: response.data.thinking_content || null,
                    provider: response.data.provider_used,
                    model: response.data.model_used,
                    context_source: response.data.context_source
                };
                const aiReply = { ...replyData, id: uuidv4(), timestamp: new Date().toISOString() };
                setMessages(prev => [...prev, aiReply]);
    
            } else {
                const aiMessageId = uuidv4();
                const emptyAiMessage = { 
                    role: 'model', 
                    parts: [{ text: '' }], 
                    id: aiMessageId, 
                    timestamp: new Date().toISOString(),
                    provider: llmProvider,
                    model: llmModelName,
                    context_source: 'Conversational'
                };
                setMessages(prev => [...prev, emptyAiMessage]);
    
                const messageData = {
                    message: textToSend,
                    history: [...messages, newUserMessage],
                    sessionId: localStorage.getItem('sessionId'),
                    systemPrompt: editableSystemPromptText,
                    llmProvider,
                    llmModelName,
                };
    
                await streamMessage(messageData, (chunk) => {
                    setMessages(prev =>
                        prev.map(msg =>
                            msg.id === aiMessageId
                                ? { ...msg, parts: [{ text: msg.parts[0].text + chunk }] }
                                : msg
                        )
                    );
                });
            }
    
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to get response.';
            setError(`Chat Error: ${errorMessage}`);
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: `Error: ${errorMessage}` }], isError: true, id: uuidv4(), timestamp: new Date().toISOString() }]);
        } finally {
            setIsLoading(false);
        }
    }, [
        inputText, isLoading, listening, messages, resetTranscript,
        isRagEnabled, isAgentMode, editableSystemPromptText, llmProvider, 
        llmModelName, enableMultiQuery, activeFile, sessionId
    ]);

    const handleGeneratePpt = useCallback(async ({ topic, context }) => {
        setIsPptModalOpen(true);
        setPptModalStatus('generating');
        setIsPptGenerating(true);
        setError('');

        try {
            const storedKeys = localStorage.getItem('userApiKeys');
            const api_keys = storedKeys ? JSON.parse(storedKeys) : {};
        
            const response = await generatePpt({ topic, context, api_keys });
        
            const serverData = response.data;
        
            if (serverData && serverData.fileId && serverData.content) {
                const url = getPptDownloadUrl(serverData.fileId);
                setPptDownloadUrl(url);
                setPptPreviewContent(serverData.content);
                setPptModalStatus('success');
            } else {
                throw new Error('Invalid or incomplete response from server.');
            }
        
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to generate presentation.';
            setError(errorMessage);
            setPptModalStatus('error');
        } finally {
            setIsPptGenerating(false);
        }
    }, []);

    const handleAcceptFlashcards = useCallback(async () => {
        setShowFlashcardSuggestion(false);
        const lastMessageText = messages[messages.length - 1]?.parts[0]?.text;
        if (!lastMessageText) return;
    
        try {
            const response = await generateFlashcards(lastMessageText);
            const parsedCards = parseFlashcards(response.data.flashcards);
            setFlashcards(prev => [...prev, ...parsedCards]);
            setAlreadySuggested(prev => ({...prev, [messages[messages.length - 1].id]: true}));
        } catch (error) {
            setError("Failed to generate flashcards.");
        }
    }, [messages]);
    
    const handleRefinePrompt = useCallback(async () => {
        const textToRefine = inputText.trim();
        if (!textToRefine || isRefining || isLoading) return;
        setIsRefining(true);
        setError('');
        try {
            const response = await refinePrompt(textToRefine);
            if (response.data && response.data.refined_prompt) {
                setInputText(response.data.refined_prompt);
            } else {
                throw new Error("The AI failed to refine the prompt.");
            }
        } catch (err) {
            setError(`Refine Error: ${err.response?.data?.message || 'Failed to refine prompt.'}`);
        } finally {
            setIsRefining(false);
        }
    }, [inputText, isRefining, isLoading]);

    const triggerFileRefresh = useCallback((newlyUploadedFile) => {
        setFileRefreshTrigger(p => p + 1);
        setIsRagEnabled(true);
        setHasFiles(true);

        if (newlyUploadedFile) {
            setActiveFile(newlyUploadedFile);
            localStorage.setItem('activeFile', newlyUploadedFile);
        } else {
            getUserFiles().then(response => {
                const files = response.data || [];
                if (files.length > 0 && !activeFile) {
                    const latestFile = files.reduce((a, b) => (new Date(a.lastModified) > new Date(b.lastModified) ? a : b));
                    setActiveFile(latestFile.relativePath);
                    localStorage.setItem('activeFile', latestFile.relativePath);
                }
            }).catch(err => console.error("Could not fetch user files on refresh:", err));
        }
    }, [activeFile]);

    const handleNewChat = useCallback(() => {  
        if (!isLoading) { 
            resetTranscript(); 
            saveAndReset(false); 
        } 
    }, [isLoading, saveAndReset, resetTranscript]);

    // MODIFICATION: New handler to toggle the input area menu.
    const toggleInputMenu = () => {
        setIsInputMenuOpen(prev => !prev);
    };

    const handleEnterKey = useCallback((e) => { if (e.key === 'Enter' && !e.shiftKey && !isLoading) { e.preventDefault(); handleSendMessage(e); } }, [handleSendMessage, isLoading]);
    const handlePromptTextChange = useCallback((newText) => { setEditableSystemPromptText(newText); }, []);
    const handleLlmProviderChange = (e) => { const newProvider = e.target.value; setLlmProvider(newProvider); setLlmModelName(LLM_OPTIONS[newProvider]?.models[0] || ''); };
    const handleLlmModelChange = (e) => { setLlmModelName(e.target.value); };
    const handleRagToggle = (e) => setIsRagEnabled(e.target.checked);
    const handleMultiQueryToggle = (e) => setEnableMultiQuery(e.target.checked);
    const handleHistory = useCallback(() => setIsHistoryModalOpen(true), []);
    const closeHistoryModal = useCallback(() => setIsHistoryModalOpen(false), []);
    const handleSessionSelectForContinuation = useCallback((sessionData) => {
        const { sessionId, messages: historyMessages, systemPrompt, provider, model } = sessionData;
        setMessages(historyMessages);
        setSessionId(sessionId);
        localStorage.setItem('sessionId', sessionId);

        const promptId = Object.keys(getPromptTextById).find(key => getPromptTextById(key) === systemPrompt) || 'custom';
        setCurrentSystemPromptId(promptId);
        setEditableSystemPromptText(systemPrompt);
        
        if (provider) setLlmProvider(provider);
        if (model) setLlmModelName(model);

        closeHistoryModal();
    }, [closeHistoryModal]);
    const onAnalysisComplete = useCallback((data) => { setAnalysisModalData(data); setIsAnalysisModalOpen(true); }, []);
    const closeAnalysisModal = useCallback(() => { setAnalysisModalData(null); setIsAnalysisModalOpen(false); }, []);
    
    const handleToggleListen = () => {
        if (listening) {
            SpeechRecognition.stopListening();
        } else {
            resetTranscript();
            SpeechRecognition.startListening({ continuous: true });
        }
    };
    
    const handleDownloadChat = useCallback(() => {
        const doc = new jsPDF();
        let y = 10;
        doc.setFontSize(16);
        doc.text(`Chat History with ${username}`, 10, y);
        y += 10;

        messages.forEach(msg => {
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text(`${msg.role === 'user' ? username : 'Assistant'}:`, 10, y);
            y += 7;

            doc.setFont(undefined, 'normal');
            const textLines = doc.splitTextToSize(msg.parts[0].text, 180);
            doc.text(textLines, 15, y);
            y += (textLines.length * 7) + 10;
            if (y > 280) {
                doc.addPage();
                y = 10;
            }
        });
        doc.save(`chat_history_${sessionId.substring(0,8)}.pdf`);
    }, [messages, username, sessionId]);
    
    const handleFileSelect = useCallback((filePath) => { setActiveFile(filePath); localStorage.setItem('activeFile', filePath); }, []);
    
    const handleCopyText = useCallback((textToCopy, messageId) => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopiedMessageId(messageId);
            setTimeout(() => setCopiedMessageId(null), 2000);
        });
    }, []);

    const getPanelTitle = () => {
        switch(activeView) {
            case 'ASSISTANT': return 'Assistant Settings';
            case 'DATA': return 'Data Sources';
            case 'PPT': return 'AI Presentation Generator';
            default: return 'Panel';
        }
    };

    const sidebarProps = {
        currentSystemPromptId, editableSystemPromptText,
        handlePromptSelectChange, handlePromptTextChange,
        llmProvider, handleLlmProviderChange,
        isProcessing: isLoading, llmModelName, handleLlmModelChange,
        enableMultiQuery, handleMultiQueryToggle, isRagEnabled,
        triggerFileRefresh,
        refreshTrigger: fileRefreshTrigger, onAnalysisComplete,
        setHasFiles, onFileSelect: handleFileSelect, activeFile
    };

    return (
        <div className={`chat-page-container ${showGradient ? 'gradient-loading' : 'normal-shadow'}`}>
            <div className={`chat-page-sidebar ${isSidePanelOpen ? 'open' : ''}`}>
                <div className="sidebar-panel-header">
                    <h3 className="sidebar-panel-title">{getPanelTitle()}</h3>
                    <button className="sidebar-close-btn" onClick={onCloseSidePanel} title="Close Panel">
                        <FiX size={24} />
                    </button>
                </div>
                
                {activeView === 'ASSISTANT' && <AssistantSettingsPanel {...sidebarProps} />}
                {activeView === 'DATA' && <DataSourcePanel {...sidebarProps} />}
                {activeView === 'PPT' && <PptGeneratorPanel onGenerate={handleGeneratePpt} isGenerating={isPptGenerating} />}
            </div>

            <div className="chat-view">
                <header className="chat-header">
                  <div className="header-left">
                    <h1 className="header-title">Fused ChatBot</h1>
                    {showGradient && <span className="loading-indicator" style={{marginLeft: '10px', fontSize: '0.8rem', opacity: 0.7}}>Loading...</span>}
                  </div>
                  <div className="header-right">
                    <span className="username-display">Hi, {username}</span>
                    <ThemeToggleButton />
                    <button onClick={handleHistory} className="header-button" title="Chat History" disabled={isLoading}><FiArchive size={20} /></button>
                    <button onClick={() => navigate('/settings')} className="header-button" title="Settings" disabled={isLoading}><FiSettings size={20} /></button>
                    <button onClick={handleDownloadChat} className="header-button" title="Download Chat" disabled={messages.length === 0}><FiDownload size={20} /></button>
                    <button onClick={handleNewChat} className="header-button" title="New Chat" disabled={isLoading}><FiPlus size={20} /></button>
                    {userRole === 'admin' && (
                      <button onClick={() => navigate('/admin')} className="header-button" title="Admin Panel">
                        <FiShield size={20} />
                      </button>
                    )}
                    <button onClick={performLogout} className="header-button" title="Logout" disabled={isLoading}><FiLogOut size={20} /></button>
                  </div>
                </header>
                <main className="messages-area" ref={scrollContainerRef}>
                    {messages.length === 0 && !isLoading && (
                         <div className="welcome-screen">
                            <FiMessageSquare size={48} className="welcome-icon" />
                            <h2>Start a conversation</h2>
                            <p>Ask a question, upload a document, or select a model to begin.</p>
                         </div>
                    )}
                    
                    {messages.map((msg) => (
                        <div key={msg.id} className={`message ${msg.role.toLowerCase()}${msg.isError ? '-error-message' : ''}`}>
                            <div className="message-content-wrapper">
                                <div className="message-header">
                                    <p className="message-sender-name">{msg.role === 'user' ? username : 'Assistant'}</p>
                                    {msg.role === 'model' && !msg.isError && (
                                        <button
                                            className="copy-button"
                                            title="Copy Text"
                                            onClick={() => handleCopyText(msg.parts[0].text, msg.id)}
                                        >
                                            {copiedMessageId === msg.id ? <FiCheck size={16} /> : <FiCopy size={16} />}
                                        </button>
                                    )}
                                </div>
                                <div className="message-text"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.parts[0].text}</ReactMarkdown></div>
                                
                                {msg.thinking && <details className="message-thinking-trace"><summary>Thinking Process</summary><pre>{msg.thinking}</pre></details>}
                                {msg.agentTrace && (
                                    <details className="message-thinking-trace agent-trace">
                                        <summary>Agent Steps</summary>
                                        <pre>{msg.agentTrace}</pre>
                                    </details>
                                )}
                                {msg.role === 'model' && msg.provider && (
                                    <div className="message-metadata">
                                        <span>Provider: {msg.provider} | Model: {msg.model || 'Default'}</span>
                                    </div>
                                )}
                                {msg.references?.length > 0 && <div className="message-references"><strong>References:</strong><ul>{msg.references.map((ref, i) => <li key={i} title={ref.preview_snippet}>{ref.documentName} (Score: {ref.score?.toFixed(2)})</li>)}</ul></div>}
                            </div>
                        </div>
                    ))}
                </main>
                
                {showFlashcardSuggestion && (
                    <FlashcardSuggestion onAccept={handleAcceptFlashcards} onDecline={() => setShowFlashcardSuggestion(false)} />
                )}
                {flashcards.length > 0 && (
                    <FlashcardList cards={flashcards} />
                )}

                <div className="indicator-container">
                    {isLoading && <div className="loading-indicator"><span>Thinking...</span></div>}
                    {!isLoading && error && <div className="error-indicator">{error}</div>}
                </div>
                {inputText.match(/pdf|topics|headings|subheadings/i) && !activeFile && (
                    <div className="fm-error" style={{margin:'10px',textAlign:'center'}}>Please activate a file in the file manager to ask questions about a PDF.</div>
                )}
                
                {/* MODIFICATION: The chat input area is restructured for mobile responsiveness */}
                <div className="chat-input-area">
                    <div className="chat-input-main-row">
                        <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleEnterKey} placeholder="Type or say something..." rows="1" disabled={isLoading || isRefining} />
                        
                        {/* MODIFICATION: Add the mobile-only "Options" button inside the main row for better alignment. */}
                        <div className="input-options-mobile" ref={inputMenuRef}>
                            <button onClick={toggleInputMenu} className="header-button input-options-button" title="More options">
                                <FiSliders size={20} />
                            </button>
                            {isInputMenuOpen && (
                                <div className="input-menu-dropdown">
                                    <VoiceInputButton isListening={listening} onToggleListen={handleToggleListen} isSupported={browserSupportsSpeechRecognition} />
                                    <button onClick={handleRefinePrompt} disabled={isLoading || isRefining || !inputText.trim()} title="Refine Prompt" className={`prompt-refine-button magic-wand-button${inputText ? ' active' : ''}`}>
                                        {isRefining ? <div className="spinner" /> : <PiMagicWand size={22} />}
                                    </button>
                                    <div className="agent-toggle-container" title="Toggle Agent Mode">
                                        <label htmlFor="agent-toggle-mobile">Agent</label>
                                        <input type="checkbox" id="agent-toggle-mobile" checked={isAgentMode} onChange={(e) => setIsAgentMode(e.target.checked)} disabled={isLoading} />
                                    </div>
                                    <div className="rag-toggle-container" title={!hasFiles ? "Upload files to enable RAG" : "Toggle RAG"}>
                                        <label htmlFor="rag-toggle-mobile">RAG</label>
                                        <input type="checkbox" id="rag-toggle-mobile" checked={isRagEnabled} onChange={handleRagToggle} disabled={!hasFiles || isLoading} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={handleSendMessage} disabled={isLoading || isRefining || !inputText.trim()} title="Send Message" className="send-button">
                            <FiSend size={20} />
                        </button>
                    </div>

                    {/* This bar will now be hidden on mobile via CSS */}
                    <div className="chat-input-options-bar">
                        <div className="chat-input-options-left">
                            <VoiceInputButton isListening={listening} onToggleListen={handleToggleListen} isSupported={browserSupportsSpeechRecognition} />
                            <button onClick={handleRefinePrompt} disabled={isLoading || isRefining || !inputText.trim()} title="Refine Prompt" className={`prompt-refine-button magic-wand-button${inputText ? ' active' : ''}`}>
                                {isRefining ? <div className="spinner" /> : <PiMagicWand size={22} />}
                            </button>
                        </div>
                        <div className="chat-input-options-right">
                            <div className="agent-toggle-container" title="Toggle Agent Mode for complex, multi-step tasks">
                                <label htmlFor="agent-toggle">Agent</label>
                                <input
                                    type="checkbox"
                                    id="agent-toggle"
                                    checked={isAgentMode}
                                    onChange={(e) => setIsAgentMode(e.target.checked)}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="rag-toggle-container" title={!hasFiles ? "Upload files to enable RAG" : "Toggle RAG"}>
                                <label htmlFor="rag-toggle">RAG</label>
                                <input type="checkbox" id="rag-toggle" checked={isRagEnabled} onChange={handleRagToggle} disabled={!hasFiles || isLoading} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {isCompilerPopupOpen && (
                <div className="compiler-popup-overlay" onClick={() => setIsCompilerPopupOpen(false)}>
                    <div className="compiler-popup-container" onClick={(e) => e.stopPropagation()}>
                        <button className="compiler-popup-close-button" onClick={() => setIsCompilerPopupOpen(false)} title="Close"><FiX size={28} /></button>
                        <CompilerView />
                    </div>
                </div>
            )}
            <HistoryModal isOpen={isHistoryModalOpen} onClose={closeHistoryModal} onSessionSelect={handleSessionSelectForContinuation} />
            {analysisModalData && <AnalysisResultModal isOpen={isAnalysisModalOpen} onClose={closeAnalysisModal} analysisData={analysisModalData} />}
            <QuizModal isOpen={isQuizModalOpen} onClose={() => setIsQuizModalOpen(false)}>
                <QuizView flashcards={flashcards} />
            </QuizModal>
            
            <GenerationStatusModal
                isOpen={isPptModalOpen}
                onClose={() => setIsPptModalOpen(false)}
                status={pptModalStatus}
                downloadUrl={pptDownloadUrl}
                errorMessage={error}
                previewContent={pptPreviewContent}
            />
        </div>
    );
};

export default ChatPage;