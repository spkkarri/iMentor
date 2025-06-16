import type { ChangeEvent, FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadCloud } from 'lucide-react';

interface DocumentUploadSectionProps {
  onDocumentUpload: (file: File) => void;
  isUploading: boolean;
}

const DocumentUploadSection: FC<DocumentUploadSectionProps> = ({ onDocumentUpload, isUploading }) => {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onDocumentUpload(file);
    }
  };

  return (
    <Card className="glass-panel rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-headline">
          <UploadCloud className="mr-2 h-6 w-6 text-primary" />
          Upload Document
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="file-upload" className="sr-only">Choose file</Label>
          <Input 
            id="file-upload" 
            type="file" 
            onChange={handleFileChange} 
            accept=".txt,.pdf,.md,.docx" 
            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
            disabled={isUploading}
          />
          <p className="mt-1 text-xs text-muted-foreground">Supported formats: TXT, PDF, MD, DOCX.</p>
        </div>
        <Button 
          onClick={() => {
            // This button is illustrative; actual upload handled by file input's onChange.
            // It could trigger processing of an already selected file if UI flow was different.
            // For now, it's more of a conceptual button.
            // If a file is selected via input, it's already being processed by onDocumentUpload.
            // Consider renaming or repurposing based on actual desired UX.
          }} 
          className="w-full btn-glow-primary-hover"
          disabled={isUploading}
        >
          {isUploading ? 'Processing...' : 'Add to Knowledge Base'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DocumentUploadSection;
