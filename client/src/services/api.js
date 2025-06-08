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

// --- Interceptor to add User ID header (TEMP AUTH) ---
api.interceptors.request.use(
    (config) => {
        const userId = localStorage.getItem('userId');
        if (userId) {
            config.headers['x-user-id'] = userId;
        } else if (!config.url.includes('/auth/')) {
             console.warn("API Interceptor: userId not found in localStorage for non-auth request to", config.url);
        }
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        } else if (!config.headers['Content-Type']) {
             config.headers['Content-Type'] = 'application/json';
        }
        return config;
    },
    (error) => {
        console.error("API Request Interceptor Error:", error);
        return Promise.reject(error);
    }
);

// --- Interceptor to handle 401 Unauthorized responses ---
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.warn("API Response Interceptor: Received 401 Unauthorized. Clearing auth data and redirecting to login.");
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


// --->>> ADD THIS NEW FUNCTION FOR DOCUMENT ANALYSIS <<<---
/**
 * Calls the backend to perform document analysis (FAQ, Topics, Mindmap).
 * @param {object} payload - The payload for the analysis.
 * @param {string} payload.type - The type of analysis ('faq', 'topics', 'mindmap').
 * @param {string} payload.filename - The name of the file to analyze.
 * @returns {Promise<axios.AxiosResponse<any>>}
 */
export const analyzeDocument = async (payload) => {
    let endpoint = '';
    if (payload.type === 'faq') {
        endpoint = '/analyze/faq'; // Note: API_BASE_URL already includes '/api'
    } else if (payload.type === 'topics') {
        endpoint = '/analyze/topics';
    } else if (payload.type === 'mindmap') {
        endpoint = '/analyze/mindmap';
    } else {
        console.error('Invalid analysis type for API call:', payload.type);
        // Return a rejected promise or throw an error to be caught by the caller
        return Promise.reject(new Error('Invalid analysis type specified for API call.'));
    }

    console.log(`[API Service] Calling ${API_BASE_URL}${endpoint} with filename: ${payload.filename}`);
    // The interceptor will add the 'x-user-id' header.
    // The backend route for analysis uses `tempAuth`, which relies on this header.
    return api.post(endpoint, { filename: payload.filename });
};
// --->>> END OF NEW FUNCTION <<<---


// --- DEFAULT EXPORT ---
// Export the configured Axios instance if needed for direct use elsewhere
export default api;