// Path: client/src/components/ChatInput.js
import React, { useEffect, useRef } from 'react';
import { useWebSpeech } from '../hooks/useWebSpeech';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone } from '@fortawesome/free-solid-svg-icons';

// This component is now ONLY the input area with the mic inside.
const ChatInput = ({ value, onInputChange, onSendMessage, disabled }) => {
    const { 
        transcript, 
        listening, 
        isSpeechSupported, 
        startListening, 
        stopListening 
    } = useWebSpeech();
    
    const textareaRef = useRef(null);

    // Update input with speech
    useEffect(() => {
        if (transcript) {
            onInputChange(value ? value + ' ' + transcript : transcript);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transcript]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, 120)}px`;
        }
    }, [value]);

    // Send on Enter key
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (value.trim() && !disabled) {
                onSendMessage(value);
            }
        }
    };

    return (
        <div className="chat-input-wrapper">
            {isSpeechSupported && (
                <button
                    type="button"
                    onClick={() => listening ? stopListening() : startListening()}
                    className={`mic-button-embedded ${listening ? 'listening' : ''}`}
                    disabled={disabled}
                    title="Voice Input"
                >
                    <FontAwesomeIcon icon={faMicrophone} />
                </button>
            )}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={listening ? "Listening..." : "Type your message..."}
                className="chat-textarea-embedded"
                rows="1"
                disabled={disabled}
            />
        </div>
    );
};

export default ChatInput;