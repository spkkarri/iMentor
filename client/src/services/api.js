// client/src/services/api.js
import axios from 'axios';

const getApiBaseUrl = () => {
    const backendPort = process.env.REACT_APP_BACKEND_PORT || 5001;
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:${backendPort}/api`;
};

const API_BASE_URL = getApiBaseUrl();
const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) config.headers['Authorization'] = `Bearer ${token}`;
        const userId = localStorage.getItem('userId');
        if (userId) config.headers['x-user-id'] = userId;
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

// --- ALL FUNCTIONS ARE EXPORTED AS NAMED CONSTANTS ---

export const signupUser = (userData) => api.post('/auth/signup', userData);
export const signinUser = (userData) => api.post('/auth/signin', userData);

export const sendMessage = (messageData) => api.post('/chat/message', messageData);
export const queryRagService = (queryData) => api.post('/chat/rag', queryData);
export const deepSearch = (queryData) => api.post('/deep_search', queryData);

export const uploadFile = (formData) => api.post('/upload', formData);
export const getUserFiles = () => api.get('/files');
export const deleteUserFile = (fileId) => api.delete(`/files/${fileId}`);
export const renameUserFile = (fileId, newOriginalName) => api.patch(`/files/${fileId}`, { newOriginalName });

export const generatePodcast = (fileId) => api.post('/podcast/generate', { fileId });
export const generateMindMap = (fileId) => api.post('/mindmap/generate', { fileId });
export const generatePresentation = (topic, userId) => api.post('/generate_presentation', { topic, userId });

export const saveChatHistory = (historyData) => api.post('/history', historyData);
export const getHistoryList = () => api.get('/history');
export const getHistorySession = (sessionId) => api.get(`/history/${sessionId}`);
export const deleteHistorySession = (sessionId) => api.delete(`/history/${sessionId}`);

// --- THERE IS NO 'export default' AT THE END OF THE FILE ---