// client/src/components/ActivityBar.js

import React from 'react';
// Import the icons you want to use. 'Slideshow' is added for the presentation feature.
import { QuestionAnswer, Code, Mic, Slideshow } from '@mui/icons-material'; // Or your preferred icons
import './ActivityBar.css';

// The props now include onPptClick for the new presentation generation feature.
const ActivityBar = ({ onQuizClick, onCompilerClick, onPodcastClick, onPptClick }) => {
    return (
        <div className="activity-bar">
            {/* Your existing icons */}
            <button onClick={onQuizClick} className="activity-bar-button" title="Start a Quiz">
                <QuestionAnswer />
            </button>
            <button onClick={onCompilerClick} className="activity-bar-button" title="Open Compiler">
                <Code />
            </button>
            
            <button onClick={onPodcastClick} className="activity-bar-button" title="AI Podcast Generator">
                <Mic />
            </button>

            {/* THIS IS THE NEW ICON BUTTON FOR PPT GENERATION */}
            <button onClick={onPptClick} className="activity-bar-button" title="AI Presentation Generator">
                <Slideshow />
            </button>
        </div>
    );
};

export default ActivityBar;