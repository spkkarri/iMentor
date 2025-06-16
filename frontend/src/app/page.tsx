'use client';

import { useState, type FC } from 'react';
import AppHeader from '@/components/app-header';
import DocumentUploadSection from '@/components/document-upload-section';
import DocumentUtilitiesSection from '@/components/document-utilities-section';
import ChatTutorSection from '@/components/chat-tutor-section';
import HelpTooltip from '@/components/help-tooltip';
import { useToast } from "@/hooks/use-toast";
import { generateFaq, generateTopics, generateMindMap, generatePodcastScript } from '@/app/actions';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


export interface DocumentFile {
  name: string;
  content: string;
  type: string;
}

export type UtilityAction = 'faq' | 'topics' | 'mindmap' | 'podcast';

const Home: FC = () => {
  const [uploadedDocs, setUploadedDocs] = useState<DocumentFile[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [utilityResult, setUtilityResult] = useState<{ title: string; content: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingUtility, setIsLoadingUtility] = useState<Record<UtilityAction, boolean>>({
    faq: false,
    topics: false,
    mindmap: false,
    podcast: false,
  });

  const { toast } = useToast();

  const handleDocumentUpload = async (file: File) => {
    setIsUploading(true);
    toast({ title: "Uploading Document", description: `Processing ${file.name}...` });

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const newDoc: DocumentFile = { name: file.name, content, type: file.type };
        setUploadedDocs((prev) => {
          const existing = prev.find(doc => doc.name === newDoc.name);
          if (existing) {
            return prev.map(doc => doc.name === newDoc.name ? newDoc : doc);
          }
          return [...prev, newDoc];
        });
        setSelectedDoc(newDoc); // Auto-select the newly uploaded document
        toast({ title: "Upload Successful", description: `${file.name} added to knowledge base.` });
      };
      reader.onerror = () => {
        toast({ variant: "destructive", title: "Upload Failed", description: `Could not read ${file.name}.` });
      };
      reader.readAsText(file); // Assuming text-based documents for now
    } catch (error) {
      console.error("File upload error:", error);
      toast({ variant: "destructive", title: "Upload Error", description: "An unexpected error occurred during upload." });
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleSelectDocument = (documentName: string) => {
    const doc = uploadedDocs.find(d => d.name === documentName);
    if (doc) {
      setSelectedDoc(doc);
      toast({ title: "Document Selected", description: `${doc.name} is now active.` });
    }
  };

  const handleUtilityAction = async (action: UtilityAction) => {
    if (!selectedDoc) {
      toast({ variant: "destructive", title: "No Document Selected", description: "Please select a document first." });
      return;
    }

    setIsLoadingUtility(prev => ({ ...prev, [action]: true }));
    toast({ title: "Processing Utility", description: `Generating ${action} for ${selectedDoc.name}...` });

    try {
      let result: { title: string; content: string } | null = null;
      const docContentInput = { documentContent: selectedDoc.content };
      const docTextInput = { documentText: selectedDoc.content }; // for generateTopics

      switch (action) {
        case 'faq':
          const faqRes = await generateFaq(docContentInput);
          result = { title: `FAQ for ${selectedDoc.name}`, content: faqRes.faqList };
          break;
        case 'topics':
          const topicsRes = await generateTopics(docTextInput);
          result = { title: `Key Topics for ${selectedDoc.name}`, content: topicsRes.topics.join('\n- ') };
          break;
        case 'mindmap':
          const mindmapRes = await generateMindMap(docContentInput);
          result = { title: `Mind Map for ${selectedDoc.name}`, content: mindmapRes.mindMap };
          break;
        case 'podcast':
          const podcastRes = await generatePodcastScript(docContentInput);
          result = { title: `Podcast Script for ${selectedDoc.name}`, content: podcastRes.podcastScript };
          break;
      }
      
      if (result) {
        setUtilityResult(result);
        setIsModalOpen(true);
        toast({ title: "Utility Generated", description: `${action} for ${selectedDoc.name} is ready.` });
      }
    } catch (error: any) {
      console.error(`Error generating ${action}:`, error);
      toast({ variant: "destructive", title: `Error Generating ${action}`, description: error.message || "An unexpected error occurred." });
    } finally {
      setIsLoadingUtility(prev => ({ ...prev, [action]: false }));
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-body">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column */}
          <div className="w-full lg:w-[35%] xl:w-[30%] space-y-8">
            <DocumentUploadSection onDocumentUpload={handleDocumentUpload} isUploading={isUploading} />
            <DocumentUtilitiesSection
              documents={uploadedDocs}
              selectedDocumentName={selectedDoc?.name}
              onSelectDocument={handleSelectDocument}
              onUtilityAction={handleUtilityAction}
              isLoading={isLoadingUtility}
            />
          </div>
          {/* Right Column */}
          <div className="w-full lg:w-[65%] xl:w-[70%]">
            <ChatTutorSection documentContent={selectedDoc?.content || null} />
          </div>
        </div>
      </main>
      <HelpTooltip />

      {utilityResult && (
        <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <AlertDialogContent className="max-w-2xl glass-panel">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-headline text-primary">{utilityResult.title}</AlertDialogTitle>
              <AlertDialogDescription className="max-h-[60vh] overflow-y-auto text-sm text-foreground/80 whitespace-pre-wrap">
                {utilityResult.content}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setIsModalOpen(false)} className="btn-glow-primary-hover">Close</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default Home;
