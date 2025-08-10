// client/src/components/MediaRenderer/index.js
import React, { useState } from 'react';
import { FaPlay, FaExternalLinkAlt, FaImage, FaNewspaper, FaExpand, FaTimes } from 'react-icons/fa';
import './index.css';

const MediaRenderer = ({ media }) => {
    const [expandedImage, setExpandedImage] = useState(null);

    if (!media || (!media.videos?.length && !media.images?.length && !media.news?.length)) {
        return null;
    }



    const handleImageExpand = (image) => {
        setExpandedImage(image);
    };

    const handleImageClose = () => {
        setExpandedImage(null);
    };

    return (
        <div className="media-renderer">
            {/* Videos Section */}
            {media.videos && media.videos.length > 0 && (
                <div className="media-section">
                    <h4 className="media-section-title">
                        <FaPlay className="media-icon" />
                        Related Videos
                    </h4>
                    <div className="videos-grid">
                        {media.videos.map((video, index) => (
                            <div key={index} className="video-card">
                                <div className="video-thumbnail-container">
                                    <img
                                        src={video.thumbnail}
                                        alt={video.title}
                                        className="video-thumbnail"
                                    />
                                    <div className="video-overlay">
                                        <FaPlay className="play-icon" />
                                        {video.duration && (
                                            <span className="video-duration">{video.duration}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="video-info">
                                    <h5 className="video-title" title={video.title}>
                                        {video.title}
                                    </h5>
                                    <div className="video-actions">
                                        <a
                                            href={video.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="video-link"
                                        >
                                            <FaExternalLinkAlt />
                                            Watch on {video.platform || 'YouTube'}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Images Section */}
            {media.images && media.images.length > 0 && (
                <div className="media-section">
                    <h4 className="media-section-title">
                        <FaImage className="media-icon" />
                        Related Images
                    </h4>
                    <div className="images-grid">
                        {media.images.map((image, index) => (
                            <div key={index} className="image-card">
                                <div className="image-container">
                                    <img
                                        src={image.thumbnail || image.url}
                                        alt={image.title}
                                        className="image-thumbnail"
                                        onClick={() => handleImageExpand(image)}
                                    />
                                    <div className="image-overlay">
                                        <FaExpand className="expand-icon" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* News Section */}
            {media.news && media.news.length > 0 && (
                <div className="media-section">
                    <h4 className="media-section-title">
                        <FaNewspaper className="media-icon" />
                        Latest News
                    </h4>
                    <div className="news-list">
                        {media.news.map((article, index) => (
                            <div key={index} className="news-card">
                                <div className="news-content">
                                    <h5 className="news-title">
                                        <a
                                            href={article.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="news-link"
                                        >
                                            {article.title}
                                        </a>
                                    </h5>
                                    {article.snippet && (
                                        <p className="news-snippet">{article.snippet}</p>
                                    )}
                                    {article.source && (
                                        <div className="news-source">
                                            <span>Source: {article.source}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="news-actions">
                                    <a
                                        href={article.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="read-more-btn"
                                    >
                                        <FaExternalLinkAlt />
                                        Read More
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Image Modal */}
            {expandedImage && (
                <div className="image-modal" onClick={handleImageClose}>
                    <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="image-modal-close" onClick={handleImageClose}>
                            <FaTimes />
                        </button>
                        <img
                            src={expandedImage.url}
                            alt={expandedImage.title}
                            className="expanded-image"
                        />
                        <div className="image-modal-info">
                            <h4>{expandedImage.title}</h4>
                            <a
                                href={expandedImage.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="image-source-link"
                            >
                                <FaExternalLinkAlt />
                                View Original
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MediaRenderer;
