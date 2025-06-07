// client/src/components/FileManagerWidget/index.js

import React, { useState } from 'react';
import { 
    IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Typography,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button, TextField 
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import PodcastsIcon from '@mui/icons-material/Podcasts';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DeleteIcon from '@mui/icons-material/Delete';
import './index.css';

const RenameDialog = ({ open, file, onClose, onSave }) => {
    const [newName, setNewName] = useState(file?.originalname || '');

    React.useEffect(() => {
        if (file) {
            setNewName(file.originalname);
        }
    }, [file]);

    const handleSave = () => {
        onSave(file._id, newName);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Rename File</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Please enter a new name for the file "{file?.originalname}".
                </DialogContentText>
                <TextField
                    autoFocus
                    margin="dense"
                    id="name"
                    label="New File Name"
                    type="text"
                    fullWidth
                    variant="standard"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handleSave} disabled={!newName.trim()}>Save</Button>
            </DialogActions>
        </Dialog>
    );
};

const FileItem = ({ file, isProcessing, onGeneratePodcast, onGenerateMindMap, onDeleteFile, onRenameFile }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const handleClick = (event) => setAnchorEl(event.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const handleDelete = () => { handleClose(); onDeleteFile(file._id, file.originalname); };
    const handlePodcast = () => { handleClose(); onGeneratePodcast(file._id, file.originalname); };
    const handleMindMap = () => { handleClose(); onGenerateMindMap(file._id, file.originalname); };
    const handleRename = () => { handleClose(); onRenameFile(file); };

    // --- FIX: Added the correct JSX for the return statement ---
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
                <MenuItem onClick={handleRename}>
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

const FileManagerWidget = ({ 
    files, 
    isLoading, 
    error, 
    onDeleteFile, 
    onRenameFile, 
    onGeneratePodcast, 
    onGenerateMindMap, 
    isProcessing 
}) => {
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [fileToRename, setFileToRename] = useState(null);

    const handleOpenRenameDialog = (file) => {
        setFileToRename(file);
        setIsRenameDialogOpen(true);
    };

    const handleCloseRenameDialog = () => {
        setIsRenameDialogOpen(false);
        setFileToRename(null);
    };

    const handleSaveRename = (fileId, newName) => {
        onRenameFile(fileId, newName);
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
                                onDeleteFile={onDeleteFile}
                                onRenameFile={handleOpenRenameDialog}
                            />
                        ))
                    ) : (
                        <p className="no-files-text">No files uploaded.</p>
                    )}
                </ul>
            )}
            
            <RenameDialog
                open={isRenameDialogOpen}
                file={fileToRename}
                onClose={handleCloseRenameDialog}
                onSave={handleSaveRename}
            />
        </div>
    );
};

export default FileManagerWidget;