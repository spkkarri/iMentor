// // client/src/components/MermaidDiagram.js
// import React, { useEffect, useRef } from 'react';
// import mermaid from 'mermaid';
// import { useTheme } from '../context/ThemeContext';

// let mermaidIdCounter = 0;

// const MermaidDiagram = ({ chart }) => {
//     const { theme } = useTheme();
//     const containerRef = useRef(null); // Ref to the container div

//     useEffect(() => {
//         let isMounted = true; 

//         if (!chart || !containerRef.current) {
//             return;
//         }

//         /**
//          * Removes characters from node text that are known to break the Mermaid parser.
//          * @param {string} text - A line of Mermaid code.
//          * @returns {string} The sanitized line.
//          */
//         const removeProblematicChars = (text) => {
//             // Preserve indentation
//             const indent = (text.match(/^(\s*)/) || ["", ""])[1];
//             let nodeText = text.trim();
            
//             // Do not sanitize the 'mindmap' keyword itself
//             if (nodeText.toLowerCase() === 'mindmap') {
//                 return nodeText;
//             }

//             // Remove colons, pipes, and replace hyphens with a space.
//             // This prevents parsing errors from special characters inside node text.
//             nodeText = nodeText.replace(/[:|]/g, '').replace(/-/g, ' ');

//             return indent + nodeText;
//         };

//         const sanitizeAndFixCode = (rawText) => {
//             if (!rawText || typeof rawText !== 'string') return 'mindmap\n  Error\n    "Invalid content"';
            
//             const fencedBlockMatch = rawText.match(/```(?:mermaid)?([\s\S]*?)```/);
//             let code = fencedBlockMatch && fencedBlockMatch[1] ? fencedBlockMatch[1].trim() : rawText.trim();
//             code = code.replace(/^(\s*)child\((.*)\)$/gm, '$1$2');

//             if (!code.trim().toLowerCase().startsWith('mindmap')) {
//                 code = 'mindmap\n' + code;
//             }

//             // First, fix the structure (indentation)
//             let lines = code.split('\n');
//             const contentLines = lines.slice(1);
//             if (contentLines.every(line => line.trim() === '')) return 'mindmap\n  Error\n    "Empty response"';

//             const newContentLines = [];
//             const firstNonEmptyIndex = contentLines.findIndex(line => line.trim() !== '');
//             if (firstNonEmptyIndex === -1) return 'mindmap\n  Error\n    "No valid content"';
            
//             const rootNode = contentLines[firstNonEmptyIndex];
//             newContentLines.push(rootNode);
//             const rootIndent = (rootNode.match(/^(\s*)/) || ['',''])[1].length;

//             for (let i = firstNonEmptyIndex + 1; i < contentLines.length; i++) {
//                 const line = contentLines[i];
//                 if (line.trim() === '') continue;
//                 const currentIndent = (line.match(/^(\s*)/) || ['',''])[1].length;
//                 newContentLines.push(currentIndent <= rootIndent ? '  ' + line.trim() : line);
//             }

//             // Second, sanitize the characters within the now-structured code
//             const structurallySoundCode = 'mindmap\n' + newContentLines.join('\n');
//             const fullySanitizedLines = structurallySoundCode.split('\n').map(removeProblematicChars);
            
//             return fullySanitizedLines.join('\n');
//         };

//         const finalCode = sanitizeAndFixCode(chart);
//         const diagramId = `mermaid-diagram-container-${mermaidIdCounter++}`;
//         containerRef.current.innerHTML = "Generating Mind Map...";

//         mermaid.render(diagramId, finalCode).then(({ svg }) => {
//             if (isMounted && containerRef.current) {
//                 containerRef.current.innerHTML = svg;
//             }
//         }).catch(e => {
//              if (isMounted && containerRef.current) {
//                  const errorHtml = `
//                     <div class="mindmap-error-container">
//                         <h4>Mindmap Syntax Error</h4>
//                         <p class="error-message">${e.message || 'Rendering failed.'}</p>
//                         <p class="error-code-header">The code that failed:</p>
//                         <pre class="error-code-block">${finalCode.replace(/</g, "<")}</pre>
//                     </div>`;
//                 containerRef.current.innerHTML = errorHtml;
//              }
//         });

//         return () => { isMounted = false; };
//     }, [chart, theme]);

//     return <div ref={containerRef} className="mermaid-diagram-container" />;
// };

// export default MermaidDiagram;

// client/src/components/MermaidDiagram.js
import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import { useTheme } from '../context/ThemeContext';

let mermaidIdCounter = 0;

const MermaidDiagram = ({ chart }) => {
    const { theme } = useTheme();

    const containerRef = useRef(null); // Ref to the container div

    useEffect(() => {
        let isMounted = true; 

        if (!chart || !containerRef.current) {
            return;
        }

        /**
         * Removes characters from node text that are known to break the Mermaid parser.
         * @param {string} text - A line of Mermaid code.
         * @returns {string} The sanitized line.
         */
        const removeProblematicChars = (text) => {
            // Preserve indentation
            const indent = (text.match(/^(\s*)/) || ["", ""])[1];
            let nodeText = text.trim();
            
            // Do not sanitize the 'mindmap' keyword itself
            if (nodeText.toLowerCase() === 'mindmap') {
                return nodeText;
            }

            // Remove colons, pipes, and replace hyphens with a space.
            // This prevents parsing errors from special characters inside node text.
            nodeText = nodeText.replace(/[:|]/g, '').replace(/-/g, ' ');

            return indent + nodeText;
        };

        const sanitizeAndFixCode = (rawText) => {
            if (!rawText || typeof rawText !== 'string') return 'mindmap\n  Error\n    "Invalid content"';
            
            const fencedBlockMatch = rawText.match(/```(?:mermaid)?([\s\S]*?)```/);
            let code = fencedBlockMatch && fencedBlockMatch[1] ? fencedBlockMatch[1].trim() : rawText.trim();
            code = code.replace(/^(\s*)child\((.*)\)$/gm, '$1$2');

            if (!code.trim().toLowerCase().startsWith('mindmap')) {
                code = 'mindmap\n' + code;
            }

            // First, fix the structure (indentation)
            let lines = code.split('\n');
            const contentLines = lines.slice(1);
            if (contentLines.every(line => line.trim() === '')) return 'mindmap\n  Error\n    "Empty response"';

            const newContentLines = [];
            const firstNonEmptyIndex = contentLines.findIndex(line => line.trim() !== '');
            if (firstNonEmptyIndex === -1) return 'mindmap\n  Error\n    "No valid content"';
            
            const rootNode = contentLines[firstNonEmptyIndex];
            newContentLines.push(rootNode);
            const rootIndent = (rootNode.match(/^(\s*)/) || ['',''])[1].length;

            for (let i = firstNonEmptyIndex + 1; i < contentLines.length; i++) {
                const line = contentLines[i];
                if (line.trim() === '') continue;
                const currentIndent = (line.match(/^(\s*)/) || ['',''])[1].length;
                newContentLines.push(currentIndent <= rootIndent ? '  ' + line.trim() : line);
            }

            // Second, sanitize the characters within the now-structured code
            const structurallySoundCode = 'mindmap\n' + newContentLines.join('\n');
            const fullySanitizedLines = structurallySoundCode.split('\n').map(removeProblematicChars);
            
            return fullySanitizedLines.join('\n');
        };

        const finalCode = sanitizeAndFixCode(chart);
        const diagramId = `mermaid-diagram-container-${mermaidIdCounter++}`;
        containerRef.current.innerHTML = "Generating Mind Map...";

        mermaid.render(diagramId, finalCode).then(({ svg }) => {
            if (isMounted && containerRef.current) {
                containerRef.current.innerHTML = svg;
            }
        }).catch(e => {
             if (isMounted && containerRef.current) {
                 const errorHtml = `
                    <div class="mindmap-error-container">
                        <h4>Mindmap Syntax Error</h4>
                        <p class="error-message">${e.message || 'Rendering failed.'}</p>
                        <p class="error-code-header">The code that failed:</p>
                        <pre class="error-code-block">${finalCode.replace(/</g, "<")}</pre>
                    </div>`;
                containerRef.current.innerHTML = errorHtml;
             }
        });

        return () => { isMounted = false; };
    }, [chart, theme]);


    return <div ref={containerRef} className="mermaid-diagram-container" />;
};

export default MermaidDiagram;