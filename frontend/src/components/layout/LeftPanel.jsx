// frontend/src/components/layout/LeftPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAppState } from '../../contexts/AppStateContext.jsx';
import DocumentUpload from '../documents/DocumentUpload.jsx';
import KnowledgeSourceList from '../documents/KnowledgeSourceList.jsx';
import SubjectList from '../documents/SubjectList.jsx';
import {
    PanelLeftClose, ChevronDown, ChevronUp, FilePlus, Settings2,
    Bot, BookOpen, Lightbulb, Library
} from 'lucide-react';
import IconButton from '../core/IconButton.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../services/api.js';

const PROMPT_PRESETS = [
     { id: 'friendly_tutor', name: 'Friendly Tutor', icon: Bot, text: "You are a friendly, patient, and encouraging tutor specializing in engineering and scientific topics for PhD students. Explain concepts clearly, break down complex ideas, use analogies, and offer positive reinforcement. Ask follow-up questions to ensure understanding." },
     { id: 'concept_explorer', name: 'Concept Explorer', icon: BookOpen, text: "You are an expert academic lecturer introducing a new, complex engineering or scientific concept. Your goal is to provide a deep, structured explanation. Define terms rigorously, outline the theory, provide relevant mathematical formulations (using Markdown), illustrative examples, and discuss applications or limitations pertinent to PhD-level research." },
     { id: 'knowledge_check', name: 'Knowledge Check', icon: Lightbulb, text: "You are assessing understanding of engineering/scientific topics. Ask targeted questions to test knowledge, identify misconceptions, and provide feedback on the answers. Start by asking the user what topic they want to be quizzed on." },
     { id: 'custom', name: 'Custom Prompt', icon: Settings2, text: "You are a helpful AI engineering tutor." }
];

function LeftPanel({ isChatProcessing }) {
    const {
        setIsLeftPanelOpen,
        systemPrompt, setSystemPrompt,
        selectDocumentForAnalysis, selectedDocumentForAnalysis,
        selectedSubject, setSelectedSubject
    } = useAppState();

    const [isPromptSectionOpen, setIsPromptSectionOpen] = useState(false);
    const [isSubjectSectionOpen, setIsSubjectSectionOpen] = useState(false);
    const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);

    const [selectedPresetId, setSelectedPresetId] = useState('custom');
    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
    const [subjectFetchError, setSubjectFetchError] = useState('');
    const [refreshKey, setRefreshKey] = useState(Date.now());

    useEffect(() => {
        const matchedPreset = PROMPT_PRESETS.find(p => p.text === systemPrompt);
        setSelectedPresetId(matchedPreset ? matchedPreset.id : 'custom');
    }, [systemPrompt]);

    const fetchSubjects = useCallback(async () => {
        setIsLoadingSubjects(true);
        setSubjectFetchError('');
        try {
            const response = await api.getSubjects();
            const subjects = Array.isArray(response.subjects) ? response.subjects : [];
            setAvailableSubjects(subjects);
        } catch (error) {
            const errorMsg = error.response?.data?.message || error.message || "Failed to load subjects.";
            toast.error(errorMsg);
            setSubjectFetchError(errorMsg);
        } finally {
            setIsLoadingSubjects(false);
        }
    }, []);

    useEffect(() => {
        fetchSubjects();
    }, [fetchSubjects]);

    const handlePresetChange = (event) => {
        const presetId = event.target.value;
        setSelectedPresetId(presetId);
        const selectedPreset = PROMPT_PRESETS.find(p => p.id === presetId);
        if (selectedPreset) setSystemPrompt(selectedPreset.text);
    };

    const handleSourceAdded = () => {
        toast.success("New source added! Refreshing list...", { id: 'refresh-toast' });
        setRefreshKey(Date.now());
    };

    const togglePromptSection = () => {
        const nextState = !isPromptSectionOpen;
        setIsPromptSectionOpen(nextState);
        if (nextState) {
            setIsSubjectSectionOpen(false);
            setIsKnowledgeBaseOpen(false);
        }
    };

    const toggleSubjectSection = () => {
        const nextState = !isSubjectSectionOpen;
        setIsSubjectSectionOpen(nextState);
        if (nextState) {
            setIsPromptSectionOpen(false);
            setIsKnowledgeBaseOpen(false);
        }
    };

    const toggleKnowledgeBaseSection = () => {
        const nextState = !isKnowledgeBaseOpen;
        setIsKnowledgeBaseOpen(nextState);
        if (nextState) {
            setIsPromptSectionOpen(false);
            setIsSubjectSectionOpen(false);
        }
    };
    
    const sectionVariants = {
        open: {
            height: 'auto',
            opacity: 1,
            transition: { type: 'spring', stiffness: 400, damping: 40 }
        },
        closed: {
            height: 0,
            opacity: 0,
            transition: { type: 'spring', stiffness: 400, damping: 40 }
        }
    };

    const SelectedPresetIcon = PROMPT_PRESETS.find(p => p.id === selectedPresetId)?.icon || Settings2;

    return (
        <div className={`flex flex-col h-full ${isChatProcessing ? 'processing-overlay' : ''}`}>
            <div className="flex items-center justify-between mb-3 px-1 pt-1">
                <h2 className="text-sm font-semibold text-text-light dark:text-text-dark">Assistant Controls</h2>
                <IconButton
                    icon={PanelLeftClose}
                    onClick={() => setIsLeftPanelOpen(false)}
                    title="Close Assistant Panel"
                    variant="ghost" size="sm"
                    className="text-text-muted-light dark:text-text-muted-dark hover:text-primary"
                />
            </div>

            {/* Custom Prompt Section */}
            <div className="mb-4">
                <button onClick={togglePromptSection} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-left text-text-light dark:text-text-dark bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md focus:outline-none shadow-sm border border-border-light dark:border-border-dark" aria-expanded={isPromptSectionOpen}>
                    <span className="flex items-center gap-2"><SelectedPresetIcon size={16} className="text-primary dark:text-primary-light" /> Custom Prompt</span>
                    {isPromptSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <AnimatePresence initial={false}>
                    {isPromptSectionOpen && (
                        <motion.div 
                            key="prompt-section-content" 
                            variants={sectionVariants}
                            initial="closed"
                            animate="open"
                            exit="closed"
                            className="mt-2 p-3 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-md shadow-inner overflow-hidden">
                             <label htmlFor="prompt-preset-select" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">Prompt Mode:</label>
                             <select id="prompt-preset-select" value={selectedPresetId} onChange={handlePresetChange} className="input-field mb-2 text-xs py-1.5">
                                 {PROMPT_PRESETS.map(preset => (<option key={preset.id} value={preset.id}>{preset.name}</option>))}
                             </select>
                             <label htmlFor="system-prompt-area" className="block text-xs font-medium text-text-muted-light dark:text-text-muted-dark mb-1">System Prompt (Editable):</label>
                             <textarea id="system-prompt-area" value={systemPrompt} onChange={(e) => { setSystemPrompt(e.target.value); setSelectedPresetId('custom'); }} rows="5" className="input-field text-xs custom-scrollbar" placeholder="Enter system prompt..."/>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Admin Subjects Section */}
            <div className="mb-4">
                <button onClick={toggleSubjectSection} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-left text-text-light dark:text-text-dark bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md focus:outline-none shadow-sm border border-border-light dark:border-border-dark" aria-expanded={isSubjectSectionOpen}>
                    <span className="flex items-center gap-2"><Library size={16} className="text-primary dark:text-primary-light" /> Admin Subjects</span>
                    {isSubjectSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <AnimatePresence initial={false}>
                    {isSubjectSectionOpen && (
                        <motion.div 
                            key="subject-select-content" 
                            variants={sectionVariants}
                            initial="closed"
                            animate="open"
                            exit="closed"
                            className="mt-2 p-3 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-md shadow-inner overflow-hidden">
                           <SubjectList
                                subjects={availableSubjects}
                                selectedSubject={selectedSubject}
                                onSelectSubject={setSelectedSubject}
                                isLoading={isLoadingSubjects}
                                error={subjectFetchError}
                           />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* User's Knowledge Base Section */}
            <div className="flex-grow flex flex-col overflow-hidden">
                <button onClick={toggleKnowledgeBaseSection} className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-left text-text-light dark:text-text-dark bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md focus:outline-none shadow-sm border border-border-light dark:border-border-dark mb-2" aria-expanded={isKnowledgeBaseOpen}>
                    <span className="flex items-center gap-2"><FilePlus size={16} className="text-primary dark:text-primary-light" /> My Knowledge Base</span>
                    {isKnowledgeBaseOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                <AnimatePresence initial={false}>
                    {isKnowledgeBaseOpen && (
                        <motion.div 
                            key="knowledge-base-content" 
                            variants={sectionVariants}
                            initial="closed"
                            animate="open"
                            exit="closed"
                            className="flex-grow flex flex-col p-3 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-md shadow-inner">
                            <DocumentUpload onSourceAdded={handleSourceAdded}  />
                            <div className="mt-3 flex-grow overflow-y-auto custom-scrollbar">
                                <KnowledgeSourceList
                                    key={refreshKey}
                                    onSelectSource={selectDocumentForAnalysis}
                                    selectedSource={selectedDocumentForAnalysis}
                                    onRefreshNeeded={refreshKey}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
export default LeftPanel;