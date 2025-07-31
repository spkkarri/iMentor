// src/components/SystemPromptWidget/index.js
import React from 'react';
import { availablePrompts } from '../../utils/prompts'; // CORRECTED PATH
import './index.css'; // CORRECTED PATH

const SystemPromptWidget = ({ selectedPromptId, promptText, onSelectChange, onTextChange }) => {
    return (
        <div className="system-prompt-widget">
            <h4>Assistant Mode</h4>
            <div className="prompt-select-container">
                <select 
                    value={selectedPromptId} 
                    onChange={(e) => onSelectChange(e.target.value)}
                    className="prompt-select"
                >
                    {availablePrompts.map(p => (
                        // Use the 'label' from your prompts.js file
                        <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                    {/* Add a custom option if the text doesn't match a preset */}
                    {!availablePrompts.find(p => p.id === selectedPromptId) && (
                        <option value="custom" disabled>Custom</option>
                    )}
                </select>
            </div>
            <textarea
                className="prompt-textarea"
                value={promptText}
                onChange={(e) => onTextChange(e.target.value)}
                rows={6}
                placeholder="Describe how the assistant should behave..."
            />
        </div>
    );
};

// Export the getPromptTextById function
export { getPromptTextById } from '../../utils/prompts';

export default SystemPromptWidget;
