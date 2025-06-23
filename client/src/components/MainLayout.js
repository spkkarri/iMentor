// client/src/components/MainLayout.js

import React, { useState, Suspense, useCallback } from 'react';
import Sidebar from './Sidebar';
import AnalysisResultModal from './AnalysisResultModal';

// Lazy load the different "views" for better performance
const ChatPage = React.lazy(() => import('./ChatPage'));
const FilesView = React.lazy(() => import('./FilesView'));
const AnalysisView = React.lazy(() => import('./AnalysisView'));

const LoadingFallback = () => <div style={{padding: '20px', textAlign: 'center'}}>Loading View...</div>;

const MainLayout = ({ performLogout }) => {
    // This state controls which view is visible in the main content area
    const [currentView, setCurrentView] = useState('chat');
    
    // State to manage analysis data for the dedicated AnalysisView
    const [analysisViewData, setAnalysisViewData] = useState(null);
    const [analysisDocumentName, setAnalysisDocumentName] = useState('');

    // State to handle the pop-up modal for manual analysis
    const [isManualAnalysisModalOpen, setIsManualAnalysisModalOpen] = useState(false);
    const [manualAnalysisModalData, setManualAnalysisModalData] = useState(null);

    const username = localStorage.getItem('username') || 'User';

    // This is called when a manual analysis is requested from FileManagerWidget
    const handleManualAnalysisRequest = useCallback((data) => {
        setManualAnalysisModalData(data);
        setIsManualAnalysisModalOpen(true);
    }, []);

    const closeManualAnalysisModal = useCallback(() => {
        setIsManualAnalysisModalOpen(false);
        setManualAnalysisModalData(null);
    }, []);

    // This is called when the auto-analysis results are ready
    const handleAutoAnalysisReady = useCallback((data, docName) => {
        setAnalysisViewData(data);
        setAnalysisDocumentName(docName);
        setCurrentView('analysis'); // Automatically switch to the analysis view
    }, []);

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
            <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
            
            <div className="main-content-area" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <header style={{ 
                    padding: '10px 20px', 
                    backgroundColor: '#1e1e1e', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    flexShrink: 0,
                    borderBottom: '1px solid #333'
                }}>
                    <h2>FusedChat: {currentView.charAt(0).toUpperCase() + currentView.slice(1)}</h2>
                    <div>
                        <span style={{ marginRight: '20px' }}>Hi, {username}!</span>
                        <button onClick={performLogout}>Logout</button>
                    </div>
                </header>
                
                <main style={{ flex: 1, overflowY: 'auto', backgroundColor: '#1a1a1a' }}>
                    <Suspense fallback={<LoadingFallback />}>
                        {currentView === 'chat' && <ChatPage />}
                        {currentView === 'files' && <FilesView onAnalysisRequest={handleManualAnalysisRequest} onAutoAnalysisReady={handleAutoAnalysisReady} />}
                        {currentView === 'analysis' && <AnalysisView analysisData={analysisViewData} documentName={analysisDocumentName}/>}
                        {/* You can add a History view component here later */}
                    </Suspense>
                </main>
            </div>

            {/* This modal is for manual analysis results */}
            {manualAnalysisModalData && (
                <AnalysisResultModal
                    isOpen={isManualAnalysisModalOpen}
                    onClose={closeManualAnalysisModal}
                    analysisData={manualAnalysisModalData}
                />
            )}
        </div>
    );
};

export default MainLayout;