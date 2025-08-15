/**
 * Enhanced Video Player Component
 * 
 * Displays YouTube videos with thumbnails and allows direct playback
 * Features:
 * - YouTube-like video grid layout
 * - High-quality thumbnails
 * - Direct video playback in modal
 * - Video metadata display
 * - Responsive design
 */

import React, { useState, useEffect } from 'react';
import { FaPlay, FaTimes, FaExternalLinkAlt, FaEye, FaClock, FaUser } from 'react-icons/fa';

const EnhancedVideoPlayer = ({ videos = [], query = '' }) => {
    const [selectedVideo, setSelectedVideo] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Extract video ID from YouTube URL
    const extractVideoId = (url) => {
        const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    };

    // Get high-quality thumbnail URL
    const getThumbnailUrl = (video) => {
        const videoId = extractVideoId(video.url);
        if (videoId) {
            // Try maxresdefault first, fallback to hqdefault
            return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        }
        return video.thumbnail || 'https://via.placeholder.com/320x180?text=Video+Thumbnail';
    };

    // Get embed URL for video
    const getEmbedUrl = (video) => {
        const videoId = extractVideoId(video.url);
        if (videoId) {
            return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
        }
        return null;
    };

    // Handle video click
    const handleVideoClick = (video) => {
        setSelectedVideo(video);
        setIsModalOpen(true);
    };

    // Close modal
    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedVideo(null);
    };

    // Handle thumbnail error
    const handleThumbnailError = (e, video) => {
        const videoId = extractVideoId(video.url);
        if (videoId) {
            // Fallback to hqdefault
            e.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
    };

    // Format view count
    const formatViews = (views) => {
        if (!views) return 'N/A';
        const num = parseInt(views.replace(/[^0-9]/g, ''));
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
        return num.toString();
    };

    // Format duration
    const formatDuration = (duration) => {
        if (!duration) return '';
        return duration;
    };

    if (!videos || videos.length === 0) {
        return null;
    }

    return (
        <div className="enhanced-video-player">
            <div className="video-section-header">
                <h3 className="video-section-title">
                    <FaPlay className="section-icon" />
                    Related Videos for "{query}"
                </h3>
                <p className="video-section-subtitle">
                    {videos.length} video{videos.length !== 1 ? 's' : ''} found • Click to play directly
                </p>
            </div>

            <div className="videos-grid">
                {videos.map((video, index) => (
                    <div 
                        key={index} 
                        className="video-card"
                        onClick={() => handleVideoClick(video)}
                    >
                        <div className="video-thumbnail-container">
                            <img
                                src={getThumbnailUrl(video)}
                                alt={video.title}
                                className="video-thumbnail"
                                onError={(e) => handleThumbnailError(e, video)}
                                loading="lazy"
                            />
                            <div className="video-overlay">
                                <div className="play-button">
                                    <FaPlay />
                                </div>
                            </div>
                            {video.duration && (
                                <div className="video-duration">
                                    {formatDuration(video.duration)}
                                </div>
                            )}
                        </div>
                        
                        <div className="video-info">
                            <h4 className="video-title" title={video.title}>
                                {video.title}
                            </h4>
                            
                            <div className="video-metadata">
                                {video.channel && (
                                    <div className="video-channel">
                                        <FaUser className="meta-icon" />
                                        <span>{video.channel}</span>
                                    </div>
                                )}
                                
                                <div className="video-stats">
                                    {video.views && (
                                        <span className="video-views">
                                            <FaEye className="meta-icon" />
                                            {formatViews(video.views)} views
                                        </span>
                                    )}
                                    {video.publishedAt && (
                                        <span className="video-date">
                                            <FaClock className="meta-icon" />
                                            {video.publishedAt}
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {video.description && (
                                <p className="video-description">
                                    {video.description.length > 100 
                                        ? `${video.description.substring(0, 100)}...` 
                                        : video.description
                                    }
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Video Modal */}
            {isModalOpen && selectedVideo && (
                <div className="video-modal-overlay" onClick={closeModal}>
                    <div className="video-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="video-modal-header">
                            <h3 className="modal-title">{selectedVideo.title}</h3>
                            <div className="modal-actions">
                                <a 
                                    href={selectedVideo.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="external-link-btn"
                                    title="Open in YouTube"
                                >
                                    <FaExternalLinkAlt />
                                </a>
                                <button 
                                    className="close-btn" 
                                    onClick={closeModal}
                                    title="Close"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </div>
                        
                        <div className="video-player-container">
                            {getEmbedUrl(selectedVideo) ? (
                                <iframe
                                    src={getEmbedUrl(selectedVideo)}
                                    title={selectedVideo.title}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className="video-iframe"
                                ></iframe>
                            ) : (
                                <div className="video-error">
                                    <p>Unable to load video player</p>
                                    <a 
                                        href={selectedVideo.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="watch-on-youtube-btn"
                                    >
                                        Watch on YouTube
                                    </a>
                                </div>
                            )}
                        </div>
                        
                        <div className="video-modal-info">
                            <div className="video-modal-metadata">
                                {selectedVideo.channel && (
                                    <span className="modal-channel">
                                        <FaUser /> {selectedVideo.channel}
                                    </span>
                                )}
                                {selectedVideo.views && (
                                    <span className="modal-views">
                                        <FaEye /> {formatViews(selectedVideo.views)} views
                                    </span>
                                )}
                                {selectedVideo.publishedAt && (
                                    <span className="modal-date">
                                        <FaClock /> {selectedVideo.publishedAt}
                                    </span>
                                )}
                            </div>
                            
                            {selectedVideo.description && (
                                <div className="video-modal-description">
                                    <h4>Description</h4>
                                    <p>{selectedVideo.description}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .enhanced-video-player {
                    margin: 20px 0;
                    background: #f8f9fa;
                    border-radius: 12px;
                    padding: 20px;
                    border: 1px solid #e9ecef;
                }

                .video-section-header {
                    margin-bottom: 20px;
                }

                .video-section-title {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 20px;
                    font-weight: 600;
                    color: #333;
                    margin: 0 0 8px 0;
                }

                .section-icon {
                    color: #ff0000;
                    font-size: 18px;
                }

                .video-section-subtitle {
                    color: #666;
                    font-size: 14px;
                    margin: 0;
                }

                .videos-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 20px;
                    margin-top: 20px;
                }

                .video-card {
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: 1px solid #e9ecef;
                }

                .video-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                }

                .video-thumbnail-container {
                    position: relative;
                    width: 100%;
                    height: 180px;
                    overflow: hidden;
                }

                .video-thumbnail {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.3s ease;
                }

                .video-card:hover .video-thumbnail {
                    transform: scale(1.05);
                }

                .video-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .video-card:hover .video-overlay {
                    opacity: 1;
                }

                .play-button {
                    background: rgba(255, 255, 255, 0.9);
                    border-radius: 50%;
                    width: 60px;
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #ff0000;
                    font-size: 20px;
                    transition: all 0.3s ease;
                }

                .play-button:hover {
                    background: white;
                    transform: scale(1.1);
                }

                .video-duration {
                    position: absolute;
                    bottom: 8px;
                    right: 8px;
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 500;
                }

                .video-info {
                    padding: 16px;
                }

                .video-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                    margin: 0 0 12px 0;
                    line-height: 1.3;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .video-metadata {
                    margin-bottom: 12px;
                }

                .video-channel {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: #666;
                    font-size: 14px;
                    margin-bottom: 8px;
                }

                .video-stats {
                    display: flex;
                    gap: 16px;
                    font-size: 13px;
                    color: #888;
                }

                .video-views,
                .video-date {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .meta-icon {
                    font-size: 12px;
                }

                .video-description {
                    color: #666;
                    font-size: 13px;
                    line-height: 1.4;
                    margin: 0;
                }

                /* Modal Styles */
                .video-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    padding: 20px;
                }

                .video-modal {
                    background: white;
                    border-radius: 12px;
                    max-width: 900px;
                    width: 100%;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                }

                .video-modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 20px 0 20px;
                    border-bottom: 1px solid #e9ecef;
                    margin-bottom: 0;
                }

                .modal-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #333;
                    margin: 0;
                    flex: 1;
                    margin-right: 20px;
                }

                .modal-actions {
                    display: flex;
                    gap: 10px;
                }

                .external-link-btn,
                .close-btn {
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 6px;
                    padding: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: #666;
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .external-link-btn:hover,
                .close-btn:hover {
                    background: #e9ecef;
                    color: #333;
                }

                .video-player-container {
                    position: relative;
                    width: 100%;
                    height: 0;
                    padding-bottom: 56.25%; /* 16:9 aspect ratio */
                    margin: 20px;
                    margin-bottom: 0;
                }

                .video-iframe {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    border-radius: 8px;
                }

                .video-error {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    color: #666;
                }

                .watch-on-youtube-btn {
                    background: #ff0000;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 6px;
                    text-decoration: none;
                    margin-top: 10px;
                    display: inline-block;
                    transition: background 0.2s ease;
                }

                .watch-on-youtube-btn:hover {
                    background: #cc0000;
                    color: white;
                }

                .video-modal-info {
                    padding: 20px;
                }

                .video-modal-metadata {
                    display: flex;
                    gap: 20px;
                    margin-bottom: 16px;
                    font-size: 14px;
                    color: #666;
                    flex-wrap: wrap;
                }

                .modal-channel,
                .modal-views,
                .modal-date {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .video-modal-description h4 {
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                    margin: 0 0 10px 0;
                }

                .video-modal-description p {
                    color: #666;
                    line-height: 1.5;
                    margin: 0;
                }

                /* Responsive Design */
                @media (max-width: 768px) {
                    .videos-grid {
                        grid-template-columns: 1fr;
                        gap: 16px;
                    }

                    .video-modal {
                        margin: 10px;
                        max-height: 95vh;
                    }

                    .video-modal-header {
                        padding: 16px;
                    }

                    .modal-title {
                        font-size: 16px;
                    }

                    .video-player-container {
                        margin: 16px;
                    }

                    .video-modal-info {
                        padding: 16px;
                    }

                    .video-modal-metadata {
                        flex-direction: column;
                        gap: 8px;
                    }
                }
            `}</style>
        </div>
    );
};

export default EnhancedVideoPlayer;
