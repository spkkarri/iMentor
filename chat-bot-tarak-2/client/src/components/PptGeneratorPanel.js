// client/src/components/PptGeneratorPanel.js
import React, { useState } from 'react';
import './PptGeneratorPanel.css'; // We will create this CSS file next

const PptGeneratorPanel = ({ onGenerate, isGenerating }) => {
    const [topic, setTopic] = useState('');
    const [context, setContext] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!topic.trim() || isGenerating) return;
        onGenerate({ topic, context });
    };

    return (
        <div className="sidebar-panel ppt-generator-panel">
            <h3 className="sidebar-header">Presentation Generator</h3>
            <form onSubmit={handleSubmit} className="ppt-form">
                <div className="form-group">
                    <label htmlFor="ppt-topic">Topic</label>
                    <input
                        id="ppt-topic"
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g., Introduction to Quantum Computing"
                        required
                        disabled={isGenerating}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="ppt-context">Additional Context (Optional)</label>
                    <textarea
                        id="ppt-context"
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        placeholder="Provide key points, target audience, or specific data to include..."
                        rows="6"
                        disabled={isGenerating}
                    />
                </div>
                <button type="submit" className="generate-ppt-button" disabled={isGenerating || !topic.trim()}>
                    {isGenerating ? 'Generating...' : 'Generate PPT'}
                </button>
            </form>
        </div>
    );
};

export default PptGeneratorPanel;