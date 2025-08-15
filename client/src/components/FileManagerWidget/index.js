// client/src/components/FileManagerWidget/index.js
import React, { useState } from 'react';
import { FaTrash, FaEdit, FaFileAudio, FaProjectDiagram, FaEllipsisV, FaCommentDots, FaFile, FaQuestionCircle } from 'react-icons/fa'; // Added FaFile for generic file icon
import { Box, Typography, List, ListItem, ListItemText, IconButton, CircularProgress, Paper, Menu, MenuItem, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';


// Make sure these imports are correct based on your project structure
import './index.css'; // This CSS file is correctly referenced and should contain the styles

function FileManagerWidget({
    files,
    isLoading,
    error,
    onDeleteFile,
    onRenameFile,
    onGeneratePodcast,
    onGenerateMindMap,
    onGenerateFAQ, // New prop for FAQ generation
    onChatWithFile, // This prop seems unused in the provided code, but kept
    isProcessing,
    onActionTaken // New prop to notify parent of an action
}) {
    const theme = useTheme();
    const [anchorEl, setAnchorEl] = useState(null); // For MUI Menu
    const [selectedFileForMenu, setSelectedFileForMenu] = useState(null); // Stores the file object for the open menu

    const handleMenuOpen = (event, file) => {
        setAnchorEl(event.currentTarget);
        setSelectedFileForMenu(file);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedFileForMenu(null);
    };

    // This function now wraps all actions to ensure the menu is closed
    const handleActionClick = (action, fileId, fileName) => {
        handleMenuClose(); // Close the menu first
        if (action) {
            action(fileId, fileName);
        }
        if (onActionTaken) {
            onActionTaken(); // Notify parent (e.g., to close sidebar)
        }
    };

    return (
        <Paper elevation={3} sx={{ p: 3, borderRadius: '12px', bgcolor: 'background.paper', border: `1px solid ${theme.palette.grey[200]}` }}>
            <Typography variant="h6" component="h3" sx={{ mb: 2, color: 'text.primary', fontWeight: 600, borderBottom: `1px solid ${theme.palette.grey[100]}`, pb: 1 }}>
                My Files
            </Typography>

            {isLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 3, color: 'text.secondary' }}>
                    <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>Loading files...</Typography>
                </Box>
            ) : error ? (
                <Typography color="error" sx={{ textAlign: 'center', py: 2 }}>{error}</Typography>
            ) : (
                <>
                    <List sx={{ maxHeight: 200, overflowY: 'auto', p: 0, '&::-webkit-scrollbar': { width: '6px' }, '&::-webkit-scrollbar-thumb': { bgcolor: 'grey.700', borderRadius: '3px' } }}>
                        {files.length === 0 ? (
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3, fontStyle: 'italic' }}>
                                No files uploaded yet.
                            </Typography>
                        ) : (
                            files.map(file => (
                                <ListItem
                                    key={file._id}
                                    disablePadding
                                    sx={{
                                        mb: 1, bgcolor: 'grey.800', borderRadius: '8px',
                                        border: `1px solid ${theme.palette.grey[700]}`,
                                        '&:hover': { bgcolor: 'grey.700' }
                                    }}
                                >
                                    <ListItemText
                                        primary={<Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            <FaFile style={{ marginRight: '8px', color: theme.palette.text.secondary }} />
                                            {file.originalname}
                                        </Typography>}
                                        sx={{ p: 1.5, pr: 0 }}
                                    />

                                    <Tooltip title="More options">
                                        <IconButton
                                            aria-controls={`file-menu-${file._id}`}
                                            aria-haspopup="true"
                                            onClick={(e) => handleMenuOpen(e, file)}
                                            disabled={isProcessing}
                                            sx={{
                                                color: 'text.secondary',
                                                '&:hover': { bgcolor: 'grey.700', color: 'text.primary' },
                                                p: 1.5,
                                            }}
                                        >
                                            <FaEllipsisV />
                                        </IconButton>
                                    </Tooltip>
                                </ListItem>
                            ))
                        )}
                    </List>

                    <Menu
                        id="file-menu"
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleMenuClose}
                        MenuListProps={{
                            'aria-labelledby': 'basic-button',
                        }}
                        PaperProps={{ // Apply theme styles to the Menu Paper
                            sx: {
                                bgcolor: 'background.paper',
                                borderRadius: '8px',
                                border: `1px solid ${theme.palette.grey[200]}`,
                                boxShadow: theme.shadows[5], // Consistent shadow
                            }
                        }}
                    >
                        {selectedFileForMenu && (
                            <>
                                <MenuItem onClick={() => handleActionClick(onGenerateFAQ, selectedFileForMenu._id, selectedFileForMenu.originalname)} disabled={isProcessing} sx={{ color: '#ffd700', '&:hover': { bgcolor: 'rgba(255, 215, 0, 0.1)' } }}>
                                    <FaQuestionCircle style={{ marginRight: '12px', color: '#ffd700' }} /> Generate FAQs
                                </MenuItem>
                                <MenuItem onClick={() => handleActionClick(onGeneratePodcast, selectedFileForMenu._id, selectedFileForMenu.originalname)} disabled={isProcessing} sx={{ color: 'text.primary', '&:hover': { bgcolor: 'grey.100' } }}>
                                    <FaFileAudio style={{ marginRight: '12px' }} /> Generate Podcast
                                </MenuItem>
                                <MenuItem onClick={() => handleActionClick(onGenerateMindMap, selectedFileForMenu._id, selectedFileForMenu.originalname)} disabled={isProcessing} sx={{ color: 'text.primary', '&:hover': { bgcolor: 'grey.100' } }}>
                                    <FaProjectDiagram style={{ marginRight: '12px' }} /> Generate Mind Map
                                </MenuItem>
                                {/* onChatWithFile is commented out in original, but if used, uncomment below */}
                                {/* <MenuItem onClick={() => handleActionClick(onChatWithFile, selectedFileForMenu._id, selectedFileForMenu.originalname)} disabled={isProcessing} sx={{ color: 'text.primary', '&:hover': { bgcolor: 'grey.100' } }}>
                                    <FaCommentDots style={{ marginRight: '12px' }} /> Chat with File
                                </MenuItem> */}
                                <MenuItem onClick={() => handleActionClick(onRenameFile, selectedFileForMenu._id, selectedFileForMenu.originalname)} disabled={isProcessing} sx={{ color: 'text.primary', '&:hover': { bgcolor: 'grey.100' } }}>
                                    <FaEdit style={{ marginRight: '12px' }} /> Rename
                                </MenuItem>
                                <MenuItem onClick={() => handleActionClick(onDeleteFile, selectedFileForMenu._id, selectedFileForMenu.originalname)} disabled={isProcessing} sx={{ color: 'error.main', '&:hover': { bgcolor: 'error.dark', color: 'white' } }}>
                                    <FaTrash style={{ marginRight: '12px' }} /> Delete
                                </MenuItem>
                            </>
                        )}
                    </Menu>


                </>
            )}
        </Paper>
    );
}

export default FileManagerWidget;
