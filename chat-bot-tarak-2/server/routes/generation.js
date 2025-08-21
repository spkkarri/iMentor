
// server/routes/generation.js
const express = require('express');
const axios = require('axios');
const { tempAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Helper function to parse a stream into a string/JSON
const streamToString = (stream) => {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
};

router.post('/report', tempAuth, async (req, res) => {
    const { topic, api_keys } = req.body;
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({ message: "A valid 'topic' is required." });
    }
    
    console.log(`[Bridge Server] Received request for topic: "${topic}". Forwarding to Python service...`);

    try {
        const pythonServiceUrl = process.env.PYTHON_AI_CORE_SERVICE_URL || 'http://localhost:9000';
        if (!pythonServiceUrl) {
            throw new Error("Python AI Core Service URL is not configured.");
        }
        
        const reportUrl = `${pythonServiceUrl}/generate_report`;

        // Request PDF stream
        const responseFromPython = await axios({
            method: 'post',
            url: reportUrl,
            data: { topic, api_keys },
            responseType: 'stream',
            timeout: 300000 // 5-minute timeout
        });

        console.log(`[Bridge Server] Received PDF stream from Python. Piping to client...`);
        
        res.setHeader('Content-Type', 'application/pdf');
        const contentDisposition = responseFromPython.headers['content-disposition'] || 'attachment; filename=report.pdf';
        res.setHeader('Content-Disposition', contentDisposition);

        responseFromPython.data.pipe(res);

    } catch (error) {
        // --- THIS IS THE CORRECTED ERROR HANDLING BLOCK ---
        console.error(`[Bridge Server] Error communicating with Python service.`);

        // Case 1: The Python service is down or there's a network error.
        if (!error.response) {
            console.error('Error details:', error.message);
            return res.status(502).json({ message: `The AI service is unreachable: ${error.message}` });
        }

        // Case 2: The Python service responded with an error (e.g., 400, 500).
        // The error response body is a stream and must be parsed.
        const errorStream = error.response.data;
        const errorBodyString = await streamToString(errorStream);
        
        let errorMessage = "An unknown error occurred in the AI service.";
        try {
            // Try to parse the error body as JSON
            const errorJson = JSON.parse(errorBodyString);
            errorMessage = errorJson.message || errorJson.error || 'The AI service returned an unspecified error.';
        } catch (parseError) {
            // If parsing fails, use the raw string (it might be plain text or HTML)
            errorMessage = errorBodyString.substring(0, 200); // Truncate for safety
        }

        console.error(`[Bridge Server] Python service responded with status ${error.response.status}: ${errorMessage}`);

        // Send a proper JSON error response back to the React client
        return res.status(error.response.status || 502).json({ message: errorMessage });
    }
});

// Paste this entire block of code before module.exports

const path = require('path');
const fs = require('fs');

// ROUTE 1: Trigger PPT Generation
router.post('/ppt', tempAuth, async (req, res) => {
    const { topic, context, api_keys } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({ message: "A valid 'topic' is required." });
    }

    console.log(`[Bridge Server] Received request for PPT on topic: "${topic}". Forwarding to Python...`);

    try {
        const pythonServiceUrl = process.env.PYTHON_AI_CORE_SERVICE_URL || 'http://localhost:9000';
        const generateUrl = `${pythonServiceUrl}/generate-ppt`;
        
        // This is a standard JSON request, not a stream
        const responseFromPython = await axios.post(generateUrl, {
            topic,
            context,
            api_keys
        }, { timeout: 300000 }); // 5-minute timeout

        console.log('[Bridge Server] Python service responded successfully with fileId.');
        // Forward the successful JSON response from Python to the client
        // The response should be { status: "success", fileId: "..." }
        res.status(200).json(responseFromPython.data);

    } catch (error) {
        // This error handling is modeled after your /report route for consistency
        console.error('[Bridge Server] Error communicating with Python service for PPT generation.');
        
        if (!error.response) {
            console.error('Error details:', error.message);
            return res.status(502).json({ message: `The AI service is unreachable: ${error.message}` });
        }

        // The error response from Python should be JSON, not a stream
        const errorMessage = error.response.data.error || error.response.data.message || 'An unknown error occurred in the AI service.';
        console.error(`[Bridge Server] Python service responded with status ${error.response.status}: ${errorMessage}`);
        
        return res.status(error.response.status || 502).json({ message: errorMessage });
    }
});

// ROUTE 2: Download the Generated PPT
router.get('/ppt/download/:fileId', tempAuth, (req, res) => {
    const { fileId } = req.params;

    // Security: Sanitize the fileId to prevent path traversal attacks
    if (!fileId || fileId.includes('..') || fileId.includes('/')) {
        return res.status(400).send('Invalid file identifier.');
    }

    // Construct the path to the file stored by the Python service.
    // This path assumes the Node.js server and Python service can access the same file system,
    // which is true in your current setup.
    // Corrected path:
    const filePath = path.join(__dirname, '..', 'generated_ppts', fileId);
    
    console.log(`[Bridge Server] Received download request for file: ${fileId}. Checking path: ${filePath}`);

    // Check if the file exists before attempting to send it
    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (err) {
                console.error(`[Bridge Server] Error sending file to client:`, err);
                // Cannot send a response here if headers are already sent
            } else {
                console.log(`[Bridge Server] Successfully sent file ${fileId} to client.`);
            }
        });
    } else {
        console.error(`[Bridge Server] File not found for download: ${filePath}`);
        res.status(404).send('The requested presentation could not be found. It may have expired or failed to generate.');
    }
});


module.exports = router;