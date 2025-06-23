// client/src/components/AdminPanel.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminAccessRequests, processAdminRequest, getAcceptedUsers } from '../services/api';
import { FiUsers, FiCheck, FiX, FiLoader } from 'react-icons/fi';
import './AdminPanel.css'; // We will create this file next

const AdminPanel = () => {
    const [requests, setRequests] = useState([]);
    const [acceptedUsers, setAcceptedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processingId, setProcessingId] = useState(null); // To show spinner on specific row
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'accepted'
    const navigate = useNavigate();

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await getAdminAccessRequests();
            setRequests(response.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch access requests.');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAcceptedUsers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await getAcceptedUsers();
            setAcceptedUsers(response.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch accepted users.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'pending') {
            fetchRequests();
        } else {
            fetchAcceptedUsers();
        }
    }, [activeTab, fetchRequests, fetchAcceptedUsers]);

    const handleProcessRequest = async (userId, isApproved) => {
        setProcessingId(userId); // Show spinner on this specific user's row
        try {
            await processAdminRequest(userId, isApproved);
            // On success, remove the user from the list to update the UI
            setRequests(prevRequests => prevRequests.filter(req => req._id !== userId));
        } catch (err) {
            setError(err.response?.data?.message || `Failed to ${isApproved ? 'approve' : 'deny'} request.`);
        } finally {
            setProcessingId(null); // Hide spinner
        }
    };

    return (
        <div className="admin-panel-container">
            <div className="admin-panel-box">
                <div className="admin-panel-header">
                    <FiUsers size={28} />
                    <h2>Admin Panel: API Access Requests</h2>
                </div>
                {/* Tab Buttons */}
                <div className="admin-tabs" style={{ display: 'flex', borderBottom: '1px solid #ccc', marginBottom: 20 }}>
                    <button
                        className={activeTab === 'pending' ? 'admin-tab active' : 'admin-tab'}
                        style={{ flex: 1, padding: '10px', border: 'none', borderBottom: activeTab === 'pending' ? '3px solid #f5a623' : 'none', background: 'none', fontWeight: activeTab === 'pending' ? 'bold' : 'normal', cursor: 'pointer' }}
                        onClick={() => setActiveTab('pending')}
                    >
                        Pending Responses
                    </button>
                    <button
                        className={activeTab === 'accepted' ? 'admin-tab active' : 'admin-tab'}
                        style={{ flex: 1, padding: '10px', border: 'none', borderBottom: activeTab === 'accepted' ? '3px solid #f5a623' : 'none', background: 'none', fontWeight: activeTab === 'accepted' ? 'bold' : 'normal', cursor: 'pointer' }}
                        onClick={() => setActiveTab('accepted')}
                    >
                        Accepted Responses/Users
                    </button>
                </div>
                {error && <p className="admin-error-message">{error}</p>}
                <div className="requests-list-container">
                    {loading ? (
                        <p>Loading...</p>
                    ) : activeTab === 'pending' ? (
                        requests.length === 0 ? (
                            <p className="no-requests-message">There are no pending requests.</p>
                        ) : (
                            <ul className="requests-list">
                                {requests.map(request => (
                                    <li key={request._id} className="request-item">
                                        <div className="request-info">
                                            <span className="username">{request.username}</span>
                                            <span className="request-date">
                                                Requested on: {new Date(request.apiKeyAccessRequest.requestedAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="request-actions">
                                            {processingId === request._id ? (
                                                <FiLoader className="spinner" size={20} />
                                            ) : (
                                                <>
                                                    <button 
                                                        className="action-button deny" 
                                                        title="Deny Access"
                                                        onClick={() => handleProcessRequest(request._id, false)}
                                                    >
                                                        <FiX size={18} />
                                                    </button>
                                                    <button 
                                                        className="action-button approve" 
                                                        title="Approve Access"
                                                        onClick={() => handleProcessRequest(request._id, true)}
                                                    >
                                                        <FiCheck size={18} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )
                    ) : (
                        acceptedUsers.length === 0 ? (
                            <p className="no-requests-message">No users have been accepted yet.</p>
                        ) : (
                            <ul className="requests-list">
                                {acceptedUsers.map(user => (
                                    <li key={user._id} className="request-item">
                                        <div className="request-info">
                                            <span className="username">{user.username}</span>
                                            <span className="request-date">
                                                Accepted on: {user.apiKeyAccessRequest?.processedAt ? new Date(user.apiKeyAccessRequest.processedAt).toLocaleString() : 'N/A'}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )
                    )}
                </div>
                <div className="admin-panel-footer">
                    <button onClick={() => navigate('/chat')} className="secondary-button">
                        Back to Chat
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;