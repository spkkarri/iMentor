class MindMapGenerator {
    // Convert Gemini AI's mind map data into React Flow format
    static formatForReactFlow(geminiMindMap) {
        if (!geminiMindMap?.nodes || !geminiMindMap?.edges) {
            throw new Error('Invalid mind map data format');
        }

        // Create nodes with proper React Flow format
        const nodes = geminiMindMap.nodes.map((node, index) => ({
            id: node.id || `node-${index}`,
            type: 'mindmap-node',
            data: {
                label: node.data?.label || node.label || `Node ${index + 1}`,
                content: node.data?.content || node.content || ''
            },
            position: node.position || {
                x: index * 200,
                y: index === 0 ? 0 : 100 + (index * 80)
            }
        }));

        // Create edges with proper React Flow format
        const edges = geminiMindMap.edges.map((edge, index) => ({
            id: edge.id || `edge-${index}`,
            source: edge.source || edge.from,
            target: edge.target || edge.to,
            type: 'smoothstep',
            data: {
                label: edge.data?.label || edge.label || ''
            }
        }));

        // Ensure we have at least one node
        if (nodes.length === 0) {
            nodes.push({
                id: 'central',
                type: 'mindmap-node',
                data: {
                    label: 'Main Topic',
                    content: 'No content available'
                },
                position: { x: 0, y: 0 }
            });
        }

        // Position central node (first node) at center
        if (nodes.length > 0) {
            nodes[0].position = { x: 0, y: 0 };
        }

        return {
            nodes,
            edges
        };
    }

    // Enhanced helper to create a mind map structure with sub-nodes from text
    static createBasicMindMap(text) {
        // Parse text into sections and subsections
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);
        
        if (lines.length === 0) {
            return {
                nodes: [{
                    id: 'central',
                    type: 'mindmap-node',
                    data: {
                        label: 'Main Topic',
                        content: 'No content available'
                    },
                    position: { x: 0, y: 0 }
                }],
                edges: []
            };
        }

        const nodes = [];
        const edges = [];
        let nodeIdCounter = 0;

        // Create central node
        const centralNode = {
            id: 'central',
            type: 'mindmap-node',
            data: {
            label: 'Main Topic',
                content: lines[0] || 'Document Content'
            },
            position: { x: 0, y: 0 }
        };
        nodes.push(centralNode);

        // Process remaining lines to create main nodes and sub-nodes
        const mainNodes = [];
        const subNodes = [];
        let currentMainNode = null;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const indentLevel = (line.match(/^(\s*)/)[0].length / 2); // Count spaces/indentation

            if (indentLevel === 0 || line.match(/^\d+\./)) {
                // Main node (no indent or numbered)
                currentMainNode = {
                    id: `main-${nodeIdCounter++}`,
                    type: 'mindmap-node',
                    data: {
                        label: line.replace(/^\d+\.\s*/, ''), // Remove numbering
                        content: line
                    },
                    position: { x: (mainNodes.length * 250) - 250, y: 150 }
                };
                mainNodes.push(currentMainNode);
                nodes.push(currentMainNode);
                
                // Connect to central node
                edges.push({
                    id: `edge-central-${currentMainNode.id}`,
                    source: 'central',
                    target: currentMainNode.id,
                    type: 'smoothstep',
                    data: { label: '' }
                });
            } else if (currentMainNode && indentLevel > 0) {
                // Sub-node (indented)
                const subNode = {
                    id: `sub-${nodeIdCounter++}`,
                    type: 'mindmap-node',
                    data: {
                        label: line.replace(/^[\s-]*/, ''), // Remove indentation and dashes
                        content: line
                    },
                    position: { 
                        x: currentMainNode.position.x + (subNodes.length * 180) - 180, 
                        y: currentMainNode.position.y + 120 
                    }
                };
                subNodes.push(subNode);
                nodes.push(subNode);
                
                // Connect to main node
                edges.push({
                    id: `edge-${currentMainNode.id}-${subNode.id}`,
                    source: currentMainNode.id,
                    target: subNode.id,
                    type: 'smoothstep',
                    data: { label: '' }
                });
            }
        }

        return { nodes, edges };
    }

    // Enhanced fallback method with sub-nodes when AI generation fails
    static createFallbackMindMap(content) {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10).slice(0, 15);
        
        const nodes = [{
            id: 'central',
            type: 'mindmap-node',
            data: {
                label: 'Document Content',
                content: 'Generated from document'
            },
            position: { x: 0, y: 0 }
        }];

        const edges = [];
        let nodeIdCounter = 0;

        // Group sentences into main topics and sub-topics
        const mainTopics = [];
        const subTopics = [];

        sentences.forEach((sentence, index) => {
            const words = sentence.trim().split(/\s+/);
            const firstWords = words.slice(0, 3).join(' ');
            
            if (index % 3 === 0) {
                // Main topic
                const mainNode = {
                    id: `main-${nodeIdCounter++}`,
                    type: 'mindmap-node',
                    data: {
                        label: firstWords,
                        content: sentence.trim()
                    },
                    position: { x: (mainTopics.length * 250) - 250, y: 150 }
                };
                mainTopics.push(mainNode);
                nodes.push(mainNode);
                
                edges.push({
                    id: `edge-central-${mainNode.id}`,
                    source: 'central',
                    target: mainNode.id,
                    type: 'smoothstep',
                    data: { label: '' }
                });
            } else {
                // Sub-topic
                const subNode = {
                    id: `sub-${nodeIdCounter++}`,
                    type: 'mindmap-node',
                    data: {
                        label: firstWords,
                        content: sentence.trim()
                    },
                    position: { 
                        x: (subTopics.length * 180) - 180, 
                        y: 300 
                    }
                };
                subTopics.push(subNode);
                nodes.push(subNode);
                
                // Connect to the last main topic
                if (mainTopics.length > 0) {
                    const lastMainTopic = mainTopics[mainTopics.length - 1];
                    edges.push({
                        id: `edge-${lastMainTopic.id}-${subNode.id}`,
                        source: lastMainTopic.id,
                        target: subNode.id,
                        type: 'smoothstep',
                        data: { label: '' }
                    });
                }
            }
        });

        return { nodes, edges };
    }

    // New method to create hierarchical mind map from structured content
    static createHierarchicalMindMap(content) {
        const sections = this.parseContentIntoSections(content);
        const nodes = [];
        const edges = [];
        let nodeIdCounter = 0;

        // Central node
        const centralNode = {
            id: 'central',
            type: 'mindmap-node',
            data: {
                label: 'Main Topic',
                content: sections.title || 'Document'
            },
            position: { x: 0, y: 0 }
        };
        nodes.push(centralNode);

        // Create main section nodes
        sections.mainSections.forEach((section, sectionIndex) => {
            const mainNode = {
                id: `main-${nodeIdCounter++}`,
                type: 'mindmap-node',
                data: {
                    label: section.title,
                    content: section.content
                },
                position: { x: (sectionIndex * 300) - 300, y: 150 }
            };
            nodes.push(mainNode);
            
            // Connect to central node
            edges.push({
                id: `edge-central-${mainNode.id}`,
                source: 'central',
                target: mainNode.id,
                type: 'smoothstep',
                data: { label: '' }
            });

            // Create sub-nodes for this section
            section.subsections.forEach((subsection, subIndex) => {
                const subNode = {
                    id: `sub-${nodeIdCounter++}`,
                    type: 'mindmap-node',
                    data: {
                        label: subsection.title,
                        content: subsection.content
                    },
                    position: { 
                        x: mainNode.position.x + (subIndex * 200) - 200, 
                        y: mainNode.position.y + 120 
                    }
                };
                nodes.push(subNode);
                
                // Connect to main node
                edges.push({
                    id: `edge-${mainNode.id}-${subNode.id}`,
                    source: mainNode.id,
                    target: subNode.id,
                    type: 'smoothstep',
                    data: { label: '' }
                });
            });
        });

        return { nodes, edges };
    }

    // Helper to determine if a line is a main section
    static isMainSection(line) {
        return line.match(/^\d+\./) || (line.length > 3 && line[0] === line[0].toUpperCase() && !line.includes(':'));
    }

    // Helper to determine if a line is a subsection
    static isSubSection(line) {
        return line.match(/^\s*[-•*]\s/) || line.match(/^\s*[a-z]\./);
    }
    
    // Process a single line to build the sections object
    static processLine(line, sections, currentSection, currentSubsection) {
        if (MindMapGenerator.isMainSection(line)) {
            if (currentSection) sections.mainSections.push(currentSection);
            currentSection = {
                title: line.replace(/^\d+\.\s*/, ''),
                content: line,
                subsections: []
            };
            currentSubsection = null; // Reset subsection
        } else if (MindMapGenerator.isSubSection(line)) {
            if (currentSection) {
                currentSubsection = {
                    title: line.replace(/^\s*[-•*]\s*/, '').replace(/^\s*[a-z]\.\s*/, ''),
                    content: line
                };
                currentSection.subsections.push(currentSubsection);
            }
        } else if (line.length > 0) {
            // Append content to the current section or subsection
            if (currentSubsection) {
                currentSubsection.content += ' ' + line;
            } else if (currentSection) {
                currentSection.content += ' ' + line;
            }
        }
        return { currentSection, currentSubsection };
    }

    // Helper method to parse content into sections, now refactored
    static parseContentIntoSections(content) {
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);
        const sections = { title: lines[0] || 'Document', mainSections: [] };
        let state = { currentSection: null, currentSubsection: null };

        for (const line of lines.slice(1)) {
            state = MindMapGenerator.processLine(line, sections, state.currentSection, state.currentSubsection);
        }

        // Add the last section if it exists
        if (state.currentSection) {
            sections.mainSections.push(state.currentSection);
        }

        return sections;
    }

    /**
     * Creates a fallback mind map in Mermaid syntax when AI generation fails.
     * This version is simplified to be more robust.
     * @param {string} content - The text content of the document.
     * @param {string} title - The title of the document.
     * @returns {string} A Mermaid syntax string.
     */
    static createMermaidFallback(content, title) {
        console.log("[MindMapGenerator] Creating enhanced Mermaid fallback.");

        // Sanitize title for the root node
        const rootTitle = this.escapeMermaidText(title || "Document");
        let mermaidString = `mindmap\n  root((${rootTitle}))\n`;

        // Extract meaningful content sections
        const lines = content.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 15 && !l.match(/^[0-9\s\-\*\.]+$/)); // Filter out numbering/bullets

        if (lines.length === 0) {
            mermaidString += `    No_Content\n      Empty_Document\n`;
            mermaidString += `\nclick No_Content handleMermaidNodeClick\n`;
            mermaidString += `click Empty_Document handleMermaidNodeClick\n`;
            return mermaidString;
        }

        // Group content into logical sections
        const sections = this.extractSections(lines);
        const clickEvents = [];

        sections.forEach((section, index) => {
            const sectionId = `Section_${index + 1}`;
            const sectionLabel = this.createNodeLabel(section.title);

            mermaidString += `    ${sectionId}[${sectionLabel}]\n`;
            clickEvents.push(`click ${sectionId} handleMermaidNodeClick`);

            // Add subsections
            section.items.forEach((item, itemIndex) => {
                const itemId = `Item_${index + 1}_${itemIndex + 1}`;
                const itemLabel = this.createNodeLabel(item);

                mermaidString += `      ${itemId}[${itemLabel}]\n`;
                clickEvents.push(`click ${itemId} handleMermaidNodeClick`);
            });
        });

        // Add click events
        mermaidString += '\n' + clickEvents.join('\n') + '\n';

        return mermaidString;
    }

    static extractSections(lines) {
        const sections = [];
        let currentSection = null;

        lines.slice(0, 20).forEach((line, index) => { // Limit to first 20 lines
            if (index % 4 === 0 || line.length > 100) {
                // Start new section
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = {
                    title: line.substring(0, 60),
                    items: []
                };
            } else if (currentSection && currentSection.items.length < 3) {
                // Add to current section
                currentSection.items.push(line.substring(0, 50));
            }
        });

        if (currentSection) {
            sections.push(currentSection);
        }

        return sections.slice(0, 5); // Max 5 sections
    }

    static createNodeLabel(text) {
        return this.escapeMermaidText(
            text.substring(0, 25) + (text.length > 25 ? '...' : '')
        );
    }

    /**
     * Escapes special characters in a string to be safely used in Mermaid labels and click functions.
     * @param {string} text - The text to escape.
     * @returns {string} The escaped text.
     */
    static escapeMermaidText(text) {
        if (!text) return '';
        return text
            .replace(/"/g, '#quot;')  // Escape double quotes
            .replace(/\(/g, '#lpar;') // Escape left parenthesis
            .replace(/\)/g, '#rpar;') // Escape right parenthesis
            .replace(/:/g, '#colon;') // Escape colon
            .replace(/;/g, '#scolon;')// Escape semicolon
            .replace(/\n/g, '<br/>'); // Replace newlines with <br/> for multi-line labels
    }
}

module.exports = MindMapGenerator;
