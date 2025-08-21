// client/src/components/Sidebar.js
import React from 'react';
// Using the same icon library as your ChatPage for consistency
import { FiMessageSquare, FiDatabase, FiHelpCircle, FiCode, FiLayout } from 'react-icons/fi';
import { BsMicFill } from 'react-icons/bs';
import './Sidebar.css'; // We will create/update this file

const Sidebar = ({
    currentView,
    setCurrentView,
    openCompilerModal,
    openQuizModal
}) => {

    // Helper for a clean, icon-only button
    const NavIconButton = ({ viewName, icon, label, onClick }) => (
        <button
            className={`sidebar-icon-button ${currentView === viewName ? 'active' : ''}`}
            onClick={onClick}
            title={label}
        >
            {icon}
        </button>
    );

    // In client/src/components/Sidebar.js
    return (
        <div className="sidebar-icon-nav">
            <div className="sidebar-nav-group-top">
                {/* These buttons change the main view in MainLayout */}
                <NavIconButton viewName="chat" icon={<FiMessageSquare size={24} />} label="Chat" onClick={() => setCurrentView('chat')} />
                <NavIconButton viewName="files" icon={<FiDatabase size={24} />} label="Data Sources" onClick={() => setCurrentView('files')} />
                <NavIconButton viewName="podcast" icon={<BsMicFill size={24} />} label="Podcast Generator" onClick={() => setCurrentView('podcast')} />
                <NavIconButton icon={<FiHelpCircle size={24} />} label="Interactive Quiz" onClick={openQuizModal} />
                <NavIconButton icon={<FiCode size={24} />} label="Code Compiler" onClick={openCompilerModal} />
                
                {/* THIS IS THE NEW, CORRECTLY PLACED BUTTON */}
                <NavIconButton 
                    viewName="ppt" 
                    icon={<FiLayout size={24} />} 
                    label="AI Presentation Generator" 
                    onClick={() => setCurrentView('ppt')} 
                />
            </div>
        </div>
    );
};

export default Sidebar;