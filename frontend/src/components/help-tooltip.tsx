import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

const HelpTooltip: FC = () => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed bottom-6 right-6 rounded-full h-12 w-12 shadow-lg bg-card/80 backdrop-blur-sm border-primary/50 hover:bg-primary/20 btn-glow-primary-hover"
            aria-label="Help"
          >
            <HelpCircle className="h-6 w-6 text-primary" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="bg-popover/90 backdrop-blur-sm border-border/70 p-3 rounded-lg shadow-xl">
          <div className="space-y-1 text-sm">
            <p className="font-semibold">Chatbot Tips:</p>
            <ul className="list-disc list-inside text-xs">
              <li>Upload a document to start.</li>
              <li>Ask specific questions about its content.</li>
              <li>Use document utilities for summaries.</li>
              <li>Be clear and concise in your queries.</li>
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default HelpTooltip;
