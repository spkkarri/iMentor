// client/src/components/PodcastGenerator/QnAWidget.js
import React, { useState } from 'react';

const QnAWidget = ({ onAsk, isAsking, answer }) => {
    const [question, setQuestion] = useState('');

    const handleAskClick = () => {
        if (question.trim()) {
            onAsk(question);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAskClick();
        }
    };

    return (
        <div className="qna-widget">
            <h4>Ask a Question About the Podcast</h4>
            <div className="qna-input-area">
                <textarea
                    placeholder="Type your question here... (Press Enter to ask)"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isAsking}
                />
                <button onClick={handleAskClick} disabled={isAsking}>
                    {isAsking ? '...' : 'Ask'}
                </button>
            </div>
            {answer && (
                <div className="qna-answer-area">
                    <strong>Answer:</strong>
                    <p>{answer}</p>
                </div>
            )}
        </div>
    );
};

export default QnAWidget;