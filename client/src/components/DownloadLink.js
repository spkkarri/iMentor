/**
 * Custom Download Link Component
 * Handles file downloads without causing page navigation
 */

import React from 'react';
import { FaDownload, FaFilePdf, FaFileWord, FaFilePowerpoint, FaFileExcel, FaFileAlt } from 'react-icons/fa';

const DownloadLink = ({ href, children, ...props }) => {
    // Check if this is a download link
    const isDownloadLink = href && (
        href.includes('/download') || 
        href.includes('.pdf') || 
        href.includes('.pptx') || 
        href.includes('.docx') || 
        href.includes('.xlsx') ||
        href.includes('/api/files/') ||
        href.includes('/api/enhanced/files/')
    );

    // Get file extension for icon
    const getFileIcon = (url) => {
        if (!url) return <FaFileAlt />;
        
        const ext = url.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'pdf':
                return <FaFilePdf style={{ color: '#e74c3c' }} />;
            case 'pptx':
            case 'ppt':
                return <FaFilePowerpoint style={{ color: '#d35400' }} />;
            case 'docx':
            case 'doc':
                return <FaFileWord style={{ color: '#2980b9' }} />;
            case 'xlsx':
            case 'xls':
                return <FaFileExcel style={{ color: '#27ae60' }} />;
            default:
                return <FaFileAlt style={{ color: '#7f8c8d' }} />;
        }
    };

    // Handle download click
    const handleDownloadClick = async (e) => {
        console.log('[DownloadLink] Click detected on:', href);

        // Prevent default behavior immediately
        e.preventDefault();
        e.stopPropagation();

        // Add visual feedback
        const button = e.currentTarget;
        const originalText = button.textContent;
        button.style.opacity = '0.7';
        button.style.cursor = 'wait';

        try {
            console.log('[DownloadLink] Starting download process for:', href);

            // Get user token for authentication
            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            console.log('[DownloadLink] Auth info - Token:', !!token, 'UserId:', userId);

            // Build full URL if relative
            let downloadUrl = href;
            if (href.startsWith('/')) {
                downloadUrl = `${window.location.origin}${href}`;
            }

            console.log('[DownloadLink] Full download URL:', downloadUrl);

            // Fetch the file
            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : '',
                    'x-user-id': userId || ''
                },
                credentials: 'include'
            });

            console.log('[DownloadLink] Response status:', response.status);
            console.log('[DownloadLink] Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                throw new Error(`Download failed: ${response.status} ${response.statusText}`);
            }

            // Get the blob
            const blob = await response.blob();
            console.log('[DownloadLink] Blob size:', blob.size, 'bytes');

            // Extract filename from URL or use default
            let filename = 'download';
            const urlParts = href.split('/');
            if (urlParts.length > 0) {
                filename = urlParts[urlParts.length - 1];
            }

            // If no extension, try to determine from content type
            if (!filename.includes('.')) {
                const contentType = response.headers.get('content-type');
                console.log('[DownloadLink] Content-Type:', contentType);
                if (contentType) {
                    if (contentType.includes('pdf')) filename += '.pdf';
                    else if (contentType.includes('presentation')) filename += '.pptx';
                    else if (contentType.includes('document')) filename += '.docx';
                    else if (contentType.includes('sheet')) filename += '.xlsx';
                }
            }

            console.log('[DownloadLink] Final filename:', filename);

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';

            // Trigger download
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Clean up
            window.URL.revokeObjectURL(url);

            console.log('[DownloadLink] Download completed successfully:', filename);

            // Show success feedback
            button.textContent = '✅ Downloaded!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);

        } catch (error) {
            console.error('[DownloadLink] Download failed:', error);

            // Show error feedback
            button.textContent = '❌ Failed - Opening in new tab...';
            setTimeout(() => {
                button.textContent = originalText;
            }, 3000);

            // Fallback: try opening in new tab
            setTimeout(() => {
                window.open(href, '_blank');
            }, 1000);

        } finally {
            // Restore button state
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
        }
    };

    // Alternative download method using iframe
    const handleAlternativeDownload = (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('[DownloadLink] Using alternative download method for:', href);

        // Method 1: Try using an invisible iframe
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = href;
        document.body.appendChild(iframe);

        // Remove iframe after a delay
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 5000);

        // Method 2: Also try direct window.location as backup
        setTimeout(() => {
            const a = document.createElement('a');
            a.href = href;
            a.download = '';
            a.target = '_blank';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }, 1000);
    };

    // If it's a download link, render custom download button
    if (isDownloadLink) {
        return (
            <div style={{ display: 'inline-block', margin: '4px 0' }}>
                <button
                    className="download-link-button"
                    onClick={handleDownloadClick}
                    title={`Download ${children}`}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: '500',
                        transition: 'all 0.2s ease',
                        marginRight: '8px'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#0056b3';
                        e.target.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#007bff';
                        e.target.style.transform = 'translateY(0)';
                    }}
                >
                    {getFileIcon(href)}
                    <span>{children}</span>
                    <FaDownload size={12} />
                </button>

                {/* Alternative download button */}
                <button
                    onClick={handleAlternativeDownload}
                    title="Alternative download method"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '8px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    ⬇️
                </button>
            </div>
        );
    }

    // For regular links, render normally
    return (
        <a 
            href={href} 
            {...props}
            target={href?.startsWith('http') ? '_blank' : undefined}
            rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
            {children}
        </a>
    );
};

export default DownloadLink;
