// src/components/chat/ChatHistory.jsx
import React, { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import { motion, AnimatePresence } from 'framer-motion';

// isLoading prop is an object: { active: boolean, message: string }
function ChatHistory({ messages, isLoading }) {
    const chatHistoryRef = useRef(null);

    // --- CORRECTED AUTO-SCROLL LOGIC ---
    useEffect(() => {
        // This effect runs whenever the messages array or the loading state changes.
        // It will automatically scroll the chat container to the bottom.
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [messages, isLoading]); // Dependency array ensures this runs on every new message or loading change

    return (
        <div ref={chatHistoryRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            <AnimatePresence initial={false}>
                {messages.map((msg, index) => (
                    <motion.div
                        key={msg.id || `msg-${index}-${msg.timestamp}`}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                        <MessageBubble
                            id={msg.id || `msg-${index}-${msg.timestamp}`}
                            sender={msg.sender}
                            text={msg.text}
                            thinking={msg.thinking}
                            references={msg.references}
                            timestamp={msg.timestamp}
                            sourcePipeline={msg.source_pipeline}
                        />
                    </motion.div>
                ))}
            </AnimatePresence>
            
            {/* The one and only loading indicator. It displays the dynamic message. */}
            {isLoading.active && (
                 <motion.div 
                    layout
                    key="thinking-bubble"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex justify-start pl-2 mt-2"
                 >
                    <div className="message-bubble bot-message bg-surface-light/80 dark:bg-surface-dark/80 backdrop-blur-sm p-3 inline-flex items-center gap-2 rounded-lg shadow-md border border-primary/20">
                        <span className="text-sm italic text-text-muted-light dark:text-text-muted-dark">{isLoading.message}</span>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
export default ChatHistory;