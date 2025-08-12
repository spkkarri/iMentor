// client/src/components/ModelSwitcher.js
import React, { useState, useEffect } from 'react';
import './ModelSwitcher.css';
import {
    Box, FormControl, Select, MenuItem, Typography, Chip, Tooltip, 
    IconButton, Alert, CircularProgress, Divider
} from '@mui/material';
import {
    Psychology as PsychologyIcon,
    Memory as MemoryIcon,
    Code as CodeIcon,
    Create as CreateIcon,
    Search as SearchIcon,
    Chat as ChatIcon,
    Refresh as RefreshIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Warning as WarningIcon
} from '@mui/icons-material';

const ModelSwitcher = ({ 
    selectedModel, 
    onModelChange, 
    isSidebarOpen = true,
    userId 
}) => {
    const [availableModels, setAvailableModels] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [modelStatus, setModelStatus] = useState({});

    // Default models configuration - Only 2 models: Gemini and Llama
    const defaultModels = [
        {
            id: 'gemini-pro',
            name: 'Gemini Pro',
            type: 'comprehensive',
            icon: <PsychologyIcon />,
            description: 'Google AI for comprehensive analysis and reasoning',
            specialties: ['Analysis', 'Reasoning', 'Web Search'],
            status: 'available',
            provider: 'Google'
        },
        {
            id: 'llama-model',
            name: 'Llama 3.2 (Ollama)',
            type: 'chat',
            icon: <ChatIcon />,
            description: 'Fast local AI model via Ollama (llama3.2:1b)',
            specialties: ['Chat', 'Conversation', 'Local AI'],
            status: 'available',
            provider: 'Ollama',
            isOllama: true,
            model: 'llama3.2:1b'
        }
    ];

    const [models, setModels] = useState(defaultModels);

    // Model type icons and colors
    const getModelTypeInfo = (type) => {
        switch (type) {
            case 'chat':
                return { icon: <MemoryIcon />, color: '#4CAF50', label: 'Chat' };
            case 'reasoning':
                return { icon: <PsychologyIcon />, color: '#2196F3', label: 'Reasoning' };
            case 'technical':
                return { icon: <CodeIcon />, color: '#FF9800', label: 'Technical' };
            case 'creative':
                return { icon: <CreateIcon />, color: '#E91E63', label: 'Creative' };
            case 'research':
                return { icon: <SearchIcon />, color: '#9C27B0', label: 'Research' };
            default:
                return { icon: <PsychologyIcon />, color: '#757575', label: 'General' };
        }
    };

    // Status icons and colors
    const getStatusInfo = (status) => {
        switch (status) {
            case 'available':
                return { icon: <CheckCircleIcon />, color: '#4CAF50', label: 'Available' };
            case 'unavailable':
                return { icon: <ErrorIcon />, color: '#F44336', label: 'Unavailable' };
            case 'limited':
                return { icon: <WarningIcon />, color: '#FF9800', label: 'Limited' };
            default:
                return { icon: <WarningIcon />, color: '#757575', label: 'Unknown' };
        }
    };

    // Fetch available models - Only Gemini and Llama models
    const fetchAvailableModels = async () => {
        setLoading(true);
        setError('');

        try {
            // Only use the 2 default models - no dynamic fetching
            const allModels = [...defaultModels];





            // Clear any cached models and force refresh
            setModels([]);
            setTimeout(() => {
                setModels(allModels);
                console.log(`🎉 Total models available: ${allModels.length} (Gemini + Llama only)`);
                console.log('📊 Available models:', allModels.map(m => `${m.name} (${m.id})`));
            }, 100);

            // Update model status
            await checkModelStatus(allModels);

        } catch (error) {
            console.error('Failed to fetch models:', error);
            setError('Failed to load available models');
        } finally {
            setLoading(false);
        }
    };

    // Check status of all models
    const checkModelStatus = async (modelList) => {
        const statusMap = {};

        for (const model of modelList) {
            try {
                if (model.provider === 'Google') {
                    // Gemini models - always available if API key exists
                    statusMap[model.id] = 'available';
                } else if (model.isMultiLLM) {
                    // Multi-LLM models - check via Multi-LLM status
                    statusMap[model.id] = 'available';
                } else if (model.isOllama) {
                    // Ollama models - check if running
                    try {
                        const response = await fetch('/api/user-ollama/status', {
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            }
                        });
                        if (response.ok) {
                            const data = await response.json();
                            statusMap[model.id] = data.data.isConnected ? 'available' : 'unavailable';
                        } else {
                            statusMap[model.id] = 'unavailable';
                        }
                    } catch {
                        statusMap[model.id] = 'unavailable';
                    }
                } else {
                    // Other models - assume available for now
                    statusMap[model.id] = 'available';
                }
            } catch (error) {
                console.warn(`Failed to check status for ${model.id}:`, error);
                statusMap[model.id] = 'unknown';
            }
        }

        setModelStatus(statusMap);
    };

    // Initialize models on component mount
    useEffect(() => {
        fetchAvailableModels();
    }, [userId]);

    // Handle model selection
    const handleModelSelect = (modelId) => {
        const model = models.find(m => m.id === modelId);
        if (model && onModelChange) {
            onModelChange(model);
        }
    };



    return (
        <Box sx={{ mb: 2 }}>
            {/* Header */}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                mb: 1,
                px: isSidebarOpen ? 0 : 0.5
            }}>
                {isSidebarOpen && (
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        AI Model
                    </Typography>
                )}
                <Tooltip title="Refresh Models">
                    <IconButton 
                        size="small" 
                        onClick={fetchAvailableModels}
                        disabled={loading}
                        sx={{ ml: isSidebarOpen ? 1 : 0 }}
                    >
                        {loading ? <CircularProgress size={16} /> : <RefreshIcon />}
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Error Alert */}
            {error && isSidebarOpen && (
                <Alert severity="error" sx={{ mb: 1, fontSize: '0.75rem' }}>
                    {error}
                </Alert>
            )}

            {/* Model Selector */}
            <FormControl fullWidth size="small">
                <Select
                    value={selectedModel || models[0]?.id || ''}
                    onChange={(e) => handleModelSelect(e.target.value)}
                    displayEmpty
                    sx={{
                        '& .MuiSelect-select': {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            py: 1
                        }
                    }}
                >
                    {models.map((model) => {
                        const modelTypeInfo = getModelTypeInfo(model.type);
                        const modelStatusInfo = getStatusInfo(model.status);
                        
                        return (
                            <MenuItem key={model.id} value={model.id}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                    {/* Model Icon */}
                                    <Box sx={{ color: modelTypeInfo.color, display: 'flex' }}>
                                        {model.icon || modelTypeInfo.icon}
                                    </Box>
                                    
                                    {/* Model Info */}
                                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {model.name}
                                        </Typography>
                                        {isSidebarOpen && (
                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                {model.provider}
                                            </Typography>
                                        )}
                                    </Box>
                                    
                                    {/* Status Icon */}
                                    <Box sx={{ color: modelStatusInfo.color, display: 'flex' }}>
                                        {modelStatusInfo.icon}
                                    </Box>
                                </Box>
                            </MenuItem>
                        );
                    })}
                </Select>
            </FormControl>



            {/* Model Count */}
            {isSidebarOpen && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1, textAlign: 'center' }}>
                    {models.length} models available
                </Typography>
            )}

            <Divider sx={{ mt: 2 }} />
        </Box>
    );
};

export default ModelSwitcher;
