// client/src/components/AuthPage.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signinUser, signupUser } from '../services/api';
import { Box, Button, Card, CardContent, TextField, Typography, Tabs, Tab, CircularProgress, Alert } from '@mui/material';

const AuthPage = ({ setIsAuthenticated }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // The user data is now the same for both login and signup
            const userData = { username, password };
            console.log('AuthPage: Attempting auth with data:', userData);
            const apiCall = isLogin ? signinUser : signupUser;
            const response = await apiCall(userData);

            console.log('AuthPage: Auth response:', response.data);
            const userId = response.data.user.id || response.data.user._id;
            console.log('AuthPage: Setting userId:', userId);
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('userId', String(userId));
            localStorage.setItem('username', response.data.user.username);
            setIsAuthenticated(true);

            // Check for admin login
            console.log('AuthPage: User data:', response.data.user);
            console.log('AuthPage: isAdmin flag:', response.data.user.isAdmin);
            console.log('AuthPage: username:', response.data.user.username);
            console.log('AuthPage: email:', response.data.user.email);

            const isAdminUser = response.data.user.isAdmin ||
                               response.data.user.username === 'admin@gmail.com' ||
                               response.data.user.email === 'admin@gmail.com';

            console.log('AuthPage: Final admin check:', isAdminUser);

            if (isAdminUser) {
                console.log('AuthPage: Admin detected, redirecting to /admin');
                alert('Admin login successful! Redirecting to admin dashboard...');
                navigate('/admin');
            } else if (!isLogin) {
                // Redirect to API key setup for new signups
                console.log('AuthPage: New signup, redirecting to API key setup');
                alert('Signup successful! Redirecting to API key setup...');
                navigate('/setup-api-keys');
            } else {
                // Regular login goes to chat
                console.log('AuthPage: Regular login, redirecting to chat');
                navigate('/chat');
            }
        } catch (err) {
            console.error('AuthPage: Auth error:', err.response ? err.response.data : err.message);
            const errorMessage = err.response?.data?.message || `Failed to ${isLogin ? 'sign in' : 'sign up'}. Please try again.`;
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', p: 2 }}>
            <Card sx={{ minWidth: 350, maxWidth: 450, width: '100%', boxShadow: 5, borderRadius: 2 }}>
                <CardContent sx={{ p: 4 }}>
                    <Typography variant="h4" component="h1" gutterBottom align="center" fontWeight="bold">
                        {isLogin ? 'Welcome Back' : 'Create Account'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center" mb={3}>
                        {isLogin ? 'Sign in to access your tutor' : 'Get started with your AI engineering tutor'}
                    </Typography>

                    <Tabs value={isLogin ? 0 : 1} onChange={() => { setIsLogin(!isLogin); setError(''); }} centered sx={{ mb: 3 }}>
                        <Tab label="Sign In" />
                        <Tab label="Sign Up" />
                    </Tabs>

                    <Box component="form" onSubmit={handleAuth} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Username field is now always visible */}
                        <TextField label="Username" variant="outlined" value={username} onChange={(e) => setUsername(e.target.value)} required />
                        
                        {/* Password field is now always visible */}
                        <TextField 
                            label="Password" 
                            type="password" 
                            variant="outlined" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                            helperText={!isLogin ? "Password must be at least 8 characters." : ""}
                        />
                        
                        {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}

                        <Button type="submit" variant="contained" size="large" sx={{ mt: 2, py: 1.5 }} disabled={isLoading}>
                            {isLoading ? <CircularProgress size={24} color="inherit" /> : (isLogin ? 'Sign In' : 'Sign Up')}
                        </Button>

                        {/* Temporary test links */}
                        <Box sx={{ mt: 2, textAlign: 'center' }}>
                            <Button
                                variant="text"
                                size="small"
                                onClick={() => navigate('/admin')}
                                sx={{ mr: 1 }}
                            >
                                Test Admin Page
                            </Button>
                            <Button
                                variant="text"
                                size="small"
                                onClick={() => navigate('/setup-api-keys')}
                            >
                                Test API Setup
                            </Button>
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};

export default AuthPage;