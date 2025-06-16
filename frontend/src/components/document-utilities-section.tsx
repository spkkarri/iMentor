import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DocumentFile, UtilityAction } from '@/app/page'; // Assuming types are defined in page.tsx or a types file
import { Lightbulb, ListOrdered, Brain, Podcast, FileText } from 'lucide-react';

interface DocumentUtilitiesSectionProps {
  documents: DocumentFile[];
  selectedDocumentName: string | undefined;
  onSelectDocument: (documentName: string) => void;
  onUtilityAction: (action: UtilityAction) => void;
  isLoading: Record<UtilityAction, boolean>;
}

const DocumentUtilitiesSection: FC<DocumentUtilitiesSectionProps> = ({
  documents,
  selectedDocumentName,
  onSelectDocument,
  onUtilityAction,
  isLoading,
}) => {
  return (
    <Card className="glass-panel rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl font-headline">
          <FileText className="mr-2 h-6 w-6 text-primary" />
          Document Utilities
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Select onValueChange={onSelectDocument} value={selectedDocumentName} disabled={documents.length === 0}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a document" />
          </SelectTrigger>
          <SelectContent>
            {documents.map((doc) => (
              <SelectItem key={doc.name} value={doc.name}>
                {doc.name}
              </SelectItem>
            ))}
            {documents.length === 0 && <SelectItem value="no-doc" disabled>No documents uploaded</SelectItem>}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            onClick={() => onUtilityAction('faq')}
            disabled={!selectedDocumentName || isLoading.faq}
            className="w-full btn-glow-primary-hover"
            variant="outline"
          >
            <Lightbulb className="mr-2 h-4 w-4" />
            {isLoading.faq ? 'Generating...' : 'Generate FAQ'}
          </Button>
          <Button
            onClick={() => onUtilityAction('topics')}
            disabled={!selectedDocumentName || isLoading.topics}
            className="w-full btn-glow-primary-hover"
            variant="outline"
          >
            <ListOrdered className="mr-2 h-4 w-4" />
            {isLoading.topics ? 'Generating...' : 'Generate Topics'}
          </Button>
          <Button
            onClick={() => onUtilityAction('mindmap')}
            disabled={!selectedDocumentName || isLoading.mindmap}
            className="w-full btn-glow-primary-hover"
            variant="outline"
          >
            <Brain className="mr-2 h-4 w-4" />
            {isLoading.mindmap ? 'Generating...' : 'Generate Mind Map'}
          </Button>
          <Button
            onClick={() => onUtilityAction('podcast')}
            disabled={!selectedDocumentName || isLoading.podcast}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 btn-glow-accent-hover"
          >
            <Podcast className="mr-2 h-4 w-4" />
            {isLoading.podcast ? 'Generating...' : 'Generate Podcast Script'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentUtilitiesSection;
