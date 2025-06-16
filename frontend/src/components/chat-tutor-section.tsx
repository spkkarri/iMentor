'use client';
import type { FC, FormEvent } from 'react';
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessage, { type Message as MessageType } from '@/components/chat-message';
import { MessageSquare, SendHorizontal, Loader2 } from 'lucide-react';
import { chatTutor } from '@/app/actions'; // Server action

interface ChatTutorSectionProps {
  documentContent: string | null;
}

const ChatTutorSection: FC<ChatTutorSectionProps> = ({ documentContent }) => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("Ready | 0 Vectors"); // Placeholder
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (documentContent) {
      setStatus(`Ready | ${Math.floor(Math.random() * 500) + 100} Vectors`); // Simulate vector count
    } else {
      setStatus("Upload a document to begin");
    }
  }, [documentContent]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !documentContent) return;

    const userMessage: MessageType = {
      id: Date.now().toString() + 'user',
      sender: 'user',
      text: inputValue,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setStatus("AI is thinking...");

    try {
      const aiResponse = await chatTutor({ documentContent, question: userMessage.text });
      const aiMessage: MessageType = {
        id: Date.now().toString() + 'ai',
        sender: 'ai',
        text: aiResponse.answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error fetching AI response:', error);
      const errorMessage: MessageType = {
        id: Date.now().toString() + 'ai-error',
        sender: 'ai',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setStatus(`Ready | ${Math.floor(Math.random() * 500) + 100} Vectors`);
    }
  };

  return (
    <Card className="h-full flex flex-col glass-panel rounded-lg">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center text-xl font-headline">
            <MessageSquare className="mr-2 h-6 w-6 text-primary" />
            Chat Tutor
          </CardTitle>
          <p className="text-xs text-muted-foreground">{status}</p>
        </div>
        <p className="text-xs text-muted-foreground ml-8">Session ID: {(Math.random() + 1).toString(36).substring(7)}</p>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full max-h-[calc(100vh-20rem)] p-4" ref={scrollAreaRef}>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare size={48} className="mb-4" />
              <p>Ask questions about the uploaded document.</p>
              {!documentContent && <p className="text-sm mt-1">Please upload a document first.</p>}
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t border-border/50">
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2">
          <Input
            type="text"
            placeholder={documentContent ? "Ask about the document..." : "Upload a document first..."}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1"
            disabled={isLoading || !documentContent}
          />
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim() || !documentContent} className="btn-glow-primary-hover">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
};

export default ChatTutorSection;
