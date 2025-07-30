// src/services/api.js
import axios from 'axios';

const getApiBaseUrl = () => {
    const backendPort = process.env.REACT_APP_BACKEND_PORT || 5007;
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    // For development, ensure it correctly points to your backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `${protocol}//${hostname}:${backendPort}/api`;
    }
    // For production, it might just be /api if served from the same domain
    return '/api';
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
            // Let the browser set the Content-Type for FormData
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
            // Use a query parameter to show a message on the login page
            window.location.href = '/login?sessionExpired=true';
        }
        return Promise.reject(error);
    }
);

// Auth
export const signupUser = (userData) => api.post('/auth/signup', userData);
export const signinUser = (userData) => api.post('/auth/signin', userData);
export const getCurrentUser = () => api.get('/auth/me');

// Chat
export const sendMessage = (messageData) => api.post('/chat/message', messageData);
export const saveChatHistory = (historyData) => api.post('/chat/history', historyData);
export const getChatSessions = () => api.get('/chat/sessions');
export const getSessionDetails = (sessionId) => api.get(`/chat/session/${sessionId}`);
export const deleteChatSession = (sessionId) => api.delete(`/chat/session/${sessionId}`);
export const summarizeConversation = (messages) => api.post('/chat/summarize', { messages });


// RAG and Search
export const queryRagService = (queryData) => api.post('/chat/rag', queryData);
export const performDeepSearch = (query, history = []) => api.post('/chat/deep-search', { query, history });
export const queryHybridRagService = (queryData) => api.post('/chat/rag-v2', queryData);

// Files
export const uploadFile = (formData) => api.post('/upload', formData);
export const getUserFiles = () => api.get('/files');
export const deleteUserFile = (fileId) => api.delete(`/files/${fileId}`);
export const renameUserFile = (fileId, newOriginalName) => api.patch(`/files/${fileId}`, { newOriginalName });

// Content Generation
export const generatePodcast = (fileId) => api.post('/podcast/generate', { fileId });
export const generateMindMap = (fileId) => api.post('/mindmap/generate', { fileId });

// User Memory Management
export const getMemories = () => api.get('/memory');
export const addMemory = (memoryData) => api.post('/memory', memoryData);
export const deleteMemory = (memoryId) => api.delete(`/memory/${memoryId}`);

// Quota Management
export const getQuotaStatus = () => api.get('/chat/quota-status');

// Training API
export const getTrainingDataStats = (subject) => api.get(`/training/data/stats/${subject}`);
export const uploadTrainingData = (formData) => api.post('/training/data/upload', formData);
export const addTextTrainingData = (subject, data) => api.post('/training/data/text', { subject, data });
export const generateSampleData = (subject, count = 100) => api.post('/training/data/generate', { subject, count });
export const getTrainingStatus = () => api.get('/training/status');
export const getTrainingModels = () => api.get('/training/models');
export const startTraining = (subject, config) => api.post('/training/start', { subject, config });
export const stopTraining = () => api.post('/training/stop');
export const getTrainingProgress = () => api.get('/training/progress');

// Advanced training API functions
export const getBaseModels = (includeCustom = false) => {
    const params = includeCustom ? { includeCustom: 'true' } : {};
    return api.get('/training/base-models', { params });
};
export const getCheckpoints = (subject = null) => {
    const params = subject ? { subject } : {};
    return api.get('/training/checkpoints', { params });
};

// Custom model API functions
export const uploadCustomModel = (formData) => {
    return api.post('/training/upload-model', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};
export const getCustomModels = () => api.get('/training/custom-models');
export const deleteCustomModel = (modelId) => api.delete(`/training/custom-models/${modelId}`);

// Ollama API functions
export const getOllamaStatus = () => api.get('/training/ollama/status');
export const getOllamaModels = () => api.get('/training/ollama/models');
export const getPopularOllamaModels = () => api.get('/training/ollama/popular');
export const pullOllamaModel = (modelName) => api.post('/training/ollama/pull', { modelName });
export const deleteOllamaModel = (modelName) => api.delete(`/training/ollama/models/${modelName}`);
export const loadOllamaModel = (modelName) => api.post(`/training/ollama/load/${modelName}`);
export const unloadOllamaModel = (modelName) => api.post(`/training/ollama/unload/${modelName}`);
export const getRunningOllamaModels = () => api.get('/training/ollama/running');
export const configureOllama = (baseUrl) => api.post('/training/ollama/configure', { baseUrl });

// Database API functions
export const getSupportedDatabaseTypes = () => api.get('/training/database/supported-types');
export const getDataFormats = () => api.get('/training/database/data-formats');
export const testDatabaseConnection = (config) => api.post('/training/database/test-connection', { config });
export const getDatabaseSchema = (config) => api.post('/training/database/get-schema', { config });
export const extractTrainingData = (config, extractionConfig) => api.post('/training/database/extract-data', { config, extractionConfig });
export const validateTrainingData = (data, format, options) => api.post('/training/database/validate-data', { data, format, options });
export const downloadModel = (modelId) => api.get(`/training/download/${modelId}`, { responseType: 'blob' });
