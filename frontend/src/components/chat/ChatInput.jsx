// frontend/src/components/chat/ChatInput.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, Plus, Brain, Zap, Globe } from 'lucide-react';
import { useWebSpeech } from '../../hooks/useWebSpeech';
import Button from '../core/Button.jsx'; 
import IconButton from '../core/IconButton.jsx';
import toast from 'react-hot-toast';
import blueBrain from "./../../assets/blueBrain.svg";
import { motion, AnimatePresence } from 'framer-motion';

function ChatInput({ 
    onSendMessage, 
    isLoading,
    useWebSearch,
    setUseWebSearch,
    criticalThinkingEnabled,
    setCriticalThinkingEnabled
}) {
    const [inputValue, setInputValue] = useState('');
    const { transcript, listening, isSpeechSupported, startListening, stopListening, resetTranscript } = useWebSpeech();
    const textareaRef = useRef(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    useEffect(() => {
        if (transcript) {
            setInputValue(prev => prev + (prev ? " " : "") + transcript);
            resetTranscript(); 
        }
    }, [transcript, resetTranscript]);
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
        }
    }, [inputValue]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (inputValue.trim() && !isLoading) {
            onSendMessage(inputValue.trim()); // Pass only the text. The parent (CenterPanel) will assemble the full payload.
            setInputValue('');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
            e.preventDefault();
            handleSubmit(e);
        }
    };
    
    const handleWebSearchToggle = () => {
        const newWebSearchState = !useWebSearch;
        setUseWebSearch(newWebSearchState);
        toast(newWebSearchState ? "Web Search enabled." : "Web Search disabled.", { icon: newWebSearchState ? "🌐" : "📄" });
        setIsMenuOpen(false);
    };

    const icon = criticalThinkingEnabled ? () => <img src={blueBrain} alt="Blue Brain" className="w-5 h-5" /> : Brain;

    return (
        <div className="p-2 sm:p-3 bg-surface-light dark:bg-surface-dark/50 backdrop-blur-sm rounded-b-lg shadow-inner">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
                <div className="relative" ref={menuRef}>
                    <IconButton
                        icon={Plus}
                        title="More Options"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        variant="ghost"
                        size="md" 
                        className="p-2 text-text-muted-light dark:text-text-muted-dark hover:text-primary"
                        disabled={isLoading}
                    />
                    <AnimatePresence>
                    {isMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full left-0 mb-2 w-48 bg-surface-light dark:bg-surface-dark rounded-lg shadow-xl border border-border-light dark:border-border-dark p-1 z-10"
                        >
                            <button
                                onClick={handleWebSearchToggle}
                                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                                    useWebSearch
                                    ? 'bg-primary/10 text-primary dark:bg-primary-dark/20 dark:text-primary-light'
                                    : 'text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                <Globe size={16} />
                                {useWebSearch ? 'Disable Web Search' : 'Enable Web Search'}
                            </button>
                             <button
                                onClick={() => {toast("File attachment coming soon!", { icon: "📎" }); setIsMenuOpen(false);}}
                                className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm rounded-md text-text-muted-light dark:text-text-muted-dark hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <Zap size={16} />
                                Attach File (soon)
                            </button>
                        </motion.div>
                    )}
                    </AnimatePresence>
                </div>

                <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isLoading ? "Waiting for response..." : "Type your message or ask a question..."}
                    className="input-field flex-1 p-2.5 resize-none min-h-[44px] max-h-32 custom-scrollbar text-sm" 
                    rows="1"
                    disabled={isLoading}
                />

                {isSpeechSupported && (
                    <IconButton
                        icon={Mic}
                        onClick={() => listening ? stopListening() : startListening()}
                        title={listening ? "Stop listening" : "Start voice input"}
                        variant={listening ? "danger" : "ghost"} 
                        size="md"
                        className={`p-2 ${listening ? 'text-red-500 animate-pulse' : 'text-text-muted-light dark:text-text-muted-dark hover:text-primary'}`}
                        disabled={isLoading}
                    />
                )}

               <IconButton
                    icon={icon}
                    onClick={() => setCriticalThinkingEnabled(!criticalThinkingEnabled)}
                    title={criticalThinkingEnabled ? "Disable Critical Thinking (KG)" : "Enable Critical Thinking (KG)"}
                    variant="ghost"
                    size="md"
                    className={`p-2 ${criticalThinkingEnabled ? 'text-purple-500' : 'text-text-muted-light dark:text-text-muted-dark hover:text-primary'}`}
                    disabled={isLoading}
                />

                <Button 
                    type="submit"
                    variant="primary"
                    size="md" 
                    className="!p-2.5" 
                    disabled={isLoading || !inputValue.trim()}
                    isLoading={isLoading && !!inputValue.trim()} 
                    title="Send message"
                >
                    {(!isLoading || !inputValue.trim()) ? <Send size={20} /> : null}
                </Button>
            </form>
            
            <div className="flex flex-col items-center justify-center mt-2 px-2 text-center h-4">
                <AnimatePresence>
                    {useWebSearch && (
                        <motion.p
                            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                            className="text-xs text-blue-500 dark:text-blue-400 flex items-center gap-1.5 font-medium"
                        >
                            <Globe size={12} /> Web Search is ON
                        </motion.p>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
export default ChatInput;