import React, { useState } from 'react';
import { Popover } from 'react-tiny-popover';
import { FaTrash, FaEdit, FaFileAudio, FaProjectDiagram, FaEllipsisV, FaCommentDots } from 'react-icons/fa';
import './index.css';
import PPTGenerator from '../PPTGenerator';

function FileManagerWidget({
    files,
    isLoading,
    error,
    onDeleteFile,
    onRenameFile,
    onGeneratePodcast,
    onGenerateMindMap,
    onChatWithFile,
    isProcessing,
    onActionTaken // New prop to notify parent of an action
}) {
    const [openMenuId, setOpenMenuId] = useState(null);

    // This function now wraps all actions to ensure the sidebar can be closed
    const handleActionClick = (action, fileId, fileName) => {
        setOpenMenuId(null);
        action(fileId, fileName);
        if (onActionTaken) {
            onActionTaken();
        }
    };

    // Added missing handleRename function
    const handleRename = (fileId, fileName) => {
        setOpenMenuId(null);
        if (onRenameFile) {
            onRenameFile(fileId, fileName);
        }
        if (onActionTaken) {
            onActionTaken();
        }
    };

    return (
        <div className="file-manager-widget">
            <h3>My Files</h3>
            {isLoading ? (
                <div className="file-manager-loading">Loading...</div>
            ) : error ? (
                <div className="file-manager-error">{error}</div>
            ) : (
                <>
                    <ul className="file-list">
                        {files.map(file => (
                            <li key={file._id} className="file-item">
                                <span className="file-name" title={file.originalname}>
                                    {file.originalname}
                                </span>
                                
                                <Popover
                                    isOpen={openMenuId === file._id}
                                    positions={['right', 'left', 'bottom', 'top']} 
                                    align="center"
                                    padding={10}
                                    onClickOutside={() => setOpenMenuId(null)}
                                    content={
                                        <div className="popover-menu">
                                            <button onClick={() => handleActionClick(onGeneratePodcast, file._id, file.originalname)} disabled={isProcessing} className="popover-menu-item">
                                                <FaFileAudio /> Generate Podcast
                                            </button>
                                            <button onClick={() => handleActionClick(onGenerateMindMap, file._id, file.originalname)} disabled={isProcessing} className="popover-menu-item">
                                                <FaProjectDiagram /> Generate Mind Map
                                            </button>
                                            <button onClick={() => handleRename(file._id, file.originalname)} disabled={isProcessing} className="popover-menu-item">
                                                <FaEdit /> Rename
                                            </button>
                                            <div className="popover-divider" />
                                            <button onClick={() => handleActionClick(onDeleteFile, file._id, file.originalname)} disabled={isProcessing} className="popover-menu-item danger">
                                                <FaTrash /> Delete
                                            </button>
                                        </div>
                                    }
                                >
                                    <button 
                                        onClick={() => setOpenMenuId(openMenuId === file._id ? null : file._id)} 
                                        className="icon-button menu-button"
                                        title="More options"
                                    >
                                        <FaEllipsisV />
                                    </button>
                                </Popover>
                            </li>
                        ))}
                    </ul>
                    <div style={{ marginTop: 20 }}>
                        <PPTGenerator />
                    </div>
                </>
            )}
        </div>
    );
};

export default FileManagerWidget;