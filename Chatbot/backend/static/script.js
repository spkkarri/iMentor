// script.js - Frontend Logic for Local AI Tutor

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM ready.");

    // --- Configuration ---
    const API_BASE_URL = window.location.origin;
    const STATUS_CHECK_INTERVAL = 10000; // Check backend status every 10 seconds
    const ERROR_MESSAGE_DURATION = 8000; // Auto-hide error messages (ms)
    const MAX_CHAT_HISTORY_MESSAGES = 100; // Limit displayed messages (optional)

    // --- DOM Elements ---
    const uploadInput = document.getElementById('pdf-upload');
    const uploadButton = document.getElementById('upload-button');
    const uploadStatus = document.getElementById('upload-status');
    const uploadSpinner = uploadButton?.querySelector('.spinner-border');

    const analysisFileSelect = document.getElementById('analysis-file-select');
    const analysisButtons = document.querySelectorAll('.analysis-btn');
    const analysisOutputContainer = document.getElementById('analysis-output-container');
    const analysisOutput = document.getElementById('analysis-output');
    const analysisOutputTitle = document.getElementById('analysis-output-title');
    const analysisStatus = document.getElementById('analysis-status');
    const analysisReasoningContainer = document.getElementById('analysis-reasoning-container');
    const analysisReasoningOutput = document.getElementById('analysis-reasoning-output');

    const mindmapContainer = document.getElementById('mindmap-container');

    const chatHistory = document.getElementById('chat-history');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const sendSpinner = sendButton?.querySelector('.spinner-border');
    const voiceInputButton = document.getElementById('voice-input-button');
    const chatStatus = document.getElementById('chat-status'); 

    const statusMessage = document.getElementById('status-message');
    const statusMessageButton = statusMessage?.querySelector('.btn-close'); 
    const connectionStatus = document.getElementById('connection-status');
    const sessionIdDisplay = document.getElementById('session-id-display');

    // --- State ---
    let sessionId = localStorage.getItem('aiTutorSessionId') || null;
    let allFiles = { default: [], uploaded: [] };
    let backendStatus = { 
        db: false,
        ai: false,
        vectorStore: false,
        vectorCount: 0,
        error: null
    };
    let isListening = false;
    let statusCheckTimer = null;
    let statusMessageTimerId = null; 
    let mermaidInitialized = false; 
    let currentSpeechUtterance = null; // To keep track of the current speech

    // --- MERMAID INITIALIZATION ---
    async function initializeMermaid() {
        if (window.mermaid && !mermaidInitialized) {
            try {
                console.log("Initializing Mermaid.js...");
                window.mermaid.initialize({
                    startOnLoad: false,
                    theme: 'dark',
                    logLevel: 'warn', 
                    flowchart: { 
                        htmlLabels: true
                    },
                });
                await window.mermaid.run({ nodes: [] }); 
                mermaidInitialized = true;
                console.log("Mermaid.js initialized successfully.");
            } catch (e) {
                console.error("Failed to initialize Mermaid.js:", e);
                showStatusMessage("Error initializing Mind Map renderer. Mind maps may not display.", "warning");
            }
        } else if (mermaidInitialized) {
            // console.log("Mermaid.js already initialized."); 
        } else if (!window.mermaid) {
            console.warn("Mermaid.js library not detected. Mind map rendering will fail. Check script tag in HTML.");
        }
    }
    // --- END MERMAID INITIALIZATION ---

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    if (SpeechRecognition) {
        try {
            recognition = new SpeechRecognition();
            recognition.continuous = false; 
            recognition.lang = 'en-US';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                chatInput.value = transcript;
                stopListeningUI();
                 handleSendMessage();
            };
            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error, event.message);
                setChatStatus(`Speech error: ${event.error}`, 'warning'); 
                stopListeningUI();
            };
            recognition.onend = () => {
                if (isListening) stopListeningUI();
            };
        } catch (e) {
             console.error("Error initializing SpeechRecognition:", e);
             recognition = null;
             if (voiceInputButton) voiceInputButton.title = "Voice input failed to initialize";
        }
    } else {
        console.warn("Speech Recognition not supported by this browser.");
        if (voiceInputButton) voiceInputButton.title = "Voice input not supported by browser";
    }

    // --- Speech Synthesis Setup ---
    const synth = window.speechSynthesis;
    let currentlySpeakingButton = null;

    function initializeApp() {
        console.log("Initializing App...");
        showInitialLoading();
        initializeMermaid(); 
        setupEventListeners();
        checkBackendStatus(true); 
        if (statusCheckTimer) clearInterval(statusCheckTimer);
        statusCheckTimer = setInterval(() => checkBackendStatus(false), STATUS_CHECK_INTERVAL);
    }

    function showInitialLoading() {
        clearChatHistory();
        addMessageToChat('bot', "Connecting to AI Tutor backend...", [], null, 'loading-msg');
        setConnectionStatus('Initializing...', 'secondary');
        updateControlStates(); 
    }

    function onBackendReady() {
         console.log("Backend is ready.");
         loadAndPopulateDocuments(); 
         if (sessionId) {
             console.log("Existing session ID found:", sessionId);
             setSessionIdDisplay(sessionId);
             loadChatHistory(sessionId);
         } else {
             console.log("No session ID found. Will generate on first message.");
             clearChatHistory(); 
             addMessageToChat('bot', "Welcome! Ask questions about the documents, or upload your own using the controls.");
             setSessionIdDisplay(null);
         }
         updateControlStates();
    }

     function onBackendUnavailable(errorMsg = "Backend connection failed.") {
         console.error("Backend is unavailable:", errorMsg);
         clearChatHistory();
         addMessageToChat('bot', `Error: ${errorMsg} Please check the server logs and ensure Ollama is running. Features will be limited.`);
         updateControlStates(); 
     }

    function updateControlStates() {
        const isDbReady = backendStatus.db;
        const isAiReady = backendStatus.ai;
        const canUpload = isAiReady;
        const canSelectAnalysis = isDbReady && (allFiles.default.length > 0 || allFiles.uploaded.length > 0);
        const canExecuteAnalysis = isAiReady && analysisFileSelect && analysisFileSelect.value;
        const canChat = isAiReady;
        disableChatInput(!canChat);
        if (uploadButton) uploadButton.disabled = !(canUpload && uploadInput?.files?.length > 0);
        if (analysisFileSelect) analysisFileSelect.disabled = !canSelectAnalysis;
        disableAnalysisButtons(!canExecuteAnalysis);
        if (voiceInputButton) {
            voiceInputButton.disabled = !(canChat && recognition); 
            voiceInputButton.title = (canChat && recognition) ? "Start Voice Input" : (recognition ? "Chat disabled" : "Voice input not supported/initialized");
        }
        setChatStatus(canChat ? "Ready" : (isDbReady ? "AI Offline" : "Backend Offline"), canChat ? 'muted' : 'warning'); 
        if (uploadStatus) setElementStatus(uploadStatus, canUpload ? "Select a PDF to upload." : (isDbReady ? "AI Offline" : "Backend Offline"), canUpload ? 'muted' : 'warning');
        if (analysisStatus) {
             if (!canSelectAnalysis) setElementStatus(analysisStatus, "Backend Offline or No Docs", 'warning');
             else if (!analysisFileSelect?.value) setElementStatus(analysisStatus, "Select document & analysis type.", 'muted');
             else if (!isAiReady) setElementStatus(analysisStatus, "AI Offline", 'warning');
             else setElementStatus(analysisStatus, `Ready to analyze ${escapeHtml(analysisFileSelect.value)}.`, 'muted');
        }
    }

    function setupEventListeners() {
        if (uploadButton) uploadButton.addEventListener('click', handleUpload);
        analysisButtons.forEach(button => button?.addEventListener('click', () => handleAnalysis(button.dataset.analysisType)));
        if (sendButton) sendButton.addEventListener('click', handleSendMessage);
        if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendButton?.disabled) handleSendMessage(); } });
        if (recognition && voiceInputButton) voiceInputButton.addEventListener('click', toggleListening);
        if (analysisFileSelect) analysisFileSelect.addEventListener('change', handleAnalysisFileSelection); 
        if (uploadInput) uploadInput.addEventListener('change', handleFileInputChange);
        if (statusMessageButton) statusMessageButton.addEventListener('click', () => clearTimeout(statusMessageTimerId)); 
        console.log("Event listeners setup.");
    }

    async function checkBackendStatus(isInitialCheck = false) {
        if (!connectionStatus || !API_BASE_URL) return;
        const previousStatus = { ...backendStatus }; 
        try {
            const response = await fetch(`${API_BASE_URL}/status?t=${Date.now()}`); 
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Status check failed: ${response.status}`);
            backendStatus.db = data.database_initialized;
            backendStatus.ai = data.ai_components_loaded;
            backendStatus.vectorStore = data.vector_store_loaded;
            backendStatus.vectorCount = data.vector_store_entries || 0;
            backendStatus.error = null; 
            const statusChanged = JSON.stringify(backendStatus) !== JSON.stringify(previousStatus);
            if (isInitialCheck || statusChanged) {
                console.log("Status changed or initial check:", data);
                updateConnectionStatusUI(); 
                if (isInitialCheck) {
                    if (backendStatus.db) onBackendReady(); 
                    else onBackendUnavailable("Database initialization failed.");
                } else {
                    if ((backendStatus.db && !previousStatus.db) || (backendStatus.ai && !previousStatus.ai)) {
                         hideStatusMessage();
                    }
                    if (backendStatus.ai && !previousStatus.ai) {
                        loadAndPopulateDocuments();
                    }
                }
                updateControlStates(); 
            }
        } catch (error) {
            console.error("Backend connection check failed:", error);
            const errorMsg = `Backend connection error: ${error.message || 'Unknown reason'}.`;
            if (backendStatus.db || backendStatus.ai || isInitialCheck) {
                 backendStatus.db = false;
                 backendStatus.ai = false;
                 backendStatus.vectorStore = false;
                 backendStatus.vectorCount = 0;
                 backendStatus.error = errorMsg;
                 updateConnectionStatusUI(); 
                 if (isInitialCheck) onBackendUnavailable(errorMsg);
                 updateControlStates(); 
            }
        }
    }

    function updateConnectionStatusUI() {
         if (!connectionStatus) return;
         let statusText = 'Unknown';
         let statusType = 'secondary';
         let persistentMessage = null;
         let messageType = 'danger';
         if (backendStatus.ai) { 
             const vectorText = backendStatus.vectorStore ? `(${backendStatus.vectorCount} vectors)` : '(Index Error)';
             statusText = `Ready ${vectorText}`;
             statusType = 'success';
             if (!backendStatus.vectorStore) { 
                 persistentMessage = "AI Ready, but Vector Store failed to load. RAG context unavailable.";
                 messageType = 'warning';
             }
         } else if (backendStatus.db) { 
             statusText = 'AI Offline';
             statusType = 'warning';
             persistentMessage = "Backend running, but AI components failed. Chat/Analysis/Upload unavailable.";
             messageType = 'warning';
         } else { 
             statusText = 'Backend Offline';
             statusType = 'danger';
             persistentMessage = backendStatus.error || "Cannot connect to backend or database failed. Check server.";
             messageType = 'danger';
         }
         setConnectionStatus(statusText, statusType);
         if(persistentMessage) {
             showStatusMessage(persistentMessage, messageType, 0); 
         } else {
             if (statusMessage?.style.display !== 'none' && !statusMessageTimerId) {
                  hideStatusMessage();
             }
         }
    }

    function setConnectionStatus(text, type = 'info') {
         if (!connectionStatus) return;
         connectionStatus.textContent = text;
         connectionStatus.className = `badge bg-${type}`; 
    }

    function showStatusMessage(message, type = 'info', duration = ERROR_MESSAGE_DURATION) {
        if (!statusMessage) return;
        statusMessage.childNodes[0].nodeValue = message; 
        statusMessage.className = `alert alert-${type} alert-dismissible fade show ms-3`; 
        statusMessage.style.display = 'block';
        if (statusMessageTimerId) clearTimeout(statusMessageTimerId);
        statusMessageTimerId = null; 
        if (duration > 0) {
            statusMessageTimerId = setTimeout(() => {
                const bsAlert = bootstrap.Alert.getInstance(statusMessage);
                if (bsAlert) bsAlert.close();
                else statusMessage.style.display = 'none'; 
                statusMessageTimerId = null; 
            }, duration);
        }
    }

    function hideStatusMessage() {
        if (!statusMessage) return;
        const bsAlert = bootstrap.Alert.getInstance(statusMessage);
        if (bsAlert) bsAlert.close();
        else statusMessage.style.display = 'none';
        if (statusMessageTimerId) clearTimeout(statusMessageTimerId);
        statusMessageTimerId = null;
    }

    function setChatStatus(message, type = 'muted') {
        if (!chatStatus) return; 
        chatStatus.textContent = message;
        chatStatus.className = `mb-1 small text-center text-${type}`;
    }

    function setElementStatus(element, message, type = 'muted') {
        if (!element) return;
        element.textContent = message;
        element.className = `small text-${type}`; 
    }

    function setSessionIdDisplay(sid) {
        if (sessionIdDisplay) {
            sessionIdDisplay.textContent = sid ? `Session: ${sid.substring(0, 8)}...` : '';
        }
    }

    function clearChatHistory() {
        if (chatHistory) chatHistory.innerHTML = '';
        if (synth && synth.speaking) { // Stop any ongoing speech when clearing history
            synth.cancel();
        }
        currentSpeechUtterance = null;
        currentlySpeakingButton = null;
    }

     function escapeHtml(unsafe) {
         if (typeof unsafe !== 'string') {
             if (unsafe === null || typeof unsafe === 'undefined') return '';
             try { unsafe = String(unsafe); } catch (e) { return ''; }
         }
         return unsafe
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, '"')
.replace(/'/g, "'");
      }

    function addMessageToChat(sender, text, references = [], thinking = null, messageId = null) {
        if (!chatHistory) return;
        while (chatHistory.children.length >= MAX_CHAT_HISTORY_MESSAGES) {
            chatHistory.removeChild(chatHistory.firstChild);
        }
        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message-wrapper', `${sender}-wrapper`);
        if(messageId) messageWrapper.dataset.messageId = messageId;
        
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');
        
        let textForTTS = text; // Default text for TTS

        if (sender === 'bot' && text) {
            try {
                if (typeof marked === 'undefined') {
                    console.warn("marked.js not loaded. Displaying raw text.");
                    const pre = document.createElement('pre');
                    pre.textContent = text;
                    messageDiv.appendChild(pre); 
                    textForTTS = text; // Raw text
                } else {
                    marked.setOptions({ breaks: true, gfm: true, sanitize: false }); 
                    messageDiv.innerHTML = marked.parse(text);
                    // For TTS, try to get the text content after markdown parsing
                    // This helps strip markdown syntax for cleaner speech.
                    textForTTS = messageDiv.textContent || text;
                }
            } catch (e) {
                console.error("Error rendering Markdown:", e);
                const pre = document.createElement('pre');
                pre.textContent = text; 
                messageDiv.appendChild(pre);
                textForTTS = text;
            }
        } else if (text) {
            messageDiv.textContent = text; 
            textForTTS = text;
        } else {
            const emptyMsgText = `[${sender === 'bot' ? 'Empty Bot Response' : 'Empty User Message'}]`;
            messageDiv.textContent = emptyMsgText;
            textForTTS = emptyMsgText;
        }
        messageWrapper.appendChild(messageDiv);

        // Add TTS button for bot messages
        if (sender === 'bot' && synth) {
            const ttsButton = document.createElement('button');
            ttsButton.classList.add('tts-button');
            ttsButton.setAttribute('aria-label', 'Play message audio');
            ttsButton.title = 'Listen to message';
            ttsButton.innerHTML = '<i class="fa fa-volume-up" aria-hidden="true"></i>';
            
            // Store text content directly for TTS to avoid issues with complex HTML
            const cleanTextForTTS = messageDiv.textContent.trim(); // Get text content after markdown processing

            ttsButton.addEventListener('click', () => {
                handlePlayTTS(cleanTextForTTS, ttsButton);
            });
            messageDiv.appendChild(ttsButton); // Append to messageDiv for positioning
        }


        if (sender === 'bot' && thinking) {
            const thinkingDiv = document.createElement('div');
            thinkingDiv.classList.add('message-thinking');
            thinkingDiv.innerHTML = `
                <details>
                    <summary class="text-info small fw-bold">Show Reasoning</summary>
                    <pre><code>${escapeHtml(thinking)}</code></pre>
                </details>`;
            messageWrapper.appendChild(thinkingDiv);
        }
        if (sender === 'bot' && references && references.length > 0) {
            const referencesDiv = document.createElement('div');
            referencesDiv.classList.add('message-references');
            let refHtml = '<strong class="small text-warning">References:</strong><ul class="list-unstyled mb-0 small">';
            references.forEach(ref => {
                if (ref && typeof ref === 'object') {
                    const source = escapeHtml(ref.source || 'Unknown Source');
                    const preview = escapeHtml(ref.content_preview || 'No preview available');
                    const number = escapeHtml(ref.number || '?');
                    refHtml += `<li class="ref-item">[${number}] <span class="ref-source" title="Preview: ${preview}">${source}</span></li>`;
                } else {
                    console.warn("Invalid reference item found:", ref);
                }
            });
            refHtml += '</ul>';
            referencesDiv.innerHTML = refHtml;
            messageWrapper.appendChild(referencesDiv);
        }
        chatHistory.appendChild(messageWrapper);
        chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
    }


    function handlePlayTTS(textToSpeak, buttonElement) {
        if (!synth) {
            showStatusMessage("Speech synthesis not supported by this browser.", "warning");
            return;
        }

        // If this button is already associated with the speaking utterance, cancel (stop) it.
        if (synth.speaking && currentlySpeakingButton === buttonElement) {
            synth.cancel();
            // UI reset will be handled by onend/onerror of the utterance
            return;
        }

        // If another message is speaking, cancel it first.
        if (synth.speaking) {
            synth.cancel();
            // Reset the previously speaking button's UI if it exists
            if (currentlySpeakingButton) {
                currentlySpeakingButton.innerHTML = '<i class="fa fa-volume-up" aria-hidden="true"></i>';
                currentlySpeakingButton.classList.remove('speaking');
                currentlySpeakingButton.title = 'Listen to message';
            }
        }
        
        currentSpeechUtterance = new SpeechSynthesisUtterance(textToSpeak);
        
        currentSpeechUtterance.onstart = () => {
            console.log("Speech started for:", textToSpeak.substring(0,30)+"...");
            buttonElement.innerHTML = '<i class="fa fa-stop" aria-hidden="true"></i>';
            buttonElement.classList.add('speaking');
            buttonElement.title = 'Stop listening';
            currentlySpeakingButton = buttonElement;
        };

        currentSpeechUtterance.onend = () => {
            console.log("Speech finished.");
            if (buttonElement === currentlySpeakingButton) { // Ensure it's the correct button
                buttonElement.innerHTML = '<i class="fa fa-volume-up" aria-hidden="true"></i>';
                buttonElement.classList.remove('speaking');
                buttonElement.title = 'Listen to message';
                currentlySpeakingButton = null;
                currentSpeechUtterance = null;
            }
        };

        currentSpeechUtterance.onerror = (event) => {
            console.error("Speech synthesis error:", event.error);
            showStatusMessage(`Speech error: ${event.error}`, "danger");
            if (buttonElement === currentlySpeakingButton) {
                buttonElement.innerHTML = '<i class="fa fa-volume-up" aria-hidden="true"></i>';
                buttonElement.classList.remove('speaking');
                buttonElement.title = 'Listen to message';
                currentlySpeakingButton = null;
                currentSpeechUtterance = null;
            }
        };
        
        // Optional: Select a specific voice if desired
        // const voices = synth.getVoices();
        // if (voices.length > 0) {
        // currentSpeechUtterance.voice = voices.find(v => v.lang === 'en-US' && v.name.includes('Google')); // Example
        // }
        
        synth.speak(currentSpeechUtterance);
    }


    function updateAnalysisDropdown() {
        if (!analysisFileSelect) return;
        const previouslySelected = analysisFileSelect.value;
        analysisFileSelect.innerHTML = ''; 
        const createOption = (filename, isUploaded = false) => {
            const option = document.createElement('option');
            option.value = filename; 
            option.textContent = filename;
            option.classList.add('file-option');
            if (isUploaded) option.classList.add('uploaded');
            return option;
        };
        const hasFiles = allFiles.default.length > 0 || allFiles.uploaded.length > 0;
        const placeholder = document.createElement('option');
        placeholder.textContent = hasFiles ? "Select a document..." : "No documents available";
        placeholder.disabled = true;
        placeholder.selected = !previouslySelected || !hasFiles; 
        placeholder.value = "";
        analysisFileSelect.appendChild(placeholder);
        if (!hasFiles) {
            analysisFileSelect.disabled = true;
            disableAnalysisButtons(true);
            return; 
        }
        if (allFiles.default.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = "Default Documents";
            allFiles.default.forEach(f => optgroup.appendChild(createOption(f, false)));
            analysisFileSelect.appendChild(optgroup);
        }
        if (allFiles.uploaded.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = "Uploaded Documents";
            allFiles.uploaded.forEach(f => optgroup.appendChild(createOption(f, true)));
            analysisFileSelect.appendChild(optgroup);
        }
        analysisFileSelect.disabled = !backendStatus.db; 
        const previousOptionExists = Array.from(analysisFileSelect.options).some(opt => opt.value === previouslySelected);
        if (previouslySelected && previousOptionExists) {
            analysisFileSelect.value = previouslySelected;
        } else {
             analysisFileSelect.value = "";
        }
        handleAnalysisFileSelection();
    }

    function handleAnalysisFileSelection() {
        const fileSelected = analysisFileSelect && analysisFileSelect.value;
        const shouldEnable = fileSelected && backendStatus.ai;
        disableAnalysisButtons(!shouldEnable);
         if (!fileSelected) {
             setElementStatus(analysisStatus, "Select document & analysis type.", 'muted');
         } else if (!backendStatus.ai) {
             setElementStatus(analysisStatus, "AI components offline.", 'warning');
         } else {
             setElementStatus(analysisStatus, `Ready to analyze ${escapeHtml(analysisFileSelect.value)}.`, 'muted');
         }
         if (analysisOutputContainer) analysisOutputContainer.style.display = 'none';
         if (mindmapContainer) mindmapContainer.style.display = 'none';
         if (analysisReasoningContainer) analysisReasoningContainer.style.display = 'none';
    }

     function handleFileInputChange() {
         const canUpload = backendStatus.ai;
         if (uploadButton) uploadButton.disabled = !(uploadInput.files.length > 0 && canUpload);
         if (uploadInput.files.length > 0) {
              setElementStatus(uploadStatus, `Selected: ${escapeHtml(uploadInput.files[0].name)}`, 'muted');
         } else {
              setElementStatus(uploadStatus, canUpload ? 'No file selected.' : 'AI Offline', canUpload ? 'muted' : 'warning');
         }
     }

    function disableAnalysisButtons(disabled = true) {
        analysisButtons.forEach(button => button && (button.disabled = disabled));
    }

    function disableChatInput(disabled = true) {
        if (chatInput) chatInput.disabled = disabled;
        if (sendButton) sendButton.disabled = disabled;
        if (voiceInputButton) voiceInputButton.disabled = disabled || !recognition;
    }

    function showSpinner(spinnerElement, show = true) {
         if (spinnerElement) spinnerElement.style.display = show ? 'inline-block' : 'none';
    }

    async function loadAndPopulateDocuments() {
        if (!API_BASE_URL || !analysisFileSelect) return;
        console.log("Loading document list...");
        analysisFileSelect.disabled = true;
        analysisFileSelect.innerHTML = '<option selected disabled value="">Loading...</option>';
        try {
            const response = await fetch(`${API_BASE_URL}/documents?t=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if(data.errors) {
                 console.warn("Errors loading document lists:", data.errors);
                 showStatusMessage(`Warning: Could not load some document lists: ${data.errors.join(', ')}`, 'warning');
            }
            allFiles.default = data.default_files || [];
            allFiles.uploaded = data.uploaded_files || [];
            console.log(`Loaded ${allFiles.default.length} default, ${allFiles.uploaded.length} uploaded docs.`);
            updateAnalysisDropdown(); 
        } catch (error) {
            console.error("Error loading document list:", error);
            showStatusMessage("Could not load the list of available documents.", 'warning');
            analysisFileSelect.innerHTML = '<option selected disabled value="">Error loading</option>';
            disableAnalysisButtons(true);
        } finally {
            updateControlStates();
        }
    }

    async function handleUpload() {
        if (!uploadInput || !uploadStatus || !uploadButton || !uploadSpinner || !API_BASE_URL || !backendStatus.ai) return;
        const file = uploadInput.files[0];
        if (!file) { setElementStatus(uploadStatus, "Select a PDF first.", 'warning'); return; }
        if (!file.name.toLowerCase().endsWith(".pdf")) { setElementStatus(uploadStatus, "Invalid file: PDF only.", 'warning'); return; }

        setElementStatus(uploadStatus, `Uploading ${escapeHtml(file.name)}...`);
        uploadButton.disabled = true;
        showSpinner(uploadSpinner, true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Upload failed: ${response.status}`);
            const successMsg = result.message || `Processed ${escapeHtml(result.filename)}.`;
            setElementStatus(uploadStatus, successMsg, 'success');
            showStatusMessage(`File '${escapeHtml(result.filename)}' added. KB: ${result.vector_count >= 0 ? result.vector_count : 'N/A'} vectors.`, 'success');
            await loadAndPopulateDocuments(); 
            uploadInput.value = ''; 
            handleFileInputChange(); 
        } catch (error) {
            console.error("Upload error:", error);
            const errorMsg = error.message || "Unknown upload error.";
            setElementStatus(uploadStatus, `Error: ${errorMsg}`, 'danger');
            showStatusMessage(`Upload Error: ${errorMsg}`, 'danger');
             uploadButton.disabled = !backendStatus.ai; 
        } finally {
             showSpinner(uploadSpinner, false);
        }
    }

    // This utility function is no longer needed for the mindmap, but kept for potential other uses.
    function stripThinkingTags(text) {
        if (typeof text !== 'string') return text;
        const thinkingRegex = /^\s*<think(ing)?\b[^>]*>[\s\S]*?<\/think(ing)?\s*>\s*/i;
        return text.replace(thinkingRegex, '').trim();
    }

    async function handleAnalysis(analysisType) {
        if (!analysisFileSelect || !analysisStatus || !analysisOutputContainer || !analysisOutput ||
            !mindmapContainer || !analysisReasoningContainer || !analysisReasoningOutput ||
            !API_BASE_URL || !backendStatus.ai) {
            console.error("Analysis prerequisites missing or AI offline.");
            setElementStatus(analysisStatus, "Error: UI components missing or AI offline.", 'danger');
            return;
        }
        const filename = analysisFileSelect.value;
        if (!filename) { setElementStatus(analysisStatus, "Select a document.", 'warning'); return; }

        console.log(`Starting analysis: Type=${analysisType}, File=${filename}`);
        setElementStatus(analysisStatus, `Generating ${analysisType} for ${escapeHtml(filename)}...`);
        disableAnalysisButtons(true);

        // Reset UI elements before new analysis
        analysisOutputContainer.style.display = 'none';
        mindmapContainer.style.display = 'none';
        analysisOutput.innerHTML = '';
        analysisReasoningOutput.textContent = '';
        analysisReasoningContainer.style.display = 'none';

        const mermaidChartDiv = mindmapContainer.querySelector('.mermaid');
        if (mermaidChartDiv) {
            mermaidChartDiv.innerHTML = ''; 
            mermaidChartDiv.removeAttribute('data-processed'); 
        }

        try {
            const response = await fetch(`${API_BASE_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, analysis_type: analysisType }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Analysis failed: ${response.status}`);

            setElementStatus(analysisStatus, `Analysis complete for ${escapeHtml(filename)}.`, 'success');

            if (result.thinking) {
                analysisReasoningOutput.textContent = result.thinking;
                analysisReasoningContainer.style.display = 'block';
            }

            if (analysisOutputTitle) analysisOutputTitle.textContent = `${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} Analysis:`;
            
            let analysisContent = result.content || "[No content generated]";

            if (analysisType === 'mindmap') {
                // BUG FIX: The original code incorrectly stripped the ```mermaid ... ``` code fences.
                // The Mermaid.js library needs the complete code block to render.
                // The backend already removes the <thinking> part, so `analysisContent` is ready to use.

                analysisOutputContainer.style.display = 'block';
                mindmapContainer.style.display = 'block';
                
                // Display raw code for debugging
                analysisOutput.innerHTML = `<p class="small">Raw Mermaid.js Code:</p><pre><code>${escapeHtml(analysisContent)}</code></pre>`;

                if (mermaidChartDiv) {
                    if (typeof mermaid !== 'undefined' && mermaid.run && mermaidInitialized) {
                        mermaidChartDiv.textContent = analysisContent; // Pass the full code block
                        mermaidChartDiv.removeAttribute('data-processed');
                        try {
                            await mermaid.run({ nodes: [mermaidChartDiv] });
                            console.log("Mermaid diagram rendered.");
                        } catch (renderError) {
                            console.error("Mermaid rendering error:", renderError);
                            const errMessage = renderError.message || String(renderError);
                            mermaidChartDiv.innerHTML = `<div class="text-danger p-2"><strong>Mermaid Render Error:</strong><br>${escapeHtml(errMessage)}<br><small>Check console. The AI may have generated invalid Mermaid syntax.</small></div>`;
                            showStatusMessage(`Mermaid Render Error: ${errMessage.substring(0,100)}...`, 'danger');
                        }
                    } else {
                        const errText = !mermaidInitialized ? "Mermaid.js not initialized." : "Mermaid.js library not available.";
                        mermaidChartDiv.innerHTML = `<div class="text-danger p-2">${errText}</div>`;
                        showStatusMessage(errText, 'danger');
                    }
                }
            } else { // Handle FAQ, Topics, and other text-based analysis
                analysisOutputContainer.style.display = 'block';
                if (typeof marked !== 'undefined') {
                    marked.setOptions({ breaks: true, gfm: true, sanitize: false });
                    analysisOutput.innerHTML = marked.parse(analysisContent);
                } else {
                    analysisOutput.textContent = analysisContent;
                }
            }
        } catch (error) {
            console.error("Analysis error in JS handleAnalysis:", error);
            const errorMsg = error.message || "Unknown analysis error.";
            setElementStatus(analysisStatus, `Error: ${errorMsg}`, 'danger');
            showStatusMessage(`Analysis Error: ${errorMsg}`, 'danger');
            analysisOutputContainer.style.display = 'none';
            mindmapContainer.style.display = 'none';
            analysisReasoningContainer.style.display = 'none';
        } finally {
            const fileSelected = analysisFileSelect && analysisFileSelect.value;
            const shouldEnable = fileSelected && backendStatus.ai;
            disableAnalysisButtons(!shouldEnable);
        }
    }

    async function handleSendMessage() {
        if (!chatInput || !sendButton || !sendSpinner || !API_BASE_URL || !backendStatus.ai) return;
        const query = chatInput.value.trim();
        if (!query) return;

        // If speech is ongoing, stop it before sending a new message
        if (synth && synth.speaking) {
            synth.cancel();
        }

        addMessageToChat('user', query);
        chatInput.value = '';
        setChatStatus('AI Tutor is thinking...'); 
        disableChatInput(true);
        showSpinner(sendSpinner, true);
        try {
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: query, session_id: sessionId }),
            });
            const result = await response.json(); 
            if (!response.ok) {
                 const errorDetail = result.error || `Request failed: ${response.status}`;
                 const displayError = result.answer || `Sorry, error: ${errorDetail}`;
                 addMessageToChat('bot', displayError, result.references || [], result.thinking || null);
                 throw new Error(errorDetail);
            }
            if (result.session_id && sessionId !== result.session_id) {
                sessionId = result.session_id;
                localStorage.setItem('aiTutorSessionId', sessionId);
                setSessionIdDisplay(sessionId);
                console.log("Session ID updated:", sessionId);
            }
            addMessageToChat('bot', result.answer, result.references || [], result.thinking || null);
            setChatStatus('Ready'); 
        } catch (error) {
            console.error("Chat error:", error);
            const errorMsg = error.message || "Unknown network/server error.";
             const lastBotMessage = chatHistory?.querySelector('.bot-wrapper:last-child .bot-message');
             if (!lastBotMessage || !lastBotMessage.textContent?.includes("Sorry, error:")) {
                  addMessageToChat('bot', `Sorry, could not get response: ${errorMsg}`);
             }
            setChatStatus(`Error: ${errorMsg.substring(0, 50)}...`, 'danger'); 
        } finally {
            disableChatInput(!backendStatus.ai); 
            showSpinner(sendSpinner, false);
            if(backendStatus.ai && chatInput) chatInput.focus();
        }
    }

    async function loadChatHistory(sid) {
        if (!sid || !chatHistory || !API_BASE_URL || !backendStatus.db) {
             addMessageToChat('bot', 'Cannot load history: Missing session ID or database unavailable.');
             return;
        }
        setChatStatus('Loading history...'); 
        disableChatInput(true);
        clearChatHistory(); // This will also cancel any ongoing speech
        try {
            const response = await fetch(`${API_BASE_URL}/history?session_id=${sid}&t=${Date.now()}`);
             if (!response.ok) {
                 if (response.status === 404 || response.status === 400) {
                     console.warn(`History not found or invalid session ID (${sid}, Status: ${response.status}). Clearing local session.`);
                     localStorage.removeItem('aiTutorSessionId');
                     sessionId = null;
                     setSessionIdDisplay(null);
                     addMessageToChat('bot', "Couldn't load previous session. Starting fresh.");
                 } else {
                     const result = await response.json().catch(() => ({}));
                     throw new Error(result.error || `Failed to load history: ${response.status}`);
                 }
                 return; 
             }
             const history = await response.json();
             if (history.length > 0) {
                 history.forEach(msg => addMessageToChat(
                     msg.sender,
                     msg.message_text,
                     msg.references || [], 
                     msg.thinking || null, 
                     msg.message_id
                 ));
                 console.log(`Loaded ${history.length} messages for session ${sid}`);
                 addMessageToChat('bot', "--- Previous chat restored ---");
             } else {
                  addMessageToChat('bot', "Welcome back! Continue your chat.");
             }
             setTimeout(() => chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'auto' }), 100);
        } catch (error) {
            console.error("Error loading chat history:", error);
             clearChatHistory();
             addMessageToChat('bot', `Error loading history: ${error.message}. Starting new chat.`);
             localStorage.removeItem('aiTutorSessionId');
             sessionId = null;
             setSessionIdDisplay(null);
        } finally {
            setChatStatus(backendStatus.ai ? 'Ready' : 'AI Offline', backendStatus.ai ? 'muted' : 'warning'); 
            disableChatInput(!backendStatus.ai); 
        }
    }

    function toggleListening() {
        if (!recognition || !voiceInputButton || voiceInputButton.disabled) return;
        if (isListening) {
            recognition.stop();
            console.log("Speech recognition stopped manually.");
        } else {
             // If speech synthesis is ongoing, stop it
            if (synth && synth.speaking) {
                synth.cancel();
            }
            try {
                recognition.start();
                startListeningUI();
                console.log("Speech recognition started.");
            } catch (error) {
                console.error("Error starting speech recognition:", error);
                setChatStatus("Voice input error. Check mic?", 'warning'); 
                stopListeningUI(); 
            }
        }
    }

    function startListeningUI() {
        isListening = true;
        if (voiceInputButton) {
            voiceInputButton.classList.add('listening', 'btn-danger');
            voiceInputButton.classList.remove('btn-outline-secondary');
            voiceInputButton.title = "Stop Listening";
            voiceInputButton.innerHTML = '<i class="fa fa-microphone-slash" aria-hidden="true"></i>'; 
        }
        setChatStatus('Listening...'); 
    }

    function stopListeningUI() {
        isListening = false;
        if (voiceInputButton) {
            voiceInputButton.classList.remove('listening', 'btn-danger');
            voiceInputButton.classList.add('btn-outline-secondary');
            voiceInputButton.title = "Start Voice Input";
            voiceInputButton.innerHTML = '<i class="fa fa-microphone" aria-hidden="true"></i>'; 
        }
        if (chatStatus && chatStatus.textContent === 'Listening...') {
             setChatStatus(backendStatus.ai ? 'Ready' : 'AI Offline', backendStatus.ai ? 'muted' : 'warning'); 
        }
    }

    initializeApp();

}); // End DOMContentLoaded
