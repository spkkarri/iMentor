// frontend/src/services/adminApi.js
import axios from 'axios';

// --- CONFIGURATION ---
const ADMIN_API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api'}/admin`;
const ADMIN_USERNAME_FRONTEND = import.meta.env.VITE_ADMIN_USERNAME || 'admin@admin.com';
const ADMIN_PASSWORD_FRONTEND = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

// --- DEDICATED AXIOS INSTANCE FOR ADMIN CALLS ---
// This creates a separate client specifically for admin routes, preventing any conflicts
// with the main app's interceptors or default settings.
const adminApiClient = axios.create({
    baseURL: ADMIN_API_BASE_URL,
});

// --- HELPER FUNCTIONS ---

export const getFixedAdminAuthHeaders = () => {
    if (!ADMIN_USERNAME_FRONTEND || !ADMIN_PASSWORD_FRONTEND) {
        console.error("Admin credentials not found in .env variables (VITE_ADMIN_USERNAME, VITE_ADMIN_PASSWORD).");
        return {};
    }
    const basicAuthToken = btoa(`${ADMIN_USERNAME_FRONTEND}:${ADMIN_PASSWORD_FRONTEND}`);
    return { 'Authorization': `Basic ${basicAuthToken}` };
};

// --- THIS IS THE REFINED AND SIMPLIFIED REQUEST HANDLER ---
// It now uses the dedicated `adminApiClient` instance.
const makeAdminApiRequest = async (method, endpoint, data = null, customHeaders = {}) => {
    try {
        const config = {
            method,
            url: endpoint, // The URL is relative to the `baseURL` of `adminApiClient`
            headers: {
                ...getFixedAdminAuthHeaders(), // Always include fresh auth headers
                ...customHeaders,
            },
        };
        if (data) {
            config.data = data;
        }
        if (data instanceof FormData) {
            config.headers['Content-Type'] = 'multipart/form-data';
        }

        const response = await adminApiClient(config);
        return response.data;
    } catch (error) {
        let errorMessage = 'Admin API request failed.';
        if (error.response) {
            errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
            console.error(`Admin API Error (${method.toUpperCase()} ${ADMIN_API_BASE_URL}${endpoint}): Status ${error.response.status}`, error.response.data);
        } else if (error.request) {
            errorMessage = 'No response from admin API server. Check network or server status.';
        } else {
            errorMessage = error.message || 'Error setting up admin API request.';
        }
        throw new Error(errorMessage);
    }
};

// --- EXPORTED API FUNCTIONS (Now using the reliable handler) ---

export const getDashboardStats = () => makeAdminApiRequest('get', '/dashboard-stats');

export const uploadAdminDocument = (formData) => makeAdminApiRequest('post', '/documents/upload', formData);
export const getAdminDocuments = () => makeAdminApiRequest('get', '/documents');
export const deleteAdminDocument = (serverFilename) => makeAdminApiRequest('delete', `/documents/${serverFilename}`);
export const getAdminDocumentAnalysis = (serverFilename) => makeAdminApiRequest('get', `/documents/${serverFilename}/analysis`);
export const getAdminDocumentAnalysisByOriginalName = (originalName) => makeAdminApiRequest('get', `/documents/by-original-name/${encodeURIComponent(originalName)}/analysis`);

export const getApiKeyRequests = () => makeAdminApiRequest('get', '/key-requests');
export const approveApiKeyRequest = (userId) => makeAdminApiRequest('post', '/key-requests/approve', { userId });
export const rejectApiKeyRequest = (userId) => makeAdminApiRequest('post', '/key-requests/reject', { userId });

export const getUsersAndChats = () => makeAdminApiRequest('get', '/users-with-chats');

export const getLlmConfigs = () => makeAdminApiRequest('get', '/llms');
export const createLlmConfig = (data) => makeAdminApiRequest('post', '/llms', data);
export const updateLlmConfig = (id, data) => makeAdminApiRequest('put', `/llms/${id}`, data);
export const deleteLlmConfig = (id) => makeAdminApiRequest('delete', `/llms/${id}`);

export const getFeedbackStats = () => makeAdminApiRequest('get', '/feedback-stats');


// --- NEW DATASET MANAGEMENT API FUNCTIONS ---
export const getDatasets = () => makeAdminApiRequest('get', '/datasets');

export const getPresignedUploadUrl = (fileName, fileType) => makeAdminApiRequest('post', '/datasets/presigned-url', { fileName, fileType });

export const finalizeUpload = (datasetMetadata) => makeAdminApiRequest('post', '/datasets/finalize-upload', datasetMetadata);

export const getPresignedDownloadUrl = (datasetId) => makeAdminApiRequest('get', `/datasets/${datasetId}/download-url`);

export const deleteDataset = (datasetId) => makeAdminApiRequest('delete', `/datasets/${datasetId}`);

export const getUserEngagementStats = () => makeAdminApiRequest('get', '/analytics/user-engagement');

export const getContentInsightStats = () => makeAdminApiRequest('get', '/analytics/content-insights');

export const getFeatureUsageStats = () => makeAdminApiRequest('get', '/analytics/feature-usage');

export const getCodeExecutorUsage = () => makeAdminApiRequest('get', '/analytics/code-executor-usage');

export const getLlmUsageStats = () => makeAdminApiRequest('get', '/analytics/llm-usage');

export const getPptxGeneratedCount = () => makeAdminApiRequest('get', '/analytics/pptx-generated-count');

export const getDocxGeneratedCount = () => makeAdminApiRequest('get', '/analytics/docx-generated-count');

export const getActiveUsersToday = () => makeAdminApiRequest('get', '/analytics/active-users-today');

export const getTotalQueries = () => makeAdminApiRequest('get', '/analytics/total-queries');

export const getTotalSources = () => makeAdminApiRequest('get', '/analytics/total-sources');

export const getNegativeFeedback = () => makeAdminApiRequest('get', '/negative-feedback');


export const startFineTuningJob = (payload) => {
    // This function is now using the robust makeAdminApiRequest helper.
    // The endpoint is relative to /api/admin, so we just need /finetuning/start
    return makeAdminApiRequest('post', '/finetuning/start', payload);
};
    