document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM ready.");

    // --- Configuration ---
    const API_BASE_URL = window.location.origin;
    const STATUS_CHECK_INTERVAL = 10000;
    const ERROR_MESSAGE_DURATION = 8000;
    const MAX_CHAT_HISTORY_MESSAGES = 100;

    // --- DOM Elements ---
    const landingView = document.getElementById('landing-view');
    const signupView = document.getElementById('signup-view');
    const loginView = document.getElementById('login-view');
    const mainAppContainer = document.getElementById('main-app-container');
    const showLoginBtn = document.getElementById('show-login-btn');
    const showSignupBtn = document.getElementById('show-signup-btn');
    const showLoginFromSignup = document.getElementById('show-login-from-signup');
    const showSignupFromLogin = document.getElementById('show-signup-from-login');
    const logoutButton = document.getElementById('logout-button');
    const usernameDisplay = document.getElementById('username-display');
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');
    const signupErrorDiv = document.getElementById('signup-error');
    const loginErrorDiv = document.getElementById('login-error');
    const signupFirstname = document.getElementById('signup-firstname');
    const signupLastname = document.getElementById('signup-lastname');
    const signupUsername = document.getElementById('signup-username');
    const signupGender = document.getElementById('signup-gender');
    const signupMobile = document.getElementById('signup-mobile');
    const signupEmail = document.getElementById('signup-email');
    const signupOrganization = document.getElementById('signup-organization');
    const signupPassword = document.getElementById('signup-password');
    const signupConfirmPassword = document.getElementById('signup-confirm-password');
    const loginIdentifier = document.getElementById('login-identifier');
    const loginPassword = document.getElementById('login-password');
    const uploadInput = document.getElementById('pdf-upload');
    const uploadButton = document.getElementById('upload-button');
    const uploadStatus = document.getElementById('upload-status');
    const uploadSpinner = uploadButton?.querySelector('.spinner-border');
    const analysisFileSelect = document.getElementById('analysis-file-select');
    const analysisButtons = document.querySelectorAll('.analysis-btn'); // This will now include podcast button
    const analysisOutputContainer = document.getElementById('analysis-output-container');
    const analysisOutput = document.getElementById('analysis-output');
    const analysisOutputTitle = document.getElementById('analysis-output-title');
    const analysisStatus = document.getElementById('analysis-status');
    const analysisReasoningContainer = document.getElementById('analysis-reasoning-container');
    const analysisReasoningOutput = document.getElementById('analysis-reasoning-output');
    const mindmapOutputContainer = document.getElementById('mindmap-output-container');
    const latexSourceContainer = document.getElementById('latex-source-container');
    const latexSourceOutput = document.getElementById('latex-source-output');
    const chatHistory = document.getElementById('chat-history');
    const thinkingMessagesContainer = document.getElementById('thinking-messages-container');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const sendSpinner = sendButton?.querySelector('.spinner-border');
    const voiceInputButton = document.getElementById('voice-input-button');
    const pauseButton = document.getElementById('pause-button');
    const stopButton = document.getElementById('stop-button');
    const chatStatus = document.getElementById('chat-status');
    const statusMessage = document.getElementById('status-message');
    const statusMessageButton = statusMessage?.querySelector('.btn-close');
    const connectionStatus = document.getElementById('connection-status');
    const sessionIdDisplay = document.getElementById('session-id-display');
    const newChatBtn = document.getElementById('new-chat-btn');
    const showSessionsBtn = document.getElementById('show-sessions-btn');
    const sessionsPopup = document.getElementById('sessions-popup');
    const sessionsList = document.getElementById('sessions-list');
    const closeSessionsPopup = document.getElementById('close-sessions-popup');
    const documentSuggestions = document.getElementById('document-suggestions');
    const documentSuggestionsList = document.getElementById('document-suggestions-list');

    // Podcast specific DOM elements
    const podcastOutputContainer = document.getElementById('podcast-output-container');
    const podcastAudioPlayer = document.getElementById('podcast-audio-player');
    const podcastScriptOutput = document.getElementById('podcast-script-output');
    const podcastStatus = document.getElementById('podcast-status');


    // --- State ---
    let currentThreadId = localStorage.getItem('aiTutorThreadId') || null;
    let authToken = localStorage.getItem('aiTutorAuthToken') || null;
    let currentUsername = localStorage.getItem('aiTutorUsername') || null;
    let allFiles = { uploaded: [] };
    let backendStatus = { db: false, ai: false, vectorStore: false, vectorCount: 0, error: null };
    let isListening = false;
    let isPaused = false;
    let isStopped = false;
    let abortController = null;
    let responseBuffer = '';
    let thinkingMessageTimer = null;
    let statusCheckTimer = null;
    let statusMessageTimerId = null;

    // --- Voice Input (Whisper AI) ---
    let mediaRecorder;
    let audioChunks = [];
    let audioStream;

    const isMediaRecorderSupported = navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder;
    if (!isMediaRecorderSupported) {
        console.warn("MediaRecorder API not supported.");
        if (voiceInputButton) voiceInputButton.title = "Voice input not supported";
    }


    function initializeApp() {
        console.log("Initializing App...");
        setupEventListeners();
        if (authToken && currentUsername) {
            console.log("User token found, attempting to show main app.");
            showMainAppView(currentUsername);
        } else {
            console.log("No user token, showing landing page.");
            showLandingView();
            checkBackendStatus(true, false);
        }
        if (statusCheckTimer) clearInterval(statusCheckTimer);
        statusCheckTimer = setInterval(() => checkBackendStatus(false, !!authToken), STATUS_CHECK_INTERVAL);
    }

    function setupEventListeners() {
        if (showLoginBtn) showLoginBtn.addEventListener('click', showLoginView);
        if (showSignupBtn) showSignupBtn.addEventListener('click', showSignupView);
        if (showLoginFromSignup) showLoginFromSignup.addEventListener('click', showLoginView);
        if (showSignupFromLogin) showSignupFromLogin.addEventListener('click', showSignupView);
        if (logoutButton) logoutButton.addEventListener('click', handleLogout);
        if (signupForm) signupForm.addEventListener('submit', handleSignup);
        if (loginForm) loginForm.addEventListener('submit', handleLogin);
        if (uploadButton) uploadButton.addEventListener('click', handleUpload);

        analysisButtons.forEach(button => {
            button?.addEventListener('click', () => {
                const analysisType = button.dataset.analysisType;
                handleAnalysis(analysisType);
            });
        });

        if (sendButton) sendButton.addEventListener('click', handleSendMessage);
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!sendButton?.disabled) handleSendMessage();
                }
            });
            chatInput.addEventListener('input', handleChatInput);
            chatInput.addEventListener('keydown', handleChatInputKeyDown);
            chatInput.addEventListener('blur', () => {
                setTimeout(() => {
                    if (documentSuggestions) documentSuggestions.style.display = 'none';
                }, 150);
            });
        }
        if (isMediaRecorderSupported && voiceInputButton) voiceInputButton.addEventListener('click', toggleVoiceInput);
        if (pauseButton) pauseButton.addEventListener('click', togglePause);
        if (stopButton) stopButton.addEventListener('click', handleStop);
        if (analysisFileSelect) analysisFileSelect.addEventListener('change', handleAnalysisFileSelection);
        if (uploadInput) uploadInput.addEventListener('change', handleFileInputChange);
        if (statusMessageButton) statusMessageButton.addEventListener('click', () => {
            if (statusMessageTimerId) clearTimeout(statusMessageTimerId);
            statusMessageTimerId = null;
            hideStatusMessage();
        });
        if (newChatBtn) {
            newChatBtn.addEventListener('click', async () => {
                if (!authToken) return;
                console.log("Attempting to create new chat thread...");
                try {
                    const response = await fetchWithAuth(`${API_BASE_URL}/chat/thread`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: "New Chat" })
                    });
                    const data = await response.json();
                    if (response.ok && data.thread_id) {
                        currentThreadId = data.thread_id;
                        localStorage.setItem('aiTutorThreadId', currentThreadId);
                        setThreadIdDisplay(currentThreadId);
                        clearChatHistory();
                        addMessageToChat('bot', "Started a new chat. Ask your question!");
                        console.log("New chat thread created:", currentThreadId);
                        if(chatInput) chatInput.focus();
                    } else {
                        console.error("Failed to create new chat thread:", data.error);
                        showStatusMessage(data.error || "Failed to create new chat thread.", 'danger');
                        clearChatHistory();
                        addMessageToChat('bot', `Error: Failed to start new chat thread. ${data.error || ''}`);
                        setThreadIdDisplay(null);
                    }
                } catch (e) {
                     if (e.message !== "Unauthorized") {
                        console.error("Error creating new chat thread:", e);
                        showStatusMessage("Failed to create new chat thread.", 'danger');
                        clearChatHistory();
                        addMessageToChat('bot', `Error: Failed to start new chat thread. ${e.message || ''}`);
                        setThreadIdDisplay(null);
                    }
                } finally {
                    updateControlStates();
                }
            });
        }
        if (showSessionsBtn) {
            showSessionsBtn.addEventListener('click', async () => {
                if (!authToken) return;
                 if (!backendStatus.db) {
                     showStatusMessage("Cannot load threads: Database is not ready.", 'warning');
                     return;
                 }
                console.log("Attempting to load previous threads...");
                try {
                    const response = await fetchWithAuth(`${API_BASE_URL}/threads?t=${Date.now()}`);
                    const threads = await response.json();
                    if (Array.isArray(threads)) {
                        sessionsList.innerHTML = '';
                        if (threads.length === 0) {
                            const li = document.createElement('li');
                            li.textContent = "No previous chats found.";
                            li.className = "text-muted";
                            sessionsList.appendChild(li);
                        } else {
                            threads.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
                            threads.forEach(thread => {
                                const li = document.createElement('li');
                                const displayTitle = thread.title || `Thread: ${thread.thread_id.substring(0, 8)}...`;
                                li.textContent = `${displayTitle} (Updated: ${new Date(thread.last_updated).toLocaleString()})`;
                                li.className = "mb-2 text-info";
                                li.style.cursor = "pointer";
                                li.onclick = () => {
                                    console.log("Loading thread:", thread.thread_id);
                                    currentThreadId = thread.thread_id;
                                    localStorage.setItem('aiTutorThreadId', currentThreadId);
                                    setThreadIdDisplay(currentThreadId);
                                    loadChatHistory(currentThreadId);
                                    sessionsPopup.style.display = 'none';
                                     if(chatInput) chatInput.focus();
                                };
                                sessionsList.appendChild(li);
                            });
                        }
                        sessionsPopup.style.display = 'block';
                        console.log(`Loaded ${threads.length} threads.`);
                    } else {
                        console.error("Could not load threads: Response was not an array.", threads);
                        showStatusMessage(threads.error || "Could not load threads.", 'danger');
                    }
                } catch (e) {
                    if (e.message !== "Unauthorized") {
                        console.error("Error loading threads:", e);
                        showStatusMessage("Could not load threads.", 'danger');
                    }
                }
            });
        }
        if (closeSessionsPopup) {
            closeSessionsPopup.onclick = () => {
                sessionsPopup.style.display = 'none';
            };
        }
        console.log("Event listeners setup.");
    }

    function showLandingView() {
        if (landingView) landingView.style.display = 'flex';
        if (signupView) signupView.style.display = 'none';
        if (loginView) loginView.style.display = 'none';
        if (mainAppContainer) mainAppContainer.style.display = 'none';
        clearAuthErrors();
    }

    function showSignupView(e) {
        if(e) e.preventDefault();
        if (landingView) landingView.style.display = 'none';
        if (signupView) signupView.style.display = 'flex';
        if (loginView) loginView.style.display = 'none';
        if (mainAppContainer) mainAppContainer.style.display = 'none';
        clearAuthErrors();
    }

    function showLoginView(e) {
        if(e) e.preventDefault();
        if (landingView) landingView.style.display = 'none';
        if (signupView) signupView.style.display = 'none';
        if (loginView) loginView.style.display = 'flex';
        if (mainAppContainer) mainAppContainer.style.display = 'none';
        clearAuthErrors();
    }

    function showMainAppView(username) {
        if (landingView) landingView.style.display = 'none';
        if (signupView) signupView.style.display = 'none';
        if (loginView) loginView.style.display = 'none';
        if (mainAppContainer) mainAppContainer.style.display = 'block';
        if (usernameDisplay) usernameDisplay.textContent = `User: ${escapeHtml(username)}`;
        clearAuthErrors();
        showInitialLoadingForMainApp();
        checkBackendStatus(true, true);
    }

    function showInitialLoadingForMainApp() {
        clearChatHistory();
        addMessageToChat('bot', "Connecting to AI Tutor backend...", [], null, 'loading-msg');
        setConnectionStatus('Initializing...', 'secondary');
        updateControlStates();
    }

    async function handleSignup(event) {
        event.preventDefault();
        clearAuthErrors();
        const firstname = signupFirstname.value.trim();
        const lastname = signupLastname.value.trim();
        const username = signupUsername.value.trim();
        const gender = signupGender.value;
        const mobile = signupMobile.value.trim();
        const email = signupEmail.value.trim();
        const organization = signupOrganization.value.trim();
        const password = signupPassword.value;
        const confirmPassword = signupConfirmPassword.value;

        if (password !== confirmPassword) {
            showAuthError(signupErrorDiv, "Passwords do not match.");
            return;
        }
        if (password.length < 8) {
            showAuthError(signupErrorDiv, "Password must be at least 8 characters.");
            return;
        }
        const signupData = {
            firstname, lastname, username, gender, mobile, email, organization, password
        };
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(signupData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Signup failed: ${response.status}`);
            console.log("Signup successful:", result.message);
            await attemptAutoLogin(username, password);
        } catch (error) {
            console.error("Signup error:", error);
            showAuthError(signupErrorDiv, error.message || "An unknown error occurred during signup.");
        }
    }

    async function handleLogin(event) {
        event.preventDefault();
        clearAuthErrors();
        const identifier = loginIdentifier.value.trim();
        const password = loginPassword.value;
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: identifier, password })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Login failed: ${response.status}`);
            authToken = result.token;
            currentUsername = result.username;
            localStorage.setItem('aiTutorAuthToken', authToken);
            localStorage.setItem('aiTutorUsername', currentUsername);
            console.log("Login successful. Token stored.");
            showMainAppView(currentUsername);
        } catch (error) {
            console.error("Login error:", error);
            showAuthError(loginErrorDiv, error.message || "An unknown error occurred during login.");
        }
    }

    async function attemptAutoLogin(username, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username, password: password })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Auto-login failed: ${response.status}`);
            authToken = result.token;
            currentUsername = result.username;
            localStorage.setItem('aiTutorAuthToken', authToken);
            localStorage.setItem('aiTutorUsername', currentUsername);
            console.log("Auto-login after signup successful.");
            showMainAppView(currentUsername);
        } catch (error) {
            console.error("Auto-login after signup failed:", error);
            showLoginView();
            showAuthError(loginErrorDiv, "Signup successful, but auto-login failed. Please log in manually.");
        }
    }

    function handleLogout() {
        authToken = null;
        currentUsername = null;
        currentThreadId = null;
        localStorage.removeItem('aiTutorAuthToken');
        localStorage.removeItem('aiTutorUsername');
        localStorage.removeItem('aiTutorThreadId');
        allFiles = { uploaded: [] };
        if (usernameDisplay) usernameDisplay.textContent = '';
        console.log("User logged out.");
        showLandingView();
        if (chatHistory) chatHistory.innerHTML = '';
        if (sessionIdDisplay) sessionIdDisplay.textContent = '';
        if (statusCheckTimer) clearInterval(statusCheckTimer);
        statusCheckTimer = setInterval(() => checkBackendStatus(false, false), STATUS_CHECK_INTERVAL);
        setConnectionStatus('Logged Out', 'secondary');
    }

    function showAuthError(element, message) {
        if (element) {
            element.textContent = message;
            element.style.display = 'block';
        }
    }
    function clearAuthErrors() {
        if (signupErrorDiv) signupErrorDiv.style.display = 'none';
        if (loginErrorDiv) loginErrorDiv.style.display = 'none';
    }

    async function fetchWithAuth(url, options = {}) {
        const headers = { ...options.headers };
        const isFormData = options.body instanceof FormData;
        if (!isFormData && options.body && typeof options.body === 'object' && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            console.warn("Unauthorized request or token expired. Logging out.");
            showStatusMessage("Your session has expired. Please log in again.", 'warning', 0);
            handleLogout();
            throw new Error("Unauthorized");
        }
        return response;
    }

    async function checkBackendStatus(isInitialCheck = false, loadAppData = false) {
        if (!connectionStatus) return;
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
                console.log("Backend Status:", data);
                updateConnectionStatusUI();
                if (loadAppData && authToken) {
                    if (isInitialCheck) {
                        if (backendStatus.db) {
                            onBackendReadyForApp();
                        } else {
                            onBackendUnavailableForApp("Database initialization failed.");
                        }
                    } else {
                        if ((backendStatus.db && !previousStatus.db) || (backendStatus.ai && !previousStatus.ai)) {
                            hideStatusMessage();
                             if (backendStatus.db && backendStatus.ai) {
                                onBackendReadyForApp();
                             } else if (backendStatus.db && !backendStatus.ai && previousStatus.ai) {
                                updateControlStates();
                                loadAndPopulateDocuments();
                             } else if (!backendStatus.db && previousStatus.db) {
                                onBackendUnavailableForApp("Database connection lost.");
                             } else {
                                 updateControlStates();
                             }
                        }
                    }
                }
                if (authToken) updateControlStates();
            }
        } catch (error) {
            console.error("Backend connection check failed:", error);
            const errorMsg = `Backend connection failed: ${error.message || 'Unknown'}.`;
            if (backendStatus.db || backendStatus.ai || isInitialCheck) {
                 backendStatus.db = false; backendStatus.ai = false; backendStatus.vectorStore = false;
                 backendStatus.vectorCount = 0; backendStatus.error = errorMsg;
                 updateConnectionStatusUI();
                 if (loadAppData && authToken) {
                     onBackendUnavailableForApp(errorMsg);
                 }
            }
        }
    }

    function onBackendReadyForApp() {
         console.log("Backend is ready for authenticated app.");
         loadAndPopulateDocuments();
         if (currentThreadId) {
             console.log("Existing chat thread ID found in local storage:", currentThreadId);
             setThreadIdDisplay(currentThreadId);
             loadChatHistory(currentThreadId);
         } else {
             console.log("No chat thread ID found in local storage. Will start a new thread on first message.");
             clearChatHistory();
             addMessageToChat('bot', "Welcome! Ask questions about your documents, or upload new ones.");
             setThreadIdDisplay(null);
         }
         updateControlStates();
    }

    function onBackendUnavailableForApp(errorMsg = "Backend connection failed.") {
         console.error("Backend is unavailable for authenticated app:", errorMsg);
         clearChatHistory();
         addMessageToChat('bot', `Error: ${errorMsg} Some features will be unavailable.`);
         setThreadIdDisplay(null);
         updateControlStates();
     }

    function updateControlStates() {
        const isUserLoggedIn = !!authToken;
        const isDbReady = backendStatus.db;
        const isAiReady = backendStatus.ai;
        const hasUploadedFiles = allFiles.uploaded.length > 0;
        const canUpload = isUserLoggedIn && isDbReady && isAiReady;
        const canSelectAnalysis = isUserLoggedIn && isDbReady && hasUploadedFiles;
        const canExecuteAnalysis= isUserLoggedIn && isAiReady && analysisFileSelect && analysisFileSelect.value;
        const canChat = isUserLoggedIn && isDbReady && isAiReady;
        disableChatInput(!canChat);
        if (uploadButton) {
            uploadButton.disabled = !(canUpload && uploadInput?.files?.length > 0);
             if (uploadStatus) {
                if (!isUserLoggedIn) setElementStatus(uploadStatus, "Login to upload.", 'muted');
                else if (!isDbReady) setElementStatus(uploadStatus, "Database offline.", 'warning');
                else if (!isAiReady) setElementStatus(uploadStatus, "AI components offline.", 'warning');
                else if (!uploadInput?.files?.length) setElementStatus(uploadStatus, "Select a PDF to upload.", 'muted');
                else setElementStatus(uploadStatus, `Selected: ${escapeHtml(uploadInput.files[0].name)}`, 'muted');
             }
        }
        if (analysisFileSelect) {
            analysisFileSelect.disabled = !canSelectAnalysis;
            if (analysisStatus) {
                if (!isUserLoggedIn) setElementStatus(analysisStatus, "Login to analyze.", 'muted');
                else if (!isDbReady) setElementStatus(analysisStatus, "Database offline.", 'danger');
                else if (!isAiReady) setElementStatus(analysisStatus, "AI components offline.", 'warning');
                else if (!hasUploadedFiles) setElementStatus(analysisStatus, "No documents uploaded. Upload a PDF.", 'muted');
                else if (!analysisFileSelect?.value) setElementStatus(analysisStatus, "Select document & utility type.", 'muted');
                else setElementStatus(analysisStatus, `Ready for ${escapeHtml(analysisFileSelect.options[analysisFileSelect.selectedIndex].text)}.`, 'muted');
            }
        }
        disableAnalysisButtons(!canExecuteAnalysis);
        if (voiceInputButton) {
            voiceInputButton.disabled = !(canChat && isMediaRecorderSupported);
            voiceInputButton.title = (canChat && isMediaRecorderSupported) ? "Start Voice Input" : (isMediaRecorderSupported ? (isUserLoggedIn ? "Chat disabled" : "Login to use voice") : "Voice input not supported");
        }
        if (pauseButton) pauseButton.disabled = !isUserLoggedIn || isStopped;
        if (stopButton) stopButton.disabled = !isUserLoggedIn || isStopped;

        if (isUserLoggedIn) {
            if (!isDbReady) setChatStatus("Database Offline", 'danger');
            else if (!isAiReady) setChatStatus("AI Offline", 'warning');
            else setChatStatus("Ready", 'muted');
        } else {
             setChatStatus("Login to chat", 'muted');
        }
        if (newChatBtn) newChatBtn.disabled = !isUserLoggedIn;
        if (showSessionsBtn) showSessionsBtn.disabled = !isUserLoggedIn || !isDbReady;
    }

    async function loadAndPopulateDocuments() {
        if (!API_BASE_URL || !analysisFileSelect || !authToken) {
            console.warn("Cannot load documents: missing auth token or critical elements.");
            updateAnalysisDropdown();
            updateControlStates();
            return;
        }
         if (!backendStatus.db) {
            console.warn("Cannot load documents: Database not ready.");
            updateAnalysisDropdown();
            updateControlStates();
             return;
         }
        console.log("Loading document list for authenticated user...");
        analysisFileSelect.disabled = true;
        analysisFileSelect.innerHTML = '<option selected disabled value="">Loading...</option>';
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/documents?t=${Date.now()}`);
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if(data.errors) {
                 console.warn("Errors loading document lists:", data.errors);
                 showStatusMessage(`Warning: Could not load document list: ${data.errors.join(', ')}`, 'warning');
            }
            allFiles.uploaded = data.uploaded_files || [];
            console.log(`Loaded ${allFiles.uploaded.length} user docs.`);
            updateAnalysisDropdown();
            updateControlStates();
            populateDocumentSuggestions(allFiles.uploaded);
        } catch (error) {
            if (error.message !== "Unauthorized") {
                console.error("Error loading document list:", error);
                showStatusMessage("Could not load your documents.", 'warning');
                analysisFileSelect.innerHTML = '<option selected disabled value="">Error loading</option>';
                updateControlStates();
            }
        }
    }

    function populateDocumentSuggestions(files) {
        if (!documentSuggestionsList) return;
        documentSuggestionsList.innerHTML = '';
        if (files.length === 0) {
            const li = document.createElement('li');
            li.textContent = "No documents uploaded.";
            li.classList.add('text-muted', 'p-2');
            documentSuggestionsList.appendChild(li);
            return;
        }
        files.forEach(filename => {
            const li = document.createElement('li');
            li.classList.add('document-suggestion-item');
            li.textContent = filename;
            li.dataset.filename = filename;
            li.addEventListener('click', () => {
                chatInput.value = `@${filename} `;
                if (documentSuggestions) documentSuggestions.style.display = 'none';
                chatInput.focus();
            });
            documentSuggestionsList.appendChild(li);
        });
    }

    function handleChatInput() {
        const query = chatInput.value;
        if (query.startsWith('@') && documentSuggestions) {
            const partialName = query.substring(1).toLowerCase();
            const filteredFiles = allFiles.uploaded.filter(filename =>
                filename.toLowerCase().includes(partialName)
            );
            populateDocumentSuggestions(filteredFiles);
            documentSuggestions.style.display = 'block';
        } else if (documentSuggestions) {
            documentSuggestions.style.display = 'none';
        }
    }

    function handleChatInputKeyDown(e) {
        if (!documentSuggestions || documentSuggestions.style.display === 'none') return;

        const items = Array.from(documentSuggestionsList.children);
        if (items.length === 0) return;

        let activeItem = documentSuggestionsList.querySelector('.active-suggestion');
        let activeIndex = activeItem ? items.indexOf(activeItem) : -1;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (activeItem) activeItem.classList.remove('active-suggestion');
            activeIndex = (activeIndex + 1) % items.length;
            items[activeIndex].classList.add('active-suggestion');
            items[activeIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (activeItem) activeItem.classList.remove('active-suggestion');
            activeIndex = (activeIndex - 1 + items.length) % items.length;
            items[activeIndex].classList.add('active-suggestion');
            items[activeIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            if (activeItem) {
                e.preventDefault();
                activeItem.click();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            documentSuggestions.style.display = 'none';
            chatInput.focus();
        }
    }

    async function handleUpload() {
        if (!uploadInput || !uploadStatus || !uploadButton || !uploadSpinner || !API_BASE_URL || !authToken || !backendStatus.db || !backendStatus.ai) return;
        const file = uploadInput.files[0];
        if (!file) { setElementStatus(uploadStatus, "No file selected.", 'muted'); return; }
        if (!file.name.toLowerCase().endsWith(".pdf")) { setElementStatus(uploadStatus, "Invalid file type (PDF only).", 'warning'); uploadInput.value = ''; handleFileInputChange(); return; }
        setElementStatus(uploadStatus, `Uploading ${escapeHtml(file.name)}...`);
        uploadButton.disabled = true;
        showSpinner(uploadButton, true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Upload failed: ${response.status}`);
            const successMsg = result.message || `Processed ${escapeHtml(result.original_filename || result.filename)}.`;
            setElementStatus(uploadStatus, successMsg, 'success');
            showStatusMessage(`File '${escapeHtml(result.original_filename || result.filename)}' added. KB: ${result.vector_count >= 0 ? result.vector_count : 'N/A'} vectors.`, 'success');
            uploadInput.value = '';
            handleFileInputChange();
            await loadAndPopulateDocuments();
        } catch (error) {
            if (error.message !== "Unauthorized") {
                console.error("Upload error:", error);
                const errorMsg = error.message || "Unknown upload error.";
                setElementStatus(uploadStatus, `Error: ${errorMsg}`, 'danger');
                showStatusMessage(`Upload Error: ${errorMsg}`, 'danger');
            }
        } finally {
             showSpinner(uploadButton, false);
             uploadButton.disabled = !(authToken && backendStatus.db && backendStatus.ai && uploadInput?.files?.length > 0);
        }
    }

    async function handleAnalysis(analysisType) {
        if (!analysisFileSelect || !analysisStatus || !API_BASE_URL || !authToken || !backendStatus.ai) {
            console.error("Analysis prerequisites missing, AI offline, or not logged in.");
            return;
        }
        if (!backendStatus.db) {
            showStatusMessage("Cannot perform analysis: Database is not ready.", 'warning');
            return;
        }
        const selectedOption = analysisFileSelect.options[analysisFileSelect.selectedIndex];
        const filename = selectedOption.value;
        if (!filename) { setElementStatus(analysisStatus, "Select a document.", 'warning'); return; }

        console.log(`Starting analysis/utility: Type=${analysisType}, File=${filename}`);
        setElementStatus(analysisStatus, `Generating ${analysisType} for ${escapeHtml(selectedOption.text)}...`);

        disableAnalysisButtons(true);
        const clickedButton = document.querySelector(`.analysis-btn[data-analysis-type="${analysisType}"]`);
        const spinner = clickedButton ? clickedButton.querySelector('.spinner-border') : null;
        if (spinner) spinner.style.display = 'inline-block';

        if (analysisOutputContainer) analysisOutputContainer.style.display = 'none';
        if (mindmapOutputContainer) { mindmapOutputContainer.style.display = 'none'; mindmapOutputContainer.innerHTML = ''; }
        if (analysisOutput) analysisOutput.innerHTML = '';
        if (analysisReasoningOutput) analysisReasoningOutput.textContent = '';
        if (analysisReasoningContainer) analysisReasoningContainer.style.display = 'none';
        if (latexSourceContainer) latexSourceContainer.style.display = 'none';
        if (latexSourceOutput) latexSourceOutput.textContent = '';
        if (podcastOutputContainer) podcastOutputContainer.style.display = 'none';
        if (podcastScriptOutput) podcastScriptOutput.innerHTML = '';
        if (podcastAudioPlayer) { podcastAudioPlayer.src = ''; podcastAudioPlayer.pause(); }
        if (podcastStatus) podcastStatus.textContent = '';


        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/analyze`, {
                method: 'POST',
                body: { filename: filename, analysis_type: analysisType },
            });
            const result = await response.json();

            if (analysisType === 'mindmap' && result.latex_source && latexSourceContainer && latexSourceOutput) {
                latexSourceOutput.textContent = result.latex_source;
                latexSourceContainer.style.display = 'block';
            } else if (latexSourceContainer) {
                latexSourceContainer.style.display = 'none';
            }

            if (!response.ok) {
                 const errorMsg = result.error || `${analysisType} failed: ${response.status}`;
                 console.error(`${analysisType} error in JS:`, errorMsg, result.thinking);
                 setElementStatus(analysisStatus, `Error: ${errorMsg}`, 'danger');
                 showStatusMessage(`${analysisType} Error: ${errorMsg}`, 'danger');
                 if (result.thinking && analysisReasoningContainer && analysisReasoningOutput) {
                     analysisReasoningContainer.style.display = 'block';
                     analysisReasoningOutput.textContent = Array.isArray(result.thinking) ? result.thinking.join('\n') : result.thinking;
                 }
                 if (analysisType === 'podcast' && result.script && podcastScriptOutput && podcastOutputContainer) {
                    podcastOutputContainer.style.display = 'block';
                    if (podcastStatus) setElementStatus(podcastStatus, `Error generating audio. Script available.`, 'warning');
                    if (typeof marked !== 'undefined') {
                        marked.setOptions({ breaks: true, gfm: true, sanitize: false });
                        podcastScriptOutput.innerHTML = marked.parse(result.script || "[No script generated]");
                    } else {
                        podcastScriptOutput.textContent = result.script || "[No script generated]";
                    }
                 }
                 return;
            }

            setElementStatus(analysisStatus, `${analysisType} complete for ${escapeHtml(selectedOption.text)}.`, 'success');

            if (result.thinking && analysisReasoningContainer && analysisReasoningOutput) {
                analysisReasoningContainer.style.display = 'block';
                analysisReasoningOutput.textContent = Array.isArray(result.thinking) ? result.thinking.join('\n') : result.thinking;
            } else if(analysisReasoningContainer) {
                 analysisReasoningContainer.style.display = 'none';
                 if(analysisReasoningOutput) analysisReasoningOutput.textContent = '';
            }

            if (analysisType === 'podcast') {
                if (podcastOutputContainer && podcastScriptOutput && podcastAudioPlayer && podcastStatus) {
                    podcastOutputContainer.style.display = 'block';
                    setElementStatus(podcastStatus, `Podcast generated for ${escapeHtml(result.original_filename || selectedOption.text)}.`, 'success');
                    if (typeof marked !== 'undefined') {
                        marked.setOptions({ breaks: true, gfm: true, sanitize: false });
                        podcastScriptOutput.innerHTML = marked.parse(result.script || "[No script generated]");
                    } else {
                        podcastScriptOutput.textContent = result.script || "[No script generated]";
                    }
                    podcastAudioPlayer.src = result.audio_url;
                }
            } else {
                if (analysisOutputContainer && analysisOutput) {
                    analysisOutputContainer.style.display = 'block';
                    if (analysisOutputTitle) analysisOutputTitle.textContent = `${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} Analysis:`;
                    const analysisContent = result.content || "[No content generated]";

                    if (analysisType === 'faq' || analysisType === 'topics') {
                        if (typeof marked !== 'undefined') {
                            marked.setOptions({ breaks: true, gfm: true, sanitize: false });
                            analysisOutput.innerHTML = marked.parse(analysisContent);
                        } else {
                            analysisOutput.textContent = analysisContent;
                        }
                        if (mindmapOutputContainer) mindmapOutputContainer.style.display = 'none';
                    } else if (analysisType === 'mindmap') {
                        analysisOutput.innerHTML = `<p class="small text-muted">Mermaid Source:</p><pre class="mindmap-markdown-source"><code>${escapeHtml(analysisContent)}</code></pre>`;
                        if (mindmapOutputContainer) {
                            mindmapOutputContainer.style.display = 'block';
                            mindmapOutputContainer.innerHTML = '';
                            mindmapOutputContainer.removeAttribute('data-processed');
                            if (typeof mermaid !== 'undefined') {
                                try {
                                    let mermaidCode = analysisContent.trim();
                                    if (mermaidCode.startsWith("```mermaid")) mermaidCode = mermaidCode.substring("```mermaid".length).trim();
                                    if (mermaidCode.endsWith("```")) mermaidCode = mermaidCode.substring(0, mermaidCode.length - "```".length).trim();
                                    if (!mermaidCode.toLowerCase().startsWith("mindmap")) {
                                        mermaidCode = "mindmap\n" + mermaidCode;
                                    }
                                    const tempDiv = document.createElement('div');
                                    tempDiv.className = 'mermaid';
                                    tempDiv.textContent = mermaidCode;
                                    mindmapOutputContainer.appendChild(tempDiv);
                                    await mermaid.run({ nodes: [tempDiv] });
                                } catch (e) {
                                    console.error("Mermaid rendering error:", e);
                                    mindmapOutputContainer.innerHTML = `<div class="text-danger p-2">Error rendering Mind Map: ${escapeHtml(e.message || String(e))}. <br>Check Mermaid source in analysis output.</div>`;
                                }
                            } else {
                                console.warn("Mermaid.js not loaded.");
                                mindmapOutputContainer.innerHTML = `<div class="text-warning p-2">Mermaid.js not available for rendering.</div>`;
                            }
                        }
                    } else {
                        analysisOutput.textContent = analysisContent;
                        if (mindmapOutputContainer) mindmapOutputContainer.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            if (error.message !== "Unauthorized") {
                console.error(`${analysisType} fetch error:`, error);
                const errorMsg = error.message || "Unknown network error.";
                setElementStatus(analysisStatus, `Error: ${errorMsg}`, 'danger');
                showStatusMessage(`${analysisType} Error: ${errorMsg}`, 'danger');
            }
            if (analysisOutputContainer) analysisOutputContainer.style.display = 'none';
            if (mindmapOutputContainer) mindmapOutputContainer.style.display = 'none';
            if (analysisReasoningContainer) analysisReasoningContainer.style.display = 'none';
            if (latexSourceContainer) latexSourceContainer.style.display = 'none';
            if (podcastOutputContainer) podcastOutputContainer.style.display = 'none';
        } finally {
            if (spinner) spinner.style.display = 'none';
            const fileIsSelected = analysisFileSelect && analysisFileSelect.value;
            const canExecuteAny = fileIsSelected && authToken && backendStatus.ai;
            disableAnalysisButtons(!canExecuteAny);
        }
    }


    async function handleSendMessage() {
        if (!chatInput || !sendButton || !sendSpinner || !API_BASE_URL || !authToken || !backendStatus.db || !backendStatus.ai) {
             console.warn("Chat prerequisites not met (input, button, token, or backend status).");
             return;
        }
        const query = chatInput.value.trim();
        if (!query) return;

        isPaused = false;
        isStopped = false;
        abortController = new AbortController();
        responseBuffer = '';

        addMessageToChat('user', query);
        chatInput.value = '';
        setChatStatus('AI Tutor is thinking...');
        disableChatInput(true);
        showSpinner(sendButton, true);
        if (pauseButton) pauseButton.disabled = false;
        if (stopButton) stopButton.disabled = false;

        console.log(`Sending chat query (Thread ID: ${currentThreadId || 'new'})...`);

        const thinkingMessages = [
            (filename) => `🔍 Looking into '${filename || "document"}'...`,
            (topic) => `📖 Reading key sections on ${topic || "the topic"}...`,
            () => "🧠 Thinking through the best explanation...",
            () => "📚 Verifying the summary..."
        ];
        let thinkingMessageIndex = 0;
        let currentThinkingFilename = null;
        let currentThinkingTopic = null;

        const filenameMatch = query.match(/^@([^ ]+)/);
        if (filenameMatch) {
            currentThinkingFilename = filenameMatch[1];
        }

        function showNextThinkingMessage() {
            if (isStopped) {
                clearTimeout(thinkingMessageTimer);
                clearThinkingMessages();
                return;
            }
            if (thinkingMessageIndex < thinkingMessages.length) {
                const messageGenerator = thinkingMessages[thinkingMessageIndex];
                let messageText;
                if (thinkingMessageIndex === 0) {
                    messageText = messageGenerator(currentThinkingFilename);
                } else if (thinkingMessageIndex === 1) {
                    const genericTopic = query.length > 20 ? query.substring(0, 20) + "..." : query;
                    messageText = messageGenerator(currentThinkingTopic || genericTopic);
                } else {
                    messageText = messageGenerator();
                }

                displayThinkingMessage(messageText);
                thinkingMessageIndex++;
                const delay = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
                thinkingMessageTimer = setTimeout(showNextThinkingMessage, delay);
            }
        }
        showNextThinkingMessage();

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/chat`, {
                method: 'POST',
                body: {
                    query: query,
                    thread_id: currentThreadId
                },
                signal: abortController.signal
            });
            if (response.body && response.headers.get('content-type')?.includes('text/event-stream')) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let threadIdFromStream = null;
                let botMessageDiv = null;
                let currentBotMessageText = '';

                const botMessageWrapper = document.createElement('div');
                botMessageWrapper.classList.add('message-wrapper', 'bot-wrapper');
                botMessageDiv = document.createElement('div');
                botMessageDiv.classList.add('message', 'bot-message');
                botMessageWrapper.appendChild(botMessageDiv);
                chatHistory.appendChild(botMessageWrapper);
                chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });

                while (true) {
                    if (isStopped) {
                        reader.cancel('User stopped response');
                        break;
                    }
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    let parts = buffer.split('\n\n');
                    buffer = parts.pop();

                    for (let part of parts) {
                        if (part.startsWith('data: ')) {
                            try {
                                const json = JSON.parse(part.slice(6));
                                if (json.type === 'thinking') {
                                    displayThinkingMessage(json.message);
                                } else if (json.type === 'chunk') { 
                                    if (!isPaused) {
                                        currentBotMessageText += json.content;
                                        if (typeof marked !== 'undefined') {
                                            marked.setOptions({ breaks: true, gfm: true, sanitize: false });
                                            botMessageDiv.innerHTML = marked.parse(currentBotMessageText);
                                        } else {
                                            botMessageDiv.textContent = currentBotMessageText;
                                        }
                                        chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
                                    } else {
                                        responseBuffer += json.content;
                                    }
                                } else if (json.type === 'final') {
                                    if (json.thread_id && currentThreadId !== json.thread_id) {
                                        currentThreadId = json.thread_id;
                                        localStorage.setItem('aiTutorThreadId', currentThreadId);
                                        setThreadIdDisplay(currentThreadId);
                                        console.log("Chat Thread ID updated/set:", currentThreadId);
                                    }
                                    currentBotMessageText += responseBuffer + (json.answer || ""); 
                                    if (typeof marked !== 'undefined') {
                                        marked.setOptions({ breaks: true, gfm: true, sanitize: false });
                                        botMessageDiv.innerHTML = marked.parse(currentBotMessageText);
                                    } else {
                                        botMessageDiv.textContent = currentBotMessageText;
                                    }
                                    addReferencesAndThinkingToMessage(botMessageWrapper, json.references, json.thinking);
                                    setChatStatus('Ready');
                                    isPaused = false;
                                    isStopped = false;

                                    if (json.thread_id && !localStorage.getItem(`aiTutorThreadTitle_${json.thread_id}`)) {
                                        // generateThreadTitle(json.thread_id, query); 
                                    }

                                } else if (json.type === 'error') {
                                    currentBotMessageText += responseBuffer + (json.answer || json.error);
                                    if (typeof marked !== 'undefined') {
                                        marked.setOptions({ breaks: true, gfm: true, sanitize: false });
                                        botMessageDiv.innerHTML = marked.parse(currentBotMessageText);
                                    } else {
                                        botMessageDiv.textContent = currentBotMessageText;
                                    }
                                    addReferencesAndThinkingToMessage(botMessageWrapper, json.references, json.thinking);
                                    setChatStatus(`Error: ${json.error?.substring(0, 50) || 'Unknown'}...`, 'danger');
                                    isPaused = false;
                                    isStopped = false;
                                }
                            } catch (e) {
                                console.error('SSE JSON parse error:', e, part);
                            }
                        }
                    }
                }
                if (botMessageDiv) {
                    addMessageActions(botMessageWrapper, 'bot', currentBotMessageText);
                    botMessageDiv.dataset.rawText = currentBotMessageText;
                }
                return;
            }
            const result = await response.json();
            if (!response.ok) {
                 const errorDetail = result.error || `Request failed: ${response.status}`;
                 const displayError = result.answer || `Sorry, error: ${errorDetail}`;
                 console.error("Chat API error:", errorDetail, result.thinking);
                 addMessageToChat('bot', displayError, result.references || [], result.thinking || null);
                 setChatStatus(`Error: ${errorDetail.substring(0, 50)}...`, 'danger');
                 return;
            }
            if (result.thread_id && currentThreadId !== result.thread_id) {
                currentThreadId = result.thread_id;
                localStorage.setItem('aiTutorThreadId', currentThreadId);
                setThreadIdDisplay(currentThreadId);
                console.log("Chat Thread ID updated/set:", currentThreadId);
            }
            addMessageToChat('bot', result.answer, result.references || [], result.thinking || null);
            setChatStatus('Ready');

            if (result.thread_id && !localStorage.getItem(`aiTutorThreadTitle_${result.thread_id}`)) {
                // generateThreadTitle(result.thread_id, query); 
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Fetch aborted by user.');
                addMessageToChat('bot', "Response stopped by user.", [], null, 'stopped-msg');
                setChatStatus('Ready');
            } else if (error.message !== "Unauthorized") {
                console.error("Chat fetch error:", error);
                const errorMsg = error.message || "Unknown network/server error.";
                 const lastBotMessage = chatHistory?.querySelector('.bot-wrapper:last-child .message.bot-message');
                 if (!lastBotMessage || !lastBotMessage.textContent?.includes("Sorry, could not get response:")) {
                      addMessageToChat('bot', `Sorry, could not get response: ${errorMsg}`);
                 }
                setChatStatus(`Error: ${errorMsg.substring(0, 50)}...`, 'danger');
            }
        } finally {
            clearTimeout(thinkingMessageTimer);
            clearThinkingMessages();
            disableChatInput(!(authToken && backendStatus.db && backendStatus.ai));
            showSpinner(sendButton, false);
            if (pauseButton) pauseButton.disabled = true;
            if (stopButton) stopButton.disabled = true;
            isPaused = false;
            isStopped = false;
            abortController = null;
            responseBuffer = '';
            if(chatInput && !chatInput.disabled) chatInput.focus();
        }
    }

    async function loadChatHistory(tid) {
        if (!tid || !chatHistory || !API_BASE_URL || !authToken || !backendStatus.db) {
             if (authToken) {
                console.warn("Cannot load history: Missing thread ID, chat element, token, or database unavailable.");
                if (!backendStatus.db) {
                    addMessageToChat('bot', 'Cannot load history: Database unavailable.');
                    setChatStatus('Database Offline', 'danger');
                } else {
                     addMessageToChat('bot', 'Cannot load history: Missing thread ID.');
                     setChatStatus('Ready', 'muted');
                }
             } else {
                 console.warn("Cannot load history: Not authenticated.");
             }
             updateControlStates();
             return;
        }
        setChatStatus('Loading history...');
        disableChatInput(true);
        clearChatHistory();
        console.log(`Attempting to load history for thread ID: ${tid}`);
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/thread_history?thread_id=${tid}&t=${Date.now()}`);
             if (!response.ok) {
                 if (response.status === 404 || response.status === 400) {
                     console.warn(`History not found for thread ID (${tid}) or invalid request. Clearing local storage thread ID.`);
                     localStorage.removeItem('aiTutorThreadId');
                     currentThreadId = null;
                     setThreadIdDisplay(null);
                     clearChatHistory();
                     addMessageToChat('bot', "Couldn't load previous chat. Starting fresh.");
                 } else {
                     const result = await response.json().catch(() => ({error: `HTTP error ${response.status}`}));
                     throw new Error(result.error || `Failed to load history: ${response.status}`);
                 }
                 return;
             }
             const historyData = await response.json();
             if (Array.isArray(historyData) && historyData.length > 0) {
                 historyData.forEach(msg => {
                     const sender = msg.sender || 'unknown';
                     const text = msg.message_text || '';
                     const references = msg.references || [];
                     const thinking = msg.thinking || null;
                     const messageId = msg.message_id || null;
                     addMessageToChat(sender, text, references, thinking, messageId);
                 });
                 console.log(`Loaded ${historyData.length} messages for thread ${tid}`);
                 addMessageToChat('bot', "--- Previous chat restored ---");
             } else if (Array.isArray(historyData) && historyData.length === 0) {
                  console.log(`No messages found for thread ${tid}. Starting fresh.`);
                  addMessageToChat('bot', "Welcome back! Continue your chat.");
             } else {
                 console.error("Error loading chat history: Unexpected response format.", historyData);
                 clearChatHistory();
                 addMessageToChat('bot', `Error loading history: Unexpected response. Starting new chat.`);
                 localStorage.removeItem('aiTutorThreadId');
                 currentThreadId = null;
                 setThreadIdDisplay(null);
             }
             setTimeout(() => chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'auto' }), 100);
         } catch (error) {
             if (error.message !== "Unauthorized") {
                 console.error("Error loading chat history:", error);
                  clearChatHistory();
                  addMessageToChat('bot', `Error loading history: ${error.message}. Starting new chat.`);
                  localStorage.removeItem('aiTutorThreadId');
                  currentThreadId = null;
                  setThreadIdDisplay(null);
             }
         } finally {
             setChatStatus(authToken && backendStatus.db && backendStatus.ai ? 'Ready' : 'AI Offline', authToken && backendStatus.db && backendStatus.ai ? 'muted' : 'warning');
             disableChatInput(!(authToken && backendStatus.db && backendStatus.ai));
             if(chatInput && !chatInput.disabled) chatInput.focus();
         }
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
            .replace(/"/g, "&quot;")
            .replace(/'/g, "'");
    }

       function handleCopyMessage(textToCopy, buttonElement) {
        if (!textToCopy) {
            console.warn("Attempted to copy empty text.");
            if(buttonElement) {
                const originalText = buttonElement.innerHTML;
                buttonElement.innerHTML = 'Error!';
                setTimeout(() => { buttonElement.innerHTML = originalText; }, 1500);
            }
            return;
        }
        navigator.clipboard.writeText(textToCopy).then(() => {
            if (buttonElement) {
                const originalText = buttonElement.innerHTML;
                const originalTitle = buttonElement.title;
                buttonElement.innerHTML = '✔️';
                buttonElement.title = 'Copied!';
                buttonElement.disabled = true;
                setTimeout(() => {
                    buttonElement.innerHTML = originalText;
                    buttonElement.title = originalTitle;
                    buttonElement.disabled = false;
                }, 1500);
            }
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            if (buttonElement) {
                const originalText = buttonElement.innerHTML;
                buttonElement.innerHTML = 'Error';
                setTimeout(() => { buttonElement.innerHTML = originalText; }, 1500);
            }
            showStatusMessage("Failed to copy message to clipboard.", "warning");
        });
    }

    function handleToggleFeedback(buttonElement, feedbackType) {
        const isActive = buttonElement.classList.contains('active');

        if (isActive) {
            buttonElement.classList.remove('active');
        } else {
            buttonElement.classList.add('active');
            const wrapper = buttonElement.closest('.message-actions');
            if (wrapper) {
                const otherButton = feedbackType === 'like' ? wrapper.querySelector('.btn-dislike') : wrapper.querySelector('.btn-like');
                if (otherButton) otherButton.classList.remove('active');
            }
        }
        console.log(`Feedback: ${feedbackType} ${isActive ? 'removed' : 'given'}`);
    }

    function handleEditUserMessage(textToEdit) {
        if (chatInput) {
            chatInput.value = textToEdit;
            chatInput.focus();
            chatInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            showStatusMessage("Message loaded into input box for editing.", "info", 3000);
        }
    }

    function addMessageToChat(sender, text, references = [], thinking = null, messageId = null) {
        if (!chatHistory) return;

        if (sender === 'bot') {
            clearThinkingMessages();
        }

        while (chatHistory.children.length >= MAX_CHAT_HISTORY_MESSAGES) {
            if (chatHistory.firstChild && chatHistory.firstChild.id === 'thinking-messages-container') {
                if (chatHistory.children.length > 1) {
                    chatHistory.removeChild(chatHistory.children[1]);
                } else {
                    break;
                }
            } else {
                chatHistory.removeChild(chatHistory.firstChild);
            }
        }

        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message-wrapper', `${sender}-wrapper`);
        if(messageId) messageWrapper.dataset.messageId = messageId;

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');

        messageDiv.dataset.rawText = text || "";


        if (sender === 'bot' && text) {
            try {
                if (typeof marked === 'undefined') {
                    const pre = document.createElement('pre'); pre.textContent = text; messageDiv.appendChild(pre);
                } else {
                    marked.setOptions({ breaks: true, gfm: true, sanitize: false });
                    messageDiv.innerHTML = marked.parse(text);
                }
            } catch (e) {
                 console.error("Markdown rendering error:", e);
                 const pre = document.createElement('pre'); pre.textContent = text; messageDiv.appendChild(pre);
             }
        } else if (text) {
            messageDiv.textContent = text;
        } else {
            messageDiv.textContent = `[${sender === 'bot' ? 'Empty Bot Response' : 'Empty User Message'}]`;
        }
        messageWrapper.appendChild(messageDiv);

        if (sender === 'bot' && thinking) {
            const thinkingDiv = document.createElement('div');
            thinkingDiv.classList.add('message-thinking');
            thinkingDiv.innerHTML = `<details><summary class="text-info small fw-bold">Show Reasoning</summary><pre><code>${escapeHtml(thinking)}</code></pre></details>`;
            messageWrapper.appendChild(thinkingDiv);
        }

        if (sender === 'bot' && references && references.length > 0) {
            const referencesDiv = document.createElement('div');
            referencesDiv.classList.add('message-references');
            let refHtml = '<strong class="small text-warning">References:</strong><ul class="list-unstyled mb-0 small">';
            references.forEach(ref => {
                if (ref && typeof ref === 'object') {
                    const source = escapeHtml(ref.source || 'Unknown');
                    const preview = escapeHtml(ref.content_preview || 'No preview');
                    const number = escapeHtml(ref.number || '?');
                    refHtml += `<li class="ref-item">[${number}] <span class="ref-source" title="Preview: ${preview}">${source}</span></li>`;
                }
            });
            refHtml += '</ul>';
            referencesDiv.innerHTML = refHtml;
            messageWrapper.appendChild(referencesDiv);
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('message-actions');

        if (sender === 'bot') {
            const copyBtn = document.createElement('button');
            copyBtn.classList.add('btn', 'btn-sm', 'btn-action', 'btn-copy');
            copyBtn.innerHTML = '📄';
            copyBtn.title = 'Copy response';
            copyBtn.addEventListener('click', () => handleCopyMessage(text || "", copyBtn));

            const likeBtn = document.createElement('button');
            likeBtn.classList.add('btn', 'btn-sm', 'btn-action', 'btn-like');
            likeBtn.innerHTML = '👍';
            likeBtn.title = 'Like response';
            likeBtn.addEventListener('click', () => handleToggleFeedback(likeBtn, 'like'));

            const dislikeBtn = document.createElement('button');
            dislikeBtn.classList.add('btn', 'btn-sm', 'btn-action', 'btn-dislike');
            dislikeBtn.innerHTML = '👎';
            dislikeBtn.title = 'Dislike response';
            dislikeBtn.addEventListener('click', () => handleToggleFeedback(dislikeBtn, 'dislike'));

            actionsDiv.append(copyBtn, likeBtn, dislikeBtn);
        } else {
            const editBtn = document.createElement('button');
            editBtn.classList.add('btn', 'btn-sm', 'btn-action', 'btn-edit-user');
            editBtn.innerHTML = '✏️';
            editBtn.title = 'Edit your message';
            editBtn.addEventListener('click', () => handleEditUserMessage(text || ""));

            const copyBtn = document.createElement('button');
            copyBtn.classList.add('btn', 'btn-sm', 'btn-action', 'btn-copy');
            copyBtn.innerHTML = '📄';
            copyBtn.title = 'Copy your message';
            copyBtn.addEventListener('click', () => handleCopyMessage(text || "", copyBtn));

            actionsDiv.append(editBtn, copyBtn);
        }
        messageWrapper.appendChild(actionsDiv);
        chatHistory.appendChild(messageWrapper);
        chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
    }

    function updateAnalysisDropdown() {
        if (!analysisFileSelect) return;
        const previouslySelected = analysisFileSelect.value;
        analysisFileSelect.innerHTML = '';

        const createOption = (filename) => {
            const option = document.createElement('option');
            option.value = filename;
            option.textContent = filename;
            option.classList.add('file-option', 'uploaded');
            return option;
        };

        const hasUploadedFiles = allFiles.uploaded.length > 0;

        let placeholderText = "Select a document...";
        if (!authToken) placeholderText = "Login to see documents";
        else if (!backendStatus.db) placeholderText = "Database Offline";
        else if (!backendStatus.ai) placeholderText = "AI Components Offline";
        else if (!hasUploadedFiles) placeholderText = "No documents uploaded";

        const placeholder = document.createElement('option');
        placeholder.textContent = placeholderText;
        placeholder.disabled = true;
        const previousOptionExistsInUploaded = allFiles.uploaded.some(f => f === previouslySelected);
        placeholder.selected = !previouslySelected || !hasUploadedFiles || !previousOptionExistsInUploaded;
        placeholder.value = "";
        analysisFileSelect.appendChild(placeholder);

        if (allFiles.uploaded.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = "My Uploaded Documents";
            allFiles.uploaded.forEach(f => optgroup.appendChild(createOption(f)));
            analysisFileSelect.appendChild(optgroup);
        }

        if (previouslySelected && previousOptionExistsInUploaded) {
            analysisFileSelect.value = previouslySelected;
        } else {
             analysisFileSelect.value = "";
        }
        handleAnalysisFileSelection();
    }

    function handleAnalysisFileSelection() {
        const fileSelected = analysisFileSelect && analysisFileSelect.value;
        const canExecute = fileSelected && authToken && backendStatus.ai;
        disableAnalysisButtons(!canExecute);
        if (!analysisStatus) return;
        if (!authToken) setElementStatus(analysisStatus, "Login to analyze.", 'muted');
        else if (!backendStatus.db) setElementStatus(analysisStatus, "Database offline.", 'danger');
        else if (!backendStatus.ai) setElementStatus(analysisStatus, "AI components offline.", 'warning');
        else if (!fileSelected) setElementStatus(analysisStatus, "Select document & utility type.", 'muted');
        else {
             const selectedOptionText = analysisFileSelect.options[analysisFileSelect.selectedIndex].text;
             setElementStatus(analysisStatus, `Ready for ${escapeHtml(selectedOptionText)}.`, 'muted');
        }
         if (analysisOutputContainer) analysisOutputContainer.style.display = 'none';
         if (mindmapOutputContainer) mindmapOutputContainer.style.display = 'none';
         if (analysisReasoningContainer) analysisReasoningContainer.style.display = 'none';
         if (latexSourceContainer) latexSourceContainer.style.display = 'none';
         if (podcastOutputContainer) podcastOutputContainer.style.display = 'none';
    }

    function handleFileInputChange() {
         const canUpload = authToken && backendStatus.db && backendStatus.ai;
         if (uploadInput && uploadButton) {
            uploadButton.disabled = !(uploadInput.files.length > 0 && canUpload);
         }
         if (uploadStatus && uploadInput) {
             if (!authToken) setElementStatus(uploadStatus, "Login to upload.", 'muted');
             else if (!backendStatus.db) setElementStatus(uploadStatus, "Database offline.", 'warning');
             else if (!backendStatus.ai) setElementStatus(uploadStatus, "AI components offline.", 'warning');
             else if (uploadInput.files.length > 0) {
                setElementStatus(uploadStatus, `Selected: ${escapeHtml(uploadInput.files[0].name)}`, 'muted');
             } else {
                setElementStatus(uploadStatus, 'No file selected.', 'muted');
             }
         }
     }

    function disableAnalysisButtons(disabled = true) {
        analysisButtons.forEach(button => button && (button.disabled = disabled));
    }

    function disableChatInput(disabled = true) {
        const canChat = authToken && backendStatus.db && backendStatus.ai;
        const finalDisabled = disabled || !canChat;
        if (chatInput) chatInput.disabled = finalDisabled;
        if (sendButton) sendButton.disabled = finalDisabled;
        if (voiceInputButton) voiceInputButton.disabled = finalDisabled || !isMediaRecorderSupported;
    }

    function showSpinner(buttonElement, show = true) {
         if (!buttonElement) return;
         const spinnerElement = buttonElement.querySelector('.spinner-border');
         const textElement = buttonElement.querySelector('span:not(.spinner-border)');

         if (spinnerElement) spinnerElement.style.display = show ? 'inline-block' : 'none';
         if (textElement) textElement.style.visibility = show ? 'hidden' : 'visible';
         buttonElement.classList.toggle('loading', show);
    }

    function clearChatHistory() {
        if (chatHistory) {
            chatHistory.innerHTML = '';
            if (thinkingMessagesContainer && !chatHistory.contains(thinkingMessagesContainer)) {
                chatHistory.appendChild(thinkingMessagesContainer);
            }
        }
    }

    function setThreadIdDisplay(tid) {
         if (sessionIdDisplay) {
             sessionIdDisplay.textContent = tid ? `Thread: ${tid.substring(0, 8)}...` : '';
         }
    }

    function updateConnectionStatusUI() {
         if (!connectionStatus) return;
         let statusText = 'Unknown'; let statusType = 'secondary'; let persistentMessage = null; let messageType = 'danger';
         if (backendStatus.db && backendStatus.ai) {
             const vectorText = backendStatus.vectorStore ? `(${backendStatus.vectorCount} vectors)` : '(Index Missing/Error)';
             statusText = `Ready ${vectorText}`;
             statusType = 'success';
             if (!backendStatus.vectorStore) {
                 persistentMessage = "AI & DB Ready, but Vector Store index failed to load or is empty. RAG context might be incomplete.";
                 messageType = 'warning';
             } else {
                 hideStatusMessage();
             }
         } else if (backendStatus.db && !backendStatus.ai) {
             statusText = 'AI Offline';
             statusType = 'warning';
             persistentMessage = "Backend running, but AI components (LLM/Embeddings) failed. Chat, Analysis, and document Upload features will be unavailable.";
             messageType = 'warning';
         } else if (!backendStatus.db) {
             statusText = 'Backend Offline';
             statusType = 'danger';
             persistentMessage = backendStatus.error || "Cannot connect to backend or Database failed. Most features unavailable.";
             messageType = 'danger';
         } else {
             statusText = 'Status Unknown';
             statusType = 'secondary';
             persistentMessage = backendStatus.error || "Backend status is uncertain. Check server logs.";
             messageType = 'warning';
         }
         setConnectionStatus(statusText, statusType);
         if(persistentMessage && authToken) {
             showStatusMessage(persistentMessage, messageType, 0);
         } else if (!persistentMessage && authToken) {
             if (statusMessage?.style.display !== 'none' && statusMessageTimerId !== null) {
             } else if (statusMessage?.style.display !== 'none' && statusMessageTimerId === null && !isStickyError(statusMessage.textContent)) {
                hideStatusMessage();
             }
         } else if (!authToken && statusMessage?.style.display !== 'none') {
              hideStatusMessage();
         }
    }
    function isStickyError(messageText) {
        if (!messageText) return false;
        return messageText.includes("AI Offline") || messageText.includes("Backend Offline") || messageText.includes("Database failed");
    }


    function setConnectionStatus(text, type = 'info') {
        if (!connectionStatus) return;
        connectionStatus.textContent = text;
        connectionStatus.className = `badge bg-${type}`;
    }

    function showStatusMessage(message, type = 'info', duration = ERROR_MESSAGE_DURATION) {
        if (!statusMessage) return;
        if (statusMessage.childNodes.length > 0 && statusMessage.childNodes[0].nodeType === Node.TEXT_NODE) {
            statusMessage.childNodes[0].nodeValue = message;
        } else {
            statusMessage.prepend(document.createTextNode(message));
        }
        statusMessage.className = `alert alert-${type} alert-dismissible fade show ms-3`;
        statusMessage.style.display = 'flex';

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
        if (statusMessageTimerId) {
            clearTimeout(statusMessageTimerId);
            statusMessageTimerId = null;
        }
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

    async function toggleVoiceInput() {
        if (!isMediaRecorderSupported || !voiceInputButton || voiceInputButton.disabled) return;

        if (isListening) {
            console.log("Stopping voice input.");
            mediaRecorder.stop();
            audioStream.getTracks().forEach(track => track.stop());
            stopListeningUI();
        } else {
            console.log("Starting voice input.");
            try {
                audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(audioStream);
                audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    console.log("Audio recording stopped. Blob size:", audioBlob.size);
                    if (audioBlob.size > 0) {
                        await sendAudioForTranscription(audioBlob);
                    } else {
                        setChatStatus("No audio recorded.", 'warning');
                    }
                    stopListeningUI();
                };

                mediaRecorder.onerror = (event) => {
                    console.error('MediaRecorder error:', event.error);
                    setChatStatus(`Recording error: ${event.error.name}`, 'danger');
                    stopListeningUI();
                };

                mediaRecorder.start();
                startListeningUI();
            } catch (error) {
                console.error("Error starting voice input:", error);
                setChatStatus(`Microphone access denied or error: ${error.name}`, 'danger');
                stopListeningUI();
            }
        }
    }

    async function sendAudioForTranscription(audioBlob) {
        if (!API_BASE_URL || !authToken) {
            console.warn("Cannot send audio: missing API_BASE_URL or authToken.");
            setChatStatus("Login to use voice input.", 'warning');
            return;
        }

        setChatStatus('Transcribing audio...', 'info');
        disableChatInput(true);
        showSpinner(sendButton, true);

        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.webm');

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/transcribe-audio`, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `Transcription failed: ${response.status}`);
            }

            if (result.text) {
                chatInput.value = result.text;
                setChatStatus('Transcription complete.', 'success');
                if (!sendButton.disabled) handleSendMessage();
            } else {
                setChatStatus('No text transcribed.', 'warning');
            }
        } catch (error) {
            if (error.message !== "Unauthorized") {
                console.error("Transcription error:", error);
                setChatStatus(`Transcription error: ${error.message}`, 'danger');
            }
        } finally {
            showSpinner(sendButton, false);
            disableChatInput(!(authToken && backendStatus.db && backendStatus.ai));
            if(chatInput && !chatInput.disabled) chatInput.focus();
        }
    }

    function startListeningUI() {
        isListening = true;
        if (voiceInputButton) {
            voiceInputButton.classList.add('listening', 'btn-danger');
            voiceInputButton.classList.remove('btn-outline-secondary');
            voiceInputButton.title = "Stop Recording";
            voiceInputButton.innerHTML = '🔴';
        }
        setChatStatus('Recording audio...', 'info');
    }

    function stopListeningUI() {
        isListening = false;
        const canChat = authToken && backendStatus.db && backendStatus.ai;
        if (voiceInputButton) {
            voiceInputButton.classList.remove('listening', 'btn-danger');
            voiceInputButton.classList.toggle('btn-success', canChat && isMediaRecorderSupported);
            voiceInputButton.classList.toggle('btn-outline-secondary', !canChat || !isMediaRecorderSupported);
            voiceInputButton.title = canChat && isMediaRecorderSupported ? "Start Voice Input" : (isMediaRecorderSupported ? (authToken ? "Chat disabled" : "Login to use voice") : "Voice input not supported");
            voiceInputButton.innerHTML = '🎤';
        }
        if (chatStatus && chatStatus.textContent.startsWith('Recording audio...')) {
            setChatStatus(canChat ? 'Ready' : (authToken ? (backendStatus.db ? 'AI Offline' : 'Database Offline') : 'Login to chat'), canChat ? 'muted' : (authToken ? 'warning' : 'muted'));
        }
    }

    function togglePause() {
        if (!pauseButton || pauseButton.disabled) return;
        if (isStopped) return;

        isPaused = !isPaused;
        if (isPaused) {
            pauseButton.innerHTML = '▶️';
            pauseButton.title = 'Resume AI Response';
            pauseButton.classList.remove('btn-outline-warning');
            pauseButton.classList.add('btn-warning');
            setChatStatus('Paused...', 'warning');
            console.log("AI response paused.");
        } else {
            pauseButton.innerHTML = '⏸️';
            pauseButton.title = 'Pause AI Response';
            pauseButton.classList.remove('btn-warning');
            pauseButton.classList.add('btn-outline-warning');
            setChatStatus('Resuming...');
            console.log("AI response resumed. Processing buffered content.");
            if (responseBuffer.length > 0) {
                const lastBotMessageDiv = chatHistory?.querySelector('.bot-wrapper:last-child .message.bot-message');
                if (lastBotMessageDiv) {
                    let currentText = lastBotMessageDiv.dataset.rawText || '';
                    currentText += responseBuffer;
                    if (typeof marked !== 'undefined') {
                        marked.setOptions({ breaks: true, gfm: true, sanitize: false });
                        lastBotMessageDiv.innerHTML = marked.parse(currentText);
                    } else {
                        lastBotMessageDiv.textContent = currentText;
                    }
                    lastBotMessageDiv.dataset.rawText = currentText;
                    chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
                }
                responseBuffer = '';
            }
            setChatStatus('AI Tutor is thinking...');
        }
    }

    function handleStop() {
        if (!stopButton || stopButton.disabled) return;
        if (isStopped) return;

        isStopped = true;
        if (abortController) {
            abortController.abort('User stopped response');
            console.log("AI response stopped by user (fetch aborted).");
        }
        clearTimeout(thinkingMessageTimer);
        clearThinkingMessages();

        if (pauseButton) pauseButton.disabled = true;
        if (stopButton) stopButton.disabled = true;
        if (sendButton) showSpinner(sendButton, false);

        setChatStatus('Response stopped by user.', 'info');
        addMessageToChat('bot', "Response stopped by user.", [], null, 'stopped-msg');
        disableChatInput(false);
        if(chatInput) chatInput.focus();
        isPaused = false;
        responseBuffer = '';
    }

    function addReferencesAndThinkingToMessage(messageWrapper, references, thinking) {
        if (thinking) {
            const thinkingDiv = document.createElement('div');
            thinkingDiv.classList.add('message-thinking');
            thinkingDiv.innerHTML = `<details><summary class="text-info small fw-bold">Show Reasoning</summary><pre><code>${escapeHtml(thinking)}</code></pre></details>`;
            messageWrapper.appendChild(thinkingDiv);
        }

        if (references && references.length > 0) {
            const referencesDiv = document.createElement('div');
            referencesDiv.classList.add('message-references');
            let refHtml = '<strong class="small text-warning">References:</strong><ul class="list-unstyled mb-0 small">';
            references.forEach(ref => {
                if (ref && typeof ref === 'object') {
                    const source = escapeHtml(ref.source || 'Unknown');
                    const preview = escapeHtml(ref.content_preview || 'No preview');
                    const number = escapeHtml(ref.number || '?');
                    refHtml += `<li class="ref-item">[${number}] <span class="ref-source" title="Preview: ${preview}">${source}</span></li>`;
                }
            });
            refHtml += '</ul>';
            referencesDiv.innerHTML = refHtml;
            messageWrapper.appendChild(referencesDiv);
        }
    }

    function addMessageActions(messageWrapper, sender, textToCopy) {
        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('message-actions');

        if (sender === 'bot') {
            const copyBtn = document.createElement('button');
            copyBtn.classList.add('btn', 'btn-sm', 'btn-action', 'btn-copy');
            copyBtn.innerHTML = '📄';
            copyBtn.title = 'Copy response';
            copyBtn.addEventListener('click', () => handleCopyMessage(textToCopy || "", copyBtn));

            const likeBtn = document.createElement('button');
            likeBtn.classList.add('btn', 'btn-sm', 'btn-action', 'btn-like');
            likeBtn.innerHTML = '👍';
            likeBtn.title = 'Like response';
            likeBtn.addEventListener('click', () => handleToggleFeedback(likeBtn, 'like'));

            const dislikeBtn = document.createElement('button');
            dislikeBtn.classList.add('btn', 'btn-sm', 'btn-action', 'btn-dislike');
            dislikeBtn.innerHTML = '👎';
            dislikeBtn.title = 'Dislike response';
            dislikeBtn.addEventListener('click', () => handleToggleFeedback(dislikeBtn, 'dislike'));

            actionsDiv.append(copyBtn, likeBtn, dislikeBtn);
        } else {
            const editBtn = document.createElement('button');
            editBtn.classList.add('btn', 'btn-sm', 'btn-action', 'btn-edit-user');
            editBtn.innerHTML = '✏️';
            editBtn.title = 'Edit your message';
            editBtn.addEventListener('click', () => handleEditUserMessage(textToCopy || ""));

            const copyBtn = document.createElement('button');
            copyBtn.classList.add('btn', 'btn-sm', 'btn-action', 'btn-copy');
            copyBtn.innerHTML = '📄';
            copyBtn.title = 'Copy your message';
            copyBtn.addEventListener('click', () => handleCopyMessage(textToCopy || "", copyBtn));

            actionsDiv.append(editBtn, copyBtn);
        }
        messageWrapper.appendChild(actionsDiv);
    }

    function displayThinkingMessage(message) {
        if (!thinkingMessagesContainer) return;
        clearThinkingMessages();
        const thinkingDiv = document.createElement('div');
        thinkingDiv.classList.add('thinking-message');
        thinkingDiv.textContent = message;
        thinkingMessagesContainer.appendChild(thinkingDiv);
        chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
    }

    function clearThinkingMessages() {
        if (thinkingMessagesContainer) {
            thinkingMessagesContainer.innerHTML = '';
        }
    }

    initializeApp();
});