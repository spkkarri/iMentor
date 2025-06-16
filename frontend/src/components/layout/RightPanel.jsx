// frontend/src/components/layout/RightPanel.jsx
import React, { useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import AnalysisToolRunner from '../analysis/AnalysisToolRunner.jsx';
import PodcastGenerator from '../analysis/PodcastGenerator.jsx';
import KnowledgeGraphViewer from '../analysis/KnowledgeGraphViewer.jsx'; // <<< NEW IMPORT
import api from '../../services/api.js'; // <<< NEW IMPORT
import { PanelRightClose, ChevronDown, ChevronUp, Telescope, Radio, BrainCircuit } from 'lucide-react'; // <<< NEW IMPORT
import IconButton from '../core/IconButton.jsx';
import Modal from '../core/Modal.jsx'; // <<< NEW IMPORT
import Button from '../core/Button.jsx'; // <<< NEW IMPORT
import { motion } from 'framer-motion';

function RightPanel() {
    const { setIsRightPanelOpen, selectedDocumentForAnalysis, selectedSubject, user } = useAppState();
    const [isAnalyzerOpen, setIsAnalyzerOpen] = useState(true);

    const [isKgModalOpen, setIsKgModalOpen] = useState(false);
    const [kgData, setKgData] = useState(null);
    const [isLoadingKg, setIsLoadingKg] = useState(false);

    const currentSelectedDocFilename = selectedDocumentForAnalysis || null;
    const isTargetAdminSubject = !!(selectedSubject && currentSelectedDocFilename && selectedSubject === currentSelectedDocFilename);

    const handleVisualizeKg = async () => {
        if (!currentSelectedDocFilename) return;
        setIsKgModalOpen(true);
        setIsLoadingKg(true);
        setKgData(null); // Clear previous data
        try {
            const data = await api.getKnowledgeGraph(currentSelectedDocFilename);
            setKgData(data);
        } catch (error) {
            const errorMessage = error.response?.data?.message || "Could not fetch knowledge graph.";
            toast.error(errorMessage);
            setKgData({ error: errorMessage });
        } finally {
            setIsLoadingKg(false);
        }
    };

    return (
        <>
            <div className="flex flex-col h-full p-3 sm:p-4 bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark custom-scrollbar">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-border-light dark:border-border-dark">
                    <h2 className="text-base font-semibold">Advanced Analyzer</h2>
                    <IconButton
                        icon={PanelRightClose}
                        onClick={() => setIsRightPanelOpen(false)}
                        title="Close Analyzer Panel"
                        variant="ghost" size="sm"
                        className="text-text-muted-light dark:text-text-muted-dark hover:text-primary dark:hover:text-primary-light"
                    />
                </div>
                
                {!currentSelectedDocFilename ? (
                    <div className="p-4 text-xs text-center text-text-muted-light dark:text-text-muted-dark bg-gray-50 dark:bg-gray-800 rounded-md border border-dashed border-border-light dark:border-border-dark">
                        <p>Select a document from the left panel to enable analysis and generation tools.</p>
                    </div>
                ) : (
                    <div className="flex-grow space-y-4 overflow-y-auto custom-scrollbar pr-1">
                        {/* Analysis Tools Section */}
                        <div>
                            <button
                                onClick={() => setIsAnalyzerOpen(!isAnalyzerOpen)}
                                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-left bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md focus:outline-none shadow-sm border border-border-light dark:border-border-dark"
                            >
                                <span className="flex items-center gap-2"><Telescope size={16} /> Analysis Tools</span>
                                {isAnalyzerOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                            {isAnalyzerOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: "easeInOut" }} className="mt-2 space-y-3 overflow-hidden"
                                >
                                    <AnalysisToolRunner toolType="faq" title="FAQ Generator" iconName="HelpCircle" selectedDocumentFilename={currentSelectedDocFilename} isTargetAdminDoc={isTargetAdminSubject} />
                                    <AnalysisToolRunner toolType="topics" title="Key Topics Extractor" iconName="Tags" selectedDocumentFilename={currentSelectedDocFilename} isTargetAdminDoc={isTargetAdminSubject} />
                                    <AnalysisToolRunner toolType="mindmap" title="Mind Map Creator" iconName="GitFork" selectedDocumentFilename={currentSelectedDocFilename} isTargetAdminDoc={isTargetAdminSubject} />
                                </motion.div>
                            )}
                        </div>

                        {/* Content Exporters Section */}
                        <div>
                            <div className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-left bg-gray-50 dark:bg-gray-800 rounded-md border border-border-light dark:border-border-dark">
                               <span className="flex items-center gap-2"><Radio size={16} /> Content Exporters</span>
                            </div>
                             <div className="mt-2 space-y-3">
                                <PodcastGenerator selectedDocumentFilename={currentSelectedDocFilename} />
                                {/* NEW VISUALIZATION BUTTON */}
                                <Button
                                    onClick={handleVisualizeKg}
                                    variant="outline"
                                    size="sm"
                                    fullWidth
                                    isLoading={isLoadingKg}
                                    leftIcon={<BrainCircuit size={16} />}
                                >
                                    Visualize Knowledge Graph
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* NEW KG MODAL */}
            <Modal
                isOpen={isKgModalOpen}
                onClose={() => setIsKgModalOpen(false)}
                title={`Knowledge Graph: ${currentSelectedDocFilename}`}
                size="5xl" // Use a very large modal for the graph
            >
                <KnowledgeGraphViewer graphData={isLoadingKg ? null : kgData} />
            </Modal>
        </>
    );
}
export default RightPanel;