import axios from 'axios';

// --- UNIFIED DYNAMIC URL DEFINITION ---

// 1. Dynamically determine the base part of the server URL (e.g., 'http://localhost:5001')
const getDynamicServerBase = () => {
    const backendPort = process.env.REACT_APP_BACKEND_PORT || 5001;
    const hostname = window.location.hostname;
    // Use the same protocol as the frontend (http: or https:)
    const protocol = window.location.protocol;
    
    // Construct the base URL without any extra paths
    return `${protocol}//${hostname}:${backendPort}`;
};

// 2. Export the server's base URL for use with file paths (like our podcast)
export const SERVER_BASE_URL = getDynamicServerBase();

// 3. Create the API base URL by adding '/api' for all Axios API requests
const API_BASE_URL = `${SERVER_BASE_URL}/api`;

// --- For Debugging ---
console.log("SERVER_BASE_URL (for files):", SERVER_BASE_URL);
console.log("API_BASE_URL (for api calls):", API_BASE_URL);

// --- Create and Configure Axios Instance ---
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


// --- NAMED EXPORTS for all API functions ---

// Authentication
export const signupUser = (userData) => api.post('/auth/signup', userData);
export const signinUser = (userData) => api.post('/auth/signin', userData);

// Chat Interaction
export const sendMessage = (messageData) => api.post('/chat/message', messageData);
export const saveChatHistory = (historyData) => api.post('/chat/history', historyData);

// Chat History Retrieval
export const getChatSessions = () => api.get('/chat/sessions');
export const getSessionDetails = (sessionId) => api.get(`/chat/session/${sessionId}`);

// File Upload
export const uploadFile = (formData) => api.post('/upload', formData);

// File Management
export const getUserFiles = () => api.get('/files');
export const renameUserFile = (serverFilename, newOriginalName) => api.patch(`/files/${serverFilename}`, { newOriginalName });
export const deleteUserFile = (serverFilename) => api.delete(`/files/${serverFilename}`);

// Document Analysis
export const analyzeDocument = (payload) => {
    let endpoint = '';
    if (payload.type === 'faq') {
        endpoint = '/analyze/faq';
    } else if (payload.type === 'topics') {
        endpoint = '/analyze/topics';
    } else if (payload.type === 'mindmap') {
        endpoint = '/analyze/mindmap';
    } else {
        return Promise.reject(new Error('Invalid analysis type specified for API call.'));
    }
    return api.post(endpoint, { filename: payload.filename });
};

// Podcast Generation
export const generatePodcast = (serverFilename) => {
  // The axios instance `api` will automatically add the base URL.
  // We need to call our specific endpoint. However, the original code used axios.post
  // which does not use the interceptor. To be consistent, let's keep it that way for now,
  // but build the URL from our dynamic constants.
  const userId = localStorage.getItem('userId');
  return axios.post(`${API_BASE_URL}/audio/generate`, 
    { serverFilename }, 
    { headers: { 'X-User-ID': userId } }
  );
};

// --- DEFAULT EXPORT ---
// Export the configured Axios instance if needed for direct use elsewhere
export default api;