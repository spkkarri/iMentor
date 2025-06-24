import React, { useState, useEffect, useCallback } from 'react';
import { getUserFiles, renameUserFile, deleteUserFile, generatePodcast, SERVER_BASE_URL } from '../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderOpen, faSyncAlt, faPodcast, faSpinner } from '@fortawesome/free-solid-svg-icons';
import './FileManagerWidget.css';

const getFileIcon = (type) => {
    // This function is fine as is
    if (!type) return '📁';
    switch (type.toLowerCase()) {
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

const FileManagerWidget = ({ refreshTrigger, isExpanded, toggleSidebar }) => {
  // --- STATE MANAGEMENT: Using separate, isolated states ---
  const [userFiles, setUserFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // For fetching the file list
  const [error, setError] = useState('');
  
  // State specifically for the renaming action
  const [renamingFile, setRenamingFile] = useState(null); // Holds the serverFilename of file being renamed
  const [newName, setNewName] = useState('');

  // State specifically for the podcast generation action
  const [generatingPodcastFor, setGeneratingPodcastFor] = useState(null); // Holds serverFilename of file being processed
  const [podcastUrl, setPodcastUrl] = useState('');
  const [podcastError, setPodcastError] = useState('');

  const fetchUserFiles = useCallback(async () => {
    const currentUserId = localStorage.getItem('userId');
    if (!currentUserId) {
        setUserFiles([]);
        return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await getUserFiles();
      setUserFiles(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load files.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserFiles();
  }, [refreshTrigger, fetchUserFiles]);

  const handleRenameClick = (file) => {
    setRenamingFile(file.serverFilename);
    setNewName(file.originalName);
  };

  const handleCancelRename = () => {
    setRenamingFile(null);
    setNewName('');
  };

  const handleSaveRename = async (serverFilename) => {
    if (!newName.trim()) return;
    setIsLoading(true); // A general loading indicator
    try {
      await renameUserFile(serverFilename, newName.trim());
      setRenamingFile(null); // Exit rename mode on success
      fetchUserFiles(); // Refresh the list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to rename file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (serverFilename, originalName) => {
    if (!window.confirm(`Are you sure you want to delete "${originalName}"?`)) return;
    setIsLoading(true);
    try {
      await deleteUserFile(serverFilename);
      fetchUserFiles(); // Refresh the list
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePodcast = async (serverFilename) => {
    setGeneratingPodcastFor(serverFilename);
    setPodcastUrl('');
    setPodcastError('');
    try {
      const response = await generatePodcast(serverFilename);
      const fullAudioUrl = `${SERVER_BASE_URL}${response.data.audioUrl}`;
      setPodcastUrl(fullAudioUrl);
    } catch (err) {
      setPodcastError(err.response?.data?.error || 'Failed to generate podcast.');
    } finally {
      setGeneratingPodcastFor(null);
    }
  };

  // Check if any action is happening that should disable other buttons
  const isAnyActionInProgress = isLoading || !!renamingFile || !!generatingPodcastFor;

   return (
    <div className="widget-container file-manager-widget" /* ... */ >
      <div className="widget-header">
        <FontAwesomeIcon icon={faFolderOpen} className="widget-icon" />
        {isExpanded && <h4 className="widget-title">Your Uploaded Files</h4>}
        <button onClick={fetchUserFiles} disabled={isLoading || !!generatingPodcastFor || !!renamingFile} className="fm-refresh-btn widget-header-action-btn" title="Refresh File List">
            <FontAwesomeIcon icon={faSyncAlt} />
        </button>
      </div>

      {isExpanded && (
        <div className="widget-content"> 
          {error && <div className="fm-error">{error}</div>}
          {podcastUrl && (
            <div className="podcast-player-container">
              <p>Your podcast is ready:</p>
              <audio controls autoPlay src={podcastUrl} key={podcastUrl} />
            </div>
          )}
          {podcastError && <div className="fm-error podcast-error">{podcastError}</div>}
          
          <div className="fm-file-list-container">
            {isLoading && userFiles.length === 0 ? (
              <p className="fm-loading">Loading files...</p>
            ) : userFiles.length === 0 && !isLoading ? (
              <p className="fm-empty">No files uploaded yet.</p>
            ) : (
              <ul className="fm-file-list">
                {userFiles.map((file) => (
                  <li key={file.serverFilename} className="fm-file-item">
                    <div className="fm-file-details">
                      {renamingFile === file.serverFilename ? (
                         <div className="fm-rename-section">
                            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()} autoFocus className="fm-rename-input"/>
                            <button onClick={handleSaveRename} className="fm-action-btn">✔️</button>
                            <button onClick={handleCancelRename} className="fm-action-btn">❌</button>
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
                        {/* Podcast Button */}
                        {generatingPodcastFor === file.serverFilename ? (
                          <button className="fm-action-btn" disabled><FontAwesomeIcon icon={faSpinner} spin /></button>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); handleGeneratePodcast(file.serverFilename, file.originalName); }} disabled={isLoading || !!renamingFile || !!generatingPodcastFor} className="fm-action-btn" title="Generate Podcast">
                              <FontAwesomeIcon icon={faPodcast} />
                          </button>
                        )}
                        
                        {/* Rename Button */}
                        <button onClick={(e) => { e.stopPropagation(); handleRenameClick(file); }} disabled={isLoading || !!renamingFile || !!generatingPodcastFor} className="fm-action-btn" title="Rename">
                           ✏️
                        </button>

                        {/* Delete Button */}
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.serverFilename, file.originalName); }} disabled={isLoading || !!renamingFile || !!generatingPodcastFor} className="fm-action-btn" title="Delete">
                            🗑️
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManagerWidget;