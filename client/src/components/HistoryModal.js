import React, { useState, useEffect } from 'react';
import { getChatSessions, getSessionDetails } from '../services/api';
import {
    Dialog, DialogTitle, DialogContent, List, ListItem, ListItemText,
    CircularProgress, Typography, Box, IconButton, ListItemSecondaryAction
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import { formatDistanceToNow } from 'date-fns';
import { deleteChatSession } from '../services/api';

const HistoryModal = ({ isOpen, onClose, onLoadSession }) => {
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchSessions = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await getChatSessions();
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
            fetchSessions();
        }
    }, [isOpen]);

    const handleLoadSession = async (sessionId) => {
        try {
            const response = await getSessionDetails(sessionId);
            onLoadSession(response.data);
            onClose();
        } catch (err) {
            setError(`Failed to load session ${sessionId}.`);
            console.error(err);
        }
    };

    const handleDeleteSession = async (sessionIdToDelete, sessionTitle) => {
        if (!window.confirm(`Are you sure you want to delete the chat titled "${sessionTitle}"?`)) {
            return;
        }
        try {
            await deleteChatSession(sessionIdToDelete);
            setSessions(prevSessions => prevSessions.filter(session => session.sessionId !== sessionIdToDelete));
        } catch (err) {
            setError(`Failed to delete session.`);
            console.error(err);
        }
    };

    return (
        <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Chat History
                <IconButton aria-label="close" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
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
                                    key={session.sessionId}
                                    button
                                    onClick={() => handleLoadSession(session.sessionId)}
                                >
                                    <ListItemText
                                        primary={session.title}
                                        secondary={`Last updated: ${formatDistanceToNow(new Date(session.updatedAt || session.createdAt), { addSuffix: true })}`}
                                    />
                                    <ListItemSecondaryAction>
                                        <IconButton
                                            edge="end"
                                            aria-label="delete"
                                            title="Delete chat"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteSession(session.sessionId, session.title);
                                            }}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))
                        ) : (
                            <Typography align="center" sx={{ my: 4 }}>
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