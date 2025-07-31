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
export const generatePodcast = (fileId) => api.post('/podcast/generate', { fileId });
export const generateMindMap = (fileId) => api.post('/mindmap/generate', { fileId });
export const generatePPT = (topic) => api.post('/files/generate-ppt', { topic }, { responseType: 'blob' });
export const generateReport = (topic) => api.post('/files/generate-report', { topic }, { responseType: 'blob' });
export const performDeepSearch = (query, history = []) => api.post('/chat/deep-search', { query, history });
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
