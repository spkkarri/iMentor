// frontend/src/services/adminApi.js
import axios from 'axios';

// Get base URL for admin document endpoints
const ADMIN_DOCS_API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api'}/admin/documents`;

// Get fixed admin credentials from .env (prefixed with VITE_ for frontend access)
const ADMIN_USERNAME_FRONTEND = import.meta.env.VITE_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_FRONTEND = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

const adminApiClient = axios.create({
    baseURL: ADMIN_DOCS_API_BASE_URL,
});

export const getFixedAdminAuthHeaders = () => {
    if (!ADMIN_USERNAME_FRONTEND || !ADMIN_PASSWORD_FRONTEND) {
        console.error("Admin credentials not found in VITE_ADMIN_USERNAME or VITE_ADMIN_PASSWORD .env variables for frontend.");
        return {};
    }
    const basicAuthToken = btoa(`${ADMIN_USERNAME_FRONTEND}:${ADMIN_PASSWORD_FRONTEND}`);
    return { 'Authorization': `Basic ${basicAuthToken}` };
};

const makeAdminApiRequest = async (method, endpoint, data = null, authHeaders = {}) => {
    if (!authHeaders.Authorization) {
        const errorMsg = "Admin authentication headers are missing. Cannot make admin API request.";
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
    try {
        const config = {
            method,
            url: endpoint,
            headers: {
                ...authHeaders,
                'Content-Type': data instanceof FormData ? 'multipart/form-data' : 'application/json',
            },
        };
        if (data) {
            config.data = data;
        }
        const response = await adminApiClient(config);
        return response.data;
    } catch (error) {
        let errorMessage = 'Admin API request failed.';
        if (error.response) {
            errorMessage = error.response.data?.message || error.response.statusText || `Server error: ${error.response.status}`;
            console.error(`Admin API Error (${method.toUpperCase()} ${ADMIN_DOCS_API_BASE_URL}${endpoint}): Status ${error.response.status}`, error.response.data);
        } else if (error.request) {
            errorMessage = 'No response from admin API server. Check network or server status.';
            console.error(`Admin API Network Error (${method.toUpperCase()} ${ADMIN_DOCS_API_BASE_URL}${endpoint}):`, error.request);
        } else {
            errorMessage = error.message || 'Error setting up admin API request.';
            console.error(`Admin API Setup Error (${method.toUpperCase()} ${ADMIN_DOCS_API_BASE_URL}${endpoint}):`, error.message);
        }
        throw new Error(errorMessage);
    }
};

export const uploadAdminDocument = async (formData, adminAuthHeaders) => {
    return makeAdminApiRequest('post', '/upload', formData, adminAuthHeaders);
};

export const getAdminDocuments = async (adminAuthHeaders) => {
    return makeAdminApiRequest('get', '/', null, adminAuthHeaders);
};

export const deleteAdminDocument = async (serverFilename, adminAuthHeaders) => {
    return makeAdminApiRequest('delete', `/${serverFilename}`, null, adminAuthHeaders);
};

export const getAdminDocumentAnalysis = async (serverFilename, adminAuthHeaders) => {
    return makeAdminApiRequest('get', `/${serverFilename}/analysis`, null, adminAuthHeaders);
};

// --- NEW FUNCTION FOR STEP 2 ---
export const getAdminDocumentAnalysisByOriginalName = async (originalName, adminAuthHeaders) => {
    // This function fetches the analysis object for an admin document using its originalName.
    // The backend route will be '/by-original-name/:originalName/analysis' relative to ADMIN_DOCS_API_BASE_URL.
    // It expects a response like:
    // { originalName, serverFilename, analysis: {faq, topics, mindmap}, analysisUpdatedAt }
    return makeAdminApiRequest('get', `/by-original-name/${encodeURIComponent(originalName)}/analysis`, null, adminAuthHeaders);
};