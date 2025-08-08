// client/src/components/ChatSidebar.js
import React from 'react';
import {
  Box, Button, Typography, IconButton, Divider, Tooltip, List, ListItem, ListItemButton, ListItemIcon, ListItemText
} from '@mui/material';
import {
    Menu as MenuIcon, AddComment as AddCommentIcon, History as HistoryIcon,
    Logout as LogoutIcon, Settings as SettingsIcon, AccountCircle as AccountCircleIcon
} from '@mui/icons-material';
import ModelSwitcher from './ModelSwitcher';

const ChatSidebar = ({
  isSidebarOpen,
  toggleSidebar,
  handleNewChat,
  handleLogout,
  selectedModel,
  onModelChange,
  userId
}) => {
  const username = localStorage.getItem('username') || 'User';

  return (
    <Box className={`sidebar ${isSidebarOpen ? '' : 'collapsed'}`}>
      <Box className="sidebar-header">
        {isSidebarOpen && (
          <Typography variant="h6" sx={{ flexGrow: 1, whiteSpace: 'nowrap' }}>
            Engineering Tutor
          </Typography>
        )}
        <Tooltip title={isSidebarOpen ? "Collapse Menu" : "Expand Menu"}>
          <IconButton onClick={toggleSidebar}>
            <MenuIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Tooltip title="New Chat" placement="right">
          <Button
            variant="contained"
            onClick={handleNewChat}
            startIcon={<AddCommentIcon />}
            sx={{
              mb: 2,
              justifyContent: isSidebarOpen ? 'flex-start' : 'center',
              px: isSidebarOpen ? 2 : 1,
              minWidth: 'auto'
            }}
          >
            {isSidebarOpen && "New Chat"}
          </Button>
      </Tooltip>

      <Divider sx={{ my: 1 }} />

      {/* Model Switcher */}
      <ModelSwitcher
        selectedModel={selectedModel}
        onModelChange={onModelChange}
        isSidebarOpen={isSidebarOpen}
        userId={userId}
      />

      <Box className="sidebar-content">
        {/* All the widgets like FileManager, FileUpload will go here */}
        <Typography variant="caption" sx={{ pl: 2, display: isSidebarOpen ? 'block' : 'none' }}>
            Widgets for files, prompts, etc. would go here.
        </Typography>
      </Box>

      <Box className="sidebar-footer">
        <List>
          <ListItem disablePadding>
            <ListItemButton>
              <ListItemIcon sx={{ minWidth: '40px' }}><HistoryIcon /></ListItemIcon>
              {isSidebarOpen && <ListItemText primary="History" />}
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton>
              <ListItemIcon sx={{ minWidth: '40px' }}><SettingsIcon /></ListItemIcon>
              {isSidebarOpen && <ListItemText primary="Settings" />}
            </ListItemButton>
          </ListItem>
           <ListItem disablePadding>
            <ListItemButton onClick={handleLogout}>
              <ListItemIcon sx={{ minWidth: '40px' }}><LogoutIcon /></ListItemIcon>
              {isSidebarOpen && <ListItemText primary="Logout" />}
            </ListItemButton>
          </ListItem>
           <Divider sx={{ my: 1 }} />
           <ListItem disablePadding>
            <ListItemButton>
              <ListItemIcon sx={{ minWidth: '40px' }}><AccountCircleIcon /></ListItemIcon>
              {isSidebarOpen && <ListItemText primary={username} />}
            </ListItemButton>
          </ListItem>
        </List>
      </Box>
    </Box>
  );
};

export default ChatSidebar;