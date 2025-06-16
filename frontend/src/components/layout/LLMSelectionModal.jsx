// frontend/src/components/layout/LLMSelectionModal.jsx
import React, { useState, useEffect } from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import api from '../../services/api.js';
import toast from 'react-hot-toast';
import { X, Save, KeyRound, AlertCircle } from 'lucide-react';
import Modal from '../core/Modal.jsx';
import Button from '../core/Button.jsx';
import LLMSelection from '../auth/LLMSelection.jsx';
import { motion } from 'framer-motion';

function LLMSelectionModal({ isOpen, onClose }) {
    const { selectedLLM: currentLLM, switchLLM: setGlobalLLMPreference } = useAppState();
    
    const [locallySelectedLLM, setLocallySelectedLLM] = useState(currentLLM);
    const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
    const [ollamaApiKeyInput, setOllamaApiKeyInput] = useState('');
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setLocallySelectedLLM(currentLLM);
            setGeminiApiKeyInput(''); 
            setOllamaApiKeyInput(''); 
            setError('');
        }
    }, [isOpen, currentLLM]);

    const handleSavePreference = async () => {
        setLoading(true); 
        setError('');
        const toastId = toast.loading('Saving LLM preference...');
        
        try {
            const configData = { llmProvider: locallySelectedLLM };
            if (geminiApiKeyInput.trim()) {
                configData.geminiApiKey = geminiApiKeyInput.trim();
            }
            if (ollamaApiKeyInput.trim()) {
                configData.ollamaApiKey = ollamaApiKeyInput.trim();
            }
            
            await api.updateUserLLMConfig(configData);
            setGlobalLLMPreference(locallySelectedLLM);
            
            toast.success(`LLM preference updated successfully.`, { id: toastId });
            onClose();
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to update LLM preference.';
            setError(errorMessage);
            toast.error(errorMessage, { id: toastId });
        } finally {
            setLoading(false);
        }
    };
    
    const inputWrapperClass = "relative";
    const inputIconClass = "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted-light dark:text-text-muted-dark";
    const inputFieldStyledClass = "input-field pl-10 py-2 text-sm";

    return (
         <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Switch LLM Provider & API Keys" 
            size="lg"
            footerContent={
                <>
                    <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSavePreference} isLoading={loading} leftIcon={<Save size={16}/>}>
                        Save Preference
                    </Button>
                </>
            }
        >
            <div className="space-y-5"> 
                <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
                    Select your preferred LLM. You can also update your API keys here. Leave a key field blank to keep your existing one.
                </p>
                <LLMSelection 
                    selectedLLM={locallySelectedLLM} 
                    onLlmChange={setLocallySelectedLLM}
                    disabled={loading}
                />
                
                <motion.div key="gemini-config-modal" className="mt-4 space-y-1">
                    <label htmlFor="modalGeminiApiKey" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark">
                        Update Gemini API Key (Optional)
                    </label>
                    <div className={inputWrapperClass}>
                        <KeyRound className={inputIconClass} />
                        <input type="password" id="modalGeminiApiKey" className={inputFieldStyledClass} placeholder="Leave blank to keep existing key" value={geminiApiKeyInput} onChange={(e) => setGeminiApiKeyInput(e.target.value)} disabled={loading} />
                    </div>
                </motion.div>
                
                <motion.div key="ollama-config-modal" className="mt-4 space-y-1">
                    <label htmlFor="modalOllamaApiKey" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark">
                        Update Ollama API Key (Optional)
                    </label>
                     <div className={inputWrapperClass}>
                        <KeyRound className={inputIconClass} />
                        <input type="password" id="modalOllamaApiKey" className={inputFieldStyledClass} placeholder="Leave blank to keep existing key" value={ollamaApiKeyInput} onChange={(e) => setOllamaApiKeyInput(e.target.value)} disabled={loading} />
                    </div>
                </motion.div>

                {error && (
                    <div className="p-3 mt-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 rounded-md text-sm flex items-center gap-2">
                        <AlertCircle size={18}/> {error}
                    </div>
                )}
            </div>
        </Modal>
    );
}

export default LLMSelectionModal;