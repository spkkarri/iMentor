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
        const response = await uploadFile(formData);
        const newFile = response.data; // The new file object from the server

        setUploadProgress(prev => ({
          ...prev,
          [file.name]: { status: 'success', message: 'Success!' }
        }));
        
        if (onUploadSuccess) {
            onUploadSuccess(newFile); // Pass the new file object
        }
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
        className="choose-files-btn"
        onClick={triggerFileInput}
        disabled={isUploading}
      >
        Choose Files
      </button>

      {/* Display status message */}
      <div className="upload-status">
        {selectedFiles.length === 0 && !isUploading && (
            <div className="no-files-message">No files selected.</div>
        )}
        {selectedFiles.length > 0 && !isUploading && (
            <div className="files-selected-message">{selectedFiles.length} file(s) selected</div>
        )}
        {isUploading && (
            <div className="uploading-message">Uploading files...</div>
        )}
      </div>

      {/* Show selected files list when files are selected */}
      {selectedFiles.length > 0 && (
        <div className="selected-files-list">
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

          <button
            type="button"
            className="upload-btn"
            onClick={handleUploadAll}
            disabled={selectedFiles.length === 0 || isUploading}
          >
            {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} File(s)`}
          </button>
        </div>
      )}
    </div>
  );
};

// --- CSS for FileUploadWidget ---
const FileUploadWidgetCSS = `
/* client/src/components/FileUploadWidget.css */
.file-upload-widget {
  display: flex;
  flex-direction: column;
  gap: 15px;
  box-sizing: border-box;
}

.choose-files-btn {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #dadce0;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  background-color: #ffffff;
  color: #1a73e8;
  text-align: center;
}

.choose-files-btn:hover:not(:disabled) {
  background-color: #f8f9fa;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.choose-files-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-status {
  text-align: center;
  font-size: 14px;
  color: #5f6368;
  padding: 12px 0;
}

.no-files-message {
  color: #5f6368;
}

.files-selected-message {
  color: #1a73e8;
}

.uploading-message {
  color: #1a73e8;
}

.selected-files-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding: 5px;
}

.file-preview-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: #f8f9fa;
  border: 1px solid #e8eaed;
  border-radius: 8px;
  font-size: 14px;
}

.file-preview-name {
  flex-grow: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #202124;
}

.file-preview-status {
  font-style: italic;
  color: #5f6368;
}

.remove-file-btn {
  background: none;
  border: none;
  color: #5f6368;
  cursor: pointer;
  padding: 4px;
  display: flex;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.remove-file-btn:hover {
  color: #d93025;
  background-color: #fce8e6;
}

.upload-btn {
  width: 100%;
  padding: 12px 16px;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
  background-color: #1a73e8;
  color: #ffffff;
  text-align: center;
  margin-top: 12px;
}

.upload-btn:hover:not(:disabled) {
  background-color: #1557b0;
  box-shadow: 0 1px 3px rgba(26, 115, 232, 0.3);
}

.upload-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

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