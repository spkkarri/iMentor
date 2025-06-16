// frontend/src/components/layout/CenterPanel.jsx
import React, { useState, useEffect, useRef } from 'react';
import ChatHistory from '../chat/ChatHistory';
import ChatInput from '../chat/ChatInput';
import api from '../../services/api';
import { useAuth as useRegularAuth } from '../../hooks/useAuth';
import { useAppState } from '../../contexts/AppStateContext';
import toast from 'react-hot-toast';

const THINKING_VARIANTS = ["🧠 Thinking...", "💭 Processing...", "🤔 Analyzing query..."];
const RAG_ANALYSIS_VARIANTS = ["📚 Reviewing documents...", "🎯 Finding relevant info...", "🧩 Combining sources..."];
const WEB_ANALYSIS_VARIANTS = ["🌐 Searching the web...", "🔎 Filtering results...", "📰 Reading latest info..."];
const GENERAL_ANALYSIS_VARIANTS = ["📊 Analyzing context...", "🔍 Searching knowledge base..."];
const GENERATION_VARIANTS = ["✨ Generating response...", "🚀 Crafting answer...", "📝 Preparing explanation..."];

const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function CenterPanel({ messages, setMessages, currentSessionId }) {
    const { token: regularUserToken } = useRegularAuth();
    // Get all necessary context from AppState
    const { selectedLLM, systemPrompt, selectedDocumentForAnalysis, selectedSubject } = useAppState();

    const [useWebSearch, setUseWebSearch] = useState(false);
    const [isSending, setIsSending] = useState({ active: false, message: '' });
    const [criticalThinkingEnabled, setCriticalThinkingEnabled] = useState(false);
    
    const isMountedRef = useRef(true);
    const simulationControllerRef = useRef(new AbortController());

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            simulationControllerRef.current.abort();
        };
    }, []);

    useEffect(() => {
        const documentContext = selectedSubject || selectedDocumentForAnalysis;
        if (documentContext && useWebSearch) {
            setUseWebSearch(false);
            toast("Web Search disabled automatically while a document is selected.", { icon: "ℹ️" });
        }
    }, [selectedDocumentForAnalysis, selectedSubject]);

    const runStatusSimulation = async (isRagActive, isWebActive, signal) => {
        // This simulation logic remains correct
        let analysisVariants = isWebActive ? WEB_ANALYSIS_VARIANTS : (isRagActive ? RAG_ANALYSIS_VARIANTS : GENERAL_ANALYSIS_VARIANTS);
        const sequence = [
            { message: getRandomItem(THINKING_VARIANTS), duration: 1200 },
            { message: getRandomItem(analysisVariants), duration: 1500 },
            { message: getRandomItem(GENERATION_VARIANTS), duration: 1300 },
        ];
        for (const stage of sequence) {
            if (signal.aborted) return;
            if (isMountedRef.current) setIsSending({ active: true, message: stage.message });
            await wait(stage.duration + (Math.random() * 400 - 200));
        }
    };

    const handleSendMessage = async (inputText) => {
        if (!inputText.trim() || !regularUserToken || !currentSessionId || isSending.active) return;

        // --- THIS IS THE FIX ---
        // Determine the document context AT THE MOMENT THE MESSAGE IS SENT.
        // This ensures the agent always knows whether to use RAG or not.
        const documentContextName = selectedSubject || selectedDocumentForAnalysis;
        const isRagActive = !!documentContextName;
        // --- END OF FIX ---

        simulationControllerRef.current = new AbortController();
        setIsSending({ active: true, message: '...' });
        runStatusSimulation(isRagActive, useWebSearch, simulationControllerRef.current.signal);

        const clientSideId = `user-${Date.now()}`;
        setMessages(prev => [...prev, { id: clientSideId, sender: 'user', role: 'user', text: inputText.trim(), parts: [{ text: inputText.trim() }], timestamp: new Date().toISOString() }]);
        
        const payload = {
            query: inputText.trim(),
            history: messages.map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: m.parts || [{ text: m.text }] })),
            sessionId: currentSessionId,
            useWebSearch: useWebSearch,
            systemPrompt,
            criticalThinkingEnabled: criticalThinkingEnabled,
            documentContextName: documentContextName, // Pass the determined context to the backend
        };

        try {
            const response = await api.sendMessage(payload);
            if (response && response.reply) {
                if (isMountedRef.current) setMessages(prev => [...prev, { ...response.reply, id: `bot-${Date.now()}` }]);
            } else {
                throw new Error("Invalid response from AI service.");
            }
        } catch (error) {
            const errorText = error.response?.data?.message || error.message || 'Failed to get response from AI.';
            const errorReply = { id: `error-${Date.now()}`, sender: 'bot', role: 'model', text: `Error: ${errorText}`, parts: [{ text: `Error: ${errorText}` }], timestamp: new Date().toISOString(), source_pipeline: "error-pipeline" };
            if (isMountedRef.current) setMessages(prev => [...prev, errorReply]);
            toast.error(errorText);
        } finally {
            simulationControllerRef.current.abort();
            if (isMountedRef.current) setIsSending({ active: false, message: '' });
        }
    };

    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark rounded-lg shadow-inner">
            {messages.length === 0 && !isSending.active && currentSessionId && (
                 <div className="p-6 sm:p-8 text-center text-text-muted-light dark:text-text-muted-dark animate-fadeIn">
                    <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-text-light dark:text-text-dark">AI Engineering Tutor</h2>
                    <p className="text-base sm:text-lg mb-3">Session ID: {currentSessionId.substring(0,8)}...</p>
                    <div className="text-xs sm:text-sm space-y-1">
                        <p>Current LLM: <span className="font-semibold text-accent">{selectedLLM.toUpperCase()}</span>.</p>
                        <p className="max-w-md mx-auto">
                            Assistant Mode: <span className="italic">"{systemPrompt.length > 60 ? systemPrompt.substring(0,60)+'...' : systemPrompt}"</span>
                        </p>
                        {/* This part correctly shows the user which document is active */}
                        {(selectedSubject || selectedDocumentForAnalysis) && (
                            <p className="mt-1 font-medium">Chat Focus: <span className="text-indigo-500 dark:text-indigo-400">{selectedSubject || selectedDocumentForAnalysis}</span></p>
                        )}
                    </div>
                </div>
            )}

            <ChatHistory messages={messages} isLoading={isSending} />
            <ChatInput
                onSendMessage={handleSendMessage}
                isLoading={isSending.active}
                useWebSearch={useWebSearch}
                setUseWebSearch={setUseWebSearch}
                criticalThinkingEnabled={criticalThinkingEnabled}
                setCriticalThinkingEnabled={setCriticalThinkingEnabled}
            />
        </div>
    );
}

export default CenterPanel;