// client/src/components/FileManagerWidget.js
import React, { useState, useEffect, useCallback } from 'react';
import { getUserFiles, renameUserFile, deleteUserFile } from '../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; // ADDED
import { faFolderOpen, faSyncAlt } from '@fortawesome/free-solid-svg-icons'; // ADDED (faFolderOpen for widget, faSyncAlt for refresh)
import './FileManagerWidget.css';

const getFileIcon = (type) => {
  switch (type) {
    case 'docs': return '📄';
    case 'images': return '🖼️';
    case 'code': return '💻';
    default: return '📁';
  }
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (typeof bytes !== 'number' || bytes < 0) return 'N/A';
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const index = Math.max(0, Math.min(i, sizes.length - 1));
  return parseFloat((bytes / Math.pow(k, index)).toFixed(1)) + ' ' + sizes[index];
};


const FileManagerWidget = ({ refreshTrigger,isExpanded ,toggleSidebar  }) => {
  const [userFiles, setUserFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [renamingFile, setRenamingFile] = useState(null);
  const [newName, setNewName] = useState('');

  const fetchUserFiles = useCallback(async () => {
    // Ensure userId exists before fetching
    const currentUserId = localStorage.getItem('userId');
    if (!currentUserId) {
        console.log("FileManager: Skipping fetch, no userId.");
        setUserFiles([]); // Clear files if no user
        return;
    }

    setIsLoading(true);
    setError('');
    try {
      // Interceptor adds user ID
      const response = await getUserFiles();
      setUserFiles(response.data || []);
    } catch (err) {
      console.error("Error fetching user files:", err);
      setError(err.response?.data?.message || 'Failed to load files.');
      setUserFiles([]);
      // Handle potential logout if 401
      if (err.response?.status === 401) {
          console.warn("FileManager: Received 401, potential logout needed.");
          // Consider calling a logout function passed via props or context
      }
    } finally {
      setIsLoading(false);
    }
  }, []); // Removed userId dependency, check inside

  useEffect(() => {
    fetchUserFiles();
  }, [refreshTrigger, fetchUserFiles]);

  const handleRenameClick = (file) => {
    setRenamingFile(file.serverFilename);
    setNewName(file.originalName);
    setError('');
  };

  const handleRenameCancel = () => {
    setRenamingFile(null);
    setNewName('');
    setError('');
  };

  const handleRenameSave = async () => {
    if (!renamingFile || !newName.trim()) {
         setError('New name cannot be empty.');
         return;
    }
    if (newName.includes('/') || newName.includes('\\')) {
        setError('New name cannot contain slashes.');
        return;
    }

    setIsLoading(true);
    setError('');
    try {
      // Interceptor adds user ID
      await renameUserFile(renamingFile, newName.trim());
      setRenamingFile(null);
      setNewName('');
      fetchUserFiles();
    } catch (err) {
      console.error("Error renaming file:", err);
      setError(err.response?.data?.message || 'Failed to rename file.');
       if (err.response?.status === 401) {
          console.warn("FileManager: Received 401 during rename.");
      }
    } finally {
       setIsLoading(false);
    }
  };

  const handleRenameInputKeyDown = (e) => {
      if (e.key === 'Enter') {
          handleRenameSave();
      } else if (e.key === 'Escape') {
          handleRenameCancel();
      }
  };

  const handleDeleteFile = async (serverFilename, originalName) => {
    if (!window.confirm(`Are you sure you want to delete "${originalName}"? This cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      // Interceptor adds user ID
      await deleteUserFile(serverFilename);
      fetchUserFiles();
    } catch (err) {
      console.error("Error deleting file:", err);
      setError(err.response?.data?.message || 'Failed to delete file.');
       if (err.response?.status === 401) {
          console.warn("FileManager: Received 401 during delete.");
      }
    } finally {
       setIsLoading(false);
    }
  };

  return (
    // MODIFICATION 1: Wrap with .widget-container and add data-tooltip
    <div 
      className="widget-container file-manager-widget" // Keep your specific class too
      data-tooltip={!isExpanded ? "Your Uploaded Files" : null}
      data-tooltip={!isExpanded ? "Your Uploaded Files" : null}
      onClick={!isExpanded ? (event) => {
          // Prevent click on refresh button from also toggling sidebar
          if (!event.target.closest('.fm-refresh-btn-collapsed')) { 
              toggleSidebar();
          }
      } : undefined}
      style={!isExpanded ? { cursor: 'pointer' } : {}}
    >
      {/* MODIFICATION 2: Add .widget-header with icon and conditional title */}
      <div className="widget-header">
        <FontAwesomeIcon icon={faFolderOpen} className="widget-icon" />
        {isExpanded && <h4 className="widget-title">Your Uploaded Files</h4>}
        
        {/* MODIFICATION 3: Move refresh button into the header, make it conditional or icon-only */}
        {isExpanded && ( // Only show refresh button text/full button when expanded
            <button
                onClick={fetchUserFiles}
                disabled={isLoading}
                className="fm-refresh-btn widget-header-action-btn" // Add a common class for header actions if needed
                title="Refresh File List"
            >
                <FontAwesomeIcon icon={faSyncAlt} /> {/* Use an icon */}
                {/* Optionally, add text if isExpanded: {isExpanded && " Refresh"} */}
            </button>
        )}
        {!isExpanded && ( // Show only icon button when collapsed
             <button
                onClick={fetchUserFiles}
                disabled={isLoading}
                className="fm-refresh-btn-collapsed widget-icon-button" // Different class for icon-only styling
                title="Refresh File List"
                style={{ marginLeft: 'auto' }} // Push to the right if it's the only item
            >
                <FontAwesomeIcon icon={faSyncAlt} />
            </button>
        )}
      </div>

      {/* MODIFICATION 4: Conditionally render the main content */}
      {isExpanded && (
        <div className="widget-content"> 
          {/* All original content of your file manager goes here */}
          {error && <div className="fm-error">{error}</div>}

          <div className="fm-file-list-container"> {/* This container should handle scrolling */}
            {isLoading && userFiles.length === 0 ? (
              <p className="fm-loading">Loading files...</p>
            ) : userFiles.length === 0 && !isLoading ? (
              <p className="fm-empty">No files uploaded yet.</p>
            ) : (
              <ul className="fm-file-list">
                {userFiles.map((file) => (
                  <li key={file.serverFilename} className="fm-file-item">
                    <span className="fm-file-icon">{getFileIcon(file.type)}</span>
                    <div className="fm-file-details">
                      {renamingFile === file.serverFilename ? (
                        <div className="fm-rename-section">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={handleRenameInputKeyDown}
                            autoFocus
                            className="fm-rename-input"
                            aria-label={`New name for ${file.originalName}`}
                          />
                          <button onClick={handleRenameSave} disabled={isLoading || !newName.trim()} className="fm-action-btn fm-save-btn" title="Save Name">✔️</button>
                          <button onClick={handleRenameCancel} disabled={isLoading} className="fm-action-btn fm-cancel-btn" title="Cancel Rename">❌</button>
                        </div>
                      ) : (
                        <>
                          <span className="fm-file-name" title={file.originalName}>{file.originalName}</span>
                          <span className="fm-file-size">{formatFileSize(file.size)}</span>
                        </>
                      )}
                    </div>
                    {renamingFile !== file.serverFilename && (
                      <div className="fm-file-actions">
                        <button
                            onClick={() => handleRenameClick(file)}
                            disabled={isLoading || !!renamingFile}
                            className="fm-action-btn fm-rename-btn"
                            title="Rename"
                        >
                           ✏️
                        </button>
                        <button
                            onClick={() => handleDeleteFile(file.serverFilename, file.originalName)}
                            disabled={isLoading || !!renamingFile}
                            className="fm-action-btn fm-delete-btn"
                            title="Delete"
                        >
                            🗑️
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {isLoading && userFiles.length > 0 && <p className="fm-loading fm-loading-bottom">Processing...</p>}
          </div>
        </div>
      )}
    </div>
  );
};
export default FileManagerWidget;