// client/src/components/FileUploadWidget.js
import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload } from '@fortawesome/free-solid-svg-icons';
import { uploadFile } from '../services/api';
import './FileUploadWidget.css'; // Make sure this CSS file exists and is correctly styled

const FileUploadWidget = ({ onUploadSuccess, isExpanded }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
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
          onUploadSuccess();
      }
      setTimeout(() => {
          setUploadStatus(prevStatus => prevStatus === 'success' ? '' : prevStatus);
          setStatusMessage(prevMsg => prevMsg === (response.data.message || 'Upload successful!') ? '' : prevMsg);
      }, 4000);
    } catch (err) {
      console.error("Upload Error:", err.response || err);
      setUploadStatus('error');
      setStatusMessage(err.response?.data?.message || 'Upload failed. Please check the file or try again.');
      if (err.response?.status === 401) {
          console.warn("FileUpload: Received 401 during upload.");
      }
    }
  };

  const triggerFileInput = () => {
       console.log("triggerFileInput called. Ref current:", fileInputRef.current);
    fileInputRef.current?.click();
  };

 return (
    <div 
        className="widget-container file-upload-widget"
        data-tooltip={!isExpanded ? "Upload File" : null}
        onClick={!isExpanded ? triggerFileInput : undefined}
        style={!isExpanded ? { cursor: 'pointer' } : {}} 
    >
        {/* ==================================================================== */}
        {/* CRITICAL CHANGE: Hidden file input is MOVED HERE - outside the     */}
        {/* conditional rendering of .widget-content. It's always in the DOM.  */}
        {/* ==================================================================== */}
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept={allowedFileTypesString}
            style={{ display: 'none' }} 
            aria-hidden="true"
            id="customFileUploadInput" // Make sure this ID is unique if needed globally
        />

        <div className="widget-header">
            <FontAwesomeIcon icon={faUpload} className="widget-icon" /> 
            {isExpanded && <h4 className="widget-title">Upload File</h4>} 
        </div>

        {isExpanded && (
            <div className="widget-content">
                {/* The "Choose File" button is now only for the expanded view */}
                {/* It still triggers the same single hidden input defined above */}
                <button
                    type="button"
                    className="select-file-btn"
                    onClick={triggerFileInput}
                    disabled={uploadStatus === 'uploading'}
                >
                    Choose File
                </button>
                
                <div className={`status-message ${uploadStatus}`}>
                    {statusMessage || (selectedFile ? `Selected: ${selectedFile.name}` : 'No file selected.')}
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
        )}
        {/* The separate button for the !isExpanded case was correctly removed in your last version */}
    </div>
  );
};

export default FileUploadWidget;