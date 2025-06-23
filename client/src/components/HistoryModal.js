// client/src/components/HistoryModal.js
import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { getChatSessions, getSessionDetails, deleteChatSession } from '../services/api';
import { FiX, FiLoader, FiMessageSquare, FiTrash2 } from 'react-icons/fi';

// ===================================================================================
//  UI Sub-Components (for a clean, modular structure)
// ===================================================================================

const Placeholder = ({ icon, text, isLoading = false }) => (
    <div className="history-placeholder">
        {isLoading
            ? <FiLoader className="icon loading-icon" />
            : icon
        }
        <span>{text}</span>
    </div>
);

const MessageBubble = ({ msg }) => (
    <div className={`history-message ${msg.role}`}>
        <div className="history-message-content-wrapper">
            <p className="history-message-sender-name">{msg.role === 'user' ? 'You' : 'Assistant'}</p>
            <div className="history-message-text">
                <ReactMarkdown>{msg.parts?.[0]?.text || '[Empty Message]'}</ReactMarkdown>
            </div>
        </div>
    </div>
);

const SessionDetails = ({ session, isLoading, onDelete }) => {
    if (isLoading) {
        return <Placeholder icon={<FiLoader />} text="Loading details..." isLoading={true} />;
    }
    if (!session) {
        return <Placeholder icon={<FiMessageSquare className="icon" />} text="Select a session to view its contents." />;
    }

    return (
        <div className="history-session-details">
            <div className="history-session-details-header">
                <h4>Session Details</h4>
                <button
                    className="history-action-btn delete"
                    onClick={() => onDelete(session.sessionId)}
                    title="Delete this chat session"
                >
                    <FiTrash2 size={16} /> Delete Session
                </button>
            </div>
            <div className="history-messages-container">
                <div className="history-messages-area">
                    {session.messages?.map((msg, index) => (
                        <MessageBubble key={`${session.sessionId}-${index}`} msg={msg} />
                    ))}
                </div>
            </div>
        </div>
    );
};

const SessionItem = ({ session, isActive, onSelect, formatDate }) => (
    <li
        className={isActive ? 'active' : ''}
        onClick={() => onSelect(session.sessionId)}
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(session.sessionId)}
        role="button"
    >
        <div className="session-preview" title={session.preview || 'Chat session'}>
            {session.preview || 'Chat session'}
        </div>
        <div className="session-date">
            {formatDate(session.updatedAt || session.createdAt)} ({session.messageCount || 0} msgs)
        </div>
    </li>
);

const SessionList = ({ sessions, isLoading, selectedSessionId, onSelect, formatDate }) => (
    <div className="history-session-list">
        <div className="history-session-list-header">Sessions</div>
        {isLoading ? (
            <Placeholder text="Loading sessions..." />
        ) : sessions.length > 0 ? (
            <ul>
                {sessions.map((session) => (
                    <SessionItem
                        key={session.sessionId}
                        session={session}
                        isActive={selectedSessionId === session.sessionId}
                        onSelect={onSelect}
                        formatDate={formatDate}
                    />
                ))}
            </ul>
        ) : (
            <Placeholder text="No past sessions found." />
        )}
    </div>
);

// ===================================================================================
//  Main HistoryModal Component (State & Logic Orchestrator)
// ===================================================================================

const HistoryModal = ({ isOpen, onClose, onSessionSelect }) => {
    // --- State Management ---
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [isLoadingSessions, setIsLoadingSessions] = useState(true);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [error, setError] = useState('');

    // --- Data Fetching and Lifecycle ---
    const fetchSessions = useCallback(async () => {
        if (!localStorage.getItem('userId')) {
            setError('Cannot load history: User not logged in.');
            return;
        }
        setIsLoadingSessions(true);
        setError('');
        try {
            const response = await getChatSessions();
            setSessions(response.data || []);
        } catch (err) {
            setError('Failed to load chat history.');
            console.error("HistoryModal: Error fetching sessions:", err);
            if (err.response?.status === 401) onClose(); // Auto-close on auth error
        } finally {
            setIsLoadingSessions(false);
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            fetchSessions();
        } else {
            // Reset state when modal is closed to ensure a clean slate on reopen
            setSessions([]);
            setSelectedSession(null);
            setError('');
            setIsLoadingSessions(false);
            setIsLoadingDetails(false);
        }
    }, [isOpen, fetchSessions]);

    // --- Event Handlers ---
    const handleSelectSession = useCallback(async (sessionId) => {
        if (!sessionId || isLoadingDetails || selectedSession?.sessionId === sessionId) return;

        setIsLoadingDetails(true);
        setError('');
        try {
            const response = await getSessionDetails(sessionId);
            setSelectedSession(response.data);
            if (onSessionSelect) {
                onSessionSelect(response.data);
            }
        } catch (err) {
            setError('Failed to load session details.');
            setSelectedSession(null);
            console.error(`HistoryModal: Error fetching session ${sessionId}:`, err);
            if (err.response?.status === 401) onClose(); // Auto-close on auth error
        } finally {
            setIsLoadingDetails(false);
        }
    }, [isLoadingDetails, selectedSession, onClose, onSessionSelect]);

    const handleDeleteSession = useCallback(async (sessionIdToDelete) => {
        if (!sessionIdToDelete || !window.confirm("Are you sure you want to permanently delete this chat history?")) return;
        
        try {
            await deleteChatSession(sessionIdToDelete);
            // If the deleted session was the one being viewed, clear the view
            if (selectedSession?.sessionId === sessionIdToDelete) {
                setSelectedSession(null);
            }
            // Refetch the session list to show the change immediately
            fetchSessions();
        } catch (err) {
            setError('Failed to delete session.');
            console.error("HistoryModal: Error deleting session:", err);
        }
    }, [selectedSession, fetchSessions]);

    // --- Helper Functions ---
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) throw new Error("Invalid date");
            return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
        } catch {
            return dateString; // Fallback for invalid date formats
        }
    };

    if (!isOpen) return null;

    // --- Render ---
    return (
        <div className="history-modal-overlay" onClick={onClose}>
            <div className="history-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="history-modal-header">
                    <h3 className="history-modal-title">Chat History</h3>
                    <button className="history-modal-close-btn" onClick={onClose} title="Close"><FiX size={24} /></button>
                </div>

                {error && <div className="history-error">{error}</div>}

                <div className="history-layout">
                    <SessionList
                        sessions={sessions}
                        isLoading={isLoadingSessions}
                        selectedSessionId={selectedSession?.sessionId}
                        onSelect={handleSelectSession}
                        formatDate={formatDate}
                    />
                    <SessionDetails
                        session={selectedSession}
                        isLoading={isLoadingDetails}
                        onDelete={handleDeleteSession}
                    />
                </div>
            </div>
        </div>
    );
};

// ===================================================================================
//  CSS Injection
// ===================================================================================
const HistoryModalCSS = `
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleUp { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.history-modal-overlay { position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease-out; backdrop-filter: blur(4px); }
.history-modal-content { background-color: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-primary); border-radius: 12px; width: 90%; max-width: 1000px; height: 85vh; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(0,0,0,0.2); animation: scaleUp 0.2s ease-out; overflow: hidden; }
.history-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-primary); flex-shrink: 0; }
.history-modal-title { margin: 0; font-size: 1.2rem; font-weight: 600; }
.history-modal-close-btn { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 0.25rem; border-radius: 50%; display: flex; transition: all 0.2s ease; }
.history-modal-close-btn:hover { background-color: var(--bg-tertiary); color: var(--text-primary); }
.history-error { color: var(--error-color, #e53e3e); background-color: var(--error-bg, rgba(229, 62, 62, 0.1)); padding: 0.5rem 1.5rem; border-bottom: 1px solid var(--error-color); font-size: 0.9rem; text-align: center; }
.history-layout { display: grid; grid-template-columns: 300px 1fr; height: 100%; overflow: hidden; }
.history-session-list { display: flex; flex-direction: column; border-right: 1px solid var(--border-primary); overflow-y: auto; }
.history-session-list-header { padding: 1rem 1.5rem; font-size: 1rem; font-weight: 600; color: var(--text-primary); border-bottom: 1px solid var(--border-primary); flex-shrink: 0; }
.history-session-list ul { list-style: none; padding: 0.5rem; margin: 0; flex-grow: 1; overflow-y: auto; }
.history-session-list li { padding: 0.75rem 1rem; margin-bottom: 0.5rem; border-radius: 6px; cursor: pointer; transition: all 0.2s ease; border: 1px solid transparent; }
.history-session-list li:hover { background-color: var(--bg-tertiary); }
.history-session-list li.active { background-color: var(--accent-active); color: var(--text-on-accent); border-color: var(--accent-active); }
.history-session-list li.active .session-date { color: var(--text-on-accent); opacity: 0.8; }
.session-preview { font-size: 0.9rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.session-date { font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; }
.history-session-details { display: flex; flex-direction: column; overflow: hidden; }
.history-session-details-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-primary); flex-shrink: 0; }
.history-session-details-header h4 { margin: 0; font-size: 1rem; font-weight: 600; }
.history-action-btn { display: flex; align-items: center; gap: 8px; padding: 0.5rem 1rem; background-color: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-primary); border-radius: 6px; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.2s ease; }
.history-action-btn.delete:hover:not(:disabled) { background-color: var(--error-bg, #fee2e2); border-color: var(--error-color, #ef4444); color: var(--error-color, #ef4444); }
.history-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.history-messages-container { flex-grow: 1; overflow-y: auto; padding: 1.5rem; }
.history-messages-area { display: flex; flex-direction: column; gap: 1.5rem; }
.history-message { display: flex; max-width: 85%; }
.history-message.user { align-self: flex-end; }
.history-message.model { align-self: flex-start; }
.history-message-content-wrapper { padding: 0.75rem 1.25rem; border-radius: 12px; line-height: 1.6; }
.history-message.user .history-message-content-wrapper { background-color: var(--accent-active); color: var(--text-on-accent); border-bottom-right-radius: 4px; }
.history-message.model .history-message-content-wrapper { background-color: var(--bg-primary); border: 1px solid var(--border-primary); color: var(--text-primary); border-bottom-left-radius: 4px; }
.history-message-sender-name { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.25rem; opacity: 0.8; }
.history-message.user .history-message-sender-name { color: var(--text-on-accent); }
.history-message-text p:first-child { margin-top: 0; } .history-message-text p:last-child { margin-bottom: 0; }
.history-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); text-align: center; gap: 1rem; padding: 1rem; }
.history-placeholder .icon { font-size: 3rem; opacity: 0.5; }
.history-placeholder .loading-icon { animation: spin 1s linear infinite; }
`;

const styleTagHistoryId = 'history-modal-styles-v2';
if (!document.getElementById(styleTagHistoryId)) {
    const styleTag = document.createElement("style");
    styleTag.id = styleTagHistoryId;
    styleTag.innerText = HistoryModalCSS;
    document.head.appendChild(styleTag);
}

export default HistoryModal;