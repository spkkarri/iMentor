// src/components/chat/MessageBubble.jsx
import React, { useEffect, useRef } from 'react'; // Import useEffect and useRef
import { marked } from 'marked';
import Prism from 'prismjs'; // Import Prism for manual highlighting
import { ChevronDown, Brain, Link as LinkIcon, Zap, Server, Volume2, StopCircle, ServerCrash } from 'lucide-react';
import { useTextToSpeech } from '../../hooks/useTextToSpeech.js';
import IconButton from '../core/IconButton.jsx';
import { renderMathInHtml } from '../../utils/markdownUtils'; // Import the math renderer
import DOMPurify from 'dompurify'; // Import DOMPurify for security

// Configure marked - it's good to have it here
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Create a new, safer markup creation function
const createMarkup = (markdownText) => {
    if (!markdownText) return { __html: '' };
    // 1. Convert Markdown to HTML
    let rawHtml = marked.parse(markdownText);
    // 2. Render KaTeX math within the HTML
    rawHtml = renderMathInHtml(rawHtml);
    // 3. Sanitize the final HTML to prevent XSS attacks
    const cleanHtml = DOMPurify.sanitize(rawHtml, {
        USE_PROFILES: { html: true, mathMl: true, svg: true },
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'],
    });
    return { __html: cleanHtml };
};


const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, '"')
         .replace(/'/g, "'");
};

function MessageBubble({ sender, text, thinking, references, timestamp, sourcePipeline, id: messageId }) {
    const isUser = sender === 'user';
    const { speak, cancel, isSpeaking: isCurrentlySpeakingThisBubble, isSupported: ttsIsSupported } = useTextToSpeech();
    
    // --- START OF CHANGES ---
    // 1. Create a ref to attach to the content container
    const contentRef = useRef(null);

    // 2. Use an effect to run Prism highlighting after the component renders/updates
    useEffect(() => {
        // The timeout ensures that React has finished rendering the HTML from `dangerouslySetInnerHTML`
        // before Prism tries to find the code blocks.
        const timer = setTimeout(() => {
            if (contentRef.current) {
                Prism.highlightAllUnder(contentRef.current);
            }
        }, 50); // A small delay is usually sufficient

        return () => clearTimeout(timer); // Cleanup timer on unmount
    }, [text]); // Re-run this effect whenever the message text changes
    // --- END OF CHANGES ---

    const formatTimestamp = (ts) => {
        if (!ts) return '';
        try {
            return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) { return 'Invalid Time'; }
    };

    const getPipelineIcon = () => {
        if (!sourcePipeline) return null;
        const lowerPipeline = sourcePipeline.toLowerCase();
        if (lowerPipeline.includes('ollama')) return <Zap size={12} className="text-green-400" title="Ollama Powered" />;
        if (lowerPipeline.includes('gemini')) return <Server size={12} className="text-blue-400" title="Gemini Powered" />;
        if (lowerPipeline.includes('rag')) return <Zap size={12} className="text-purple-400" title="RAG Enhanced" />;
        if (lowerPipeline.includes('error')) return <ServerCrash size={12} className="text-red-400" title="Error" />;
        return null;
    };

    const handleToggleSpeech = () => {
        if (!ttsIsSupported || !text) return;
        if (isCurrentlySpeakingThisBubble) {
            cancel();
        } else {
            speak({ text });
        }
    };
    
    return (
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full group`}>
            <div 
                className={`message-bubble max-w-[85%] md:max-w-[75%] p-3 rounded-2xl shadow-md break-words ${
                    isUser 
                    ? 'bg-primary dark:bg-primary-dark text-white rounded-br-lg' 
                    : 'bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark rounded-bl-lg border border-border-light dark:border-border-dark'
                }`}
            >
                {/* Main message content */}
                <div 
                    // 3. Attach the ref to the div that contains the dangerous HTML
                    ref={contentRef}
                    className="prose prose-sm dark:prose-invert max-w-none message-content leading-relaxed" 
                    dangerouslySetInnerHTML={createMarkup(text || '')} 
                />
                
                {/* Timestamp, Pipeline Icon, and TTS Button */}
                <div className="flex items-center justify-end mt-1.5 text-xs opacity-70 gap-2">
                    {!isUser && getPipelineIcon() && <span className="mr-1">{getPipelineIcon()}</span>}
                    <span>{formatTimestamp(timestamp)}</span>
                    {!isUser && ttsIsSupported && text && (
                        <IconButton
                            icon={isCurrentlySpeakingThisBubble ? StopCircle : Volume2}
                            onClick={handleToggleSpeech}
                            title={isCurrentlySpeakingThisBubble ? "Stop reading" : "Read aloud"}
                            size="sm"
                            variant="ghost"
                            className={`p-0.5 ${isCurrentlySpeakingThisBubble ? 'text-red-500' : 'text-text-muted-light dark:text-text-muted-dark hover:text-primary'}`}
                        />
                    )}
                </div>
            </div>

            {/* Metadata: Thinking and References for Bot Messages */}
            {!isUser && (thinking || (references && references.length > 0)) && (
                <div className="message-metadata-container max-w-[85%] md:max-w-[75%] mt-1.5 pl-2 space-y-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {thinking && thinking.trim() && (
                        <details className="group/details text-xs">
                            <summary className="flex items-center gap-1 cursor-pointer text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light transition-colors">
                                <Brain size={14} /> AI Reasoning
                                <ChevronDown size={14} className="group-open/details:rotate-180 transition-transform" />
                            </summary>
                            <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-md text-text-light dark:text-text-dark whitespace-pre-wrap break-all text-[0.7rem] max-h-32 overflow-y-auto custom-scrollbar">
                                <code>{escapeHtml(thinking)}</code>
                            </pre>
                        </details>
                    )}
                    {references && references.length > 0 && (
                        <details className="group/details text-xs" open>
                            <summary className="flex items-center gap-1 cursor-pointer text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light transition-colors">
                                <LinkIcon size={14} /> References
                                <ChevronDown size={14} className="group-open/details:rotate-180 transition-transform" />
                            </summary>
                            <ul className="mt-1 pl-1 space-y-0.5 text-[0.7rem]">
                                {references.map((ref, index) => (
                                    <li 
                                        key={index} 
                                        className="text-text-muted-light dark:text-text-muted-dark hover:text-text-light dark:hover:text-text-dark transition-colors truncate"
                                        title={`Preview: ${escapeHtml(ref.content_preview || '')}\nSource: ${escapeHtml(ref.source || '')}`}
                                    >
                                        <span className="font-semibold text-accent">[{ref.number}]</span> {escapeHtml(ref.source)}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
}
export default MessageBubble;