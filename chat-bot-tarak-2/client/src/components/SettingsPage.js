// client/src/components/SettingsPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserSettings, saveUserSettings } from '../services/api';
import './SettingsPage.css'; // Import the improved stylesheet

const SettingsPage = () => {
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

    // --- MODIFICATION START: API Key validation function is now active ---
    const validateApiKey = (key, serviceName) => {
        // Groq keys start with 'gsk_'. This is a more specific check.
        if (serviceName === 'Grok' && !key.startsWith('gsk_')) {
            return false;
        }
        // General check for length and characters.
        return /^[A-Za-z0-9_]{20,}$/.test(key);
    };
    // --- MODIFICATION END ---

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccessMessage('');

        // --- MODIFICATION START: Client-side validation is now enabled ---
        if (settings.geminiApiKey && !validateApiKey(settings.geminiApiKey, 'Gemini')) {
            setError('Invalid Gemini API Key format. Please check your key.');
            setSaving(false);
            return;
        }
        if (settings.grokApiKey && !validateApiKey(settings.grokApiKey, 'Grok')) {
            setError('Invalid Groq API Key format. It should start with "gsk_".');
            setSaving(false);
            return;
        }
        // --- MODIFICATION END ---

        try {
            await saveUserSettings(settings);
            // This part is correct and should remain.
            localStorage.setItem('userApiKeys', JSON.stringify({
                gemini: settings.geminiApiKey,
                groq: settings.grokApiKey,
                ollama_host: settings.ollamaHost
            }));
            setSuccessMessage('Settings saved successfully!');
            setTimeout(() => setSuccessMessage(''), 3000); // Message disappears after 3s
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="settings-page-container"><p>Loading settings...</p></div>;
    }

    // --- MODIFICATION START: Updated JSX with correct class names ---
    return (
        <div className="settings-page-container">
            <div className="settings-form-box">
                <h2>User Settings</h2>
                <p className="form-sub-header">Manage your API keys and custom server configurations.</p>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="geminiApiKey">Gemini API Key</label>
                        <input id="geminiApiKey" name="geminiApiKey" type="password" value={settings.geminiApiKey} onChange={handleChange} placeholder="Enter your Gemini API Key" disabled={saving} />
                    </div>
                    <div className="input-group">
                        <label htmlFor="grokApiKey">Grok API Key</label>
                        <input id="grokApiKey" name="grokApiKey" type="password" value={settings.grokApiKey} onChange={handleChange} placeholder="Enter your Groq API Key (starts with gsk_)" disabled={saving} />
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
    // --- MODIFICATION END ---
};

export default SettingsPage;