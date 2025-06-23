// client/src/components/SettingsPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserSettings, saveUserSettings } from '../services/api';

// ==================================================================
//  START OF MODIFICATION: Import the main stylesheet
// ==================================================================
// We no longer need a dedicated CSS file. We will use the shared styles.
// import './SettingsPage.css';
import './ChatPage.css'; // This ensures the form styles are available
// ==================================================================
//  END OF MODIFICATION
// ==================================================================


const SettingsPage = () => {
    // The component's internal logic remains the same.
    const [settings, setSettings] = useState({ geminiApiKey: '', grokApiKey: '', ollamaHost: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await getUserSettings();
                setSettings({
                    geminiApiKey: response.data.geminiApiKey || '',
                    grokApiKey: response.data.grokApiKey || '',
                    ollamaHost: response.data.ollamaHost || ''
                });
            } catch (err) { setError('Failed to load your settings. Please try again later.'); } 
            finally { setLoading(false); }
        };
        fetchSettings();
    }, []);

    const handleChange = (e) => { setSettings({ ...settings, [e.target.name]: e.target.value }); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccessMessage('');
        try {
            await saveUserSettings(settings);
            setSuccessMessage('Settings saved successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="form-page-container"><p>Loading settings...</p></div>;
    }

    // ==================================================================
    //  START OF MODIFICATION: Use the shared, generic class names
    // ==================================================================
    return (
        <div className="form-page-container">
            <div className="form-box">
                <h2>User Settings</h2>
                <p className="form-sub-header">Manage your API keys and custom server configurations.</p>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="geminiApiKey">Gemini API Key</label>
                        <input id="geminiApiKey" name="geminiApiKey" type="password" value={settings.geminiApiKey} onChange={handleChange} placeholder="Enter your Gemini API Key" disabled={saving} />
                    </div>
                    <div className="input-group">
                        <label htmlFor="grokApiKey">Grok API Key</label>
                        <input id="grokApiKey" name="grokApiKey" type="password" value={settings.grokApiKey} onChange={handleChange} placeholder="Enter your Grok API Key" disabled={saving} />
                    </div>
                    <div className="input-group">
                        <label htmlFor="ollamaHost">Custom Ollama Host (Optional)</label>
                        <input id="ollamaHost" name="ollamaHost" type="text" value={settings.ollamaHost} onChange={handleChange} placeholder="e.g., http://192.168.1.100:11434" disabled={saving} />
                        <small className="input-hint">Leave blank to use the system default.</small>
                    </div>
                    
                    {error && <p className="error-message">{error}</p>}
                    {successMessage && <p className="success-message">{successMessage}</p>}
                    
                    <div className="form-actions">
                        <button type="button" onClick={() => navigate('/chat')} className="secondary-button" disabled={saving}>
                            Back to Chat
                        </button>
                        <button type="submit" disabled={saving} className="primary-button">
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
    // ==================================================================
    //  END OF MODIFICATION
    // ==================================================================
};

export default SettingsPage;