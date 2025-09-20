// client/src/components/UserSettings.js
// User settings component for API key management and configuration

import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Button,
    Switch,
    FormControlLabel,
    Alert,
    Divider,
    Tab,
    Tabs,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Chip,
    InputAdornment,
    IconButton
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    Save,
    PlayArrow,
    Key,
    Security,
    AccountCircle,
    Refresh
} from '@mui/icons-material';
import { 
    getUserApiKeys, 
    updateUserApiKeys, 
    testUserServices, 
    clearUserServiceCache,
    requestAdminAccess,
    getCurrentUser
} from '../services/api';

const UserSettings = () => {
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    
    // API Keys state
    const [apiKeysConfig, setApiKeysConfig] = useState({
        geminiApiKey: '',
        ollamaUrl: '',
        ollamaModel: 'llama2',
        preferredService: 'admin',
        useAdminKeys: true
    });
    
    // User profile state
    const [userProfile, setUserProfile] = useState({
        username: '',
        email: '',
        isAdmin: false
    });
    
    // UI state
    const [showApiKey, setShowApiKey] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [adminAccessReason, setAdminAccessReason] = useState('');
    
    // Status information
    const [serviceStatus, setServiceStatus] = useState({
        geminiKeyValid: false,
        ollamaConnectionValid: false,
        lastValidationAt: null,
        adminAccessStatus: 'pending'
    });

    // Load user data on component mount
    useEffect(() => {
        loadUserSettings();
        loadUserProfile();
    }, []);

    const loadUserSettings = async () => {
        try {
            setLoading(true);
            const response = await getUserApiKeys();
            const data = response.data;
            
            setApiKeysConfig({
                geminiApiKey: '', // Never show actual key for security
                ollamaUrl: data.ollamaUrl || '',
                ollamaModel: data.ollamaModel || 'llama2',
                preferredService: data.preferredService || 'admin',
                useAdminKeys: data.useAdminKeys !== false
            });
            
            setServiceStatus({
                geminiKeyValid: data.geminiKeyValid || false,
                ollamaConnectionValid: data.ollamaConnectionValid || false,
                lastValidationAt: data.lastValidationAt,
                adminAccessStatus: data.adminAccessStatus || 'pending',
                hasGeminiKey: data.hasGeminiKey || false,
                hasOllamaConfig: data.hasOllamaConfig || false
            });
            
        } catch (error) {
            setMessage({ 
                type: 'error', 
                text: 'Failed to load settings: ' + (error.response?.data?.message || error.message)
            });
        } finally {
            setLoading(false);
        }
    };

    const loadUserProfile = async () => {
        try {
            const response = await getCurrentUser();
            const user = response.data.user;
            setUserProfile({
                username: user.username || '',
                email: user.email || '',
                isAdmin: user.isAdmin || false
            });
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    };

    const handleSaveApiKeys = async () => {
        try {
            setLoading(true);
            
            const updateData = {
                ollamaUrl: apiKeysConfig.ollamaUrl,
                ollamaModel: apiKeysConfig.ollamaModel,
                preferredService: apiKeysConfig.preferredService,
                useAdminKeys: apiKeysConfig.useAdminKeys
            };
            
            // Only include Gemini API key if it's been changed
            if (apiKeysConfig.geminiApiKey && apiKeysConfig.geminiApiKey.trim()) {
                updateData.geminiApiKey = apiKeysConfig.geminiApiKey;
            }
            
            await updateUserApiKeys(updateData);
            
            // Clear service cache to use new keys
            await clearUserServiceCache();
            
            setMessage({ type: 'success', text: 'Settings saved successfully!' });
            
            // Reload settings to get updated status
            setTimeout(() => {
                loadUserSettings();
            }, 1000);
            
        } catch (error) {
            setMessage({ 
                type: 'error', 
                text: 'Failed to save settings: ' + (error.response?.data?.message || error.message)
            });
        } finally {
            setLoading(false);
        }
    };

    const handleTestServices = async () => {
        try {
            setTesting(true);
            const response = await testUserServices();
            
            if (response.data.success) {
                setMessage({ type: 'success', text: 'Service test completed successfully!' });
                setServiceStatus(prev => ({
                    ...prev,
                    ...response.data.results
                }));
            } else {
                setMessage({ type: 'warning', text: 'Some services failed tests. Check configuration.' });
            }
            
        } catch (error) {
            setMessage({ 
                type: 'error', 
                text: 'Service test failed: ' + (error.response?.data?.message || error.message)
            });
        } finally {
            setTesting(false);
        }
    };

    const handleRequestAdminAccess = async () => {
        try {
            setLoading(true);
            await requestAdminAccess({ reason: adminAccessReason });
            setMessage({ type: 'success', text: 'Admin access request submitted!' });
            setShowConfirmDialog(false);
            setAdminAccessReason('');
            loadUserSettings(); // Refresh status
        } catch (error) {
            setMessage({ 
                type: 'error', 
                text: 'Failed to request admin access: ' + (error.response?.data?.message || error.message)
            });
        } finally {
            setLoading(false);
        }
    };

    const renderApiKeysTab = () => (
        <Box>
            {/* Service Selection */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        🔧 Service Configuration
                    </Typography>
                    
                    <FormControlLabel
                        control={
                            <Switch
                                checked={apiKeysConfig.useAdminKeys}
                                onChange={(e) => setApiKeysConfig(prev => ({
                                    ...prev,
                                    useAdminKeys: e.target.checked
                                }))}
                            />
                        }
                        label="Use shared admin API keys"
                    />
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {apiKeysConfig.useAdminKeys 
                            ? "Using shared admin keys (requires approval)" 
                            : "Using your own API keys"
                        }
                    </Typography>
                    
                    {apiKeysConfig.useAdminKeys && serviceStatus.adminAccessStatus === 'pending' && (
                        <Box sx={{ mt: 2 }}>
                            <Alert severity="warning">
                                Admin access is pending approval. 
                                <Button 
                                    size="small" 
                                    onClick={() => setShowConfirmDialog(true)}
                                    sx={{ ml: 1 }}
                                >
                                    Request Again
                                </Button>
                            </Alert>
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Gemini API Configuration */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        🧠 Gemini AI Configuration
                    </Typography>
                    
                    <TextField
                        fullWidth
                        label="Gemini API Key"
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKeysConfig.geminiApiKey}
                        onChange={(e) => setApiKeysConfig(prev => ({
                            ...prev,
                            geminiApiKey: e.target.value
                        }))}
                        placeholder={serviceStatus.hasGeminiKey ? "••••••••••••••••" : "Enter your Gemini API key"}
                        disabled={apiKeysConfig.useAdminKeys}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        edge="end"
                                    >
                                        {showApiKey ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            )
                        }}
                        sx={{ mb: 2 }}
                    />
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                            label={serviceStatus.hasGeminiKey ? "Key Configured" : "No Key"} 
                            color={serviceStatus.hasGeminiKey ? "success" : "default"}
                            size="small"
                        />
                        <Chip 
                            label={serviceStatus.geminiKeyValid ? "Valid" : "Not Tested"} 
                            color={serviceStatus.geminiKeyValid ? "success" : "warning"}
                            size="small"
                        />
                    </Box>
                </CardContent>
            </Card>

            {/* Ollama Configuration */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        🦙 Ollama Configuration
                    </Typography>
                    
                    <TextField
                        fullWidth
                        label="Ollama URL"
                        value={apiKeysConfig.ollamaUrl}
                        onChange={(e) => setApiKeysConfig(prev => ({
                            ...prev,
                            ollamaUrl: e.target.value
                        }))}
                        placeholder="http://localhost:11434"
                        disabled={apiKeysConfig.useAdminKeys}
                        sx={{ mb: 2 }}
                    />
                    
                    <TextField
                        fullWidth
                        label="Ollama Model"
                        value={apiKeysConfig.ollamaModel}
                        onChange={(e) => setApiKeysConfig(prev => ({
                            ...prev,
                            ollamaModel: e.target.value
                        }))}
                        placeholder="llama2"
                        disabled={apiKeysConfig.useAdminKeys}
                        sx={{ mb: 2 }}
                    />
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                            label={serviceStatus.hasOllamaConfig ? "Configured" : "Not Configured"} 
                            color={serviceStatus.hasOllamaConfig ? "success" : "default"}
                            size="small"
                        />
                        <Chip 
                            label={serviceStatus.ollamaConnectionValid ? "Connected" : "Not Tested"} 
                            color={serviceStatus.ollamaConnectionValid ? "success" : "warning"}
                            size="small"
                        />
                    </Box>
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSaveApiKeys}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={20} /> : 'Save Settings'}
                </Button>
                
                <Button
                    variant="outlined"
                    startIcon={<PlayArrow />}
                    onClick={handleTestServices}
                    disabled={testing}
                >
                    {testing ? <CircularProgress size={20} /> : 'Test Services'}
                </Button>
                
                <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={loadUserSettings}
                >
                    Refresh
                </Button>
            </Box>
        </Box>
    );

    const renderProfileTab = () => (
        <Box>
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        👤 User Profile
                    </Typography>
                    
                    <TextField
                        fullWidth
                        label="Username"
                        value={userProfile.username}
                        disabled
                        sx={{ mb: 2 }}
                    />
                    
                    <TextField
                        fullWidth
                        label="Email"
                        value={userProfile.email}
                        disabled
                        sx={{ mb: 2 }}
                    />
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                            label={userProfile.isAdmin ? "Admin User" : "Regular User"} 
                            color={userProfile.isAdmin ? "primary" : "default"}
                        />
                        <Chip 
                            label={`Access: ${serviceStatus.adminAccessStatus}`} 
                            color={serviceStatus.adminAccessStatus === 'approved' ? "success" : "warning"}
                        />
                    </Box>
                    
                    {serviceStatus.lastValidationAt && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            Last validated: {new Date(serviceStatus.lastValidationAt).toLocaleString()}
                        </Typography>
                    )}
                </CardContent>
            </Card>
        </Box>
    );

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
            <Typography variant="h4" gutterBottom>
                ⚙️ User Settings
            </Typography>
            
            {message.text && (
                <Alert 
                    severity={message.type} 
                    onClose={() => setMessage({ type: '', text: '' })}
                    sx={{ mb: 3 }}
                >
                    {message.text}
                </Alert>
            )}
            
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                    <Tab icon={<Key />} label="API Keys" />
                    <Tab icon={<AccountCircle />} label="Profile" />
                    <Tab icon={<Security />} label="Security" />
                </Tabs>
            </Box>
            
            {activeTab === 0 && renderApiKeysTab()}
            {activeTab === 1 && renderProfileTab()}
            {activeTab === 2 && (
                <Alert severity="info">
                    Security settings coming soon...
                </Alert>
            )}

            {/* Admin Access Request Dialog */}
            <Dialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)}>
                <DialogTitle>Request Admin Access</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        label="Reason for admin access"
                        value={adminAccessReason}
                        onChange={(e) => setAdminAccessReason(e.target.value)}
                        placeholder="Please explain why you need admin access..."
                        sx={{ mt: 2 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
                    <Button 
                        onClick={handleRequestAdminAccess}
                        variant="contained"
                        disabled={!adminAccessReason.trim() || loading}
                    >
                        Submit Request
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default UserSettings;
