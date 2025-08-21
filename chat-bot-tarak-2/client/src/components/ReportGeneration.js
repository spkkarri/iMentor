// client/src/components/ReportGeneration.js
import React, { useState } from 'react';
import { generateReport } from '../services/api'; // Import the function from api.js
import { saveAs } from 'file-saver'; // Import the file-saver library

function ReportGeneration() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [topic, setTopic] = useState("The Future of AI in Healthcare"); // Default topic

    const handleGenerateClick = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // This is the data your backend endpoint expects.
            // WARNING: In a production app, do not expose API keys on the client-side.
            // This key should be retrieved from a secure context or used only on the server.
            const reportData = {
                topic: topic,
                apiKeys: {
                    // Replace with your actual Groq API key
                    groq: "YOUR_GROQ_API_KEY_HERE"
                }
            };

            console.log("Component: Calling generateReport API function.");
            const response = await generateReport(reportData);

            // ===================================================================
            //  THE FIX IS APPLIED HERE
            // ===================================================================
            // The axios request is configured with `responseType: 'blob'`,
            // which means `response.data` is ALREADY the complete blob we need.
            // We do NOT need to wrap it in a new Blob() constructor.

            const pdfBlob = response.data;

            // Use file-saver to trigger the download with the valid blob.
            saveAs(pdfBlob, `${topic.replace(/[^a-zA-Z0-9]/g, '_')}_report.pdf`);
            console.log("Component: PDF Download triggered successfully.");

        } catch (err) {
            console.error("Component: An error occurred during report generation.", err);
            let errorMessage = "An unexpected error occurred.";

            // This logic correctly reads the JSON error message from a blob response
            if (err.response && err.response.data) {
                const errorBlob = err.response.data;
                // Use a Promise-based approach to read the blob asynchronously
                try {
                    const errorText = await errorBlob.text();
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error || errorJson.message || "Failed to get details from server.";
                } catch (parseError) {
                    errorMessage = "Could not parse the error response from the server.";
                }
            } else if (err.message) {
                errorMessage = err.message; // For network errors
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '600px', margin: '20px auto' }}>
            <h2 style={{ textAlign: 'center' }}>Generate a New Report</h2>
            <div style={{ marginBottom: '15px' }}>
                <label htmlFor="topic-input" style={{ marginRight: '10px', display: 'block', marginBottom: '5px' }}>Topic:</label>
                <input
                    id="topic-input"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    style={{ padding: '10px', width: '100%', boxSizing: 'border-box' }}
                    placeholder="e.g., The Impact of Quantum Computing"
                />
            </div>
            <button
                onClick={handleGenerateClick}
                disabled={isLoading || !topic.trim()}
                style={{ padding: '12px 25px', fontSize: '16px', width: '100%', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}
            >
                {isLoading ? 'Generating, please wait...' : 'Generate PDF Report'}
            </button>
            {isLoading && (
                <div style={{ marginTop: '15px', textAlign: 'center', color: '#555' }}>
                    This can take up to a minute...
                </div>
            )}
            {error && (
                <div style={{ marginTop: '20px', color: '#D8000C', backgroundColor: '#FFD2D2', border: '1px solid #D8000C', borderRadius: '5px', padding: '10px' }}>
                    <strong>Error:</strong> {error}
                </div>
            )}
        </div>
    );
}

export default ReportGeneration;