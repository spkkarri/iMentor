// client/src/components/PodcastGenerator/PodcastHistory.js
import React from 'react';
import { PlayArrow, Delete } from '@mui/icons-material';
import './PodcastHistory.css';

const PodcastHistory = ({ history, onLoad, onDelete }) => {
    if (!history || history.length === 0) {
        return <div className="history-empty">No previously generated podcasts.</div>;
    }

    return (
        <div className="podcast-history">
            <h3 className="history-title">Your Previous Podcasts</h3>
            <ul className="history-list">
                {history.map(podcast => (
                    <li key={podcast._id} className="history-item">
                        <div className="history-item-info">
                            <span className="history-item-title">{podcast.title}</span>
                            <span className="history-item-date">
                                {new Date(podcast.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="history-item-actions">
                            <button onClick={() => onLoad(podcast)} className="action-btn load-btn" title="Load Podcast">
                                <PlayArrow />
                            </button>
                            <button onClick={() => onDelete(podcast._id)} className="action-btn delete-btn" title="Delete Podcast">
                                <Delete />
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default PodcastHistory;