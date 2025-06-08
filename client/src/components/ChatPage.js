// client/src/components/ChatPage.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
// Ensure you have a service that wraps your API calls, e.g., api.js
// For this example, I'll assume `sendMessage`, `saveChatHistory`, `getUserFiles`, `queryRagService`
// are correctly defined in `../services/api`
import { sendMessage, saveChatHistory, getUserFiles, analyzeDocument } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { v4 as uuidv4 } from 'uuid';
import DocumentAnalysisWidget from './DocumentAnalysisWidget';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faTimes, faUpload, faCog, faFolderOpen, faGlobe, faBookOpen } from '@fortawesome/free-solid-svg-icons';

import SystemPromptWidget, { availablePrompts, getPromptTextById } from './SystemPromptWidget';
import HistoryModal from './HistoryModal';
import FileUploadWidget from './FileUploadWidget';
import FileManagerWidget from './FileManagerWidget';

import './ChatPage.css';

const ChatPage = ({ setIsAuthenticated }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    // const [isRagLoading, setIsRagLoading] = useState(false);
    const [error, setError] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [userId, setUserId] = useState('');
    const [username, setUsername] = useState('');
    const [currentSystemPromptId, setCurrentSystemPromptId] = useState('friendly');
    const [editableSystemPromptText, setEditableSystemPromptText] = useState(() => getPromptTextById('friendly'));
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0);
    const [hasFiles, setHasFiles] = useState(false);
    // const [isRagEnabled, setIsRagEnabled] = useState(false);
    // const [hasDefaultedRagOnForSession, setHasDefaultedRagOnForSession] = useState(false);

    const [selectedLlmProvider, setSelectedLlmProvider] = useState('gemini');
    const [selectedOllamaModel, setSelectedOllamaModel] = useState('mistral');
    const [selectedGroqModel, setSelectedGroqModel] = useState(''); // Initially empty, set by dropdown


      const [uiSelectedTool, setUiSelectedTool] = useState('none'); 

    const messagesEndRef = useRef(null);
    const navigate = useNavigate();
    // --- ADDING New State for Document Analysis ---
    const [availableDocsForAnalysis, setAvailableDocsForAnalysis] = useState([]);
    const [selectedDocForAnalysis, setSelectedDocForAnalysis] = useState('');
    const [analysisResultText, setAnalysisResultText] = useState('');
    const [isAnalyzingDoc, setIsAnalyzingDoc] = useState(false);
    const [analysisErrorText, setAnalysisErrorText] = useState('');
    const [currentAnalysisType, setCurrentAnalysisType] = useState('');
    // --- End New State ---


    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true); // true = expanded, false = collapsed

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const performLogoutCleanup = useCallback((isRedirecting = true) => {
        console.log("[Client ChatPage] Performing logout cleanup...");
        localStorage.clear();
        setIsAuthenticated(false);
        setMessages([]);
        setSessionId('');
        setUserId('');
        setUsername('');
        setCurrentSystemPromptId('friendly');
        setEditableSystemPromptText(getPromptTextById('friendly'));
        setError('');
        setHasFiles(false);
        // setIsRagEnabled(false);
        setSelectedLlmProvider('gemini');
        setSelectedOllamaModel('mistral');
        setSelectedGroqModel('');
        // setHasDefaultedRagOnForSession(false);
        // Reset analysis states as well
        setAvailableDocsForAnalysis([]);
        setSelectedDocForAnalysis('');
        setAnalysisResultText('');
        setIsAnalyzingDoc(false);
        setAnalysisErrorText('');
        setCurrentAnalysisType('');
        if (isRedirecting && window.location.pathname !== '/login') {
            console.log("[Client ChatPage] Navigating to /login.");
            navigate('/login', { replace: true });
        }
        localStorage.removeItem('uiSelectedTool'); // Clear it for next login
        setUiSelectedTool('none'); 
    }, [setIsAuthenticated, navigate]);


    useEffect(() => {
        console.log("[Client ChatPage] Mount effect running.");
        const storedSessionId = localStorage.getItem('sessionId');
        const storedUserId = localStorage.getItem('userId');
        const storedUsername = localStorage.getItem('username');   
        const savedUiSelectedTool = localStorage.getItem('uiSelectedTool');

        if (savedUiSelectedTool === 'academic' || savedUiSelectedTool === 'web') {
            setUiSelectedTool(savedUiSelectedTool);
            console.log(`[Client ChatPage] Mount: Loaded uiSelectedTool from localStorage: ${savedUiSelectedTool}`)
         } else {
            setUiSelectedTool('none'); // Default if nothing saved or invalid
            localStorage.setItem('uiSelectedTool', 'none'); 
            console.log("[Client ChatPage] Mount: Defaulted uiSelectedTool to 'none'.");
        }

        if (!storedUserId || !storedSessionId || !storedUsername) {
            console.warn("[Client ChatPage] Mount: Missing auth info in localStorage. Attempting logout/redirect.");
            performLogoutCleanup(true);
        } else {
            console.log("[Client ChatPage] Mount: Auth info found. Setting state.");
            setSessionId(storedSessionId);
            setUserId(storedUserId);
            setUsername(storedUsername);
            // setHasDefaultedRagOnForSession(false);

            if (selectedLlmProvider === 'groq' && !selectedGroqModel) {
                 setSelectedGroqModel('llama3-8b-8192');
                 console.log("[Client ChatPage] Mount: Groq provider selected, ensuring a default model is set.");
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // performLogoutCleanup is memoized, selectedLlmProvider/selectedGroqModel are initial states for this mount effect

    useEffect(() => {
        const checkUserFilesAndPopulateDropdowns = async () => {
            if (!userId) {
                setHasFiles(false); 
                // setIsRagEnabled(false);
                setAvailableDocsForAnalysis([]);
                return;
            }
             console.log("[Client ChatPage] checkUserFilesAndSetStates: Checking for userId:", userId);
            try {
                const response = await getUserFiles();
                const filesData = response.data || [];
                console.log("[ChatPage useEffect] filesData received from getUserFiles:", JSON.stringify(filesData, null, 2));
                const filesCurrentlyExist = filesData.length > 0;
                setHasFiles(filesCurrentlyExist);

                setAvailableDocsForAnalysis(
                    Array.isArray(filesData) ? filesData.map(file => {
                        const originalNameForDropdown = file.originalName || file.filename || file.name || 'Unnamed Document';
                        console.log(`[ChatPage Dropdown MAP] File from API: originalName='${file.originalName}', serverFilename='${file.serverFilename}', using displayName='${originalNameForDropdown}'`);
                        return {
                            displayName: originalNameForDropdown, // This is what user sees
                            // The VALUE of the option should be exactly what you want to send to backend analysis query
                            valueToSend: originalNameForDropdown, // This will be e.target.value
                            id: file.serverFilename || file.id || uuidv4() 
                        };
                    }) : []
                );

                // if (filesCurrentlyExist && !hasDefaultedRagOnForSession) {
                //     setIsRagEnabled(true); setHasDefaultedRagOnForSession(true);
                // } else if (!filesCurrentlyExist) {
                //     setIsRagEnabled(false); setHasDefaultedRagOnForSession(false);
                // }
            } catch (err) {
                console.error("[Client ChatPage] Error checking user files (for RAG/Analysis):", err);
                setAvailableDocsForAnalysis([]);
                if (err.response?.status === 401) performLogoutCleanup(true);
                else setError("Could not check user files status.");
                setHasFiles(false);
            }
        };
        if (userId) checkUserFilesAndPopulateDropdowns();
    }, [userId, fileRefreshTrigger, performLogoutCleanup, ]);

    const triggerFileRefresh = () => {
        console.log("[Client ChatPage] triggerFileRefresh called.");
        setFileRefreshTrigger(prev => prev + 1);
    };
    

    // const handleRagToggle = (event) => {
    //     const newRagState = event.target.checked;
    //     console.log("[Client ChatPage] handleRagToggle: User changed RAG to:", newRagState);
    //     setIsRagEnabled(newRagState);
    //     if (!hasDefaultedRagOnForSession && newRagState) setHasDefaultedRagOnForSession(true);
    // };

    const handlePromptSelectChange = (newId) => {
        console.log("[Client ChatPage] System prompt selected:", newId);
        setCurrentSystemPromptId(newId); setEditableSystemPromptText(getPromptTextById(newId));
        setError(prev => prev && (prev.includes("Session invalid") || prev.includes("Critical Error")) ? prev : `Assistant mode changed.`);
        setTimeout(() => { setError(prev => prev === `Assistant mode changed.` ? '' : prev); }, 3000);
    };

    const handlePromptTextChange = (newText) => {
        setEditableSystemPromptText(newText);
        const matchingPreset = availablePrompts.find(p => p.id !== 'custom' && p.prompt === newText);
        setCurrentSystemPromptId(matchingPreset ? matchingPreset.id : 'custom');
    };

    const handleHistory = () => { console.log("[Client ChatPage] handleHistory called."); setIsHistoryModalOpen(true); };
    const closeHistoryModal = () => setIsHistoryModalOpen(false);

    const actualSaveAndReset = async (isLoggingOut = false, onCompleteCallback = null) => {
        console.log("[Client ChatPage] actualSaveAndReset called. isLoggingOut:", isLoggingOut);
        const localSessionId = localStorage.getItem('sessionId');
        const localUserId = localStorage.getItem('userId');
        if (!localSessionId || !localUserId) {
            console.error("[Client ChatPage] Save Error: Session ID or User ID missing for saveAndReset.");
            setError("Critical Error: Session info missing. Cannot save current chat.");
            if (isLoggingOut) performLogoutCleanup();
            if (onCompleteCallback) onCompleteCallback(false);
            return;
        }
        const messagesToSave = messages.filter(m => m.role && m.parts);
        if (messagesToSave.length === 0) {
            console.log("[Client ChatPage] saveAndReset: No messages to save.");
            if (!isLoggingOut) {
                const newClientSessionId = uuidv4(); localStorage.setItem('sessionId', newClientSessionId);
                setSessionId(newClientSessionId); setMessages([]); handlePromptSelectChange('friendly');
                setError('');  triggerFileRefresh();
                console.log(`[Client ChatPage] UI reset for new chat. New client session ID: ${newClientSessionId}`);
            }
            if (onCompleteCallback) onCompleteCallback(true);
            return;
        }
        setIsLoading(true); let operationSuccess = false;
        try {
            console.log(`[Client ChatPage] Saving history for session: ${localSessionId}`);
            const response = await saveChatHistory({ sessionId: localSessionId, messages: messagesToSave });
            operationSuccess = response.data && response.data.savedSessionId;
            if (!isLoggingOut) {
                const newClientSessionId = uuidv4(); localStorage.setItem('sessionId', newClientSessionId);
                setSessionId(newClientSessionId); setMessages([]); handlePromptSelectChange('friendly');
                setError('');  triggerFileRefresh();
                console.log(`[Client ChatPage] UI reset for new chat. New client session ID: ${newClientSessionId}`);
            }
        } catch (err) {
            const failErrorMsg = err.response?.data?.message || err.message || 'Failed to save session.';
            console.error("[Client ChatPage] Save/Reset API Error:", err);
            setError(`Session Save Error: ${failErrorMsg}.`);
            if (err.response?.status === 401 && !isLoggingOut) {
                 performLogoutCleanup();
            } else if (!isLoggingOut) {
                 const fallbackNewSessionId = uuidv4(); localStorage.setItem('sessionId', fallbackNewSessionId);
                 setSessionId(fallbackNewSessionId); setMessages([]); handlePromptSelectChange('friendly');
                 triggerFileRefresh();
                 console.warn("[Client ChatPage] Save failed, UI reset with new client session ID:", fallbackNewSessionId);
            }
        } finally {
            setIsLoading(false);
            if (onCompleteCallback) onCompleteCallback(operationSuccess);
        }
    };

    const handleLogoutWrapper = (skipSave = false) => {
        console.log("[Client ChatPage] handleLogoutWrapper called. skipSave:", skipSave);
        if (!skipSave && messages.length > 0 && localStorage.getItem('userId') && localStorage.getItem('sessionId')) {
            actualSaveAndReset(true, () => performLogoutCleanup());
        } else { performLogoutCleanup(); }
    };

    const handleNewChatWrapper = () => {
        console.log("[Client ChatPage] handleNewChatWrapper called.");
        if (isLoading ) return;
        actualSaveAndReset(false);
    };

    const handleSendMessage = useCallback(async (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        const textToSend = inputText.trim();
        const currentLocalSessionId = localStorage.getItem('sessionId');
        const currentLocalUserId = localStorage.getItem('userId');

        if (!textToSend || isLoading || !currentLocalSessionId || !currentLocalUserId) {
            if (!currentLocalSessionId || !currentLocalUserId) {
                 setError("Session invalid. Please refresh or log in again.");
                 if (!currentLocalUserId) performLogoutCleanup(true);
            }
            return;
        }

        const newUserMessage = { role: 'user', parts: [{ text: textToSend }], timestamp: new Date() };
        const previousMessagesState = [...messages];
        setMessages(prev => [...prev, newUserMessage]);
        setInputText(''); setError('');
        

        // let relevantDocsFromRag = []; let ragQueryError = null;
         const performRagForThisMessage_flagForPayload = true

        // if (performRagForThisMessage) {
        //     setIsRagLoading(true);
        //     try {
        //         const ragResponse = await queryRagService({ message: textToSend });
        //         relevantDocsFromRag = ragResponse.data.relevantDocs || []; // Not directly used if backend handles RAG context
        //     } catch (err) {
        //         ragQueryError = err.response?.data?.message || "Failed to retrieve documents for RAG.";
        //         if (err.response?.status === 401) { performLogoutCleanup(true); setIsRagLoading(false); return; }
        //     } finally { setIsRagLoading(false); }
        // }

        setIsLoading(true);
        const historyForAPI = previousMessagesState.map(msg => ({ role: msg.role, parts: msg.parts }));
        const systemPromptToSend = editableSystemPromptText;

        try {
            // +++ MODIFIED: Determine toolMode to send to backend +++
            let backendToolMode = null; // Default for 'none'
            if (uiSelectedTool === 'web') {
                backendToolMode = 'web_explicit';
            } else if (uiSelectedTool === 'academic') {
                backendToolMode = 'academic';
            }
            // If uiSelectedTool is 'none', backendToolMode remains null, backend will default to 'default_behavior'
            // +++ END OF MODIFICATION +++

            const messagePayload = {
                query: textToSend,
                history: historyForAPI,
                sessionId: currentLocalSessionId,
                systemPrompt: systemPromptToSend,
                // isRagEnabled: true,
                llmProvider: selectedLlmProvider,
                ...(selectedLlmProvider === 'groq' && { groqModelId: selectedGroqModel }),
                ...(selectedLlmProvider === 'ollama' && { ollamaModelName: selectedOllamaModel }),
                toolMode: backendToolMode
            };
            
            console.log("[Client ChatPage] Sending to /api/chat/message with payload:", JSON.stringify(messagePayload, null, 2));

            const sendMessageResponse = await sendMessage(messagePayload);
            const modelReplyData = sendMessageResponse.data;

            if (modelReplyData?.reply?.role && modelReplyData?.reply?.parts?.length > 0) {
                const botMessage = {
                    ...modelReplyData.reply,
                    thinking: modelReplyData.thinking || null,
                    references: modelReplyData.references || []
                };
                setMessages(prev => [...prev, botMessage]);
            } else {
                throw new Error("Invalid reply structure from backend.");
            }
            setError(prev => prev && (prev.includes("Session invalid") || prev.includes("Critical Error")) ? prev : '');
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to get response.';
            setError(prev => prev ? `${prev} | Chat Error: ${errorMessage}` : `Chat Error: ${errorMessage}`);
            setMessages(previousMessagesState);
            if (err.response?.status === 401) performLogoutCleanup(true);
        } finally {
            setIsLoading(false);
        }
    }, [
        inputText, isLoading,  messages, editableSystemPromptText,
        hasFiles, selectedLlmProvider, selectedGroqModel, selectedOllamaModel,
        performLogoutCleanup,uiSelectedTool // No need for setIsAuthenticated, navigate here as performLogoutCleanup handles them
    ]);




     const handleToolModeChange = useCallback((toolIconClicked) => { // toolIconClicked will be 'web' or 'academic'
        console.log('[ChatPage] handleToolModeChange called with:', toolIconClicked, 'Current uiSelectedTool:', uiSelectedTool);
        setUiSelectedTool(prevTool => {
            const newTool = prevTool === toolIconClicked ? 'none' : toolIconClicked; // Toggle: if same, set to 'none'
            console.log('[ChatPage] Inside setUiSelectedTool. prevTool:', prevTool, 'newTool:', newTool);
            localStorage.setItem('uiSelectedTool', newTool);
            console.log(`[Client ChatPage] UI Tool selection changed to: ${newTool}`);
            
            let feedbackMsg = "";
            if (newTool === 'none') feedbackMsg = "Default search mode activated.";
            else if (newTool === 'web') feedbackMsg = "Web Search mode activated.";
            else if (newTool === 'academic') feedbackMsg = "Academic Search mode activated.";
            
            setError(prev => prev && (prev.includes("Session invalid") || prev.includes("Critical Error")) ? prev : feedbackMsg);
            setTimeout(() => { setError(prevError => prevError === feedbackMsg ? '' : prevError); }, 2500); // Clear feedback after a bit
            return newTool;
        });
    }, [setError]); // No dependencies needed if setError is stable
    // +++ END OF MODIFICATION +++


    const handleDocumentAnalysis = useCallback(async (analysisTypeToPerform) => {
        if (!selectedDocForAnalysis) {
            setAnalysisErrorText('Please select a document first.');
            setCurrentAnalysisType(''); return;
        }
        if (isAnalyzingDoc) return;

       console.log(`[ChatPage handleDocumentAnalysis] Value being sent as 'filename': '${selectedDocForAnalysis}'`);
       console.log(`[ChatPage handleDocumentAnalysis] selectedDocForAnalysis being sent: '${selectedDocForAnalysis}', type: '${analysisTypeToPerform}'`);


        console.log(`[Client ChatPage] Requesting ${analysisTypeToPerform.toUpperCase()} for: ${selectedDocForAnalysis}`);
        setIsAnalyzingDoc(true); setAnalysisResultText(''); setAnalysisErrorText(''); setCurrentAnalysisType(analysisTypeToPerform);
        try {
            console.log("Sending filename to analysis:", selectedDocForAnalysis);
            const response = await analyzeDocument({ type: analysisTypeToPerform, filename: selectedDocForAnalysis });
            const data = response.data;
            if (data && data.result !== undefined) {
                setAnalysisResultText(data.result);
            } else if (data && data.error) {
                throw new Error(data.error);
            } else {
                throw new Error(`Empty/invalid result for ${analysisTypeToPerform}.`);
            }
        } catch (error) {
            setAnalysisErrorText(error.response?.data?.error || error.message || `Failed ${analysisTypeToPerform}.`);
            setAnalysisResultText('');
        } finally {
            setIsAnalyzingDoc(false);
        }
    }, [selectedDocForAnalysis, isAnalyzingDoc]); // analyzeDocument is stable import

    const handleEnterKey = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isLoading &&  inputText.trim()) {
                handleSendMessage(); // No need to pass 'e' if handleSendMessage doesn't use it for this path
            }
        }
    }, [handleSendMessage, isLoading, inputText]);

    const isProcessing = isLoading || isAnalyzingDoc;


    const toggleSidebar = useCallback(() => {
        setIsSidebarExpanded(prev => !prev);
    }, []); // Empty dependency array for setIsSidebarExpanded from useState



     const handleSelectedDocChange = (newValue) => {
        setSelectedDocForAnalysis(newValue);
        setAnalysisResultText('');    // Reset result
        setAnalysisErrorText('');     // Reset error
        setCurrentAnalysisType('');   // Reset current type
    };

    console.log("[ChatPage RENDER] uiSelectedTool is currently:", uiSelectedTool);

    if (!userId && !localStorage.getItem('userId')) {
        return <div className="loading-indicator"><span>Initializing Session...</span></div>;
    }
    {console.log('[ChatPage] Rendering with uiSelectedTool:', uiSelectedTool)}
    return (
        <div className={`chat-page-container ${isSidebarExpanded ? 'sidebar-expanded' : 'sidebar-collapsed'}`}>
            <div className={`sidebar-area ${isSidebarExpanded ? '' : 'collapsed'}`}>
                <button
                    onClick={toggleSidebar}
                    className="sidebar-toggle-btn" 
                    aria-label={isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
                    aria-expanded={isSidebarExpanded} // Good for accessibility
                >
                    <FontAwesomeIcon icon={isSidebarExpanded ? faTimes : faBars} /> {/* Shows X when expanded, Bars when collapsed */}
                </button>
                
                
                 <SystemPromptWidget
                    isExpanded={isSidebarExpanded} // Pass state
                    toggleSidebar={toggleSidebar}  
                    selectedPromptId={currentSystemPromptId} 
                    promptText={editableSystemPromptText}
                    onSelectChange={handlePromptSelectChange} 
                    onTextChange={handlePromptTextChange}
                 />
                <FileUploadWidget
                    isExpanded={isSidebarExpanded} // Pass state
                    onUploadSuccess={triggerFileRefresh} 
                
                
                />
                <FileManagerWidget
                    isExpanded={isSidebarExpanded} // Pass state
                    toggleSidebar={toggleSidebar}
                    refreshTrigger={fileRefreshTrigger} 
                    
                    
                />

                {/* --- Document Analysis Section INSIDE SIDEBAR, AFTER FileManagerWidget --- */}
               <DocumentAnalysisWidget
    isExpanded={isSidebarExpanded}
    toggleSidebar={toggleSidebar} 
    availableDocs={availableDocsForAnalysis}
    selectedDoc={selectedDocForAnalysis}
    onSelectedDocChange={handleSelectedDocChange}
    isProcessing={isProcessing}
    userId={userId}
    onAnalyze={handleDocumentAnalysis}
    isAnalyzing={isAnalyzingDoc}
    currentAnalysisType={currentAnalysisType}
    analysisErrorText={analysisErrorText}
    analysisResultText={analysisResultText}
/>





                    

            </div> {/* <-- SIDEBAR ENDS HERE */}

           <div className="chat-container">
                <header className="chat-header">
                    <h1>Engineering Tutor</h1>
                    <div className="header-controls">
                        <div className="mb-3" style={{ marginRight: '15px' }}>
                            <label htmlFor="llmProviderSelect" className="form-label" style={{ marginRight: '5px', fontSize: '0.8rem' }}>AI Engine:</label>
                            <select
                                id="llmProviderSelect"
                                className="form-select form-select-sm"
                                value={`${selectedLlmProvider}${selectedLlmProvider === 'groq' ? ':' + selectedGroqModel : ''}${selectedLlmProvider === 'ollama' ? ':' + selectedOllamaModel : ''}`}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    const parts = value.split(':');
                                    const provider = parts[0];
                                    let model = parts[1] || '';

                                    setSelectedLlmProvider(provider);

                                    if (provider === 'groq') {
                                        if (!model) model = 'llama3-8b-8192'; // Default Groq model
                                        setSelectedGroqModel(model);
                                        setSelectedOllamaModel(''); // Clear Ollama model
                                        console.log(`Switched to Groq provider, model: ${model}`);
                                    } else if (provider === 'ollama') {
                                        if (!model) model = 'mistral'; // Default Ollama model
                                        setSelectedOllamaModel(model);
                                        setSelectedGroqModel(''); // Clear Groq model
                                        console.log(`Switched to Ollama provider, model: ${model}`);
                                    } else if (provider === 'gemini') {
                                        setSelectedOllamaModel(''); // Clear Ollama model
                                        setSelectedGroqModel(''); // Clear Groq model
                                        console.log('Switched to Gemini provider');
                                    }
                                }}
                                disabled={isProcessing}
                                style={{ fontSize: '0.8rem', padding: '2px 5px', borderRadius: '4px' }}
                            >
                                <option value="gemini">Google Gemini Pro</option>
                                <option value="groq:llama3-8b-8192">Groq: Llama 3 8B</option>
                                <option value="groq:llama3-70b-8192">Groq: Llama 3 70B</option>
                                <option value="groq:mixtral-8x7b-32768">Groq: Mixtral 8x7B</option>
                                <option value="groq:gemma-7b-it">Groq: Gemma 7B</option>
                                <option value="ollama:mistral">Local: Mistral 7B</option>
                                <option value="ollama:llama2">Local: Llama 2 7B</option>
                                <option value="ollama:codegemma">Local: CodeGemma 7B</option>
                            </select>
                        </div>
                        <span className="username-display">Hi, {username}!</span>
                        <button onClick={handleHistory} className="header-button history-button" disabled={isProcessing}>History</button>
                        <button onClick={handleNewChatWrapper} className="header-button newchat-button" disabled={isProcessing}>New Chat</button>
                        <button onClick={() => handleLogoutWrapper(false)} className="header-button logout-button" disabled={isProcessing}>Logout</button>
                    </div>
                </header>

                <div className="messages-area">
                    {messages.map((msg, index) => {
                        if (!msg?.role || !msg?.parts?.length || !msg.timestamp) {
                            console.warn("Skipping rendering invalid message object:", msg);
                            return <div key={`error-${index}`} className="message-error">Msg Error</div>;
                        }

                        const messageText = msg.parts[0]?.text || '';
                        const isBot = msg.role === 'model' || msg.role === 'bot'; // Accommodate 'bot' for flexibility

                        return (
                            <div key={`${sessionId}-${index}-${new Date(msg.timestamp).toISOString()}-${msg.role}`} className={`message-container ${msg.role}-message-container`}>
                                <div className={`message ${msg.role}`}>
                                    <div className="message-content">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{messageText}</ReactMarkdown>
                                    </div>
                                    {isBot && msg.thinking && (
                                        <details className="message-thinking-client" style={{ marginTop: '5px', fontSize: '0.8em' }}>
                                            <summary style={{ cursor: 'pointer', color: '#90caf9' }}>Show Reasoning</summary>
                                            <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', backgroundColor: '#333', padding: '5px', borderRadius: '4px', marginTop: '5px' }}>
                                                <code>{msg.thinking}</code>
                                            </pre>
                                        </details>
                                    )}
                                    {isBot && msg.references && msg.references.length > 0 && (
                                        <div className="message-references-client" style={{ marginTop: '5px', fontSize: '0.8em' }}>
                                            <strong style={{ color: '#b3b3b3' }}>References:</strong>
                                            <ul style={{ listStyleType: 'none', paddingLeft: '10px', margin: '5px 0 0 0' }}>
                                                {msg.references.map((ref, refIdx) => (
                                                    <li key={refIdx} title={ref.content_preview || ref.chunk_content || ''} style={{ marginBottom: '3px' }}>
                                                        [{ref.number || refIdx + 1}] {ref.source}
                                                        {ref.score && ` (Score: ${ref.score.toFixed(3)})`}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                <span className="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {(isLoading || isAnalyzingDoc) && (
                    <div className="loading-indicator">
                        <span>{isAnalyzingDoc ? 'Analyzing document...' : 'Thinking...'}</span>
                    </div>
                )}

                {!(isLoading || isAnalyzingDoc) && error && !analysisErrorText && (
                    <div className="error-indicator">{error}</div>
                )}
                {!(isLoading ||  isAnalyzingDoc) && analysisErrorText && (
                    <div className="error-indicator">{analysisErrorText}</div>
                )}

                <footer className="input-area">
                    <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={handleEnterKey}
                        placeholder="Ask your tutor..."
                        rows="1"
                        disabled={isProcessing}
                        aria-label="Chat input"
                    />
                       {/* +++ MODIFIED: Tool Toggle Buttons with correct onClick and className logic +++ */}
                       {/* +++ MODIFIED: Tool Toggle Buttons with correct onClick and className logic +++ */}
                    <div className="tool-toggle-buttons-chatpage">
                        <button 
                            onClick={() => handleToolModeChange('web')}
                           className={`tool-button-chatpage ${uiSelectedTool === 'web' ? 'active-tool' : ''}`}
                            title="Activate Web Search"
                            disabled={isProcessing}
                            aria-pressed={uiSelectedTool === 'web'}
                        >
                            <FontAwesomeIcon icon={faGlobe} />
                        </button>
                        <button
                            onClick={() => handleToolModeChange('academic')}
                            className={`tool-button-chatpage ${uiSelectedTool === 'academic' ? 'active-tool' : ''}`}
                            title="Activate Academic Search"
                            disabled={isProcessing}
                            aria-pressed={uiSelectedTool === 'academic'}
                        >
                             <FontAwesomeIcon icon={faBookOpen} /> {/* Changed to faBookOpen */}
                        </button>
                    </div>
                    {/* +++ END OF TOOL TOGGLE BUTTONS DIV +++ */}


                    
                    <button id="sendChatMessageButton" onClick={handleSendMessage} disabled={isProcessing || !inputText.trim()} title="Send Message" aria-label="Send message">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                        </svg>
                    </button>
                </footer>

                <HistoryModal isOpen={isHistoryModalOpen} onClose={closeHistoryModal} />
            </div>
        </div>
    );
};




export default ChatPage;