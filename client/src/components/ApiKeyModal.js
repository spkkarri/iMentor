// client/src/components/ApiKeyModal.js
import React, { useState } from 'react';
import './ApiKeyModal.css';

// This component is now a "dumb" component. It only manages its own form state
// and calls the onComplete prop with the user's choices.
const ApiKeyModal = ({ username, onComplete }) => {
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [grokApiKey, setGrokApiKey] = useState('');
    const [ollamaHost, setOllamaHost] = useState('');
    const [requestAdminAccess, setRequestAdminAccess] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAction = async (isSkipping) => {
        setLoading(true);
        setError('');
        try {
            let dataToSend = {};
            if (isSkipping) {
                // If skipping, send the checkbox status.
                dataToSend = { skip: true, requestAccess: requestAdminAccess };
            } else {
                // If saving, validate and send the keys.
                if (!geminiApiKey.trim() || !grokApiKey.trim()) {
                    setError('Please provide both Gemini and Grok API keys to save.');
                    setLoading(false);
                    return;
                }
                dataToSend = { geminiApiKey, grokApiKey, ollamaHost, skip: false };
            }
            // The onComplete prop (which is handleApiKeyStepCompletion in AuthPage) will now do the work.
            console.log('ApiKeyModal dataToSend:', dataToSend); // Debug print before sending
            // If ollamaHost is an empty string, remove it from dataToSend
            if (dataToSend.ollamaHost === '') {
                delete dataToSend.ollamaHost;
            }
            await onComplete(dataToSend);
        } catch (err) {
            // Display the error passed up from the parent component.
            setError(err.message || 'An unexpected error occurred.');
            setLoading(false);
        }
        // Don't set loading to false here, as the parent will navigate away on success.
    };

    return (
        <div className="auth-box"> 
            <h2>Welcome, {username}!</h2>
            <p className="auth-sub-header">To use the AI, provide your keys or request access from an admin.</p>
            
            <form onSubmit={(e) => { e.preventDefault(); handleAction(false); }}>
                <div className="input-group">
                    <label htmlFor="gemini-key">
                        Gemini AI API Key
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="api-key-link">(Get API Key)</a>
                    </label>
                    <input id="gemini-key" type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} placeholder="Enter your Gemini API Key" disabled={loading} autoComplete="new-password" />
                </div>
                <div className="input-group">
                    <label htmlFor="grok-key">
                        Grok API Key
                        <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="api-key-link">(Get API Key)</a>
                    </label>
                    <input id="grok-key" type="password" value={grokApiKey} onChange={(e) => setGrokApiKey(e.target.value)} placeholder="Enter your Grok API Key" disabled={loading} autoComplete="new-password" />
                </div>
                <div className="input-group">
                    <label htmlFor="ollama-host">Ollama Server URL</label>
                    <input
                        id="ollama-host"
                        type="text"
                        value={ollamaHost}
                        onChange={(e) => setOllamaHost(e.target.value)}
                        placeholder="http://localhost:11434"
                        disabled={loading}
                        autoComplete="off"
                    />
                </div>
                {error && <p className="error-message">{error}</p>}
                <button type="submit" disabled={loading} className="auth-button full-width-button">
                    {loading ? 'Saving...' : 'Save and Continue'}
                </button>
            </form>

            <div className="divider-or">OR</div>

            <div className="skip-section">
                <div className="checkbox-group">
                    <input type="checkbox" id="request-access-checkbox" checked={requestAdminAccess} onChange={(e) => setRequestAdminAccess(e.target.checked)} disabled={loading} />
                    <label htmlFor="request-access-checkbox">Request API access from admin</label>
                </div>
                <button type="button" onClick={() => handleAction(true)} disabled={loading} className="secondary-button full-width-button">
                    Skip for now
                </button>
            </div>
        </div>
    );
};

export default ApiKeyModal;