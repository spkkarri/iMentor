// client/src/components/FileUploadWidget.js
import React, { useState, useRef } from 'react';
import { uploadFile } from '../services/api';

const FileUploadWidget = ({ onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(''); // 'uploading', 'success', 'error', ''
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef(null);

  const allowedFileTypesString = ".pdf,.txt,.docx,.doc,.pptx,.ppt,.py,.js,.bmp,.png,.jpg,.jpeg";

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const fileExt = "." + file.name.split('.').pop().toLowerCase();
      if (!allowedFileTypesString.includes(fileExt)) {
           setStatusMessage(`Error: File type (${fileExt}) not allowed.`);
           setUploadStatus('error');
           setSelectedFile(null);
           if (fileInputRef.current) fileInputRef.current.value = '';
           return;
      }

      const MAX_SIZE_MB = 20;
      const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
      if (file.size > MAX_SIZE_BYTES) {
          setStatusMessage(`Error: File exceeds ${MAX_SIZE_MB}MB limit.`);
          setUploadStatus('error');
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
      }

      setSelectedFile(file);
      setStatusMessage(`Selected: ${file.name}`);
      setUploadStatus('');

    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setStatusMessage('Please select a file first.');
      setUploadStatus('error');
      return;
    }
     const currentUserId = localStorage.getItem('userId');
     if (!currentUserId) {
         setStatusMessage('Error: Not logged in. Cannot upload file.');
         setUploadStatus('error');
         return;
     }

    setUploadStatus('uploading');
    setStatusMessage(`Uploading ${selectedFile.name}...`);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await uploadFile(formData);

      setUploadStatus('success');
      setStatusMessage(response.data.message || 'Upload successful!');

      setSelectedFile(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }

      if (onUploadSuccess && typeof onUploadSuccess === 'function') {
          onUploadSuccess(response.data.filename);
      }

      setTimeout(() => {
          setUploadStatus(prevStatus => prevStatus === 'success' ? '' : prevStatus);
          setStatusMessage(prevMsg => prevMsg === (response.data.message || 'Upload successful!') ? '' : prevMsg);
      }, 4000);


    } catch (err) {
      console.error("Upload Error:", err.response || err);
      setUploadStatus('error');
      setStatusMessage(err.response?.data?.message || 'Upload failed. Please check the file or try again.');
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload-widget sidebar-panel">
      <h3 className="sidebar-header">Upload File</h3>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={allowedFileTypesString}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <button
        type="button"
        className="select-file-btn"
        onClick={triggerFileInput}
        disabled={uploadStatus === 'uploading'}
      >
        Choose File
      </button>
      <div className={`status-message ${uploadStatus}`}>
        {statusMessage || 'No file selected.'}
      </div>
      <button
        type="button"
        className="upload-btn"
        onClick={handleUpload}
        disabled={!selectedFile || uploadStatus === 'uploading'}
      >
        {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload'}
      </button>
    </div>
  );
};

// --- CSS for FileUploadWidget ---
const FileUploadWidgetCSS = `
.file-upload-widget {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.select-file-btn, .upload-btn {
  width: 100%;
  padding: 10px 15px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.select-file-btn {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}
.select-file-btn:hover:not(:disabled) {
  border-color: var(--accent-active);
}

.upload-btn {
  background-color: var(--accent-active);
  color: var(--text-on-accent);
  border: 1px solid var(--accent-active);
}
.upload-btn:hover:not(:disabled) {
  background-color: var(--accent-hover);
  border-color: var(--accent-hover);
}

.select-file-btn:disabled, .upload-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status-message {
  font-size: 0.8rem;
  color: var(--text-secondary);
  padding: 8px 10px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  text-align: center;
  min-height: 1.6em;
  line-height: 1.4;
  word-break: break-word;
  transition: all 0.2s ease;
}

.status-message.uploading {
  color: var(--accent-active);
  border-color: var(--accent-active);
}
.status-message.success {
  color: #27ae60;
  border-color: #27ae60;
  background-color: rgba(39, 174, 96, 0.1);
}
.status-message.error {
  color: var(--error-color, #e53e3e);
  border-color: var(--error-color, #e53e3e);
  background-color: var(--error-bg, rgba(229, 62, 62, 0.1));
}
`;
const styleTagUploadId = 'file-upload-widget-styles';
if (!document.getElementById(styleTagUploadId)) {
    const styleTag = document.createElement("style");
    styleTag.id = styleTagUploadId;
    styleTag.type = "text/css";
    styleTag.innerText = FileUploadWidgetCSS;
    document.head.appendChild(styleTag);
}

export default FileUploadWidget;