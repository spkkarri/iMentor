// client/src/App.js
import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CircularProgress } from '@mui/material';
import { getCurrentUser } from './services/api';

// Lazy load components to reduce initial bundle size
const AuthPage = React.lazy(() => import('./components/AuthPage'));
const ChatPage = React.lazy(() => import('./components/ChatPage'));
const LandingPage = React.lazy(() => import('./components/LandingPage')); // Ensure LandingPage is lazy loaded too

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#1a1a1a',
      paper: '#2d2d2d',
    },
    primary: {
      main: '#90caf9',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b3b3b3',
    }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#2d2d2d',
          color: '#ffffff',
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#2d2d2d',
          color: '#ffffff',
        }
      }
    }
  }
});

const LoadingFallback = () => (
    <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#121212'
    }}>
        <CircularProgress />
    </div>
);

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Keep isAuthenticated in sync with localStorage userId (for multi-tab logout)
    useEffect(() => {
        const handleStorage = (event) => {
            if (event.key === 'userId' && !event.newValue) {
                setIsAuthenticated(false);
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    // On mount, set isAuthenticated based on userId and username
    useEffect(() => {
        const storedUserId = localStorage.getItem('userId');
        const storedUsername = localStorage.getItem('username');
        if (!storedUserId || !storedUsername) {
            setIsAuthenticated(false);
        } else {
            setIsAuthenticated(true);
        }
    }, []);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                console.log('[Auth Debug] No token in localStorage');
                setIsAuthenticated(false);
                return;
            }
            try {
                const response = await getCurrentUser();
                console.log('[Auth Debug] /api/auth/me success:', response.data);
                const userId = response.data.user.id || response.data.user._id;
                console.log('Setting userId:', userId);
                localStorage.setItem('userId', String(userId));
                localStorage.setItem('username', response.data.user.username);
                setIsAuthenticated(true);
            } catch (err) {
                if (err.response) {
                    // Server responded with a status code outside 2xx
                    console.error('[Auth Debug] /api/auth/me error:', err.response.status, err.response.data);
                } else if (err.request) {
                    // No response received
                    console.error('[Auth Debug] /api/auth/me no response:', err.request);
                } else {
                    // Something else happened
                    console.error('[Auth Debug] /api/auth/me error:', err.message);
                }
                localStorage.clear();
                setIsAuthenticated(false);
            }
        };
        checkAuth();
    }, []);

    return (
        <ThemeProvider theme={darkTheme}>
            <Router>
                <div style={{
                    minHeight: '100vh',
                    backgroundColor: '#1a1a1a',
                    color: '#ffffff',
                    padding: '20px'
                }}>
                    <Suspense fallback={<LoadingFallback />}>
                        <Routes>
                            {/* Landing Page is now the default root */}
                            <Route path="/" element={<LandingPage />} />

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
                                    isAuthenticated ? (
                                        <ChatPage setIsAuthenticated={setIsAuthenticated} />
                                    ) : (
                                        <Navigate to="/login" replace />
                                    )
                                }
                            />

                            {/* Fallback for any unmatched routes */}
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </Suspense>
                </div>
            </Router>
        </ThemeProvider>
    );
}

export default App;