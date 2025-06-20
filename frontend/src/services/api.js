// frontend/src/services/api.js
import axios from "axios";
import toast from "react-hot-toast";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api",
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.error("API Interceptor: Received 401 Unauthorized. Token might be invalid or expired.");
    }
    return Promise.reject(error);
  }
);

function parseAnalysisOutput(rawOutput) {
    if (!rawOutput || typeof rawOutput !== 'string') {
        return { content: '', thinking: '' };
    }
    const thinkingMatch = rawOutput.match(/<thinking>([\s\S]*?)<\/thinking>/i);
    let thinkingText = '';
    let mainContent = rawOutput;

    if (thinkingMatch && thinkingMatch[1]) {
        thinkingText = thinkingMatch[1].trim();
        mainContent = rawOutput.replace(/<thinking>[\s\S]*?<\/thinking>\s*/i, '').trim();
    }
    return { content: mainContent, thinking: thinkingText };
}

const api = {
  login: async (credentials) => {
    const response = await apiClient.post("/auth/signin", credentials);
    return response.data;
  },
  signup: async (userData) => {
    const response = await apiClient.post("/auth/signup", userData);
    return response.data;
  },
  getMe: async () => {
    const response = await apiClient.get("/auth/me");
    return response.data;
  },
  sendMessage: async (payload) => {
    const response = await apiClient.post("/chat/message", payload);
    return response.data;
  },
  getChatHistory: async (sessionId) => {
    const response = await apiClient.get(`/chat/session/${sessionId}`);
    return response.data;
  },
  getChatSessions: async () => {
    const response = await apiClient.get("/chat/sessions");
    return response.data;
  },
  startNewSession: async (previousSessionId) => {
    const response = await apiClient.post("/chat/history", { previousSessionId });
    return response.data;
  },
  deleteChatSession: async (sessionId) => {
    const response = await apiClient.delete(`/chat/session/${sessionId}`);
    return response.data;
  },
  uploadFile: async (formData, onUploadProgress) => {
    const response = await apiClient.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress,
    });
    return response.data;
  },
  getFiles: async () => {
    const response = await apiClient.get("/files");
    return response.data;
  },
  deleteFile: async (serverFilename) => {
    const response = await apiClient.delete(`/files/${serverFilename}`);
    return response.data;
  },
  updateUserLLMConfig: async (configData) => {
    console.log("[Frontend API] Sending LLM config update:", configData);
    const response = await apiClient.put("/llm/config", configData);
    return response.data;
  },
  getOrchestratorStatus: async () => {
    try {
      const response = await apiClient.get("/network/ip");
      return { status: "ok", message: `Backend Online at ${response.data.ips[0]}` };
    } catch (e) {
      return { status: "error", message: "Backend Unreachable" };
    }
  },
  getUserProfile: async () => {
    const response = await apiClient.get("/user/profile");
    return response.data;
  },
  updateUserProfile: async (profileData) => {
    const response = await apiClient.put("/user/profile", profileData);
    return response.data;
  },
  getSubjects: async () => {
    const response = await apiClient.get("/subjects");
    return response.data;
  },
  requestAnalysis: async (payload) => {
    const { filename, analysis_type } = payload;
    if (!filename || !analysis_type) {
      throw new Error("Filename and analysis type are required.");
    }
    const toastId = toast.loading(`Generating ${analysis_type} for "${filename}"...`);
    try {
      const response = await apiClient.get(`/analysis/${encodeURIComponent(filename)}`);
      const fullAnalysisObject = response.data;
      const rawOutput = fullAnalysisObject[analysis_type];
      if (!rawOutput || typeof rawOutput !== 'string' || rawOutput.trim() === "") {
         toast.success(`No stored ${analysis_type} found for "${filename}".`, { id: toastId });
         return {
            content: `Notice: Analysis for '${analysis_type}' has not been generated yet or was empty.`,
            thinking: "No analysis data found in the database for this type."
         };
      }
      const { content, thinking } = parseAnalysisOutput(rawOutput);
      toast.success(`Successfully generated ${analysis_type} for "${filename}".`, { id: toastId });
      return { content, thinking };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      toast.error(`Error generating ${analysis_type}: ${errorMessage}`, { id: toastId });
      throw error;
    }
  },
  generateDocument: async ({ markdownContent, docType, sourceDocumentName }) => {
    const response = await apiClient.post('/generate/document', 
      { markdownContent, docType, sourceDocumentName },
      { responseType: 'blob' }
    );
    const contentDisposition = response.headers['content-disposition'];
    let filename = `generated-document.${docType}`;
    if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch && filenameMatch.length > 1) {
            filename = filenameMatch[1];
        }
    }
    return { fileBlob: response.data, filename: filename };
  },
  generatePodcast: async ({ analysisContent, sourceDocumentName, podcastOptions }) => {
    const response = await apiClient.post('/export/podcast', 
      { analysisContent, sourceDocumentName, podcastOptions },
      { responseType: 'blob' }
    );
    return { audioBlob: response.data, sourceDocumentName };
  },
  getKnowledgeGraph: async (documentName) => {
    const response = await apiClient.get(`/kg/visualize/${encodeURIComponent(documentName)}`);
    return response.data;
  },
};

export default api;