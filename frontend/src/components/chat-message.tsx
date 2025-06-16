import type { FC } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Smile } from 'lucide-react'; // Placeholder for emoji reactions

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.sender === 'user';

  return (
    <div className={cn('flex items-start gap-3 my-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <Avatar className="h-8 w-8 border border-primary/50">
          <AvatarImage src="https://placehold.co/40x40.png" alt="AI Avatar" data-ai-hint="robot abstract" />
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[70%] p-3 rounded-lg shadow-md relative group',
          isUser ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-muted/70 text-foreground rounded-bl-none glass-panel !bg-card/50'
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{message.text}</p>
        <div className="absolute -bottom-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        p-0.5 bg-card border border-border rounded-full shadow-lg
                        flex items-center space-x-0.5
                        backdrop-blur-sm bg-opacity-70"
             style={isUser ? { right: '0.5rem' } : { left: '0.5rem' }}>
          <button className="p-0.5 rounded-full hover:bg-muted focus:outline-none">
            <Smile size={14} className="text-muted-foreground hover:text-primary" />
          </button>
        </div>
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 border border-border">
          <AvatarImage src="https://placehold.co/40x40.png" alt="User Avatar" data-ai-hint="person silhouette" />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

export default ChatMessage;
