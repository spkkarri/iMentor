// client/src/services/api.js
import axios from 'axios';

// Dynamically determine API Base URL
const getApiBaseUrl = () => {
    const backendPort = process.env.REACT_APP_BACKEND_PORT || 5001;
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const backendHost = (hostname === 'localhost' || hostname === '127.0.0.1')
        ? 'localhost'
        : hostname;
    return `${protocol}//${backendHost}:${backendPort}/api`;
};

const API_BASE_URL = getApiBaseUrl();
console.log("API Base URL:", API_BASE_URL);

// Create Axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
});

// --- Interceptors (Your existing interceptors are perfect) ---
api.interceptors.request.use(
    (config) => {
        const userId = localStorage.getItem('userId');
        if (userId) {
            config.headers['x-user-id'] = userId;
        } else if (!config.url.includes('/auth/')) {
             console.warn("API Interceptor: userId not found for non-auth request to", config.url);
        }
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        } else if (!config.headers['Content-Type']) {
             config.headers['Content-Type'] = 'application/json';
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            console.warn("API Response Interceptor: Received 401 Unauthorized. Clearing auth data.");
            localStorage.removeItem('sessionId');
            localStorage.removeItem('username');
            localStorage.removeItem('userId');
            if (!window.location.pathname.includes('/login')) {
                 window.location.href = '/login?sessionExpired=true';
            }
        }
        return Promise.reject(error);
    }
);
// --- End Interceptors ---


// --- NAMED EXPORTS for API functions ---

// Authentication
export const signupUser = (userData) => api.post('/auth/signup', userData);
export const signinUser = (userData) => api.post('/auth/signin', userData);

// Chat Interaction
export const sendMessage = (messageData) => api.post('/chat/message', messageData);
export const saveChatHistory = (historyData) => api.post('/chat/history', historyData);

// RAG Query
export const queryRagService = (queryData) => api.post('/chat/rag', queryData);

// Chat History Retrieval
export const getChatSessions = () => api.get('/chat/sessions');
export const getSessionDetails = (sessionId) => api.get(`/chat/session/${sessionId}`);

// File Upload
export const uploadFile = (formData) => api.post('/upload', formData);

// File Management
export const getUserFiles = () => api.get('/files');
export const renameUserFile = (serverFilename, newOriginalName) => api.patch(`/files/${serverFilename}`, { newOriginalName });
export const deleteUserFile = (serverFilename) => api.delete(`/files/${serverFilename}`);

// --- NEW: Podcast Generation ---
// This function makes the API call to our Node.js backend to trigger the podcast generation.
export const generatePodcast = (fileId) => {
    // It sends the fileId in the request body, as our backend route expects.
    return api.post('/podcast', { fileId });
};
// --- END OF NEW FUNCTION ---


// --- DEFAULT EXPORT ---
export default api;