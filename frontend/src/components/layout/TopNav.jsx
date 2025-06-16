// frontend/src/components/layout/TopNav.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import ThemeToggle from '../common/ThemeToggle.jsx';
import LLMSelectionModal from './LLMSelectionModal.jsx';
import ProfileSettingsModal from '../profile/ProfileSettingsModal.jsx';
import { 
    LogOut, User, MessageSquare, History as HistoryIcon, Settings, Cpu, Zap, ServerCrash, Server 
} from 'lucide-react';
import toast from 'react-hot-toast';

function TopNav({ user: authUser, onLogout, onNewChat, onHistoryClick, orchestratorStatus }) {
    const { selectedLLM, switchLLM } = useAppState();
    const [isLLMModalOpen, setIsLLMModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const profileDropdownRef = useRef(null);

    const getStatusIndicator = () => {
        if (!orchestratorStatus) return <div title="Status unavailable" className="w-4 h-4 bg-gray-400 rounded-full"></div>;
        if (orchestratorStatus.status === "ok") {
            return <Zap size={18} className="text-green-400 animate-pulse" title={`Backend Online: ${orchestratorStatus.message}`} />;
        } else if (orchestratorStatus.status === "loading") {
            return <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-yellow-400" title="Connecting..."></div>;
        } else {
            return <ServerCrash size={18} className="text-red-400" title={`Backend Offline: ${orchestratorStatus.message}`} />;
        }
    };
    
    useEffect(() => {
        function handleClickOutside(event) {
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
                setIsProfileDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [profileDropdownRef]);

    return (
        <>
            <nav className="fixed top-0 left-0 right-0 z-40 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark shadow-sm h-16 flex items-center justify-between px-2 sm:px-4">
                <div className="flex items-center gap-2">
                    <a href="/" className="flex items-center gap-1.5 sm:gap-2 text-lg sm:text-xl font-semibold text-text-light dark:text-text-dark">
                        <Server size={24} className="text-primary dark:text-primary-light" />
                        <span className="hidden sm:inline">AI Tutor</span>
                    </a>
                </div>

                <div className="flex-1 flex justify-center px-2">
                    <div className="flex items-center gap-1 sm:gap-2">
                         <button
                            onClick={onNewChat}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs sm:text-sm font-medium rounded-md text-text-light dark:text-text-dark bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="Start a new chat session"
                        >
                            <MessageSquare size={14} /> <span className="hidden sm:inline">New Chat</span>
                        </button>
                        <button
                            onClick={onHistoryClick}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs sm:text-sm font-medium rounded-md text-text-light dark:text-text-dark bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="View chat history"
                        >
                            <HistoryIcon size={14} /> <span className="hidden sm:inline">History</span>
                        </button>
                        <button
                            onClick={() => setIsLLMModalOpen(true)}
                            className="flex items-center gap-1 px-2 py-1.5 text-xs sm:text-sm font-medium rounded-md text-text-light dark:text-text-dark bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title={`Switch LLM (Current: ${selectedLLM.toUpperCase()})`}
                        >
                            <Cpu size={14} /> <span className="hidden xs:inline">{selectedLLM.toUpperCase()}</span>
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* --- FIX: Added a fixed-size wrapper div for the status indicator --- */}
                    <div className="w-8 h-8 flex items-center justify-center">
                        {getStatusIndicator()}
                    </div>
                    <ThemeToggle />
                    <div className="relative" ref={profileDropdownRef}>
                        <button 
                            onClick={() => setIsProfileDropdownOpen(prev => !prev)}
                            className="p-1.5 bg-primary-light dark:bg-primary-dark text-white rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-light dark:focus:ring-offset-surface-dark focus:ring-primary"
                        >
                            <User size={18} />
                        </button>
                        <div 
                            className={`absolute right-0 mt-2 w-48 bg-surface-light dark:bg-surface-dark rounded-md shadow-lg py-1 transition-all duration-150 ease-in-out transform origin-top-right z-50
                                ${isProfileDropdownOpen 
                                    ? 'opacity-100 scale-100 visible' 
                                    : 'opacity-0 scale-95 invisible'
                                }`
                            }
                        >
                            <div className="px-4 py-2 text-sm text-text-light dark:text-text-dark border-b border-border-light dark:border-border-dark">
                                Signed in as <br/><strong>{authUser?.username || 'User'}</strong>
                            </div>
                            <button
                                onClick={() => { setIsProfileModalOpen(true); setIsProfileDropdownOpen(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                                <Settings size={16} /> Profile
                            </button>
                            <button
                                onClick={() => { onLogout(); setIsProfileDropdownOpen(false); }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 flex items-center gap-2"
                            >
                                <LogOut size={16} /> Logout
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
            <LLMSelectionModal 
                isOpen={isLLMModalOpen} 
                onClose={() => setIsLLMModalOpen(false)} 
                currentLLM={selectedLLM}
                onSelectLLM={(llm) => {
                    switchLLM(llm);
                    setIsLLMModalOpen(false);
                }}
            />
            <ProfileSettingsModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
            />
        </>
    );
}
export default TopNav;