// client/src/components/SystemPromptWidget.js

import React from 'react';
import { Select, MenuItem, TextField, Typography, Box } from '@mui/material';

// --- NEW: Enhanced Prompts with Chain-of-Thought (CoT) Instructions ---
const baseInstructions = "You are an expert AI Engineering Tutor. Your goal is to help students understand complex topics by providing clear, accurate, and concise explanations. When asked a question, first, think step-by-step to formulate your answer. Then, present the final, clean answer to the user. Do not show your step-by-step thinking unless explicitly asked to.";

export const availablePrompts = [
    {
        id: 'friendly',
        label: 'Friendly Tutor',
        prompt: `${baseInstructions} Your tone should be encouraging, friendly, and approachable. Use analogies to simplify difficult concepts.`
    },
    {
        id: 'formal',
        label: 'Formal Professor',
        prompt: `${baseInstructions} Your tone should be formal, academic, and precise. Cite principles and use correct terminology.`
    },
    {
        id: 'socratic',
        label: 'Socratic Method',
        prompt: `${baseInstructions} Instead of giving direct answers, guide the student to the solution by asking leading questions. Help them think for themselves.`
    },
    {
        id: 'code_reviewer',
        label: 'Code Reviewer',
        prompt: `${baseInstructions} Your primary focus is on code. Analyze code snippets for errors, efficiency, and best practices. Provide corrected code with detailed explanations of the changes.`
    },
    {
        id: 'custom',
        label: 'Custom',
        prompt: ''
    }
];

export const getPromptTextById = (id) => {
    const prompt = availablePrompts.find(p => p.id === id);
    return prompt ? prompt.prompt : availablePrompts[0].prompt;
};

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