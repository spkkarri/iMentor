// client/src/components/SettingsWidget/index.js
import React from 'react';
import SystemPromptWidget from '../SystemPromptWidget'; // Assuming this component exists

const SettingsWidget = (props) => {
    return (
        <div>
            <h3>Settings</h3>
            <SystemPromptWidget {...props} />
            {/* You can add more settings here in the future */}
        </div>
    );
};

export default SettingsWidget;