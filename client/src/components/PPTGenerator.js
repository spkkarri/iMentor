import React, { useState } from 'react';
import { generatePPT, generateReport } from '../services/api';
import useSelectedModel from '../hooks/useSelectedModel';
import './ChatPage.css';


const PPTGenerator = () => {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [option, setOption] = useState('choose');
  const { selectedModel } = useSelectedModel();

  const handleGenerate = async () => {
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }
    if (option === 'choose') {
      setError('Please select an option');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }
      let response;
      console.log(`🎯 Generating ${option} using model: ${selectedModel}`);
      if (option === 'ppt') {
        response = await generatePPT(title, selectedModel);
      } else if (option === 'report') {
        response = await generateReport(title, selectedModel);
      }
      const blobType = option === 'ppt' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/pdf';
      const fileExtension = option === 'ppt' ? 'pptx' : 'pdf';
      const url = window.URL.createObjectURL(new Blob([response.data], { type: blobType }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${title.replace(/\s+/g, '_')}.${fileExtension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError(`Failed to generate ${option === 'ppt' ? 'PPT' : 'report'}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '20px auto', padding: 20, border: '1px solid #ccc', borderRadius: 8, textAlign: 'center' }}>
      <h2>Generate PPT/Report</h2>
      <input
        type="text"
        placeholder="Ex: Indian Railways"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="ppt-generator-input"
      />
      <select
        value={option}
        onChange={(e) => setOption(e.target.value)}
        className="ppt-generator-select"
      >
        <option value="choose" disabled>Choose</option>
        <option value="ppt">Generate PPT</option>
        <option value="report">Generate Report</option>
      </select>
      <button onClick={handleGenerate} disabled={loading} style={{ width: '100%', padding: 10, fontSize: 16, backgroundColor: '#52a8f9ff', color: 'white', border: 'none', borderRadius: 4 }}>
        {loading ? 'Generating...' : 'Generate'}
      </button>
      {loading && (
        <div style={{ marginTop: 20 }}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 50 50"
            style={{ margin: 'auto', display: 'block' }}
          >
            <circle
              cx="25"
              cy="25"
              r="20"
              fill="none"
              stroke="#007bff"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="31.415, 31.415"
              transform="rotate(0 25 25)"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 25 25"
                to="360 25 25"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
        </div>
      )}
      {error && <p style={{ color: 'red', marginTop: 10 }}>{error}</p>}
    </div>
  );
};

export default PPTGenerator;
