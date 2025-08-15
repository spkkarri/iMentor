import React, { useState } from 'react';
import './MediaRenderer.css';

const MediaRenderer = ({ videos = [], blogs = [], academic = [], wikipedia = [], documentation = [], news = [], tutorials = [], community = [], sources = [] }) => {
    const [activeTab, setActiveTab] = useState('videos');

    // Count total media items including new content types
    const totalItems = videos.length + blogs.length + academic.length + wikipedia.length + documentation.length + news.length + tutorials.length + community.length;
    
    if (totalItems === 0) {
        return null;
    }

    return (
        <div className="media-renderer">
            <div className="media-header">
                <h4>🎯 Enhanced Search Results</h4>
                <div className="media-tabs">
                    {videos.length > 0 && (
                        <button
                            className={`media-tab ${activeTab === 'videos' ? 'active' : ''}`}
                            onClick={() => setActiveTab('videos')}
                        >
                            🎥 Relevant Videos ({videos.length})
                        </button>
                    )}
                    {blogs.length > 0 && (
                        <button
                            className={`media-tab ${activeTab === 'blogs' ? 'active' : ''}`}
                            onClick={() => setActiveTab('blogs')}
                        >
                            📝 Articles ({blogs.length})
                        </button>
                    )}
                    {academic.length > 0 && (
                        <button
                            className={`media-tab ${activeTab === 'academic' ? 'active' : ''}`}
                            onClick={() => setActiveTab('academic')}
                        >
                            🎓 Research ({academic.length})
                        </button>
                    )}
                    {wikipedia.length > 0 && (
                        <button
                            className={`media-tab ${activeTab === 'wikipedia' ? 'active' : ''}`}
                            onClick={() => setActiveTab('wikipedia')}
                        >
                            📖 Wikipedia ({wikipedia.length})
                        </button>
                    )}
                    {documentation.length > 0 && (
                        <button
                            className={`media-tab ${activeTab === 'documentation' ? 'active' : ''}`}
                            onClick={() => setActiveTab('documentation')}
                        >
                            📋 Documentation ({documentation.length})
                        </button>
                    )}
                    {news.length > 0 && (
                        <button
                            className={`media-tab ${activeTab === 'news' ? 'active' : ''}`}
                            onClick={() => setActiveTab('news')}
                        >
                            📰 News ({news.length})
                        </button>
                    )}
                    {tutorials.length > 0 && (
                        <button
                            className={`media-tab ${activeTab === 'tutorials' ? 'active' : ''}`}
                            onClick={() => setActiveTab('tutorials')}
                        >
                            🎯 Tutorials ({tutorials.length})
                        </button>
                    )}
                    {community.length > 0 && (
                        <button
                            className={`media-tab ${activeTab === 'community' ? 'active' : ''}`}
                            onClick={() => setActiveTab('community')}
                        >
                            👥 Community ({community.length})
                        </button>
                    )}
                </div>
            </div>

            <div className="media-content">
                {/* Relevant YouTube Videos */}
                {activeTab === 'videos' && videos.length > 0 && (
                    <div className="videos-section">
                        <div className="section-header">
                            <h5>🎥 Relevant Videos</h5>
                            <p className="section-subtitle">Educational videos and tutorials related to your search</p>
                        </div>
                        <div className="videos-grid">
                            {videos.map((video, index) => (
                                <div key={index} className="video-card">
                                    <div className="video-thumbnail">
                                        <img
                                            src={video.thumbnail}
                                            alt={video.title}
                                            onError={(e) => {
                                                e.target.src = 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg';
                                            }}
                                        />
                                        <div className="video-duration">{video.duration}</div>
                                        <div className="play-overlay">
                                            <div className="play-button">▶</div>
                                        </div>
                                    </div>
                                    <div className="video-info">
                                        <h5 className="video-title">
                                            <a href={video.url} target="_blank" rel="noopener noreferrer">
                                                {video.title}
                                            </a>
                                        </h5>
                                        <div className="video-meta">
                                            <span className="video-channel">📺 {video.channel}</span>
                                            <span className="video-views">👁 {video.views}</span>
                                        </div>
                                        <p className="video-description">{video.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Blog Articles */}
                {activeTab === 'blogs' && blogs.length > 0 && (
                    <div className="blogs-section">
                        <div className="section-header">
                            <h5>📝 Related Articles</h5>
                            <p className="section-subtitle">High-quality articles and blog posts from trusted sources</p>
                        </div>
                        <div className="blogs-list">
                            {blogs.map((blog, index) => (
                                <div key={index} className="blog-card">
                                    <div className="blog-header">
                                        <h5 className="blog-title">
                                            <a href={blog.url} target="_blank" rel="noopener noreferrer">
                                                {blog.title}
                                            </a>
                                        </h5>
                                        <div className="blog-meta">
                                            <span className="blog-source">{blog.source}</span>
                                            <span className="blog-read-time">{blog.readTime}</span>
                                        </div>
                                    </div>
                                    <p className="blog-snippet">{blog.snippet}</p>
                                    {blog.tags && blog.tags.length > 0 && (
                                        <div className="blog-tags">
                                            {blog.tags.map((tag, tagIndex) => (
                                                <span key={tagIndex} className="blog-tag">{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Academic Sources */}
                {activeTab === 'academic' && academic.length > 0 && (
                    <div className="academic-section">
                        <div className="section-header">
                            <h5>🎓 Research Papers</h5>
                            <p className="section-subtitle">Academic research and scholarly articles from peer-reviewed sources</p>
                        </div>
                        <div className="academic-list">
                            {academic.map((paper, index) => (
                                <div key={index} className="academic-card">
                                    <div className="academic-header">
                                        <h5 className="academic-title">
                                            <a href={paper.url} target="_blank" rel="noopener noreferrer">
                                                {paper.title}
                                            </a>
                                        </h5>
                                        <div className="academic-meta">
                                            <span className="academic-source">{paper.source}</span>
                                            {paper.year && <span className="academic-year">{paper.year}</span>}
                                            {paper.citations && <span className="academic-citations">{paper.citations} citations</span>}
                                        </div>
                                    </div>
                                    {paper.authors && paper.authors.length > 0 && (
                                        <div className="academic-authors">
                                            <strong>Authors:</strong> {paper.authors.join(', ')}
                                        </div>
                                    )}
                                    <p className="academic-snippet">{paper.snippet}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Wikipedia */}
                {activeTab === 'wikipedia' && wikipedia.length > 0 && (
                    <div className="wikipedia-section">
                        <div className="wikipedia-list">
                            {wikipedia.map((wiki, index) => (
                                <div key={index} className="wikipedia-card">
                                    <div className="wikipedia-header">
                                        <h5 className="wikipedia-title">
                                            <a href={wiki.url} target="_blank" rel="noopener noreferrer">
                                                📖 {wiki.title}
                                            </a>
                                        </h5>
                                        <span className="wikipedia-source">{wiki.source}</span>
                                    </div>
                                    <p className="wikipedia-snippet">{wiki.snippet}</p>
                                    {wiki.thumbnail && (
                                        <div className="wikipedia-thumbnail">
                                            <img src={wiki.thumbnail} alt={wiki.title} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Documentation */}
                {activeTab === 'documentation' && documentation.length > 0 && (
                    <div className="documentation-section">
                        <div className="documentation-list">
                            {documentation.map((doc, index) => (
                                <div key={index} className="documentation-card">
                                    <div className="documentation-header">
                                        <h5 className="documentation-title">
                                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                                📋 {doc.title}
                                            </a>
                                        </h5>
                                        <span className="documentation-source">{doc.source}</span>
                                    </div>
                                    <p className="documentation-snippet">{doc.snippet}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* News Articles */}
                {activeTab === 'news' && news.length > 0 && (
                    <div className="news-section">
                        <div className="section-header">
                            <h5>📰 Latest News</h5>
                            <p className="section-subtitle">Current news and developments related to your search</p>
                        </div>
                        <div className="news-list">
                            {news.map((article, index) => (
                                <div key={index} className="news-card">
                                    <div className="news-header">
                                        <h5 className="news-title">
                                            <a href={article.url} target="_blank" rel="noopener noreferrer">
                                                📰 {article.title}
                                            </a>
                                        </h5>
                                        <div className="news-meta">
                                            <span className="news-source">📰 {article.source}</span>
                                            <span className="news-date">📅 {article.publishDate}</span>
                                            <span className="news-category">🏷 {article.category}</span>
                                        </div>
                                    </div>
                                    <p className="news-snippet">{article.snippet}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tutorials */}
                {activeTab === 'tutorials' && tutorials.length > 0 && (
                    <div className="tutorials-section">
                        <div className="section-header">
                            <h5>🎯 Learning Tutorials</h5>
                            <p className="section-subtitle">Step-by-step tutorials and courses for hands-on learning</p>
                        </div>
                        <div className="tutorials-list">
                            {tutorials.map((tutorial, index) => (
                                <div key={index} className="tutorial-card">
                                    <div className="tutorial-header">
                                        <h5 className="tutorial-title">
                                            <a href={tutorial.url} target="_blank" rel="noopener noreferrer">
                                                🎯 {tutorial.title}
                                            </a>
                                        </h5>
                                        <div className="tutorial-meta">
                                            <span className="tutorial-source">📚 {tutorial.source}</span>
                                            <span className="tutorial-difficulty">📊 {tutorial.difficulty}</span>
                                            <span className="tutorial-duration">⏱ {tutorial.duration}</span>
                                            <span className="tutorial-type">🎓 {tutorial.type}</span>
                                        </div>
                                    </div>
                                    <p className="tutorial-snippet">{tutorial.snippet}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Community Content */}
                {activeTab === 'community' && community.length > 0 && (
                    <div className="community-section">
                        <div className="section-header">
                            <h5>👥 Community Discussions</h5>
                            <p className="section-subtitle">Community forums, discussions, and collaborative content</p>
                        </div>
                        <div className="community-list">
                            {community.map((item, index) => (
                                <div key={index} className="community-card">
                                    <div className="community-header">
                                        <h5 className="community-title">
                                            <a href={item.url} target="_blank" rel="noopener noreferrer">
                                                👥 {item.title}
                                            </a>
                                        </h5>
                                        <div className="community-meta">
                                            <span className="community-source">🌐 {item.source}</span>
                                            <span className="community-members">👥 {item.members || item.questions || item.repositories}</span>
                                            <span className="community-activity">📈 {item.activity}</span>
                                            <span className="community-type">🏷 {item.type}</span>
                                        </div>
                                    </div>
                                    <p className="community-snippet">{item.snippet}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Sources Summary */}
            {sources.length > 0 && (
                <div className="sources-summary">
                    <h5>📚 All Sources ({sources.length})</h5>
                    <div className="sources-list">
                        {sources.slice(0, 5).map((source, index) => (
                            <div key={index} className="source-item">
                                <a href={source.url} target="_blank" rel="noopener noreferrer">
                                    {source.title}
                                </a>
                                <span className="source-domain">({source.source})</span>
                            </div>
                        ))}
                        {sources.length > 5 && (
                            <div className="sources-more">
                                +{sources.length - 5} more sources
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MediaRenderer;
