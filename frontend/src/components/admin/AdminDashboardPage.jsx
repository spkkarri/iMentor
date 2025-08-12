// frontend/src/components/admin/AdminDashboardPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import * as adminApi from '../../services/adminApi.js';
import Button from '../core/Button.jsx';
import IconButton from '../core/IconButton.jsx';
import Modal from '../core/Modal.jsx';
import ApiKeyRequestManager from './ApiKeyRequestManager.jsx';
import UserChatManager from './UserChatManager.jsx';
import AdminInsights from './AdminInsights.jsx';
import LLMConfigManager from './LLMConfigManager.jsx';
import ModelFeedbackStats from './ModelFeedbackStats.jsx'; 
import DatasetManager from './DatasetManager.jsx'; // <<< NEW IMPORT

import { UploadCloud, Trash2, Eye, LogOut, Loader2, AlertTriangle, CheckCircle, RefreshCw, Shield, Users, Lightbulb, HelpCircle, Cog, Database, BarChart2  } from 'lucide-react'; // <<< ADDED Database ICON
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Helper functions
const localParseAnalysisOutput = (rawOutput) => { 
    if (!rawOutput || typeof rawOutput !== 'string') return { content: '' };
    const thinkingMatch = rawOutput.match(/<thinking>([\s\S]*?)<\/thinking>/i);
    let mainContent = rawOutput;
    if (thinkingMatch && thinkingMatch[1]) {
        mainContent = rawOutput.replace(/<thinking>[\s\S]*?<\/thinking>\s*/i, '').trim();
    }
    return { content: mainContent };
};
const createMarkup = (markdownText) => { 
    if (!markdownText) return { __html: '' };
    const html = marked.parse(markdownText);
    const cleanHtml = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
    return { __html: cleanHtml };
};

// AdminDocumentUpload Component
function AdminDocumentUpload({ onUploadSuccess }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const handleFileChange = (e) => { if (isUploading) return; const file = e.target.files && e.target.files[0]; if (file) setSelectedFile(file); else setSelectedFile(null); };
    const handleUpload = async () => {
        if (!selectedFile) { toast.error("Please select a file to upload."); return; }
        setIsUploading(true);
        const toastId = toast.loading(`Uploading "${selectedFile.name}"...`);
        const formData = new FormData();
        formData.append('file', selectedFile);
        try {
            const authHeaders = adminApi.getFixedAdminAuthHeaders();
            const response = await adminApi.uploadAdminDocument(formData, authHeaders);
            toast.success(response.message || `Admin document "${selectedFile.name}" uploaded.`, { id: toastId });
            onUploadSuccess();
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = null;
        } catch (error) {
            toast.error(error.message || `Failed to upload "${selectedFile.name}".`, { id: toastId });
        } finally {
            setIsUploading(false);
        }
    };
    return (
        <div className="card-base p-4">
            <h2 className="text-lg font-semibold mb-3 text-text-light dark:text-text-dark">Upload New Subject Document</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="input-field flex-grow text-sm p-2.5 min-h-[44px]" accept=".pdf,.docx,.txt,.md" disabled={isUploading} />
                <Button onClick={handleUpload} isLoading={isUploading} disabled={!selectedFile || isUploading} leftIcon={<UploadCloud size={16} />} size="md" className="w-full sm:w-auto !py-2.5">Upload</Button>
            </div>
            {selectedFile && !isUploading && <p className="text-xs mt-2 text-text-muted-light dark:text-text-muted-dark">Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</p>}
        </div>
    );
}

// Main AdminDashboardPage Component
function AdminDashboardPage() {
    const { setIsAdminSessionActive } = useAppState();
    const navigate = useNavigate();

    const [documents, setDocuments] = useState([]);
    const [keyRequests, setKeyRequests] = useState([]);
    const [usersWithChats, setUsersWithChats] = useState([]);
    const [dashboardStats, setDashboardStats] = useState({});
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [loadingError, setLoadingError] = useState('');
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [currentDocForModal, setCurrentDocForModal] = useState(null);
    const [analysisContent, setAnalysisContent] = useState(null);
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
    const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
    const [isUserChatsModalOpen, setIsUserChatsModalOpen] = useState(false);
    const [isLlmModalOpen, setIsLlmModalOpen] = useState(false);
    const [isDatasetModalOpen, setIsDatasetModalOpen] = useState(false); // <<< NEW STATE for Dataset Modal
    const [showDeleteDocModal, setShowDeleteDocModal] = useState(false);
    const [docToDelete, setDocToDelete] = useState(null); 
    

    const adminLogoutHandler = () => {
        setIsAdminSessionActive(false);
        toast.success("Admin logged out.");
        navigate('/');
    };

    const fetchAdminData = useCallback(async (isRefresh = false) => {
        let toastId;
        if (isRefresh) {
            toastId = toast.loading("Refreshing all admin data...");
        } else {
            setIsInitialLoading(true);
        }
        setLoadingError('');
        
        try {
            const authHeaders = adminApi.getFixedAdminAuthHeaders();
            const [docsResponse, requestsResponse, usersResponse, statsResponse] = await Promise.all([
                adminApi.getAdminDocuments(authHeaders),
                adminApi.getApiKeyRequests(authHeaders),
                adminApi.getUsersAndChats(authHeaders),
                adminApi.getDashboardStats(authHeaders)
            ]);

            setDocuments(Array.isArray(docsResponse.documents) ? docsResponse.documents : []);
            setKeyRequests(Array.isArray(requestsResponse) ? requestsResponse : []);
            setUsersWithChats(Array.isArray(usersResponse) ? usersResponse : []);
            setDashboardStats(statsResponse || {});

            if (isRefresh) toast.success("Admin data refreshed.", { id: toastId });
        } catch (err) {
            const errorMessage = err.message || "Failed to fetch admin data.";
            setLoadingError(errorMessage);
            if (isRefresh) toast.error(errorMessage, { id: toastId });
            else toast.error(errorMessage);
        } finally {
            if (!isRefresh) setIsInitialLoading(false);
        }
    }, []);

    useEffect(() => { fetchAdminData(); }, [fetchAdminData]);

    const handleDeleteDocument = async () => {
        if (!docToDelete) return;

        const toastId = toast.loading(`Deleting "${docToDelete.originalName}"...`);
        try {
            const authHeaders = adminApi.getFixedAdminAuthHeaders();
            await adminApi.deleteAdminDocument(docToDelete.serverFilename, authHeaders);
            toast.success(`Document "${docToDelete.originalName}" deleted.`, { id: toastId });
            fetchAdminData(true);
            if (isAnalysisModalOpen && currentDocForModal?.serverFilename === docToDelete.serverFilename) {
                setIsAnalysisModalOpen(false);
            }
        } catch (err) {
            toast.error(err.message || `Failed to delete "${docToDelete.originalName}".`, { id: toastId });
        } finally {
            setShowDeleteDocModal(false);
            setDocToDelete(null);
        }
    };
    
    const handleViewAnalysis = async (doc) => {
        setCurrentDocForModal(doc);
        setAnalysisContent(null);
        setIsAnalysisModalOpen(true);
        setIsLoadingAnalysis(true);
        try {
            const authHeaders = adminApi.getFixedAdminAuthHeaders();
            const response = await adminApi.getAdminDocumentAnalysis(doc.serverFilename, authHeaders);
            setAnalysisContent(response.analysis);
        } catch (err) {
            toast.error(`Failed to load analysis: ${err.message}`);
            setAnalysisContent({ error: `Failed to load analysis: ${err.message}` });
        } finally {
            setIsLoadingAnalysis(false);
        }
    };
    
    const renderAnalysisModalContent = () => {
        if (isLoadingAnalysis) {
            return (
                <div className="flex justify-center items-center h-48">
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <p className="ml-2 text-text-muted-light dark:text-text-muted-dark">Loading analysis...</p>
                </div>
            );
        }
        if (!analysisContent || analysisContent.error) {
            return <p className="p-4 text-center text-red-500 dark:text-red-400">{analysisContent?.error || "No analysis content available or an error occurred."}</p>;
        }
        const hasContent = analysisContent.faq?.trim() || analysisContent.topics?.trim() || analysisContent.mindmap?.trim();
        if (!hasContent) {
            return <p className="p-4 text-center text-text-muted-light dark:text-text-muted-dark">Analysis has not been generated for this document, or all analysis fields are empty.</p>;
        }
        return (
            <div className="prose prose-sm dark:prose-invert max-w-none text-text-light dark:text-text-dark space-y-6 p-1 custom-scrollbar">
                {analysisContent.faq?.trim() && ( <div><h3 className="text-base font-semibold border-b border-border-light dark:border-border-dark pb-1 mb-2">Frequently Asked Questions</h3><div dangerouslySetInnerHTML={createMarkup(localParseAnalysisOutput(analysisContent.faq).content)} /></div>)}
                {analysisContent.topics?.trim() && ( <div><h3 className="text-base font-semibold border-b border-border-light dark:border-border-dark pb-1 mb-2">Key Topics</h3><div dangerouslySetInnerHTML={createMarkup(localParseAnalysisOutput(analysisContent.topics).content)} /></div>)}
                {analysisContent.mindmap?.trim() && (<div><h3 className="text-base font-semibold border-b border-border-light dark:border-border-dark pb-1 mb-2">Mind Map (Mermaid Code)</h3><pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md text-xs whitespace-pre-wrap overflow-x-auto custom-scrollbar"><code>{localParseAnalysisOutput(analysisContent.mindmap).content}</code></pre></div>)}
            </div>
        );
    };

    return (
        <div className="h-screen flex flex-col bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
            <header className="flex-shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-border-light dark:border-border-dark">
                <h1 className="text-2xl font-bold">Professor's Dashboard</h1>
                <div className="flex items-center gap-2">
                    <IconButton icon={RefreshCw} onClick={() => fetchAdminData(true)} title="Refresh Admin Data" variant="ghost" size="md" className="text-text-muted-light dark:text-text-muted-dark hover:text-primary"/>
                    <IconButton icon={BarChart2} onClick={() => navigate('/admin/analytics')} title="Platform Analytics" variant="ghost" size="md" className="text-text-muted-light dark:text-text-muted-dark hover:text-primary"/>
                    <IconButton icon={Shield} onClick={() => setIsSecurityModalOpen(true)} title="Security Center & API Requests" variant="ghost" size="md" className="text-text-muted-light dark:text-text-muted-dark hover:text-primary"/>
                    <IconButton icon={Users} onClick={() => setIsUserChatsModalOpen(true)} title="User Management & Chats" variant="ghost" size="md" className="text-text-muted-light dark:text-text-muted-dark hover:text-primary"/>
                    <IconButton icon={Database} onClick={() => setIsDatasetModalOpen(true)} title="Dataset Management" variant="ghost" size="md" className="text-text-muted-light dark:text-text-muted-dark hover:text-primary"/>
                    <IconButton icon={Cog} onClick={() => setIsLlmModalOpen(true)} title="LLM Configuration" variant="ghost" size="md" className="text-text-muted-light dark:text-text-muted-dark hover:text-primary"/>
                    <Button onClick={adminLogoutHandler} variant="danger" size="sm" leftIcon={<LogOut size={16}/>}> Logout Admin </Button>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
                <AdminInsights stats={dashboardStats} isLoading={isInitialLoading} error={loadingError} />

                <ModelFeedbackStats />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <AdminDocumentUpload onUploadSuccess={() => fetchAdminData(true)} />

                        <div className="card-base p-0 sm:p-4">
                            <h2 className="text-lg font-semibold mb-3 text-text-light dark:text-text-dark px-4 sm:px-0 pt-4 sm:pt-0">Uploaded Subject Documents</h2>
                            {isInitialLoading && !documents.length && ( <div className="flex items-center justify-center p-6"> <Loader2 size={24} className="animate-spin text-primary mr-2" /> Loading documents... </div> )}
                            {loadingError && !documents.length && ( <div className="p-3 my-3 mx-4 sm:mx-0 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 rounded-md text-sm flex items-center gap-2"> <AlertTriangle size={18} /> {loadingError} <button onClick={() => fetchAdminData(true)} className="ml-auto text-xs underline hover:text-red-400">Retry</button> </div> )}
                            {!isInitialLoading && documents.length === 0 && !loadingError && ( <p className="text-center text-sm text-text-muted-light dark:text-text-muted-dark py-6 px-4 sm:px-0"> No subject documents uploaded yet. </p> )}
                            {documents.length > 0 && (
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 dark:bg-gray-800">
                                            <tr>
                                                <th className="px-3 sm:px-4 py-2.5 font-medium">Original Name</th>
                                                <th className="px-3 sm:px-4 py-2.5 font-medium hidden md:table-cell">Uploaded</th>
                                                <th className="px-3 sm:px-4 py-2.5 font-medium">Analysis Status</th>
                                                <th className="px-3 sm:px-4 py-2.5 font-medium text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {documents.map((doc) => (
                                                <tr key={doc.serverFilename} className="border-b border-border-light dark:border-border-dark hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                                    <td className="px-3 sm:px-4 py-2 truncate max-w-[150px] sm:max-w-xs" title={doc.originalName}>{doc.originalName}</td>
                                                    <td className="px-3 sm:px-4 py-2 whitespace-nowrap hidden md:table-cell"> {doc.uploadedAt ? format(new Date(doc.uploadedAt), 'MMM d, yyyy HH:mm') : 'N/A'} </td>
                                                    <td className="px-3 sm:px-4 py-2"> {(doc.hasFaq || doc.hasTopics || doc.hasMindmap) ? ( <span className="flex items-center text-green-600 dark:text-green-400 text-xs"><CheckCircle size={14} className="mr-1"/> Generated</span> ) : (doc.analysisUpdatedAt ? <span className="text-gray-500 dark:text-gray-400 text-xs">Empty/Skipped</span> : <span className="text-yellow-500 dark:text-yellow-400 text-xs">Pending</span>)} </td>
                                                    <td className="px-1 sm:px-4 py-2 text-center whitespace-nowrap">
                                                        <IconButton icon={Eye} title="View Analysis" size="sm" variant="ghost" className="text-primary hover:text-primary-dark mr-0.5 sm:mr-1" onClick={() => handleViewAnalysis(doc)} disabled={isLoadingAnalysis && currentDocForModal?.serverFilename === doc.serverFilename} />
                                                        <IconButton icon={Trash2} title="Delete Document" size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => { setDocToDelete({ serverFilename: doc.serverFilename, originalName: doc.originalName }); setShowDeleteDocModal(true);  }} />                                                    </td>
                                                </tr>    
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="card-base p-4">
                            <h2 className="text-lg font-semibold mb-3 text-text-light dark:text-text-dark flex items-center gap-2">
                                <HelpCircle size={20} className="text-accent" /> Content Gap Analysis
                            </h2>
                            <div className="text-center py-8 px-4 border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
                                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">This panel will show student questions that the chatbot could not answer from your documents.</p>
                                <p className="text-xs mt-1 text-text-muted-light/70 dark:text-text-muted-dark/70">(Feature Coming Soon)</p>
                            </div>
                        </div>
                        <div className="card-base p-4">
                             <h2 className="text-lg font-semibold mb-3 text-text-light dark:text-text-dark flex items-center gap-2">
                                <Lightbulb size={20} className="text-accent" /> Frequently Asked Topics
                            </h2>
                            <div className="text-center py-8 px-4 border-2 border-dashed border-border-light dark:border-border-dark rounded-lg">
                                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">This panel will show a word cloud or list of the most common topics students ask about.</p>
                                <p className="text-xs mt-1 text-text-muted-light/70 dark:text-text-muted-dark/70">(Feature Coming Soon)</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            <Modal isOpen={isAnalysisModalOpen} onClose={() => setIsAnalysisModalOpen(false)} title={`Analysis Results: ${currentDocForModal?.originalName || 'Document'}`} size="2xl">
                {renderAnalysisModalContent()}
            </Modal>
            <Modal isOpen={isSecurityModalOpen} onClose={() => setIsSecurityModalOpen(false)} title="Security Center" size="3xl">
                {isInitialLoading ? (
                    <div className="flex justify-center items-center p-8"> <Loader2 size={24} className="animate-spin text-primary inline-block mr-2" /> Loading Security Data... </div>
                ) : ( <ApiKeyRequestManager requests={keyRequests} onAction={() => fetchAdminData(true)} /> )}
            </Modal>
            <Modal isOpen={isUserChatsModalOpen} onClose={() => setIsUserChatsModalOpen(false)} title="User Session Summaries" size="4xl">
                {isInitialLoading ? (
                     <div className="flex justify-center items-center p-8"> <Loader2 size={24} className="animate-spin text-primary inline-block mr-2" /> Loading User Chat Data... </div>
                ) : ( <UserChatManager usersWithChats={usersWithChats} /> )}
            </Modal>
            <Modal isOpen={isLlmModalOpen} onClose={() => setIsLlmModalOpen(false)} title="LLM Configuration Management" size="4xl">
                <LLMConfigManager />
            </Modal>
            {/* <<< NEW MODAL FOR DATASETS --- */}
            <Modal isOpen={isDatasetModalOpen} onClose={() => setIsDatasetModalOpen(false)} title="Secure Dataset Management" size="5xl">
                <DatasetManager />
            </Modal>
            <Modal
                isOpen={showDeleteDocModal}
                onClose={() => setShowDeleteDocModal(false)}
                title="Confirm Document Deletion"
                size="md"
                footerContent={
                    <>
                        <Button variant="secondary" onClick={() => setShowDeleteDocModal(false)}>Cancel</Button>
                        <Button variant="danger" onClick={handleDeleteDocument}>Confirm Delete</Button>
                    </>
                }
            >
                <p className="py-4">
                    Are you sure you want to permanently delete the document "<strong>{docToDelete?.originalName}</strong>"? This action will remove its analysis and associated data.
                </p>
            </Modal>
        </div>
    );
}

export default AdminDashboardPage;