// client/src/App.js
import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { CircularProgress } from '@mui/material';
import { ThemeProvider } from './context/ThemeContext';
import { useTheme } from './context/ThemeContext';

// Lazy load top-level components/layouts
const AuthPage = React.lazy(() => import('./components/AuthPage'));
const MainLayout = React.lazy(() => import('./components/MainLayout'));
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const SettingsPage = React.lazy(() => import('./components/SettingsPage'));

// Helper component to display a loading spinner during lazy loading
const LoadingFallback = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
    </div>
);

// Helper component for routes that require authentication
const ProtectedRoute = ({ children }) => {
    const isAuthenticated = !!localStorage.getItem('userId');
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Helper component for routes that require admin privileges
const AdminRoute = ({ children }) => {
    const isAuthenticated = !!localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    return userRole === 'admin' ? children : <Navigate to="/" replace />;
};

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('userId'));

    const performLogout = () => {
        localStorage.clear();
        setIsAuthenticated(false);
    };

    useEffect(() => {
        const handleStorageChange = (event) => {
            if (event.key === 'userId') {
                const authStatus = !!event.newValue;
                if (authStatus !== isAuthenticated) {
                    setIsAuthenticated(authStatus);
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [isAuthenticated]);

    // This new inner component allows us to access the 'theme' from useTheme
    // because it is inside the <ThemeProvider>.
    const AppRoutes = () => {
        const { theme } = useTheme(); // Get the current theme ('light' or 'dark')

        return (
            // Apply the theme class to the main container div
            <div className={`app-container ${theme}-mode`}>
                <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                        <Route
                            path="/login"
                            element={isAuthenticated ? <Navigate to="/chat" replace /> : <AuthPage setIsAuthenticated={setIsAuthenticated} />}
                        />
                        <Route
                            path="/admin"
                            element={
                                <AdminRoute>
                                    <AdminPanel />
                                </AdminRoute>
                            }
                        />
                        {/* This key route handles all authenticated pages */}
                        <Route
                            path="/*"
                            element={
                                <ProtectedRoute>
                                    <MainLayout performLogout={performLogout} />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </Suspense>
            </div>
        );
    };

    return (
        <ThemeProvider>
            <Router>
                <AppRoutes /> {/* Render the new inner component here */}
            </Router>
        </ThemeProvider>
    );
}

export default App;