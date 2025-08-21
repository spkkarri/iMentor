// client/src/components/MainLayout.js
import React, { useState, Suspense, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Modal from './Modal';
import QuizModal from './QuizModal';
import CompilerView from './CompilerView';

// Lazy load ALL page-level components that MainLayout can render
const ChatPage = React.lazy(() => import('./ChatPage'));
const PodcastGeneratorPage = React.lazy(() => import('./PodcastGenerator/PodcastGeneratorPage'));
const SettingsPage = React.lazy(() => import('./SettingsPage'));
const QuizView = React.lazy(() => import('./QuizView'));

const LoadingFallback = () => <div style={{width: '100%', padding: '20px', textAlign: 'center', color: 'white'}}>Loading...</div>;

const MainLayout = ({ performLogout }) => {
    // --- ROUTING LOGIC (Unchanged) ---
    const location = useLocation();
    const navigate = useNavigate();

    // New state to manage the visibility of the second sidebar (the panel inside ChatPage).
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

    // This function remains the same.
    const getCurrentView = () => {
        const path = location.pathname;
        if (path.startsWith('/files')) return 'files';
        if (path.startsWith('/podcast')) return 'podcast';
        if (path.startsWith('/settings')) return 'settings';
        if (path.startsWith('/ppt')) return 'ppt';
        return 'chat';
    };
    const currentView = getCurrentView();

    // The navigation handler now also controls the side panel's state.
    const handleNavigation = (view) => {
        navigate(`/${view}`);
        // When user clicks an icon for a view that has a panel, we ensure the panel is set to open.
        if (['chat', 'files', 'ppt'].includes(view)) {
            setIsSidePanelOpen(true);
        }
    };
    
    // New handler to close the side panel. This will be passed to ChatPage.
    const handleCloseSidePanel = useCallback(() => {
        setIsSidePanelOpen(false);
    }, []);

    // Added effect to automatically close the panel if user navigates
    // to a page that doesn't have a panel (e.g., /settings).
    useEffect(() => {
        if (!['chat', 'files', 'ppt'].includes(currentView)) {
            setIsSidePanelOpen(false);
        }
    }, [currentView]);


    // --- MODAL LOGIC (CORRECTED) ---
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [isCompilerModalOpen, setIsCompilerModalOpen] = useState(false);
    const openQuizModal = useCallback(() => setIsQuizModalOpen(true), []);
    const closeQuizModal = useCallback(() => setIsQuizModalOpen(false), []);
    const openCompilerModal = useCallback(() => setIsCompilerModalOpen(true), []);
    // FIX: Added 'const' which was missing. This resolves the error.
    const closeCompilerModal = useCallback(() => setIsCompilerModalOpen(false), []);

    // Pass the new state and handler down to ChatPage.
    const renderCurrentView = () => {
        switch(currentView) {
            case 'chat':
            case 'files':
            case 'ppt':
                // ChatPage will now receive props to control its internal panel.
                return (
                    <ChatPage
                        performLogout={performLogout}
                        initialPanel={currentView}
                        isSidePanelOpen={isSidePanelOpen}
                        onCloseSidePanel={handleCloseSidePanel}
                    />
                );
            case 'podcast':
                return <PodcastGeneratorPage />;
            case 'settings':
                return <SettingsPage />;
            default:
                return (
                    <ChatPage
                        performLogout={performLogout}
                        initialPanel="chat"
                        isSidePanelOpen={isSidePanelOpen}
                        onCloseSidePanel={handleCloseSidePanel}
                    />
                );
        }
    };

    // Determine if the background overlay should be active.
    const showOverlay = isSidePanelOpen && ['chat', 'files', 'ppt'].includes(currentView);

    return (
        <div className="main-layout-container" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
            {/* This is your ActivityBar. It now drives the state of the side panel. */}
            <Sidebar
                currentView={currentView}
                setCurrentView={handleNavigation}
                openCompilerModal={openCompilerModal}
                openQuizModal={openQuizModal}
            />
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                <Suspense fallback={<LoadingFallback />}>
                    {renderCurrentView()}
                </Suspense>
            </main>

            {/* Add the overlay div. It will be styled with CSS. */}
            {/* It's only rendered when needed and will close the panel when clicked. */}
            {showOverlay && <div className="mobile-panel-overlay active" onClick={handleCloseSidePanel}></div>}

            {/* --- MODALS (Unchanged) --- */}
            <QuizModal isOpen={isQuizModalOpen} onClose={closeQuizModal}>
                <Suspense fallback={<LoadingFallback />}><QuizView /></Suspense>
            </QuizModal>
            <Modal isOpen={isCompilerModalOpen} onClose={closeCompilerModal}>
                <CompilerView />
            </Modal>
        </div>
    );
};

export default MainLayout;