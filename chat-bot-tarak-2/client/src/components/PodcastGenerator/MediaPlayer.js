// client/src/components/PodcastGenerator/MediaPlayer.js
import React from 'react';

const MediaPlayer = ({ audioUrl, title, onPause, onPlay }) => {
    return (
        <div className="media-player-widget">
            <h3>{title}</h3>
            <audio
                controls
                src={audioUrl}
                onPause={onPause}
                onPlay={onPlay}
                style={{ width: '100%' }}
            >
                Your browser does not support the audio element.
            </audio>
        </div>
    );
};

export default MediaPlayer;