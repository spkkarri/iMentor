// client/src/services/api.js
import axios from 'axios';

// Dynamically determine API Base URL
const getApiBaseUrl = () => {
    const backendPort = process.env.REACT_APP_BACKEND_PORT || 5003;
    const hostname = window.location.hostname;
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const backendHost = (hostname === 'localhost' || hostname === '127.0.0.1') ? 'localhost' : hostname;
    return `${protocol}//${backendHost}:${backendPort}/api`;
};

const API_BASE_URL = getApiBaseUrl();
const api = axios.create({ baseURL: API_BASE_URL });

// Interceptors (Unchanged)
api.interceptors.request.use( (config) => { const userId = localStorage.getItem('userId'); if (userId) { config.headers['x-user-id'] = userId; } else if (!config.url.includes('/auth/')) { console.warn("API Interceptor: userId not found for non-auth request to", config.url); } if (!(config.data instanceof FormData)) { config.headers['Content-Type'] = 'application/json'; } return config; }, (error) => Promise.reject(error) );
api.interceptors.response.use( (response) => response, (error) => { if (error.response && error.response.status === 401) { console.warn("API Interceptor: 401 Unauthorized. Clearing auth & redirecting."); localStorage.clear(); if (!window.location.pathname.includes('/login')) { window.location.href = '/login?sessionExpired=true'; } } return Promise.reject(error); } );


// --- AUTHENTICATION ---
export const signupUser = (userData) => api.post('/auth/signup', userData);
export const signinUser = (userData) => api.post('/auth/signin', userData);
export const requestAdminKeyAccess = () => api.post('/auth/request-access');


// --- USER SETTINGS ---
export const getUserSettings = () => api.get('/settings');
export const saveUserSettings = (settingsData) => api.post('/settings', settingsData);


// ==================================================================
//  START OF NEW FEATURE MODIFICATION
// ==================================================================

// --- ADMIN PANEL ---
export const getAdminAccessRequests = () => api.get('/admin/requests');
export const processAdminRequest = (userId, isApproved) => api.post('/admin/approve', { userId, isApproved });
export const getAcceptedUsers = () => api.get('/admin/accepted');
// ==================================================================
//  END OF NEW FEATURE MODIFICATION
// ==================================================================


// --- CHAT & HISTORY ---
export const sendMessage = (messageData) => api.post('/chat/message', messageData);
export const saveChatHistory = (historyData) => api.post('/chat/history', historyData);
export const getChatSessions = () => api.get('/chat/sessions');
export const getSessionDetails = (sessionId) => api.get(`/chat/session/${sessionId}`);
export const deleteChatSession = (sessionId) => api.delete(`/chat/session/${sessionId}`);


// --- FILE UPLOAD & MANAGEMENT ---
export const uploadFile = (formData) => api.post('/upload', formData);
export const getUserFiles = () => api.get('/files');
export const renameUserFile = (serverFilename, newOriginalName) => api.patch(`/files/${serverFilename}`, { newOriginalName });
export const deleteUserFile = (serverFilename) => api.delete(`/files/${serverFilename}`);


// --- DOCUMENT ANALYSIS ---
export const analyzeDocument = (analysisData) => api.post('/analysis/document', analysisData);


// --- DEFAULT EXPORT ---
export default api;