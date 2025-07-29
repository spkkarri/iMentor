// client/src/components/SettingsWidget/index.js
import React from 'react';
import SystemPromptWidget from '../SystemPromptWidget';
import MemoryWidget from '../MemoryWidget'; // <-- Import the new widget
import './index.css'; // <-- Import CSS for styling

const SettingsWidget = (props) => {
    return (
        <div className="settings-widget">
            <h3>Settings</h3>
            <SystemPromptWidget {...props} />
            {/* --- INSERTION: Add the MemoryWidget below the prompt settings --- */}
            <MemoryWidget />
        </div>
    );
};

export default SettingsWidget;