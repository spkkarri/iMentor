import axios from 'axios';

const getApiBaseUrl = () => {
    const backendPort = process.env.REACT_APP_BACKEND_PORT || 5007;
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:${backendPort}/api`;
};

const API_BASE_URL = getApiBaseUrl();
console.log("API Base URL:", API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        const userId = localStorage.getItem('userId');
        if (userId) {
            config.headers['x-user-id'] = userId;
        }
        
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        } else if (!config.headers['Content-Type']) {
             config.headers['Content-Type'] = 'application/json';
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = '/login?sessionExpired=true';
        }
        return Promise.reject(error);
    }
);

export const signupUser = (userData) => api.post('/auth/signup', userData);
export const signinUser = (userData) => api.post('/auth/signin', userData);
// Updated to send a more structured history
export const sendMessage = (messageData) => api.post('/chat/message', messageData);
export const saveChatHistory = (historyData) => api.post('/chat/history', historyData);
export const queryRagService = (queryData) => api.post('/chat/rag', queryData);
export const getChatSessions = () => api.get('/chat/sessions');
export const getSessionDetails = (sessionId) => api.get(`/chat/session/${sessionId}`);
export const uploadFile = (formData) => api.post('/upload', formData);
export const getUserFiles = () => api.get('/files');
export const deleteUserFile = (fileId) => api.delete(`/files/${fileId}`);
export const generatePodcast = (fileId, style = 'single-host', selectedModel = 'gemini-flash') => api.post('/podcast/generate', { fileId, style, selectedModel });
export const generateMindMap = (fileId, selectedModel = 'gemini-flash') => api.post('/mindmap/generate', { fileId, selectedModel });
export const generatePPT = (topic, selectedModel = 'gemini-flash') => api.post('/files/generate-ppt', { topic, selectedModel }, { responseType: 'blob' });
export const generateReport = (topic, selectedModel = 'gemini-flash') => api.post('/files/generate-report', { topic, selectedModel }, { responseType: 'blob' });
export const performDeepSearch = async (query, history = [], selectedModel = 'gemini-flash') => {
    try {
        // Try the new efficient deep search first
        const response = await api.post('/chat/efficient-deep-search', {
            query,
            selectedModel,
            history: history.map(msg => ({
                role: msg.role,
                content: msg.parts?.[0]?.text || msg.content || ''
            }))
        });
        return response;
    } catch (error) {
        console.error('Efficient deep search failed:', error);
        // Fallback to enhanced deep search
        try {
            const fallbackResponse = await api.post('/chat/enhanced-deep-search', {
                query,
                history: history.map(msg => ({
                    role: msg.role,
                    content: msg.parts?.[0]?.text || msg.content || ''
                }))
            });
            return fallbackResponse;
        } catch (fallbackError) {
            console.error('Enhanced deep search also failed:', fallbackError);
            // Final fallback to original deep search
            try {
                const finalFallbackResponse = await api.post('/chat/deep-search', {
                    query,
                    history: history.map(msg => ({
                        role: msg.role,
                        content: msg.parts?.[0]?.text || msg.content || ''
                    }))
                });
                return finalFallbackResponse;
            } catch (finalError) {
                console.error('All deep search methods failed:', finalError);
                throw error;
            }
        }
    }
};

// Enhanced Deep Search V2 with rich media content
export const performEnhancedDeepSearchV2 = async (query, history = [], selectedModel = 'gemini-flash') => {
    try {
        console.log('🚀 Calling Enhanced Deep Search V2 API...');
        const response = await api.post('/chat/enhanced-deep-search-v2', {
            query,
            selectedModel,
            history: history.map(msg => ({
                role: msg.role,
                content: msg.parts?.[0]?.text || msg.content || ''
            }))
        });

        console.log('✅ Enhanced Deep Search V2 response received:', response.data);
        return response;
    } catch (error) {
        console.error('Enhanced Deep Search V2 failed:', error);
        throw error;
    }
};

export const renameUserFile = (fileId, newOriginalName) => api.patch(`/files/${fileId}`, { newOriginalName });
export const getFileOverview = (fileId) => api.post('/files/overview', { fileId });

// --- Merged Functions ---

// User Memory Management (from main)
export const getMemories = () => api.get('/memory');
export const addMemory = (memoryData) => api.post('/memory', memoryData);
export const deleteMemory = (memoryId) => api.delete(`/memory/${memoryId}`);

// Quota Management (from main)
export const getQuotaStatus = () => api.get('/chat/quota-status');

// User Details (from team4)
export const getCurrentUser = () => api.get('/auth/me');

// Training functions
export const getBaseModels = (includeCustom = false) => api.get(`/training/models/base?includeCustom=${includeCustom}`);
export const getCheckpoints = (subject = null) => api.get(`/training/checkpoints${subject ? `?subject=${subject}` : ''}`);
export const getCustomModels = () => api.get('/training/models/custom');
export const deleteCustomModel = (modelId) => api.delete(`/training/models/custom/${modelId}`);
export const uploadCustomModel = (formData) => api.post('/training/models/custom', formData, {
    headers: {
        'Content-Type': 'multipart/form-data'
    }
});

// Training data functions
export const getTrainingDataStats = () => api.get('/training/data/stats');
export const uploadTrainingData = (formData) => api.post('/training/data', formData, {
    headers: {
        'Content-Type': 'multipart/form-data'
    }
});
export const addTextTrainingData = (data) => api.post('/training/data/text', data);

// Database functions
export const getSupportedDatabaseTypes = () => api.get('/database/types');
export const getDataFormats = () => api.get('/database/formats');
export const testDatabaseConnection = (config) => api.post('/database/test-connection', config);
export const getDatabaseSchema = (connectionId) => api.get(`/database/schema/${connectionId}`);
export const extractTrainingData = (config) => api.post('/database/extract', config);
export const validateTrainingData = (data) => api.post('/training/data/validate', data);

// Chat session functions
export const deleteChatSession = (sessionId) => api.delete(`/chat/sessions/${sessionId}`);

// Ollama functions
export const getOllamaStatus = () => api.get('/ollama/status');
export const configureOllama = (config) => api.post('/ollama/configure', config);
export const getOllamaModels = () => api.get('/ollama/models');
export const getPopularOllamaModels = () => api.get('/ollama/models/popular');
export const getRunningOllamaModels = () => api.get('/ollama/models/running');
export const deleteOllamaModel = (modelName) => api.delete(`/ollama/models/${modelName}`);
export const loadOllamaModel = (modelName) => api.post(`/ollama/models/${modelName}/load`);
export const unloadOllamaModel = (modelName) => api.post(`/ollama/models/${modelName}/unload`);

// Training dashboard functions
export const getTrainingModels = () => api.get('/training/models');
export const getTrainingStatus = () => api.get('/training/status');
export const startTrainingAPI = (data) => api.post('/training/start', data);
export const stopTrainingAPI = () => api.post(`/training/stop`);
export const getTrainingProgress = () => api.get(`/training/progress`);

// Sample data generation
export const generateSampleData = (subject, count) => api.post('/training/data/generate', { subject, count });

// Ollama functions
export const pullOllamaModel = (modelName) => api.post('/ollama/pull', { modelName });

// User API Keys Management
export const getUserApiKeys = () => api.get('/user-api-keys');
export const updateUserApiKeys = (data) => api.put('/user-api-keys', data);
export const testUserServices = () => api.post('/user-api-keys/test');
export const clearUserServiceCache = () => api.post('/user-api-keys/clear-cache');
export const requestAdminAccess = (data) => api.post('/user-api-keys/request-admin-access', data);

// Admin Dashboard
export const getAdminDashboard = () => api.get('/admin/dashboard');
export const getAllUsers = () => api.get('/admin/users');
export const getUserDetails = (userId) => api.get(`/admin/users/${userId}`);
export const approveAdminAccess = (userId, data) => api.post(`/admin/users/${userId}/approve`, data);
export const denyAdminAccess = (userId, data) => api.post(`/admin/users/${userId}/deny`, data);
export const revokeAdminAccess = (userId, data) => api.post(`/admin/users/${userId}/revoke`, data);
export const updateUserConfig = (userId, data) => api.put(`/admin/users/${userId}`, data);
export const getSystemStats = () => api.get('/admin/stats');
