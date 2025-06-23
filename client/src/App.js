// client/src/App.js
import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';

import { ThemeProvider } from './context/ThemeContext';

// Lazy load components
const AuthPage = React.lazy(() => import('./components/AuthPage'));
const ChatPage = React.lazy(() => import('./components/ChatPage'));
const SettingsPage = React.lazy(() => import('./components/SettingsPage'));

// ==================================================================
//  START OF NEW FEATURE MODIFICATION
// ==================================================================
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));

// Helper component for protected routes
const ProtectedRoute = ({ children }) => {
    const isAuthenticated = !!localStorage.getItem('userId');
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Helper component for admin-only routes
const AdminRoute = ({ children }) => {
    const isAuthenticated = !!localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole'); // We will save this upon login
    
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    return userRole === 'admin' ? children : <Navigate to="/chat" replace />; // Redirect non-admins to chat
};
// ==================================================================
//  END OF NEW FEATURE MODIFICATION
// ==================================================================


const LoadingFallback = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
    </div>
);

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('userId'));

    useEffect(() => {
        const handleStorageChange = (event) => {
            if (event.key === 'userId') {
                setIsAuthenticated(!!event.newValue);
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    return (
        <ThemeProvider>
            <Router>
                <div className="app-container">
                    <Suspense fallback={<LoadingFallback />}>
                        <Routes>
                            <Route
                                path="/login"
                                element={
                                    !isAuthenticated ? (
                                        <AuthPage setIsAuthenticated={setIsAuthenticated} />
                                    ) : (
                                        <Navigate to="/chat" replace />
                                    )
                                }
                            />
                            <Route
                                path="/chat"
                                element={
                                    <ProtectedRoute>
                                        <ChatPage setIsAuthenticated={setIsAuthenticated} />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/settings"
                                element={
                                    <ProtectedRoute>
                                        <SettingsPage />
                                    </ProtectedRoute>
                                }
                            />
                            
                            {/* ================================================================== */}
                            {/* START OF NEW FEATURE MODIFICATION: Add the admin route */}
                            {/* ================================================================== */}
                            <Route
                                path="/admin"
                                element={
                                    <AdminRoute>
                                        <AdminPanel />
                                    </AdminRoute>
                                }
                            />
                            {/* ================================================================== */}
                            {/* END OF NEW FEATURE MODIFICATION */}
                            {/* ================================================================== */}

                            <Route
                                path="/"
                                element={<Navigate to={isAuthenticated ? "/chat" : "/login"} replace />}
                            />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Suspense>
                </div>
            </Router>
        </ThemeProvider>
    );
}

export default App;