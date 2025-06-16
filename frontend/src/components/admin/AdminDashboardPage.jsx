// frontend/src/pages/AdminDashboardPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import * as adminApi from '../../services/adminApi.js';
import Button from '../core/Button.jsx';
import IconButton from '../core/IconButton.jsx';
import Modal from '../core/Modal.jsx';
import { UploadCloud, FileText, Trash2, Eye, LogOut, Loader2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns'; // For formatting dates

// --- AdminDocumentUpload Component (child of AdminDashboardPage) ---
function AdminDocumentUpload({ onUploadSuccess }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        if (isUploading) return;
        const file = e.target.files && e.target.files[0];
        if (file) setSelectedFile(file);
        else setSelectedFile(null);
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error("Please select a file to upload.");
            return;
        }
        setIsUploading(true);
        const toastId = toast.loading(`Uploading "${selectedFile.name}"...`);
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const authHeaders = adminApi.getFixedAdminAuthHeaders(); // Get Basic Auth headers
            const response = await adminApi.uploadAdminDocument(formData, authHeaders);
            toast.success(response.message || `Admin document "${selectedFile.name}" uploaded. Analysis initiated.`, { id: toastId });
            onUploadSuccess(); // Callback to refresh document list in parent
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = null;
        } catch (error) {
            // error.message now comes from makeAdminApiRequest's error handling
            toast.error(error.message || `Failed to upload admin document "${selectedFile.name}".`, { id: toastId });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="card-base p-4 mb-6">
            <h2 className="text-lg font-semibold mb-3 text-text-light dark:text-text-dark">Upload New Admin Document</h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="input-field flex-grow text-sm p-2.5 min-h-[44px]"
                    accept=".pdf,.docx,.txt,.md" // Should match allowedAdminExtensions in backend multer
                    disabled={isUploading}
                />
                <Button
                    onClick={handleUpload}
                    isLoading={isUploading}
                    disabled={!selectedFile || isUploading}
                    leftIcon={<UploadCloud size={16} />}
                    size="md" // Consistent with other buttons
                    className="w-full sm:w-auto !py-2.5" // Tailwind class for padding
                >
                    Upload
                </Button>
            </div>
            {selectedFile && !isUploading && (
                <p className="text-xs mt-2 text-text-muted-light dark:text-text-muted-dark">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </p>
            )}
        </div>
    );
}

// --- Main AdminDashboardPage Component ---
function AdminDashboardPage() {
    const { setIsAdminSessionActive } = useAppState(); // For admin logout
    const navigate = useNavigate();

    const [documents, setDocuments] = useState([]); // List of admin documents
    const [isLoading, setIsLoading] = useState(true); // Loading state for document list
    const [error, setError] = useState(''); // Error message for document list fetching

    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [currentDocForModal, setCurrentDocForModal] = useState(null); // Doc whose analysis is being viewed
    const [analysisContent, setAnalysisContent] = useState(null); // {faq, topics, mindmap}
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false); // Loading state for fetching analysis

    const adminLogoutHandler = () => {
        setIsAdminSessionActive(false); // Clear the admin session flag in AppState
        toast.success("Admin logged out.");
        navigate('/'); // Navigate to the main page (AuthModal will show if no regular user)
    };

    const fetchAdminDocs = useCallback(async (showLoadingToast = false) => {
        let toastId;
        if (showLoadingToast) {
            toastId = toast.loading("Refreshing document list...");
        } else {
            setIsLoading(true); // For initial load or non-toast refresh
        }
        setError('');
        try {
            const authHeaders = adminApi.getFixedAdminAuthHeaders();
            const response = await adminApi.getAdminDocuments(authHeaders);
            setDocuments(Array.isArray(response.documents) ? response.documents : []);
            if (showLoadingToast) toast.success("Document list refreshed.", { id: toastId });
        } catch (err) {
            const errorMessage = err.message || "Failed to fetch admin documents.";
            setError(errorMessage);
            if (showLoadingToast) toast.error(errorMessage, { id: toastId });
            else toast.error(errorMessage); // Show toast on initial load failure too
        } finally {
            if (!showLoadingToast) setIsLoading(false);
        }
    }, []); // No dependencies that change frequently, getFixedAdminAuthHeaders is stable

    useEffect(() => {
        fetchAdminDocs(); // Fetch documents when component mounts
    }, [fetchAdminDocs]);

    const handleDeleteDocument = async (serverFilename, originalName) => {
        if (!window.confirm(`Are you sure you want to delete admin document "${originalName}"? This action will remove its record and any associated analysis.`)) return;
        
        const toastId = toast.loading(`Deleting "${originalName}"...`);
        try {
            const authHeaders = adminApi.getFixedAdminAuthHeaders();
            await adminApi.deleteAdminDocument(serverFilename, authHeaders);
            toast.success(`Admin document "${originalName}" deleted.`, { id: toastId });
            fetchAdminDocs(); // Refresh the list
            if (isAnalysisModalOpen && currentDocForModal?.serverFilename === serverFilename) {
                setIsAnalysisModalOpen(false); // Close modal if the deleted doc was being viewed
            }
        } catch (err) {
            toast.error(err.message || `Failed to delete "${originalName}".`, { id: toastId });
        }
    };

    const handleViewAnalysis = async (doc) => {
        setCurrentDocForModal(doc);
        setAnalysisContent(null);      // Clear previous analysis
        setIsAnalysisModalOpen(true); // Open modal
        setIsLoadingAnalysis(true);   // Set loading state for analysis
        try {
            const authHeaders = adminApi.getFixedAdminAuthHeaders();
            const response = await adminApi.getAdminDocumentAnalysis(doc.serverFilename, authHeaders);
            setAnalysisContent(response.analysis); // response.analysis = {faq, topics, mindmap}
            // toast.success(`Analysis loaded for ${doc.originalName}`); // Optional success toast
        } catch (err) {
            toast.error(`Failed to load analysis for ${doc.originalName}: ${err.message}`);
            setAnalysisContent({ error: `Failed to load analysis: ${err.message}` }); // Show error in modal
        } finally {
            setIsLoadingAnalysis(false);
        }
    };

    const renderAnalysisModalContent = () => {
        if (!currentDocForModal) return null; // Should not happen if modal is open

        if (isLoadingAnalysis) {
            return <div className="p-6 text-center"><Loader2 className="animate-spin text-primary inline-block mr-2"/>Loading analysis content...</div>;
        }
        if (!analysisContent) {
            return <div className="p-4 text-text-muted-light dark:text-text-muted-dark">No analysis data currently available for this document. It might still be processing or was skipped.</div>;
        }
        if (analysisContent.error) {
            return <div className="p-4 text-red-500 dark:text-red-400 text-sm">Error: {analysisContent.error}</div>;
        }

        // Check if all analysis fields are effectively empty or placeholder messages
        const isEmpty = (str) => !str || str.trim() === "" || str.toLowerCase().startsWith("skipped:") || str.toLowerCase().startsWith("notice:");
        const allAnalysesEmpty = isEmpty(analysisContent.faq) && isEmpty(analysisContent.topics) && isEmpty(analysisContent.mindmap);

        if (allAnalysesEmpty) {
            return <div className="p-4 text-text-muted-light dark:text-text-muted-dark">Analysis processing may have been skipped or resulted in no content for all types.</div>;
        }

        return (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto custom-scrollbar p-1 pr-2">
                {Object.entries(analysisContent).map(([key, value]) => {
                    const displayValue = (typeof value === 'string' && value.trim()) ? value : `No content generated for ${key}.`;
                    return (
                        <details key={key} className="text-xs rounded-md border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark" open>
                            <summary className="font-medium cursor-pointer capitalize p-2 bg-gray-50 dark:bg-gray-700/60 hover:bg-gray-100 dark:hover:bg-gray-600/60 rounded-t-md transition-colors">
                                {key.replace(/([A-Z])/g, ' $1').trim()} {/* e.g., mindmap -> Mind Map */}
                            </summary>
                            <pre className="p-2.5 bg-white dark:bg-gray-800 text-text-light dark:text-text-dark text-[0.7rem] max-h-60 overflow-y-auto custom-scrollbar whitespace-pre-wrap break-words rounded-b-md">
                                <code>{displayValue}</code>
                            </pre>
                        </details>
                    );
                })}
            </div>
        );
    };
    
    // --- Main JSX for AdminDashboardPage ---
    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark p-4 sm:p-6">
            <header className="flex items-center justify-between mb-6 pb-3 border-b border-border-light dark:border-border-dark">
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <div className="flex items-center gap-2">
                    <IconButton
                        icon={RefreshCw}
                        onClick={() => fetchAdminDocs(true)} // Pass true to show loading toast
                        title="Refresh Document List"
                        variant="ghost"
                        size="md"
                        className="text-text-muted-light dark:text-text-muted-dark hover:text-primary"
                    />
                    <Button onClick={adminLogoutHandler} variant="danger" size="sm" leftIcon={<LogOut size={16}/>}>
                        Logout Admin
                    </Button>
                </div>
            </header>

            <AdminDocumentUpload onUploadSuccess={() => fetchAdminDocs(false)} /> {/* Don't show toast for auto-refresh */}

            <div className="card-base p-0 sm:p-4">
                <h2 className="text-lg font-semibold mb-3 text-text-light dark:text-text-dark px-4 sm:px-0 pt-4 sm:pt-0">
                    Uploaded Admin Documents
                </h2>
                {isLoading && (
                    <div className="flex items-center justify-center p-6">
                        <Loader2 size={24} className="animate-spin text-primary mr-2" /> Loading documents...
                    </div>
                )}
                {error && (
                    <div className="p-3 my-3 mx-4 sm:mx-0 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 rounded-md text-sm flex items-center gap-2">
                        <AlertTriangle size={18} /> {error}
                        <button onClick={() => fetchAdminDocs(true)} className="ml-auto text-xs underline hover:text-red-400">Retry</button>
                    </div>
                )}
                {!isLoading && !error && documents.length === 0 && (
                    <p className="text-center text-sm text-text-muted-light dark:text-text-muted-dark py-6 px-4 sm:px-0">
                        No admin documents uploaded yet.
                    </p>
                )}
                {!isLoading && !error && documents.length > 0 && (
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
                                        <td className="px-3 sm:px-4 py-2 whitespace-nowrap hidden md:table-cell">
                                            {doc.uploadedAt ? format(new Date(doc.uploadedAt), 'MMM d, yyyy HH:mm') : 'N/A'}
                                        </td>
                                        <td className="px-3 sm:px-4 py-2">
                                            {(doc.hasFaq || doc.hasTopics || doc.hasMindmap) ? (
                                                <span className="flex items-center text-green-600 dark:text-green-400 text-xs">
                                                    <CheckCircle size={14} className="mr-1"/> Generated
                                                </span>
                                            ) : (
                                                doc.analysisUpdatedAt ? // If updated but still no content, means it was empty
                                                <span className="text-gray-500 dark:text-gray-400 text-xs">Empty/Skipped</span> :
                                                <span className="text-yellow-500 dark:text-yellow-400 text-xs">Pending</span>
                                            )}
                                        </td>
                                        <td className="px-1 sm:px-4 py-2 text-center whitespace-nowrap">
                                            <IconButton
                                                icon={Eye}
                                                title="View Analysis"
                                                size="sm"
                                                variant="ghost"
                                                className="text-primary hover:text-primary-dark dark:text-primary-light dark:hover:text-primary-darker mr-0.5 sm:mr-1"
                                                onClick={() => handleViewAnalysis(doc)}
                                                disabled={isLoadingAnalysis && currentDocForModal?.serverFilename === doc.serverFilename}
                                            />
                                            <IconButton
                                                icon={Trash2}
                                                title="Delete Document"
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                                onClick={() => handleDeleteDocument(doc.serverFilename, doc.originalName)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isAnalysisModalOpen}
                onClose={() => setIsAnalysisModalOpen(false)}
                title={`Analysis Results: ${currentDocForModal?.originalName || 'Document'}`}
                size="2xl"
            >
                {renderAnalysisModalContent()}
            </Modal>
        </div>
    );
}

export default AdminDashboardPage;