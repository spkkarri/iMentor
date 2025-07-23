// src/components/SystemPromptWidget.js

import React from 'react';
import { Select, MenuItem, TextField, Typography, Box } from '@mui/material';
import { availablePrompts } from '../utils/prompts'; // <-- UPDATED IMPORT

const SystemPromptWidget = ({ selectedPromptId, promptText, onSelectChange, onTextChange }) => {
    const isCustom = selectedPromptId === 'custom';

    return (
        <Box className="system-prompt-widget" sx={{ p: 2, border: '1px solid #444', borderRadius: 2, mb: 2 }}>
            <Typography variant="h6" component="h4" gutterBottom>
                Assistant Mode
            </Typography>
            <Select
                value={selectedPromptId}
                onChange={(e) => onSelectChange(e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
            >
                {availablePrompts.map(p => (
                    <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
                ))}
            </Select>
            {isCustom && (
                <TextField
                    label="Custom System Prompt"
                    multiline
                    rows={4}
                    value={promptText}
                    onChange={(e) => onTextChange(e.target.value)}
                    fullWidth
                    variant="outlined"
                />
            )}
        </Box>
    );
};

export default SystemPromptWidget;