import React, { useState } from 'react';
import FileUploadWidget from './FileUploadWidget';
import { generateQuizFromFile } from '../services/api';

// Add this new function at the top of QuizView.js
function parseJsonlToQuiz(jsonlText) {
  if (!jsonlText || typeof jsonlText !== 'string') return [];

  try {
    // 1. Split the text into individual lines (each line is a JSON object).
    const lines = jsonlText.trim().split('\n');

    // 2. Parse each line as a JSON object.
    const questions = lines.map(line => {
      try {
        const jsonObj = JSON.parse(line);
        
        // 3. Validate the structure of each object.
        if (
          !jsonObj.question || 
          !Array.isArray(jsonObj.options) || 
          jsonObj.options.length === 0 || 
          !jsonObj.answer
        ) {
          return null; // Skip malformed objects
        }
        
        // 4. Find the index of the correct answer.
        const answerIndex = jsonObj.options.findIndex(
          option => option === jsonObj.answer
        );
        
        if (answerIndex === -1) return null; // Skip if the answer isn't in the options
        
        // 5. Return the question in the format your component expects.
        return {
          question: jsonObj.question,
          options: jsonObj.options,
          answer: answerIndex, // The correct, zero-based index
        };

      } catch (e) {
        console.error("Failed to parse a line of JSONL:", line, e);
        return null; // Skip lines that are not valid JSON
      }
    });

    // 6. Filter out any null values from parsing errors.
    return questions.filter(q => q !== null);

  } catch (error) {
    console.error("Failed to parse the entire JSONL string:", jsonlText, error);
    return [];
  }
}

const QuizView = () => {
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState([]);
  const [score, setScore] = useState(null);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Called after upload, expects uploaded file info (simulate with just name for now)
  const handleUploadSuccess = async (uploadedFileName) => {
    if (!uploadedFileName || typeof uploadedFileName !== 'string' || uploadedFileName.trim() === '') {
      setError('Invalid uploaded file name.');
      setQuizQuestions([]);
      setLoading(false);
      return;
    }
    setFileUploaded(true);
    setFileName(uploadedFileName);
    setError('');
    setLoading(true);
    try {
      // For real integration, you need documentName and serverFilename
      // Here we assume uploadedFileName is the original name and serverFilename is the same
      const payload = {
        documentName: uploadedFileName,
        serverFilename: uploadedFileName,
        analysisType: 'mcq',
        llmProvider: 'gemini',
        llmModelName: null
      };
      // Validate required fields before sending
      if (!payload.documentName || !payload.serverFilename || !payload.analysisType) {
        throw new Error('Missing required fields for quiz generation.');
      }
      const response = await generateQuizFromFile(payload);
      console.log('[DEBUG] Quiz generation response:', response);
      const jsonlText = response.data.analysis_result; // The server now returns JSONL
      console.log('[DEBUG] JSONL Text:', jsonlText);
      
      // --- THIS IS THE CORRECTED LINE ---
      const questions = parseJsonlToQuiz(jsonlText);

      console.log('[DEBUG] Parsed Questions:', questions);
      if (questions.length === 0) throw new Error('No valid quiz questions could be parsed from the document.');
      setQuizQuestions(questions);
      setUserAnswers(Array(questions.length).fill(null));
      setScore(null);
    } catch (err) {
      console.error('[ERROR] Quiz generation error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to generate quiz.');
      setQuizQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (qIdx, optIdx) => {
    const updated = [...userAnswers];
    updated[qIdx] = optIdx;
    setUserAnswers(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let correct = 0;
    quizQuestions.forEach((q, idx) => {
      if (userAnswers[idx] === q.answer) correct++;
    });
    setScore(correct);
  };

  // Helper to determine option style and icon after submission
  const getOptionStyleAndIcon = (qIdx, optIdx) => {
    if (score === null) return [{}, null];
    const isUserSelected = userAnswers[qIdx] === optIdx;
    const isCorrect = quizQuestions[qIdx].answer === optIdx;
    if (isUserSelected && isCorrect) {
      return [{ backgroundColor: '#2e7d32', color: 'white', fontWeight: 'bold', padding: '4px 8px', borderRadius: 4, boxShadow: '0 0 8px #4caf50' }, '✓ Correct'];
    }
    if (isUserSelected && !isCorrect) {
      return [{ backgroundColor: '#c62828', color: 'white', fontWeight: 'bold', padding: '4px 8px', borderRadius: 4, boxShadow: '0 0 8px #e53935' }, '✗ Wrong'];
    }
    if (!isUserSelected && isCorrect) {
      return [{ backgroundColor: '#2e7d32', color: 'white', fontWeight: 'bold', padding: '4px 8px', borderRadius: 4, boxShadow: '0 0 8px #4caf50' }, '✓ Correct'];
    }
    return [{}, null];
  };

  return (
    <div style={{ padding: '2rem', color: '#fff', maxWidth: 600, margin: '0 auto', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem', fontWeight: '700', fontSize: '1.8rem' }}>Interactive Quizzing</h2>
      {!fileUploaded && (
        <div>
          <FileUploadWidget onUploadSuccess={handleUploadSuccess} />
          <p style={{ marginTop: '1rem', fontSize: '1.1rem', textAlign: 'center' }}>Upload a document to generate a quiz.</p>
        </div>
      )}
      {loading && <div style={{ margin: '2rem 0', color: '#ffd700', fontWeight: '600', fontSize: '1.2rem', textAlign: 'center' }}>Generating quiz...</div>}
      {error && <div style={{ margin: '2rem 0', color: '#e53e3e', fontWeight: '600', fontSize: '1.1rem', textAlign: 'center' }}>{error}</div>}
      {fileUploaded && quizQuestions.length > 0 && !loading && !error && (
        <form onSubmit={handleSubmit} style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: '600', fontSize: '1.3rem' }}>Quiz: {fileName}</h3>
          {quizQuestions.map((q, qIdx) => (
            <div key={qIdx} style={{ marginBottom: '1.5rem', background: '#1e1e1e', padding: '1rem 1.2rem', borderRadius: 10, boxShadow: '0 0 10px rgba(0,0,0,0.5)' }}>
              <div style={{ marginBottom: 12, fontWeight: '600', fontSize: '1.1rem', color: '#f0f0f0' }}><strong>Q{qIdx + 1}:</strong> {q.question}</div>
              {q.options.map((opt, optIdx) => {
                const [style, icon] = getOptionStyleAndIcon(qIdx, optIdx);
                return (
                  <label
                    key={optIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: 6,
                      padding: '6px 10px',
                      borderRadius: 6,
                      cursor: score === null ? 'pointer' : 'default',
                      ...style,
                      position: 'relative'
                    }}
                  >
                    <input
                      type="radio"
                      name={`question-${qIdx}`}
                      value={optIdx}
                      checked={userAnswers[qIdx] === optIdx}
                      onChange={() => handleOptionChange(qIdx, optIdx)}
                      required
                      disabled={score !== null}
                      style={{ marginRight: 12, cursor: score === null ? 'pointer' : 'default' }}
                    />
                    <span style={{ flexGrow: 1, fontSize: '1rem', color: style.color || '#ddd' }}>{opt}</span>
                    {icon && (
                      <span
                        style={{
                          fontWeight: 'bold',
                          marginLeft: 12,
                          fontSize: '1.2rem',
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)'
                        }}
                      >
                        {icon}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          ))}
          <button
            type="submit"
            style={{
              padding: '12px 24px',
              fontSize: '1.1rem',
              borderRadius: 8,
              background: '#4caf50',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              marginTop: '1rem',
              boxShadow: '0 4px 8px rgba(76, 175, 80, 0.4)'
            }}
          >
            Submit Quiz
          </button>
        </form>
      )}
      {score !== null && (
        <div style={{ marginTop: '2rem', fontSize: '1.3rem', color: '#ffd700', fontWeight: '700', textAlign: 'center' }}>
          Your Score: {score} / {quizQuestions.length}
        </div>
      )}
    </div>
  );
};

export default QuizView;