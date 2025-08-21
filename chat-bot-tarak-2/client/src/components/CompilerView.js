import React, { useState, useEffect } from 'react';
import './CompilerView.css';

const languages = [
  { id: 52, name: 'C++' },
  { id: 62, name: 'Java' },
  { id: 71, name: 'Python' },
  { id: 50, name: 'C' },
  { id: 54, name: 'C#' },
  { id: 63, name: 'JavaScript' },
  { id: 68, name: 'Go' },
  { id: 78, name: 'Rust' },
];

const CompilerView = () => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState(languages[0].id);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  // --- ANIMATION STATE ---
  const [isInitialAnimating, setIsInitialAnimating] = useState(true);
  const [hasSettledGlow, setHasSettledGlow] = useState(false);

  useEffect(() => {
    // This effect runs once when the component mounts to control the initial animation.
    const animationTimer = setTimeout(() => {
      setIsInitialAnimating(false);
      setHasSettledGlow(true);
    }, 2500); // Animation lasts for 2.5 seconds

    // Cleanup the timer if the component unmounts
    return () => clearTimeout(animationTimer);
  }, []);
  // --- END OF ANIMATION STATE ---

  const runCode = async () => {
    setIsRunning(true);
    setOutput('Running...');

    try {
      const response = await fetch('https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
          'X-RapidAPI-Key': '56dbeee59cmshe0e0bcb0885f269p175c93jsnf861cfd89d9e'
        },
        body: JSON.stringify({
          language_id: language,
          source_code: code,
          stdin: input,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setOutput(result.stdout || result.compile_output || result.stderr || 'Execution finished with no output.');
      } else {
        setOutput(result.message || 'An error occurred.');
      }
    } catch (error) {
      setOutput('Error running code: ' + error.message);
    } finally {
      setIsRunning(false);
    }
  };
  
  // Dynamically create class string for the main container
  const containerClasses = `compiler-container ${isInitialAnimating ? 'rainbow-glow-animate' : ''} ${hasSettledGlow ? 'constant-glow' : ''}`;

  return (
    <div className={containerClasses}>
      <header className="compiler-header">
        <h2>Code Compiler</h2>
        <div className="compiler-controls">
          <select value={language} onChange={(e) => setLanguage(parseInt(e.target.value))} disabled={isRunning}>
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
          <button className={`run-button ${isRunning ? 'is-running' : ''}`} onClick={runCode} disabled={isRunning}>
            {isRunning ? 'Running...' : 'Run'}
          </button>
        </div>
      </header>

      <div className="compiler-layout">
        <div className="section code-section">
          <label htmlFor="code-editor">Code</label>
          <textarea
            id="code-editor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Write your code here..."
            spellCheck="false"
          />
        </div>

        <div className="right-pane">
          <div className="section input-section">
            <label htmlFor="input-area">Input</label>
            <textarea
              id="input-area"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter program input here..."
              spellCheck="false"
            />
          </div>
          <div className="section output-section">
            <label htmlFor="output-area">Output</label>
            <pre id="output-area" className="output-pre">
              {output || 'Program output will appear here...'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompilerView;