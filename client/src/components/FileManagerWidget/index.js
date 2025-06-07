// client/src/components/FileManagerWidget.js

import React, { useState, useEffect, useCallback } from 'react';
import { getUserFiles, deleteUserFile } from '../../services/api';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Typography } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DeleteIcon from '@mui/icons-material/Delete';
import './index.css';

const FileItem = ({ file, isProcessing, onGeneratePodcast, onGenerateMindMap, onDelete }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const handleClick = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const handleDelete = () => {
        handleClose();
        onDelete(file._id, file.originalname);
    };

    const handlePodcast = () => {
        handleClose();
        onGeneratePodcast(file._id, file.originalname);
    };
    
    const handleMindMap = () => {
        handleClose();
        onGenerateMindMap(file._id, file.originalname);
    };

    return (
        <li className="file-item">
            <span className="file-name" title={file.originalname}>{file.originalname}</span>
            <IconButton
                aria-label="more"
                id={`long-button-${file._id}`}
                aria-controls={open ? 'long-menu' : undefined}
                aria-expanded={open ? 'true' : undefined}
                aria-haspopup="true"
                onClick={handleClick}
                disabled={isProcessing}
            >
                <MoreVertIcon />
            </IconButton>
            <Menu
                id={`long-menu-${file._id}`}
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
            >
                <MenuItem disabled>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Edit Name</ListItemText>
                </MenuItem>
                <MenuItem onClick={handlePodcast}>
                    <ListItemIcon><PodcastsIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Generate Podcast</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleMindMap}>
                    <ListItemIcon><AccountTreeIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Generate Mind Map</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleDelete}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    <ListItemText primaryTypographyProps={{ color: 'error' }}>Delete</ListItemText>
                </MenuItem>
            </Menu>
        </li>
    );
};

const FileManagerWidget = ({ refreshTrigger, onGeneratePodcast, onGenerateMindMap, onFilesChange, isProcessing }) => {
    const [files, setFiles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const stableOnFilesChange = useCallback(onFilesChange, []);
    // FIX: Get the userId to make the component aware of the current user.
    const userId = localStorage.getItem('userId');

    useEffect(() => {
        const fetchFiles = async () => {
            // If there's no user, don't try to fetch files.
            if (!userId) {
                setFiles([]);
                stableOnFilesChange(false);
                return;
            }

            setIsLoading(true);
            setError('');
            try {
                const response = await getUserFiles();
                const filesData = response.data || [];
                setFiles(filesData);
                stableOnFilesChange(filesData.length > 0);
            } catch (err) {
                console.error("Failed to fetch files:", err);
                setError('Could not load files.');
                setFiles([]);
                stableOnFilesChange(false);
            } finally {
                setIsLoading(false);
            }
        };
        fetchFiles();
    // FIX: Add userId to the dependency array.
    // This forces the component to re-fetch files when the user changes.
    }, [refreshTrigger, stableOnFilesChange, userId]);

    const handleDelete = async (fileId, fileName) => {
        if (window.confirm(`Are you sure you want to delete "${fileName}"?`)) {
            try {
                await deleteUserFile(fileId);
                // Optimistically update the UI for a snappy user experience
                setFiles(prevFiles => prevFiles.filter(file => file._id !== fileId));
            } catch (err) {
                setError(`Could not delete ${fileName}.`);
                // Clear the error after a few seconds
                setTimeout(() => setError(''), 3000);
            }
        }
    };

    return (
        <div className="file-manager-widget">
            <Typography variant="h6" component="h4" sx={{ mb: 1 }}>My Files</Typography>
            {isLoading && <p className="loading-text">Loading files...</p>}
            {error && <p className="error-text">{error}</p>}
            
            {!isLoading && !error && (
                <ul className="file-list">
                    {files.length > 0 ? (
                        files.map(file => (
                            <FileItem
                                key={file._id}
                                file={file}
                                isProcessing={isProcessing}
                                onGeneratePodcast={onGeneratePodcast}
                                onGenerateMindMap={onGenerateMindMap}
                                onDelete={handleDelete}
                            />
                        ))
                    ) : (
                        <p className="no-files-text">No files uploaded.</p>
                    )}
                </ul>
            )}
        </div>
    );
};

export default FileManagerWidget;