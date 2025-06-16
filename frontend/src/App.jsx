// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth as useRegularAuth } from './hooks/useAuth.jsx';
import { useAppState } from './contexts/AppStateContext.jsx';
import AuthModal from './components/auth/AuthModal.jsx';
import TopNav from './components/layout/TopNav.jsx';
import LeftPanel from './components/layout/LeftPanel.jsx';
import CenterPanel from './components/layout/CenterPanel.jsx';
import RightPanel from './components/layout/RightPanel.jsx';
import LeftCollapsedNav from './components/layout/LeftCollapsedNav.jsx';
import RightCollapsedNav from './components/layout/RightCollapsedNav.jsx';
import ChatHistoryModal from './components/chat/ChatHistoryModal.jsx';
import AdminDashboardPage from './components/admin/AdminDashboardPage.jsx';
import AdminProtectedRoute from './components/admin/AdminProtectedRoute.jsx';
import api from './services/api.js';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

function MainAppLayout({ orchestratorStatus }) {
    const { user: regularUser, logout: regularUserLogout } = useRegularAuth();
    const {
        currentSessionId,
        isLeftPanelOpen,
        isRightPanelOpen,
        setSessionId: setGlobalSessionId,
    } = useAppState();
    const [appStateMessages, setAppStateMessages] = useState([]);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    const handleRegularUserLogout = () => {
        regularUserLogout();
        setGlobalSessionId(null);
    };

    const handleNewChat = async () => {
        try {
            const data = await api.startNewSession(currentSessionId); 
            if (data && data.newSessionId) {
                setGlobalSessionId(data.newSessionId);
                toast.success("New chat started!");
            } else {
                toast.error("Could not start new chat session.");
            }
        } catch (error) {
            toast.error(`Failed to start new chat: ${error.message}`);
        }
    };

    const handleSelectSessionFromHistory = (sessionId) => {
        if (sessionId && sessionId !== currentSessionId) {
            setGlobalSessionId(sessionId);
            toast.success(`Loading session...`);
        }
        setIsHistoryModalOpen(false);
    };

    const { token: regularUserTokenValue } = useRegularAuth();

    const fetchChatHistory = useCallback(async (sid) => {
        if (!sid || !regularUserTokenValue) {
            setAppStateMessages([]);
            return;
        }
        try {
            const sessionData = await api.getChatHistory(sid);
            
            // --- THIS IS THE CORRECTED LOGIC ---
            // The API now returns messages pre-formatted with `sender`.
            // We no longer need to map or transform the data here.
            setAppStateMessages(Array.isArray(sessionData.messages) ? sessionData.messages : []);
            // --- END OF CORRECTION ---

        } catch (error) {
            toast.error(`History load failed: ${error.message}`);
        }
    }, [regularUserTokenValue]);

    useEffect(() => {
        if (currentSessionId && regularUserTokenValue) {
            fetchChatHistory(currentSessionId);
        } else if (!regularUserTokenValue) {
            setAppStateMessages([]);
        }
    }, [currentSessionId, regularUserTokenValue, fetchChatHistory]);

    return (
        <>
            <TopNav user={regularUser} onLogout={handleRegularUserLogout} onNewChat={handleNewChat} onHistoryClick={() => setIsHistoryModalOpen(true)} orchestratorStatus={orchestratorStatus} />
            <div className="flex flex-1 overflow-hidden pt-16 bg-background-light dark:bg-background-dark">
                <AnimatePresence mode="wait">
                    {isLeftPanelOpen ? (
                        <motion.aside key="left-panel-main" initial={{ x: '-100%' }} animate={{ x: '0%' }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="w-full md:w-72 lg:w-80 xl:w-96 bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark overflow-y-auto p-3 sm:p-4 shadow-lg flex-shrink-0 custom-scrollbar">
                            <LeftPanel />
                        </motion.aside>
                    ) : ( <LeftCollapsedNav /> )}
                </AnimatePresence>
                <main className={`flex-1 flex flex-col overflow-hidden p-1 sm:p-2 md:p-4 transition-all duration-300 ease-in-out ${isLeftPanelOpen ? 'lg:ml-0' : 'lg:ml-16 md:ml-14'} ${isRightPanelOpen ? 'lg:mr-0' : 'lg:mr-16 md:mr-14'}`}>
                    <CenterPanel messages={appStateMessages} setMessages={setAppStateMessages} currentSessionId={currentSessionId} />
                </main>
                <AnimatePresence mode="wait">
                    {isRightPanelOpen ? (
                        <motion.aside key="right-panel-main" initial={{ x: '100%' }} animate={{ x: '0%' }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="hidden md:flex md:flex-col md:w-72 lg:w-80 xl:w-96 bg-surface-light dark:bg-surface-dark border-l border-border-light dark:border-border-dark overflow-y-auto p-3 sm:p-4 shadow-lg flex-shrink-0 custom-scrollbar">
                            <RightPanel />
                        </motion.aside>
                    ) : ( <RightCollapsedNav /> )}
                </AnimatePresence>
            </div>
            <ChatHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} onSelectSession={handleSelectSessionFromHistory} />
        </>
    );
}

function App() {
    const { token: regularUserToken, user: regularUser, loading: regularUserAuthLoading, setUser: setRegularUserInAuthContext } = useRegularAuth();
    const { theme, setSessionId: setGlobalSessionId, currentSessionId, isAdminSessionActive } = useAppState();
    const navigate = useNavigate();
    const location = useLocation();
    const [appInitializing, setAppInitializing] = useState(true);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [orchestratorStatus, setOrchestratorStatus] = useState({ status: "loading", message: "Connecting..." });

    useEffect(() => { document.documentElement.className = theme; }, [theme]);
    useEffect(() => { api.getOrchestratorStatus().then(setOrchestratorStatus); }, []);

    useEffect(() => {
        if (isAdminSessionActive) {
            setAppInitializing(false);
            setShowAuthModal(false);
            if (!location.pathname.startsWith('/admin')) {
                navigate('/admin/dashboard', { replace: true });
            }
            return;
        }
        if (regularUserAuthLoading) {
            setAppInitializing(true);
            return;
        }
        setAppInitializing(false);
        if (regularUserToken && regularUser) {
            setShowAuthModal(false);
            if (location.pathname.startsWith('/admin')) {
                navigate('/', { replace: true });
            } else if (!currentSessionId) {
                api.startNewSession(null).then(data => {
                    if (data && data.newSessionId) {
                        setGlobalSessionId(data.newSessionId);
                    }
                });
            }
        } else if (!location.pathname.startsWith('/admin')) {
            setShowAuthModal(true);
        }
    }, [regularUserAuthLoading, regularUserToken, regularUser, isAdminSessionActive, currentSessionId, navigate, location.pathname, setGlobalSessionId]);

    const handleAuthSuccess = (authData) => {
        setShowAuthModal(false);
        if (authData && !authData.isAdminLogin && authData.token) {
            api.startNewSession(null).then(data => {
                if (data && data.newSessionId) {
                    setGlobalSessionId(data.newSessionId);
                }
            });
            if (authData.email && authData._id) {
                setRegularUserInAuthContext({ id: authData._id, email: authData.email });
            }
        }
    };

    if (appInitializing) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background-light dark:bg-background-dark">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden font-sans">
            <AnimatePresence>
                {showAuthModal && <AuthModal isOpen={showAuthModal} onClose={handleAuthSuccess} />}
            </AnimatePresence>
            <Routes>
                <Route path="/admin/dashboard" element={<AdminProtectedRoute><AdminDashboardPage /></AdminProtectedRoute>} />
                <Route path="/*" element={isAdminSessionActive ? <Navigate to="/admin/dashboard" replace /> : (regularUserToken && regularUser) ? <MainAppLayout orchestratorStatus={orchestratorStatus} /> : null} />
            </Routes>
        </div>
    );
}

function AppWrapper() {
    return (
        <Router>
            <App />
        </Router>
    );
}

export default AppWrapper;