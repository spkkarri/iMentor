// src/components/QuotaStatus.js
import React, { useState, useEffect } from 'react';
import { getQuotaStatus } from '../services/api';
import './QuotaStatus.css';

const QuotaStatus = () => {
    const [quotaData, setQuotaData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchQuotaStatus = async () => {
        try {
            setLoading(true);
            const response = await getQuotaStatus();
            if (response.data.success) {
                setQuotaData(response.data.quota);
                setError(null);
            } else {
                setError('Failed to fetch quota status');
            }
        } catch (err) {
            console.error('Error fetching quota status:', err);
            setError('Unable to fetch quota status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuotaStatus();
        // Refresh quota status every 5 minutes
        const interval = setInterval(fetchQuotaStatus, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="quota-status loading">
                <div className="quota-spinner"></div>
                <span>Loading quota...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="quota-status error">
                <span>⚠️ {error}</span>
            </div>
        );
    }

    if (!quotaData) {
        return null;
    }

    const getStatusColor = () => {
        if (quotaData.quotaExceeded) return 'red';
        if (quotaData.percentUsed >= 90) return 'orange';
        if (quotaData.percentUsed >= 75) return 'yellow';
        return 'green';
    };

    const getStatusIcon = () => {
        if (quotaData.quotaExceeded) return '🚫';
        if (quotaData.percentUsed >= 90) return '⚠️';
        if (quotaData.percentUsed >= 75) return '📊';
        return '✅';
    };

    const getStatusText = () => {
        if (quotaData.quotaExceeded) {
            return `Quota Exceeded (${quotaData.requests}/${quotaData.limit})`;
        }
        return `API Usage: ${quotaData.requests}/${quotaData.limit} (${quotaData.percentUsed}%)`;
    };

    return (
        <div className={`quota-status ${getStatusColor()}`}>
            <div className="quota-header">
                <span className="quota-icon">{getStatusIcon()}</span>
                <span className="quota-text">{getStatusText()}</span>
            </div>
            
            <div className="quota-bar">
                <div 
                    className="quota-fill" 
                    style={{ 
                        width: `${Math.min(quotaData.percentUsed, 100)}%`,
                        backgroundColor: getStatusColor() === 'red' ? '#ff4444' :
                                       getStatusColor() === 'orange' ? '#ff8800' :
                                       getStatusColor() === 'yellow' ? '#ffaa00' : '#44aa44'
                    }}
                ></div>
            </div>

            <div className="quota-details">
                <div className="quota-remaining">
                    Remaining: {quotaData.remaining} requests
                </div>
                {quotaData.quotaExceeded && (
                    <div className="quota-reset">
                        Resets in: {quotaData.timeUntilReset}
                    </div>
                )}
                {quotaData.warning && (
                    <div className="quota-warning">
                        {quotaData.warning}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuotaStatus;
