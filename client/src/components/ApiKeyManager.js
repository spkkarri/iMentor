// client/src/components/ApiKeyManager.js
import React, { useState, useEffect } from 'react';
import {
    Box, Typography, TextField, Button, Switch, FormControlLabel,
    Accordion, AccordionSummary, AccordionDetails, Alert, Chip,
    IconButton, InputAdornment, Divider, CircularProgress
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Save as SaveIcon,
    Refresh as RefreshIcon,
    Key as KeyIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Warning as WarningIcon
} from '@mui/icons-material';

const ApiKeyManager = ({ userId, isSidebarOpen = true }) => {
    const [apiKeys, setApiKeys] = useState({
        gemini: '',
        deepseek: '',
        qwen: ''
    });
    const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
    const [useOwnKeys, setUseOwnKeys] = useState(false);
    const [showKeys, setShowKeys] = useState({
        gemini: false,
        deepseek: false,
        qwen: false
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [keyStatus, setKeyStatus] = useState({
        gemini: 'unknown',
        deepseek: 'unknown',
        qwen: 'unknown',
        ollama: 'unknown'
    });

    // Load user's current API keys and settings
    useEffect(() => {
        loadUserSettings();
    }, [userId]);

    const loadUserSettings = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/user/settings', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setApiKeys({
                    gemini: data.apiKeys?.gemini || '',
                    deepseek: data.apiKeys?.deepseek || '',
                    qwen: data.apiKeys?.qwen || ''
                });
                setOllamaUrl(data.ollamaUrl || 'http://localhost:11434');
                setUseOwnKeys(data.useOwnKeys || false);
                
                // Check key status
                await checkKeyStatus();
            }
        } catch (error) {
            console.error('Failed to load user settings:', error);
            setMessage({ text: 'Failed to load settings', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const checkKeyStatus = async () => {
        try {
            const response = await fetch('/api/user/api-keys/status', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setKeyStatus(data.status || {});
            }
        } catch (error) {
            console.error('Failed to check key status:', error);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        setMessage({ text: '', type: '' });

        try {
            const response = await fetch('/api/user/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    apiKeys,
                    ollamaUrl,
                    useOwnKeys
                })
            });

            const result = await response.json();

            if (response.ok) {
                setMessage({ text: '✅ Settings saved successfully!', type: 'success' });
                await checkKeyStatus();
                
                // Clear message after 3 seconds
                setTimeout(() => setMessage({ text: '', type: '' }), 3000);
            } else {
                setMessage({ text: `❌ ${result.message || 'Failed to save settings'}`, type: 'error' });
            }
        } catch (error) {
            setMessage({ text: `❌ Network error: ${error.message}`, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const toggleKeyVisibility = (keyType) => {
        setShowKeys(prev => ({
            ...prev,
            [keyType]: !prev[keyType]
        }));
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'valid':
                return <CheckCircleIcon sx={{ color: '#4CAF50', fontSize: 16 }} />;
            case 'invalid':
                return <ErrorIcon sx={{ color: '#F44336', fontSize: 16 }} />;
            case 'limited':
                return <WarningIcon sx={{ color: '#FF9800', fontSize: 16 }} />;
            default:
                return <WarningIcon sx={{ color: '#757575', fontSize: 16 }} />;
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'valid': return '#4CAF50';
            case 'invalid': return '#F44336';
            case 'limited': return '#FF9800';
            default: return '#757575';
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="caption" sx={{ ml: 1 }}>Loading settings...</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ mb: 2 }}>
            <Accordion defaultExpanded={true}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <KeyIcon sx={{ fontSize: 20 }} />
                        {isSidebarOpen && (
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                API Keys & Settings
                            </Typography>
                        )}
                    </Box>
                </AccordionSummary>
                
                <AccordionDetails>
                    <Box sx={{ width: '100%' }}>
                        {/* Message Display */}
                        {message.text && (
                            <Alert 
                                severity={message.type} 
                                sx={{ mb: 2, fontSize: '0.75rem' }}
                                onClose={() => setMessage({ text: '', type: '' })}
                            >
                                {message.text}
                            </Alert>
                        )}

                        {/* Use Own Keys Toggle */}
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={useOwnKeys}
                                    onChange={(e) => setUseOwnKeys(e.target.checked)}
                                    size="small"
                                />
                            }
                            label={
                                <Typography variant="body2">
                                    Use My Own API Keys
                                </Typography>
                            }
                            sx={{ mb: 2 }}
                        />

                        {useOwnKeys && (
                            <>
                                {/* Gemini API Key */}
                                <Box sx={{ mb: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            🔍 Gemini API Key
                                        </Typography>
                                        {getStatusIcon(keyStatus.gemini)}
                                    </Box>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        type={showKeys.gemini ? 'text' : 'password'}
                                        value={apiKeys.gemini}
                                        onChange={(e) => setApiKeys(prev => ({ ...prev, gemini: e.target.value }))}
                                        placeholder="Enter Gemini API key"
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => toggleKeyVisibility('gemini')}
                                                    >
                                                        {showKeys.gemini ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                            sx: { fontSize: '0.875rem' }
                                        }}
                                    />
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        For research, analysis, and web search
                                    </Typography>
                                </Box>

                                {/* DeepSeek API Key */}
                                <Box sx={{ mb: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            🧠 DeepSeek API Key
                                        </Typography>
                                        {getStatusIcon(keyStatus.deepseek)}
                                    </Box>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        type={showKeys.deepseek ? 'text' : 'password'}
                                        value={apiKeys.deepseek}
                                        onChange={(e) => setApiKeys(prev => ({ ...prev, deepseek: e.target.value }))}
                                        placeholder="Enter DeepSeek API key"
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => toggleKeyVisibility('deepseek')}
                                                    >
                                                        {showKeys.deepseek ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                            sx: { fontSize: '0.875rem' }
                                        }}
                                    />
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        For advanced reasoning and mathematics
                                    </Typography>
                                </Box>

                                {/* Qwen API Key */}
                                <Box sx={{ mb: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            ⚡ Qwen API Key
                                        </Typography>
                                        {getStatusIcon(keyStatus.qwen)}
                                    </Box>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        type={showKeys.qwen ? 'text' : 'password'}
                                        value={apiKeys.qwen}
                                        onChange={(e) => setApiKeys(prev => ({ ...prev, qwen: e.target.value }))}
                                        placeholder="Enter Qwen/DashScope API key"
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => toggleKeyVisibility('qwen')}
                                                    >
                                                        {showKeys.qwen ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                            sx: { fontSize: '0.875rem' }
                                        }}
                                    />
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        For programming and technical discussions
                                    </Typography>
                                </Box>

                                <Divider sx={{ my: 2 }} />
                            </>
                        )}

                        {/* Ollama URL */}
                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    🦙 Ollama Server URL
                                </Typography>
                                {getStatusIcon(keyStatus.ollama)}
                            </Box>
                            <TextField
                                fullWidth
                                size="small"
                                value={ollamaUrl}
                                onChange={(e) => setOllamaUrl(e.target.value)}
                                placeholder="http://localhost:11434"
                                InputProps={{
                                    sx: { fontSize: '0.875rem' }
                                }}
                            />
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Your personal Ollama server for local models
                            </Typography>
                        </Box>

                        {/* Status Summary */}
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                                Configuration Status:
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                <Chip
                                    label={`Admin Keys: ${useOwnKeys ? 'Disabled' : 'Enabled'}`}
                                    size="small"
                                    color={useOwnKeys ? 'default' : 'primary'}
                                    variant="outlined"
                                />
                                {useOwnKeys && (
                                    <>
                                        <Chip
                                            label="Gemini"
                                            size="small"
                                            sx={{ 
                                                borderColor: getStatusColor(keyStatus.gemini),
                                                color: getStatusColor(keyStatus.gemini)
                                            }}
                                            variant="outlined"
                                        />
                                        <Chip
                                            label="DeepSeek"
                                            size="small"
                                            sx={{ 
                                                borderColor: getStatusColor(keyStatus.deepseek),
                                                color: getStatusColor(keyStatus.deepseek)
                                            }}
                                            variant="outlined"
                                        />
                                        <Chip
                                            label="Qwen"
                                            size="small"
                                            sx={{ 
                                                borderColor: getStatusColor(keyStatus.qwen),
                                                color: getStatusColor(keyStatus.qwen)
                                            }}
                                            variant="outlined"
                                        />
                                    </>
                                )}
                                <Chip
                                    label="Ollama"
                                    size="small"
                                    sx={{ 
                                        borderColor: getStatusColor(keyStatus.ollama),
                                        color: getStatusColor(keyStatus.ollama)
                                    }}
                                    variant="outlined"
                                />
                            </Box>
                        </Box>

                        {/* Action Buttons */}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                                onClick={handleSaveSettings}
                                disabled={saving}
                                sx={{ flex: 1 }}
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<RefreshIcon />}
                                onClick={checkKeyStatus}
                                disabled={saving}
                            >
                                Test
                            </Button>
                        </Box>
                    </Box>
                </AccordionDetails>
            </Accordion>
        </Box>
    );
};

export default ApiKeyManager;
