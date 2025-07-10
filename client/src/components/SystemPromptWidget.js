// client/src/components/SystemPromptWidget.js
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'; // ADDED
import { faCog } from '@fortawesome/free-solid-svg-icons';    // ADDED - or faRobot, faBrain, faScroll etc.
import './SystemPromptWidget.css'

// Define the THREE required system prompts + a Custom option
export const availablePrompts = [
  {
    id: 'friendly',
    title: 'Friendly Tutor',
    prompt: 'You are a friendly, patient, and encouraging tutor specializing in engineering and scientific topics for PhD students. Explain concepts clearly, break down complex ideas, use analogies, and offer positive reinforcement. Ask follow-up questions to ensure understanding.',
  },
  {
    id: 'explorer', // Changed ID slightly for clarity
    title: 'Concept Explorer',
    prompt: 'You are an expert academic lecturer introducing a new, complex engineering or scientific concept. Your goal is to provide a deep, structured explanation. Define terms rigorously, outline the theory, provide relevant mathematical formulations (using Markdown), illustrative examples, and discuss applications or limitations pertinent to PhD-level research.',
  },
  {
    id: 'knowledge_check',
    title: 'Knowledge Check',
    prompt: 'You are assessing understanding of engineering/scientific topics. Ask targeted questions to test knowledge, identify misconceptions, and provide feedback on the answers. Start by asking the user what topic they want to be quizzed on.',
  },
   {
    id: 'custom', // Represents user-edited state
    title: 'Custom Prompt',
    prompt: '', // Placeholder, actual text comes from textarea
   },
  //  {
  //   id: 'friendly',
  //   title: 'Friendly Tutor',
  //   prompt: 'You are a friendly, patient, and encouraging tutor specializing in engineering and scientific topics for PhD students. Explain concepts clearly, break down complex ideas, use analogies, and offer positive reinforcement. Ask follow-up questions to ensure understanding.',
  // },
  // {
  //   id: 'explorer',
  //   title: 'Concept Explorer',
  //   prompt: 'You are an expert academic lecturer introducing a new, complex engineering or scientific concept. Your goal is to provide a deep, structured explanation. Define terms rigorously, outline the theory, provide relevant mathematical formulations (using Markdown), illustrative examples, and discuss applications or limitations pertinent to PhD-level research.',
  // },
  // {
  //   id: 'knowledge_check',
  //   title: 'Knowledge Check',
  //   prompt: 'You are assessing understanding of engineering/scientific topics. Ask targeted questions to test knowledge, identify misconceptions, and provide feedback on the answers. Start by asking the user what topic they want to be quizzed on.',
  // },
  //  {
  //   id: 'custom',
  //   title: 'Custom Prompt',
  //   prompt: '',
  // },
];

// Helper to find prompt text by ID - Export if needed elsewhere
export const getPromptTextById = (id) => {
  const prompt = availablePrompts.find(p => p.id === id);
  return prompt ? prompt.prompt : ''; // Return empty string if not found
};


/**
 * Renders a sidebar widget with a dropdown for preset prompts
 * and an editable textarea for the current system prompt.
 * @param {object} props - Component props.
 * @param {string} props.selectedPromptId - The ID of the currently active preset (or 'custom').
 * @param {string} props.promptText - The current text of the system prompt (potentially edited).
 * @param {function} props.onSelectChange - Callback when dropdown selection changes. Passes the new ID.
 * @param {function} props.onTextChange - Callback when the textarea content changes. Passes the new text.
 */
const SystemPromptWidget = ({ selectedPromptId, promptText, onSelectChange, onTextChange,  isExpanded,  toggleSidebar  }) => {

  const handleDropdownChange = (event) => {
    const newId = event.target.value;
    onSelectChange(newId); // Notify parent of the ID change
  };

  const handleTextareaChange = (event) => {
    onTextChange(event.target.value); // Notify parent of the text change
  };

  return (
    <div 
        className="widget-container system-prompt-widget" // Root div with both classes
        data-tooltip={!isExpanded ? "Assistant Mode" : null}
        onClick={!isExpanded ? toggleSidebar : undefined}
        style={!isExpanded ? { cursor: 'pointer' } : {}}
    >
        {/* Header: Contains Icon and (conditional) Title */}
        <div className="widget-header">
            <FontAwesomeIcon icon={faCog} className="widget-icon" />
            {isExpanded && <h3 className="widget-title">Assistant Mode</h3>} 
        </div>

        {/* Content: Only shown if the sidebar is expanded */}
        {isExpanded && (
            <div className="widget-content">
                {/* Dropdown for selecting presets */}
                <select
                    className="prompt-select" // Your specific class for this select
                    value={selectedPromptId}
                    onChange={handleDropdownChange}
                    aria-label="Select Assistant Mode"
                >
                    {availablePrompts.filter(p => p.id !== 'custom').map((p) => (
                    <option key={p.id} value={p.id}>
                        {p.title}
                    </option>
                    ))}
                    {selectedPromptId === 'custom' && (
                        <option key="custom" value="custom">
                            Custom Prompt
                        </option>
                    )}
                </select>

                {/* Editable Textarea for the actual prompt */}
                <label htmlFor="system-prompt-text-widget" className="prompt-label"> {/* Changed id for label */}
                    System Prompt (Editable)
                </label>
                <textarea
                    id="system-prompt-text-widget" // Ensure unique IDs if the old one is still in ChatPage
                    className="prompt-textarea" // Your specific class for this textarea
                    value={promptText}
                    onChange={handleTextareaChange}
                    rows="5"
                    maxLength="2000"
                    placeholder="The current system prompt will appear here. You can edit it directly."
                    aria-label="Editable System Prompt Text"
                />
                
                <div className="char-count">{promptText?.length || 0} / 2000</div> 
            </div>
        )}
    </div>
  );
};

export default SystemPromptWidget;