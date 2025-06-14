// client/src/components/HistoryModal.js

import React, { useState, useEffect } from 'react';
import { getHistoryList, getHistorySession, deleteHistorySession } from '../services/api';
import {
    Dialog, DialogTitle, DialogContent, List, ListItem, ListItemText,
    CircularProgress, Typography, Box, IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import { formatDistanceToNow, isValid } from 'date-fns'; // <-- Import the 'isValid' function

const HistoryModal = ({ isOpen, onClose, onLoadSession }) => {
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchHistory = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await getHistoryList();
            setSessions(response.data);
        } catch (err) {
            setError('Failed to load chat history.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
    }, [isOpen]);

    const handleLoadSession = async (sessionId) => {
        try {
            const response = await getHistorySession(sessionId);
            onLoadSession(response.data);
            onClose();
        } catch (err) {
            setError(`Failed to load session.`);
            console.error(err);
        }
    };

    const handleDeleteSession = async (sessionId, event) => {
        event.stopPropagation();
        if (window.confirm('Are you sure you want to permanently delete this chat history?')) {
            try {
                await deleteHistorySession(sessionId);
                fetchHistory(); 
            } catch (err) {
                setError('Failed to delete session.');
                console.error(err);
            }
        }
    };

    // --- NEW: Helper function to safely format the date ---
    const formatSafeDate = (dateString) => {
        const date = new Date(dateString);
        // Check if the date is valid before trying to format it
        if (isValid(date)) {
            return formatDistanceToNow(date, { addSuffix: true });
        }
        // Return a fallback string if the date is invalid
        return 'a while ago';
    };

    return (
        <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { bgcolor: '#2d2d2d', color: '#e0e0e0' } }}>
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Chat History
                <IconButton aria-label="close" onClick={onClose} sx={{ color: 'inherit' }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ borderColor: '#444' }}>
                {isLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                        <CircularProgress />
                    </Box>
                )}
                {error && (
                    <Typography color="error" align="center" sx={{ my: 4 }}>
                        {error}
                    </Typography>
                )}
                {!isLoading && !error && (
                    <List>
                        {sessions.length > 0 ? (
                            sessions.map((session) => (
                                <ListItem
                                    button
                                    key={session.sessionId}
                                    onClick={() => handleLoadSession(session.sessionId)}
                                    secondaryAction={
                                        <IconButton edge="end" aria-label="delete" onClick={(e) => handleDeleteSession(session.sessionId, e)}>
                                            <DeleteIcon sx={{ color: '#888', '&:hover': { color: '#f44336' } }} />
                                        </IconButton>
                                    }
                                    sx={{ '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' } }}
                                >
                                    <ListItemText
                                        primary={session.title}
                                        // --- FIX: Use the new safe date formatting function ---
                                        secondary={`Last updated: ${formatSafeDate(session.createdAt)}`}
                                        primaryTypographyProps={{ sx: { color: '#e0e0e0' } }}
                                        secondaryTypographyProps={{ sx: { color: '#a0a0a0' } }}
                                    />
                                </ListItem>
                            ))
                        ) : (
                            <Typography align="center" sx={{ my: 4, color: '#a0a0a0' }}>
                                No chat history found.
                            </Typography>
                        )}
                    </List>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default HistoryModal;