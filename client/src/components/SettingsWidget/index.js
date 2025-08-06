// client/src/components/SettingsWidget/index.js
import React from 'react';
import SystemPromptWidget from '../SystemPromptWidget';
import MemoryWidget from '../MemoryWidget';
import { Box, Typography, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const SettingsWidget = (props) => {
    const theme = useTheme();
    return (
        <Paper elevation={3} sx={{ p: 3, borderRadius: '12px', bgcolor: 'background.paper', border: `1px solid ${theme.palette.grey[200]}` }}>
            <Typography variant="h5" component="h3" sx={{ mb: 3, color: 'text.primary', fontWeight: 600, borderBottom: `1px solid ${theme.palette.grey[100]}`, pb: 1.5 }}>
                Settings
            </Typography>
            {/* SystemPromptWidget is already styled consistently */}
            <SystemPromptWidget {...props} />
            {/* MemoryWidget is also styled consistently */}
            <MemoryWidget />
        </Paper>
    );
};

export default SettingsWidget;
```css
/* client/src/components/SettingsWidget/index.css */

/* --- Root Variables (for consistency with MUI theme) --- */
/* These are for reference. The MUI theme in App.js is the primary source of truth. */
/* Rely on the theme propagation or use specific hex values that match the theme. */
:root {
    --bg-color: #131314; /* background.default */
    --surface-color: #1e1f20; /* background.paper */
    --primary-text-color: #e3e3e3; /* text.primary */
    --secondary-text-color: #9aa0a6; /* text.secondary */
    --primary-main: #8ab4f8; /* primary.main */
    --primary-dark: #6a9bf8; /* primary.dark */
    --grey-100: #202124; /* grey[100] */
    --grey-200: #3c4043; /* grey[200] */
    --grey-700: #424242; /* grey[700] */
    --grey-800: #2c2c2c; /* grey[800] */
    --grey-900: #212121; /* grey[900] */
    --success-main: #4caf50; /* success.main */
    --success-dark: #388e3c; /* success.dark */
    --error-main: #f44336; /* error.main */
    --error-dark: #d32f2f; /* error.dark */
    --warning-main: #ff9800; /* warning.main */
    --warning-dark: #f57c00; /* warning.dark */
    --info-main: #2196f3; /* info.main */
    --info-dark: #1976d2; /* info.dark */
    --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
}

/* SettingsWidget container - now MUI Paper */
.settings-widget {
    /* Styles are now primarily managed by the MUI Paper component in SettingsWidget.js */
}

/* Heading - now MUI Typography */
.settings-widget h3 {
    /* Styles are now handled by MUI Typography */
}
