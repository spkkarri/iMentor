// client/src/components/ChatPage.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';
                 
// --- Services & Configuration ---
import { sendMessage, saveChatHistory, getUserFiles } from '../services/api';
import { LLM_OPTIONS } from '../config/constants';
import { useTheme } from '../context/ThemeContext';

// --- Child Components ---
import SystemPromptWidget, { getPromptTextById } from './SystemPromptWidget';
import HistoryModal from './HistoryModal';
import FileUploadWidget from './FileUploadWidget';
import FileManagerWidget from './FileManagerWidget';
import AnalysisResultModal from './AnalysisResultModal';
import VoiceInputButton from './VoiceInputButton';

// --- Icons ---
import { FiMessageSquare, FiDatabase, FiSettings, FiLogOut, FiSun, FiMoon, FiSend, FiPlus, FiArchive, FiShield } from 'react-icons/fi';

// --- Styles ---
import './ChatPage.css';

// --- UI Sub-Components (for organization) ---
const ActivityBar = ({ activeView, setActiveView }) => (
    <div className="activity-bar">
        <button className={`activity-button ${activeView === 'ASSISTANT' ? 'active' : ''}`} onClick={() => setActiveView('ASSISTANT')} title="Assistant Settings">
            <FiSettings size={24} />
        </button>
        <button className={`activity-button ${activeView === 'DATA' ? 'active' : ''}`} onClick={() => setActiveView('DATA')} title="Data Sources">
            <FiDatabase size={24} />
        </button>
    </div>
);

const AssistantSettingsPanel = (props) => (
    <div className="sidebar-panel">
        <h3 className="sidebar-header">Assistant Settings</h3>
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
        <h3 className="sidebar-header">Data Sources</h3>
        <FileUploadWidget onUploadSuccess={props.triggerFileRefresh} />
        <FileManagerWidget refreshTrigger={props.refreshTrigger} onAnalysisComplete={props.onAnalysisComplete} />
    </div>
);

const Sidebar = ({ activeView, ...props }) => (
    <div className="sidebar-area">
        {activeView === 'ASSISTANT' && <AssistantSettingsPanel {...props} />}
        {activeView === 'DATA' && <DataSourcePanel {...props} />}
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

const ChatPage = ({ setIsAuthenticated }) => {
    // --- State Management ---
    const [activeView, setActiveView] = useState('ASSISTANT');
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
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'accepted'

    // --- Refs & Hooks ---
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();
    const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

    React.useEffect(() => {
        if (listening) {
            setInputText(transcript);
        }
    }, [transcript, listening]);

    // --- Fetch user info on mount to set userRole and username ---
    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                // Check if sessionId exists in localStorage as a sign of logged-in user
                const sessionId = localStorage.getItem('sessionId');
                if (!sessionId) {
                    setUserRole(null);
                    setUsername('');
                    setIsAuthenticated(false);
                    navigate('/login', { replace: true });
                    return;
                }
                // Try to get user info from localStorage 'user' key if available
                const userRole = localStorage.getItem('userRole');
                const username = localStorage.getItem('username');
                setUserRole(userRole || null);
                setUsername(username || '');
            } catch (error) {
                console.error('Error fetching user info', error);
                setUserRole(null);
                setUsername('');
                setIsAuthenticated(false);
                navigate('/login', { replace: true });
            }
        };
        fetchUserInfo();
    }, [setIsAuthenticated, navigate]);

    // ==================================================================
    //  START OF FUNCTION RE-ORDERING FIX
    // ==================================================================

    // --- Callbacks & Handlers ---
    const performLogoutCleanup = useCallback(() => {
        localStorage.clear();
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
    }, [setIsAuthenticated, navigate]);

    // *MOVED UP*: This function must be defined before saveAndReset can use it.
    const handlePromptSelectChange = useCallback((newId) => {
        setCurrentSystemPromptId(newId);
        setEditableSystemPromptText(getPromptTextById(newId));
    }, []);

    // *STAYS HERE*: This function depends on handlePromptSelectChange.
    const saveAndReset = useCallback(async (isLoggingOut = false, onCompleteCallback = null) => {
        const messagesToSave = messages.filter(m => m.role && m.parts);
        if (!localStorage.getItem('sessionId') || messagesToSave.length === 0 || isLoading) {
            if (onCompleteCallback) onCompleteCallback();
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const response = await saveChatHistory({ sessionId: localStorage.getItem('sessionId'), messages: messagesToSave });
            const newSessionId = response.data.newSessionId || uuidv4();
            localStorage.setItem('sessionId', newSessionId);
            setSessionId(newSessionId);
            setMessages([]);
            if (!isLoggingOut) handlePromptSelectChange('friendly');
        } catch (err) {
            setError(`Session Error: ${err.response?.data?.message || 'Failed to save session.'}`);
        } finally {
            setIsLoading(false);
            if (onCompleteCallback) onCompleteCallback();
        }
    }, [messages, isLoading, handlePromptSelectChange]);

    // *STAYS HERE*: These functions depend on saveAndReset.
    const handleLogout = useCallback(() => saveAndReset(true, performLogoutCleanup), [saveAndReset, performLogoutCleanup]);

    const handleSendMessage = useCallback(async (e) => {
        if (e) e.preventDefault();
        const textToSend = inputText.trim();
        if (!textToSend || isLoading) return;
        SpeechRecognition.stopListening();
        setIsLoading(true);
        setError('');
        const newUserMessage = { role: 'user', parts: [{ text: textToSend }], timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, newUserMessage]);
        setInputText('');
        resetTranscript();
        const messageData = {
            message: textToSend,
            history: [...messages, newUserMessage].map(m => ({ role: m.role, parts: m.parts })),
            sessionId: localStorage.getItem('sessionId'),
            systemPrompt: editableSystemPromptText,
            isRagEnabled, llmProvider, llmModelName: llmModelName || null, enableMultiQuery,
        };
        try {
            const response = await sendMessage(messageData);
            if (!response.data?.reply?.parts?.[0]) { throw new Error("Received an invalid response from the AI."); }
            setMessages(prev => [...prev, response.data.reply]);
        } catch (err) {
            const errorMessage = err.response?.data?.message || 'Failed to get response.';
            setError(`Chat Error: ${errorMessage}`);
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: `Error: ${errorMessage}` }], isError: true, timestamp: new Date().toISOString() }]);
        } finally {
            setIsLoading(false);
        }
    }, [inputText, isLoading, messages, editableSystemPromptText, isRagEnabled, llmProvider, llmModelName, enableMultiQuery, resetTranscript]);

    const handleNewChat = useCallback(() => { if (!isLoading) { resetTranscript(); saveAndReset(false); } }, [isLoading, saveAndReset, resetTranscript]);
    const handleEnterKey = useCallback((e) => { if (e.key === 'Enter' && !e.shiftKey && !isLoading) { e.preventDefault(); handleSendMessage(e); } }, [handleSendMessage, isLoading]);
    const triggerFileRefresh = useCallback(() => setFileRefreshTrigger(p => p + 1), []);
    const handlePromptTextChange = useCallback((newText) => { setEditableSystemPromptText(newText); }, []);
    const handleLlmProviderChange = (e) => { const newProvider = e.target.value; setLlmProvider(newProvider); setLlmModelName(LLM_OPTIONS[newProvider]?.models[0] || ''); };
    const handleLlmModelChange = (e) => { setLlmModelName(e.target.value); };
    const handleRagToggle = (e) => setIsRagEnabled(e.target.checked);
    const handleMultiQueryToggle = (e) => setEnableMultiQuery(e.target.checked);
    const handleHistory = useCallback(() => setIsHistoryModalOpen(true), []);
    const closeHistoryModal = useCallback(() => setIsHistoryModalOpen(false), []);
   
    // FIX: Define the handler for selecting a session from the history modal
    const handleSessionSelectForContinuation = useCallback((sessionData) => {
        if (sessionData && sessionData.sessionId && sessionData.messages) {
            localStorage.setItem('sessionId', sessionData.sessionId);
            setSessionId(sessionData.sessionId);
            setMessages(sessionData.messages);
            setError('');
            closeHistoryModal();
        }
    }, [closeHistoryModal]);

    const onAnalysisComplete = useCallback((data) => { setAnalysisModalData(data); setIsAnalysisModalOpen(true); }, []);
    const closeAnalysisModal = useCallback(() => { setAnalysisModalData(null); setIsAnalysisModalOpen(false); }, []);
    const handleToggleListen = () => { if (listening) { SpeechRecognition.stopListening(); } else { resetTranscript(); SpeechRecognition.startListening({ continuous: true }); } };

    // --- New handler for chat download ---
    const handleDownloadChat = useCallback(() => {
        if (messages.length === 0) return;
        const doc = new jsPDF();
        let y = 10;
        doc.setFontSize(12);
        messages.forEach((msg, index) => {
            const sender = msg.role === 'user' ? username || 'User' : 'Assistant';
            const text = msg.parts.map(part => part.text).join(' ');
            const lines = doc.splitTextToSize(`${sender}: ${text}`, 180);
            if (y + lines.length * 10 > 280) {
                doc.addPage();
                y = 10;
            }
            doc.text(lines, 10, y);
            y += lines.length * 10;
        });
        doc.save('chat_history.pdf');
    }, [messages, username]);

    // FIX: Define the props object to pass to the Sidebar component
    const sidebarProps = {
        currentSystemPromptId,
        editableSystemPromptText,
        handlePromptSelectChange,
        handlePromptTextChange,
        llmProvider,
        handleLlmProviderChange,
        isProcessing: isLoading,
        llmModelName,
        handleLlmModelChange,
        enableMultiQuery,
        handleMultiQueryToggle,
        isRagEnabled,
        triggerFileRefresh,
        refreshTrigger: fileRefreshTrigger,
        onAnalysisComplete,
    };

    // --- Render ---
    return (
        <div className="main-layout">
            <ActivityBar activeView={activeView} setActiveView={setActiveView} />
            <Sidebar activeView={activeView} {...sidebarProps} />
            <div className="chat-view">
                <header className="chat-header">
                    <h1>FusedChat</h1>
                    <div className="header-controls">
                        <span className="username-display">Hi, {username}</span>
                        <ThemeToggleButton />
                        <button onClick={handleHistory} className="header-button" title="Chat History" disabled={isLoading}><FiArchive size={20} /></button>
                        <button onClick={handleNewChat} className="header-button" title="New Chat" disabled={isLoading}><FiPlus size={20} /></button>
                        <button onClick={() => navigate('/settings')} className="header-button" title="Settings" disabled={isLoading}><FiSettings size={20} /></button>
                        {userRole === 'admin' && (
                            <button onClick={() => navigate('/admin')} className="header-button admin-button" title="Admin Panel">
                                <FiShield size={20} />
                            </button>
                        )}
                        <button onClick={handleLogout} className="header-button" title="Logout" disabled={isLoading}><FiLogOut size={20} /></button>
                        <button onClick={handleDownloadChat} className="header-button" title="Download Chat" disabled={messages.length === 0}>Download Chat</button>
                    </div>
                </header>
                <main className="messages-area">
                    {messages.length === 0 && !isLoading && (
                         <div className="welcome-screen">
                            <FiMessageSquare size={48} className="welcome-icon" />
                            <h2>Start a conversation</h2>
                            <p>Ask a question, upload a document, or select a model to begin.</p>
                         </div>
                    )}
                    {messages.map((msg, index) => (
                        <div key={`${sessionId}-${index}`} className={`message ${msg.role.toLowerCase()}${msg.isError ? '-error-message' : ''}`}>
                            <div className="message-content-wrapper">
                                <p className="message-sender-name">{msg.role === 'user' ? username : 'Assistant'}</p>
                                <div className="message-text"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.parts[0].text}</ReactMarkdown></div>
                                {msg.thinking && <details className="message-thinking-trace"><summary>Thinking Process</summary><pre>{msg.thinking}</pre></details>}
                                {msg.references?.length > 0 && <div className="message-references"><strong>References:</strong><ul>{msg.references.map((ref, i) => <li key={i} title={ref.preview_snippet}>{ref.documentName} (Score: {ref.score?.toFixed(2)})</li>)}</ul></div>}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </main>
                <div className="indicator-container">
                    {isLoading && <div className="loading-indicator"><span>Thinking...</span></div>}
                    {!isLoading && error && <div className="error-indicator">{error}</div>}
                </div>
                <footer className="input-area">
                    <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleEnterKey} placeholder="Type or say something..." rows="1" disabled={isLoading} />
                    <VoiceInputButton isListening={listening} onToggleListen={handleToggleListen} isSupported={browserSupportsSpeechRecognition} />
                    <div className="rag-toggle-container" title={!hasFiles ? "Upload files to enable RAG" : "Toggle RAG"}>
                        <label htmlFor="rag-toggle">RAG</label>
                        <input type="checkbox" id="rag-toggle" checked={isRagEnabled} onChange={handleRagToggle} disabled={!hasFiles || isLoading} />
                    </div>
                    <button onClick={handleSendMessage} disabled={isLoading || !inputText.trim()} title="Send Message" className="send-button">
                        <FiSend size={20} />
                    </button>
                </footer>
            </div>
            <HistoryModal isOpen={isHistoryModalOpen} onClose={closeHistoryModal} onSessionSelect={handleSessionSelectForContinuation} />
            {analysisModalData && <AnalysisResultModal isOpen={isAnalysisModalOpen} onClose={closeAnalysisModal} analysisData={analysisModalData} />}
        </div>
    );
};

export default ChatPage;