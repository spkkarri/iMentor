import React, { useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import { motion, AnimatePresence } from 'framer-motion';

function ChatHistory({ messages, botStatusPlaceholder }) {
    const chatHistoryRef = useRef(null);

    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [messages, botStatusPlaceholder]);

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

            {botStatusPlaceholder && (
                <motion.div 
                    layout
                    key="bot-status-placeholder"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex justify-start pl-2 mt-2"
                >
                    <div className="max-w-[85%] bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-xl shadow-md animate-pulse text-sm">
                        {botStatusPlaceholder}
                    </div>
                </motion.div>
            )}
        </div>
    );
}

export default ChatHistory;
