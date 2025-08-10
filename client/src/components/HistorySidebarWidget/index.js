// client/src/components/HistorySidebarWidget/index.js
import React, { useState, useEffect } from 'react';
import { getChatSessions, deleteChatSession } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';
import { FaTrash, FaSpinner } from 'react-icons/fa';
import './index.css';

const HistorySidebarWidget = ({ onLoadSession }) => {
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchSessions = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await getChatSessions();
            setSessions(response.data.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
        } catch (err) {
            setError('Failed to load history.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const handleDelete = async (e, sessionId, title) => {
        e.stopPropagation();
        if (window.confirm(`Delete the chat titled "${title}"?`)) {
            try {
                console.log('Deleting session:', sessionId);
                const response = await deleteChatSession(sessionId);
                console.log('Delete response:', response);
                setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
                console.log('Session deleted successfully');
            } catch (err) {
                console.error('Delete session error:', err);
                setError(`Failed to delete session: ${err.response?.data?.message || err.message}`);
            }
        }
    };

    const handleLoad = async (sessionId) => {
        // --- FIX: Pass only the sessionId string, not an object ---
        onLoadSession(sessionId);
    }

    return (
        <div className="history-widget">
            <h3>Chat History</h3>
            {isLoading && <div className="history-status"><FaSpinner className="spin" /> Loading...</div>}
            {error && <div className="history-status error">{error}</div>}
            {!isLoading && !error && (
                <ul className="history-list">
                    {sessions.length > 0 ? sessions.map(session => (
                        <li key={session.sessionId} onClick={() => handleLoad(session.sessionId)} className="history-item">
                            <div className="history-item-content">
                                <p className="history-title">{session.title}</p>
                                <p className="history-date">
                                    {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                                </p>
                            </div>
                            <button className="delete-btn" title="Delete" onClick={(e) => handleDelete(e, session.sessionId, session.title)}>
                                <FaTrash />
                            </button>
                        </li>
                    )) : <div className="history-status">No history found.</div>}
                </ul>
            )}
        </div>
    );
};

export default HistorySidebarWidget;