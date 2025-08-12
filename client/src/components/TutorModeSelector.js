// client/src/components/TutorModeSelector.js
import React, { useState, useEffect } from 'react';
import {
    Box, FormControl, Select, MenuItem, Typography, Chip, 
    TextField, Dialog, DialogTitle, DialogContent, DialogActions,
    Button, IconButton, Tooltip
} from '@mui/material';
import {
    School as SchoolIcon,
    Business as BusinessIcon,
    Code as CodeIcon,
    Psychology as PsychologyIcon,
    Settings as SettingsIcon,
    Add as AddIcon,
    Edit as EditIcon
} from '@mui/icons-material';

const TutorModeSelector = ({ 
    selectedMode, 
    onModeChange, 
    isSidebarOpen = true 
}) => {
    const [customModeDialog, setCustomModeDialog] = useState(false);
    const [customModeName, setCustomModeName] = useState('');
    const [customModeDescription, setCustomModeDescription] = useState('');
    const [customModes, setCustomModes] = useState(() => {
        const saved = localStorage.getItem('customTutorModes');
        return saved ? JSON.parse(saved) : [];
    });

    // Predefined tutor modes
    const predefinedModes = [
        {
            id: 'friendly-tutor',
            name: 'Friendly Tutor',
            description: 'Encouraging, patient, and supportive teaching style',
            icon: <SchoolIcon />,
            color: '#4CAF50',
            systemPrompt: 'You are a friendly and encouraging tutor. Be patient, supportive, and use simple explanations. Always encourage the student and celebrate their progress. Use positive language and break down complex topics into easy-to-understand steps.'
        },
        {
            id: 'professional-tutor',
            name: 'Professional Tutor',
            description: 'Formal, structured, and comprehensive teaching approach',
            icon: <BusinessIcon />,
            color: '#2196F3',
            systemPrompt: 'You are a professional tutor with expertise in your field. Provide structured, comprehensive explanations with proper terminology. Be formal yet approachable, and ensure accuracy in all information. Include relevant examples and practical applications.'
        },
        {
            id: 'code-mentor',
            name: 'Code Mentor',
            description: 'Technical programming guidance with best practices',
            icon: <CodeIcon />,
            color: '#FF9800',
            systemPrompt: 'You are an experienced programming mentor. Focus on clean code, best practices, and efficient solutions. Explain programming concepts clearly, provide code examples, suggest improvements, and help debug issues. Always consider performance and maintainability.'
        },
        {
            id: 'research-assistant',
            name: 'Research Assistant',
            description: 'Academic research support with critical thinking',
            icon: <PsychologyIcon />,
            color: '#9C27B0',
            systemPrompt: 'You are a research-oriented academic assistant. Help with critical thinking, analysis, and research methodology. Provide well-sourced information, encourage deeper investigation, and help structure academic arguments. Focus on evidence-based reasoning.'
        },
        {
            id: 'customize-tutor',
            name: 'Customize Tutor',
            description: 'Create your own custom tutor personality',
            icon: <SettingsIcon />,
            color: '#607D8B',
            systemPrompt: '',
            isCustomizeOption: true
        }
    ];

    // Combine predefined and custom modes
    const allModes = [...predefinedModes, ...customModes];

    // Save custom modes to localStorage
    useEffect(() => {
        localStorage.setItem('customTutorModes', JSON.stringify(customModes));
    }, [customModes]);

    // Save selected mode to localStorage
    useEffect(() => {
        if (selectedMode) {
            localStorage.setItem('selectedTutorMode', selectedMode);
        }
    }, [selectedMode]);

    // Handle mode selection
    const handleModeSelect = (modeId) => {
        if (modeId === 'customize-tutor') {
            setCustomModeDialog(true);
            return;
        }

        const mode = allModes.find(m => m.id === modeId);
        if (mode && onModeChange) {
            onModeChange(mode);
        }
    };

    // Handle custom mode creation
    const handleCreateCustomMode = () => {
        if (customModeName.trim() && customModeDescription.trim()) {
            const newMode = {
                id: `custom-${Date.now()}`,
                name: customModeName.trim(),
                description: customModeDescription.trim(),
                icon: <SettingsIcon />,
                color: '#607D8B',
                systemPrompt: customModeDescription.trim(),
                isCustom: true
            };

            setCustomModes(prev => [...prev, newMode]);
            setCustomModeDialog(false);
            setCustomModeName('');
            setCustomModeDescription('');
            
            // Auto-select the new custom mode
            handleModeSelect(newMode.id);
        }
    };

    // Get current mode info (exclude customize option)
    const actualModes = allModes.filter(m => !m.isCustomizeOption);
    const currentMode = actualModes.find(m => m.id === selectedMode) || actualModes[0];

    return (
        <Box sx={{ mb: 2 }}>

            {/* Mode Selector */}
            <FormControl fullWidth size="small">
                <Select
                    value={selectedMode || actualModes[0]?.id || ''}
                    onChange={(e) => handleModeSelect(e.target.value)}
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
                    {allModes.map((mode) => (
                        <MenuItem key={mode.id} value={mode.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                {/* Mode Icon */}
                                <Box sx={{ color: mode.color, display: 'flex' }}>
                                    {mode.icon}
                                </Box>
                                
                                {/* Mode Info */}
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        {mode.name}
                                    </Typography>
                                    {isSidebarOpen && (
                                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                            {mode.description}
                                        </Typography>
                                    )}
                                </Box>
                                
                                {/* Custom Mode Indicator */}
                                {mode.isCustom && (
                                    <Chip
                                        label="Custom"
                                        size="small"
                                        variant="outlined"
                                        sx={{ fontSize: '0.65rem', height: 20 }}
                                    />
                                )}

                                {/* Customize Option Indicator */}
                                {mode.isCustomizeOption && (
                                    <Chip
                                        label="+"
                                        size="small"
                                        variant="filled"
                                        sx={{
                                            fontSize: '0.75rem',
                                            height: 20,
                                            backgroundColor: mode.color,
                                            color: 'white'
                                        }}
                                    />
                                )}
                            </Box>
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            {/* Current Mode Description */}
            {isSidebarOpen && currentMode && (
                <Typography variant="caption" sx={{ 
                    color: 'text.secondary', 
                    display: 'block', 
                    mt: 1, 
                    fontStyle: 'italic',
                    textAlign: 'center'
                }}>
                    {currentMode.description}
                </Typography>
            )}

            {/* Custom Mode Creation Dialog */}
            <Dialog 
                open={customModeDialog} 
                onClose={() => setCustomModeDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Create Custom Tutor Mode</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Mode Name"
                        fullWidth
                        variant="outlined"
                        value={customModeName}
                        onChange={(e) => setCustomModeName(e.target.value)}
                        placeholder="e.g., Creative Writing Coach"
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        margin="dense"
                        label="Mode Description & Instructions"
                        fullWidth
                        multiline
                        rows={4}
                        variant="outlined"
                        value={customModeDescription}
                        onChange={(e) => setCustomModeDescription(e.target.value)}
                        placeholder="Describe how this tutor should behave and teach. This will guide the AI's responses..."
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCustomModeDialog(false)}>Cancel</Button>
                    <Button 
                        onClick={handleCreateCustomMode}
                        variant="contained"
                        disabled={!customModeName.trim() || !customModeDescription.trim()}
                    >
                        Create Mode
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default TutorModeSelector;
