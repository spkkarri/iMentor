// API utility functions for React frontend to connect to Flask backend
// Handles: auth, upload, document list, analysis, chat, session management

const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

// --- Auth Token Management ---
export function getAuthToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('aiTutorAuthToken') : null;
}
export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem('aiTutorAuthToken', token);
}
export function clearAuthToken() {
  if (typeof window !== 'undefined') localStorage.removeItem('aiTutorAuthToken');
}

// --- Auth ---
export async function login(identifier: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: identifier, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  setAuthToken(data.token);
  return data;
}

export async function signup(signupData: any) {
  const res = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signupData)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Signup failed');
  return data;
}

export function logout() {
  clearAuthToken();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('aiTutorUsername');
    localStorage.removeItem('aiTutorThreadId');
  }
}

// --- File Upload ---
export async function uploadDocument(file: File) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data;
}

// --- Document List ---
export async function getDocuments() {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_BASE_URL}/documents`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch documents');
  return data.uploaded_files || [];
}

// --- Analysis ---
export async function runAnalysis(filename: string, analysisType: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_BASE_URL}/analyze`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ filename, analysis_type: analysisType })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${analysisType} failed`);
  return data;
}

// --- Chat ---
export async function sendChatMessage(query: string, threadId?: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, thread_id: threadId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Chat failed');
  return data;
}

export async function getChatHistory(threadId: string) {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_BASE_URL}/thread_history?thread_id=${threadId}`,
    { headers: { 'Authorization': `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load chat history');
  return data;
}

// --- Status ---
export async function getBackendStatus() {
  const res = await fetch(`${API_BASE_URL}/status`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Status check failed');
  return data;
}

// --- Chat Threads ---
export async function createNewChatThread() {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_BASE_URL}/chat/thread`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title: 'New Chat' })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create chat thread');
  return data;
}

export async function getChatThreads() {
  const token = getAuthToken();
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${API_BASE_URL}/threads`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch threads');
  return data;
}
