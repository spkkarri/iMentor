import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// ✅ 1. IMPORT THE getUserSettings FUNCTION
import { signinUser, signupUser, saveUserSettings, requestAdminKeyAccess, getUserSettings } from '../services/api';
import ApiKeyModal from './ApiKeyModal';

/**
 * Manages user authentication (Sign In/Sign Up) and the initial API key setup flow.
 *
 * @param {object} props - The component props.
 * @param {function} props.setIsAuthenticated - Function to update the authentication state in the parent component.
 */
const AuthPage = ({ setIsAuthenticated }) => {
    // --- State Management ---
    const [currentStep, setCurrentStep] = useState('auth'); // 'auth' or 'apiKeys'
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    /**
     * Handles the initial Sign In or Sign Up submission.
     * On success, it retrieves all user data (including role) and proceeds.
     */
    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const userData = { username, password };
            let response;

            if (isLogin) {
                response = await signinUser(userData);
            } else {
                if (password.length < 6) {
                    throw new Error('Password must be at least 6 characters long.');
                }
                // First, create the user account
                await signupUser(userData);
                // Then, sign in immediately to get the full user object, including the role
                response = await signinUser(userData);
            }

            // Destructure all necessary fields from the response, including the user's role
            const { needsApiKeyPrompt, sessionId, username: loggedInUsername, _id: userId, role } = response.data;
            if (!userId || !sessionId || !loggedInUsername || !role) {
                throw new Error("Incomplete authentication data received from server.");
            }

            // Store all essential session details in localStorage
            localStorage.setItem('sessionId', sessionId);
            localStorage.setItem('username', loggedInUsername);
            localStorage.setItem('userId', userId);
            localStorage.setItem('userRole', role); // Save the user's role

            // The backend determines if the API key prompt is necessary
            if (needsApiKeyPrompt) {
                setCurrentStep('apiKeys');
            } else {
                // ======================= THE FINAL FIX =======================
                // This user doesn't need the prompt, meaning they are an admin
                // or have been approved. We MUST fetch their settings to get the keys.
                console.log("User does not need API key prompt. Fetching settings...");
                try {
                    const settingsResponse = await getUserSettings();
                    const settings = settingsResponse.data;
                    
                    // Save the fetched keys to localStorage so other components can use them.
                    localStorage.setItem('userApiKeys', JSON.stringify({
                        gemini: settings.geminiApiKey,
                        groq: settings.grokApiKey,
                        ollama_host: settings.ollamaHost
                    }));

                    console.log("Settings and API keys loaded into localStorage.");

                    setIsAuthenticated(true);
                    navigate('/chat', { replace: true });

                } catch (settingsErr) {
                    // If fetching settings fails, we can't proceed.
                    throw new Error("Successfully logged in, but failed to fetch API key settings.");
                }
                // =============================================================
            }
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'An error occurred.');
            localStorage.clear();
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Handles the result from the ApiKeyModal.
     * It sets the loading state, saves settings or requests access, then completes authentication.
     */
    const handleApiKeyStepCompletion = async (data) => {
        setLoading(true);
        // Debug print: show what is being received from ApiKeyModal
        console.log('AuthPage handleApiKeyStepCompletion received:', data);
        try {
            if (data.skip) {
                if (data.requestAccess) {
                    await requestAdminKeyAccess();
                }
            } else {
                // Only include ollamaHost if it exists in data (user provided it)
                const settingsToSend = {
                    geminiApiKey: data.geminiApiKey,
                    grokApiKey: data.grokApiKey
                };
                if ('ollamaHost' in data) {
                    settingsToSend.ollamaHost = data.ollamaHost;
                }
                await saveUserSettings(settingsToSend);
            }
            setIsAuthenticated(true);
            navigate('/chat', { replace: true });
        } catch (err) {
            setLoading(false);
            throw err;
        }
    };

    /** Toggles between Sign In and Sign Up modes. */
    const toggleMode = () => {
        setIsLogin(!isLogin);
        setUsername('');
        setPassword('');
        setError('');
    };

    // --- Render Logic ---
    return (
        <div className="auth-container">
            {currentStep === 'auth' && (
                <div className="auth-box">
                    <h2>{isLogin ? 'Sign In' : 'Sign Up'}</h2>
                    <form onSubmit={handleAuth}>
                        <div className="input-group">
                            <label htmlFor="username">Username</label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                                disabled={loading}
                            />
                        </div>
                        <div className="input-group">
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete={isLogin ? "current-password" : "new-password"}
                                disabled={loading}
                            />
                        </div>
                        {error && <p className="error-message">{error}</p>}
                        <button type="submit" disabled={loading} className="auth-button">
                            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                        </button>
                    </form>
                    <button onClick={toggleMode} className="toggle-button" disabled={loading}>
                        {isLogin ? 'Need an account? Sign Up' : 'Have an account? Sign In'}
                    </button>
                </div>
            )}

            {currentStep === 'apiKeys' && (
                <ApiKeyModal
                    username={localStorage.getItem('username')}
                    onComplete={handleApiKeyStepCompletion}
                    loading={loading}
                />
            )}
        </div>
    );
};

// --- Component-Specific Styles ---
const AuthPageCSS = `
.auth-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: var(--bg-secondary); padding: 1rem; }
.auth-box { background-color: var(--bg-primary); color: var(--text-primary); padding: 40px; border-radius: 12px; border: 1px solid var(--border-primary); box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); width: 100%; max-width: 420px; text-align: center; }
.auth-box h2 { margin-top: 0; margin-bottom: 25px; color: var(--text-primary); font-size: 1.8rem; font-weight: 600; }
.input-group { margin-bottom: 20px; text-align: left; }
.input-group label { display: block; margin-bottom: 8px; color: var(--text-secondary); font-weight: 500; }
.input-group input { width: 100%; padding: 12px 15px; border: 1px solid var(--border-primary); background-color: var(--bg-tertiary); color: var(--text-primary); border-radius: 6px; box-sizing: border-box; font-size: 1rem; transition: all 0.2s ease; }
.input-group input:focus { outline: none; border-color: var(--accent-active); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-active) 20%, transparent); }
.input-group input:disabled { background-color: var(--bg-tertiary); opacity: 0.6; cursor: not-allowed; }
.auth-button { width: 100%; padding: 12px; background-color: var(--accent-active); color: var(--text-on-accent); border: none; border-radius: 6px; font-size: 1rem; font-weight: 500; cursor: pointer; transition: all 0.2s ease; margin-top: 10px; }
.auth-button:hover:not(:disabled) { background-color: var(--accent-hover); }
.auth-button:disabled { opacity: 0.5; cursor: not-allowed; }
.toggle-button { background: none; border: none; color: var(--accent-active); cursor: pointer; margin-top: 20px; font-size: 0.9rem; font-weight: 500; }
.toggle-button:hover:not(:disabled) { text-decoration: underline; }
.toggle-button:disabled { color: var(--text-secondary); cursor: not-allowed; }
.error-message { color: #e53e3e; margin-top: 15px; margin-bottom: 0; font-size: 0.9rem; }
`;

const styleTagAuthId = 'auth-page-styles';
if (!document.getElementById(styleTagAuthId)) {
    const styleTag = document.createElement("style");
    styleTag.id = styleTagAuthId;
    styleTag.type = "text/css";
    styleTag.innerText = AuthPageCSS;
    document.head.appendChild(styleTag);
}


export default AuthPage;