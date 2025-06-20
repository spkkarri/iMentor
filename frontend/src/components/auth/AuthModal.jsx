// frontend/src/components/auth/AuthModal.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import LLMSelection from './LLMSelection.jsx';
import toast from 'react-hot-toast';
import { LogIn, UserPlus, X, KeyRound, AtSign, AlertCircle, HardDrive } from 'lucide-react';
import Button from '../core/Button.jsx';
import IconButton from '../core/IconButton.jsx';
import { motion } from 'framer-motion';

function AuthModal({ isOpen, onClose }) {
    const { login, signup } = useAuth();
    const { setIsAdminSessionActive, switchLLM: setGlobalLLM, selectedLLM } = useAppState();

    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [localSelectedLLM, setLocalSelectedLLM] = useState('gemini');
    const [apiKey, setApiKey] = useState('');
    const [ollamaUrl, setOllamaUrl] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;

    useEffect(() => {
        if (isOpen) {
            setError('');
            setEmail('');
            setPassword('');
            setApiKey('');
            setOllamaUrl('');
            setLocalSelectedLLM(selectedLLM || 'gemini');
        } else {
            setIsLoginView(true);
        }
    }, [isOpen, selectedLLM]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!emailRegex.test(email) && !(isLoginView && email === (process.env.VITE_ADMIN_USERNAME || 'admin@admin.com'))) {
            return setError("Please enter a valid email address.");
        }
        if (password.length < 6) {
            return setError("Password must be at least 6 characters long.");
        }
        if (!isLoginView && localSelectedLLM === 'gemini' && !apiKey.trim()) {
            return setError("Gemini API Key is required.");
        }
        if (!isLoginView && localSelectedLLM === 'ollama' && !ollamaUrl.trim()) {
            return setError("Ollama URL is required.");
        }
        
        setLoading(true);
        const toastId = toast.loading(isLoginView ? 'Logging in...' : 'Creating account...');

        try {
            if (isLoginView) {
                const authDataResponse = await login({ email, password });
                if (authDataResponse.isAdminLogin) {
                    toast.dismiss(toastId);
                    toast.success("Admin login successful!");
                    setIsAdminSessionActive(true); 
                    onClose({ isAdminLogin: true });
                } else {
                    toast.dismiss(toastId);
                    toast.success(authDataResponse.message || 'Login Successful!');
                    onClose(authDataResponse);
                }
            } else { // Signup logic
                const signupData = {
                    email, password,
                    preferredLlmProvider: localSelectedLLM,
                };
                if (localSelectedLLM === 'gemini') {
                    signupData.apiKey = apiKey;
                } else if (localSelectedLLM === 'ollama') {
                    signupData.ollamaUrl = ollamaUrl;
                }

                const authDataResponse = await signup(signupData);
                setGlobalLLM(localSelectedLLM);
                toast.dismiss(toastId);
                toast.success(authDataResponse.message || 'Signup Successful!');
                onClose(authDataResponse);
            }
        } catch (err) {
            toast.dismiss(toastId);
            const errorMessage = err.response?.data?.message || err.message || `An error occurred.`;
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const inputWrapperClass = "relative";
    const inputIconClass = "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted-light dark:text-text-muted-dark";
    const inputFieldStyledClass = "input-field pl-10 py-2.5 text-sm w-full";

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <motion.div 
                key="auth-modal-content"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="card-base p-6 sm:p-8 w-full max-w-md"
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl sm:text-2xl font-bold">{isLoginView ? 'Welcome Back' : 'Create Your Account'}</h2>
                    <IconButton icon={X} onClick={() => onClose(null)} variant="ghost" size="sm" title="Close" />
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 rounded-md text-sm flex items-center gap-2">
                        <AlertCircle size={16}/>{error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className={inputWrapperClass}>
                        <AtSign className={inputIconClass} />
                        <input type="text" id="auth-email" className={inputFieldStyledClass} placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
                    </div>
                    <div className={inputWrapperClass}>
                        <KeyRound className={inputIconClass} />
                        <input type="password" id="auth-password" className={inputFieldStyledClass} placeholder="Password (min. 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" disabled={loading} />
                    </div>

                    {!isLoginView && (
                        <div className="space-y-4 pt-2 animate-fadeIn">
                            <LLMSelection selectedLLM={localSelectedLLM} onLlmChange={setLocalSelectedLLM} disabled={loading} />
                            
                            <div style={{ display: localSelectedLLM === 'gemini' ? 'block' : 'none' }}>
                                <motion.div key="gemini-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <label htmlFor="api-key-input" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Gemini API Key <span className="text-red-500">*</span></label>
                                    <div className={inputWrapperClass}>
                                        <KeyRound className={inputIconClass} />
                                        <input type="password" id="api-key-input" className={inputFieldStyledClass} placeholder="Enter your Gemini API Key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required={localSelectedLLM === 'gemini'} disabled={loading} />
                                    </div>
                                </motion.div>
                            </div>
                        
                            <div style={{ display: localSelectedLLM === 'ollama' ? 'block' : 'none' }}>
                                <motion.div key="ollama-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <label htmlFor="ollama-url-input" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Ollama URL <span className="text-red-500">*</span></label>
                                    <div className={inputWrapperClass}>
                                        <HardDrive className={inputIconClass} />
                                        <input type="text" id="ollama-url-input" className={inputFieldStyledClass} placeholder="e.g., http://localhost:11434" value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)} required={localSelectedLLM === 'ollama'} disabled={loading} />
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    )}

                    <Button type="submit" fullWidth isLoading={loading} leftIcon={isLoginView ? <LogIn size={18}/> : <UserPlus size={18}/>} className="py-2.5 !text-base">
                        {isLoginView ? 'Login' : 'Sign Up'}
                    </Button>
                </form>

                <p className="mt-6 text-center text-sm">
                    <button onClick={() => setIsLoginView(!isLoginView)} className="font-medium text-primary hover:underline" disabled={loading}>
                        {isLoginView ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                    </button>
                </p>
            </motion.div>
        </div>
    );
}
export default AuthModal;