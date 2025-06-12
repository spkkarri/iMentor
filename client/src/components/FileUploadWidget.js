// client/src/components/FileUploadWidget.js
import React, { useState, useRef } from 'react';
import { uploadFile } from '../services/api';
import { FaTimesCircle } from 'react-icons/fa'; // Icon for removing a file

const FileUploadWidget = ({ onUploadSuccess }) => {
  // State now holds an array of files
  const [selectedFiles, setSelectedFiles] = useState([]);
  // State to track individual file upload progress
  const [uploadProgress, setUploadProgress] = useState({}); // { [fileName]: { status, message } }
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const allowedFileTypesString = ".pdf,.txt,.docx,.doc,.pptx,.ppt,.py,.js,.bmp,.png,.jpg,.jpeg";

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    const newFiles = [];
    const newProgress = {};

    files.forEach(file => {
      const fileExt = "." + file.name.split('.').pop().toLowerCase();
      const MAX_SIZE_MB = 20;
      const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

      if (!allowedFileTypesString.includes(fileExt)) {
        newProgress[file.name] = { status: 'error', message: 'Invalid type' };
      } else if (file.size > MAX_SIZE_BYTES) {
        newProgress[file.name] = { status: 'error', message: `> ${MAX_SIZE_MB}MB` };
      } else {
        newFiles.push(file);
      }
    });

    setSelectedFiles(prev => [...prev, ...newFiles]);
    setUploadProgress(prev => ({ ...prev, ...newProgress }));

    // Clear the input so the same files can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (fileName) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== fileName));
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileName];
      return newProgress;
    });
  };

  const handleUploadAll = async () => {
    if (selectedFiles.length === 0) return;

    const currentUserId = localStorage.getItem('userId');
    if (!currentUserId) {
      setUploadProgress({ 'system-error': { status: 'error', message: 'Not logged in.' } });
      return;
    }

    setIsUploading(true);
    const initialProgress = {};
    selectedFiles.forEach(file => {
      initialProgress[file.name] = { status: 'pending', message: 'Waiting...' };
    });
    setUploadProgress(initialProgress);

    for (const file of selectedFiles) {
      setUploadProgress(prev => ({
        ...prev,
        [file.name]: { status: 'uploading', message: 'Uploading...' }
      }));

      const formData = new FormData();
      formData.append('file', file);

      try {
        await uploadFile(formData);
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'success', message: 'Success!' }
        }));
        if (onUploadSuccess) onUploadSuccess();
      } catch (err) {
        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'error', message: err.response?.data?.message || 'Failed' }
        }));
      }
    }

    setIsUploading(false);
    // Clear successful uploads after a delay
    setTimeout(() => {
        setSelectedFiles([]);
        setUploadProgress({});
    }, 4000);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload-widget">
      <h4>Upload Files</h4>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={allowedFileTypesString}
        style={{ display: 'none' }}
        aria-hidden="true"
        multiple // <-- CRITICAL: Allow multiple file selection
      />
      <button
        type="button"
        className="select-file-btn"
        onClick={triggerFileInput}
        disabled={isUploading}
      >
        Choose Files
      </button>

      {/* Display list of selected files */}
      <div className="selected-files-list">
        {selectedFiles.length === 0 && !isUploading && (
            <div className="status-message">No files selected.</div>
        )}
        {selectedFiles.map(file => (
          <div key={file.name} className={`file-preview-item ${uploadProgress[file.name]?.status || ''}`}>
            <span className="file-preview-name" title={file.name}>{file.name}</span>
            <div className="file-preview-status">
              {uploadProgress[file.name]?.message}
            </div>
            {!isUploading && (
              <button onClick={() => removeFile(file.name)} className="remove-file-btn">
                <FaTimesCircle />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="upload-btn"
        onClick={handleUploadAll}
        disabled={selectedFiles.length === 0 || isUploading}
      >
        {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} File(s)`}
      </button>
    </div>
  );
};

// --- CSS for FileUploadWidget ---
const FileUploadWidgetCSS = `
/* client/src/components/FileUploadWidget.css */
.file-upload-widget { display: flex; flex-direction: column; gap: 12px; padding: 20px; box-sizing: border-box; }
.file-upload-widget h4 { margin-top: 0; margin-bottom: 10px; color: #e0e0e0; font-size: 0.95rem; font-weight: 600; }
.select-file-btn, .upload-btn { width: 100%; padding: 9px 15px; border: 1px solid #555; border-radius: 6px; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: all 0.2s ease; background-color: #3c3c3c; color: #e0e0e0; text-align: center; }
.select-file-btn:hover:not(:disabled), .upload-btn:hover:not(:disabled) { background-color: #4a4a4a; border-color: #666; }
.select-file-btn:disabled, .upload-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.upload-btn { background-color: #90caf9; border-color: #90caf9; color: #121212; }
.upload-btn:hover:not(:disabled) { background-color: #a4d4fa; border-color: #a4d4fa; }
.status-message { font-size: 0.8rem; color: #888; text-align: center; }

.selected-files-list { display: flex; flex-direction: column; gap: 8px; max-height: 150px; overflow-y: auto; padding: 5px; }
.file-preview-item { display: flex; align-items: center; gap: 8px; padding: 8px; background-color: #3c3c3c; border: 1px solid #555; border-radius: 4px; font-size: 0.85rem; }
.file-preview-name { flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #ccc; }
.file-preview-status { font-style: italic; color: #888; }
.remove-file-btn { background: none; border: none; color: #888; cursor: pointer; padding: 0; display: flex; }
.remove-file-btn:hover { color: #f44336; }

/* Status-specific styling */
.file-preview-item.uploading .file-preview-status { color: #90caf9; }
.file-preview-item.success { border-left: 3px solid #52c41a; }
.file-preview-item.success .file-preview-status { color: #52c41a; }
.file-preview-item.error { border-left: 3px solid #f44336; }
.file-preview-item.error .file-preview-status { color: #f44336; }
`;
// --- Inject CSS ---
const styleTagUploadId = 'file-upload-widget-styles';
if (!document.getElementById(styleTagUploadId)) {
    const styleTag = document.createElement("style");
    styleTag.id = styleTagUploadId;
    styleTag.type = "text/css";
    styleTag.innerText = FileUploadWidgetCSS;
    document.head.appendChild(styleTag);
}
// --- End CSS Injection ---

export default FileUploadWidget;