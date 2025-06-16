// // server/routes/generation.js
// const express = require('express');
// const axios = require('axios');
// const router = express.Router();

// // This route is protected by authMiddleware applied in server.js

// // @route   POST /api/generate/document
// // @desc    Generate a document (PPTX or DOCX) by proxying to the Python service.
// // @access  Private
// router.post('/document', async (req, res) => {
//     const { markdownContent, docType } = req.body;

//     if (!markdownContent || !docType) {
//         return res.status(400).json({ message: 'markdownContent and docType are required.' });
//     }

//     const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
//     if (!pythonServiceUrl) {
//         console.error("[Generation Route] PYTHON_RAG_SERVICE_URL is not set.");
//         return res.status(500).json({ message: "Document generation service is not configured." });
//     }

//     const generationUrl = `${pythonServiceUrl}/generate_document`;
//     console.log(`[Generation Route] Forwarding request to Python service: ${generationUrl}`);

//     try {
//         const pythonResponse = await axios.post(generationUrl, {
//             markdownContent,
//             docType
//         }, { timeout: 60000 }); // 1 minute timeout for generation

//         if (pythonResponse.data && pythonResponse.data.success) {
//             const filename = pythonResponse.data.filename;
//             // Construct the full download URL for the client
//             const downloadUrl = `${pythonServiceUrl}/download_document/${filename}`;
            
//             res.status(200).json({
//                 success: true,
//                 downloadUrl: downloadUrl,
//                 filename: filename
//             });
//         } else {
//             throw new Error(pythonResponse.data.error || "Unknown error from generation service.");
//         }
//     } catch (error) {
//         const errorMsg = error.response?.data?.error || error.message || "Failed to generate document.";
//         console.error(`[Generation Route] Error calling Python service: ${errorMsg}`);
//         res.status(500).json({ message: errorMsg });
//     }
// });

// module.exports = router;














// // server/routes/generation.js
// const express = require('express');
// const axios = require('axios');
// const router = express.Router();
// const User = require('../models/User'); // <-- Import User model

// // This route is protected by authMiddleware applied in server.js

// // @route   POST /api/generate/document
// // @desc    Generate a document (PPTX or DOCX) by proxying to the Python service.
// // @access  Private
// router.post('/document', async (req, res) => {
//     // --- MODIFIED: Destructure new fields ---
//     const { markdownContent, docType, sourceDocumentName } = req.body;
//     const userId = req.user._id;

//     if (!markdownContent || !docType || !sourceDocumentName) {
//         return res.status(400).json({ message: 'markdownContent, docType, and sourceDocumentName are required.' });
//     }

//     try {
//         // --- NEW: Fetch the full text of the source document ---
//         const user = await User.findById(userId).select('uploadedDocuments');
//         if (!user) {
//             return res.status(404).json({ message: 'User not found.' });
//         }
//         const sourceDocument = user.uploadedDocuments.find(doc => doc.filename === sourceDocumentName);
//         if (!sourceDocument || !sourceDocument.text) {
//             return res.status(404).json({ message: `Source document '${sourceDocumentName}' or its text content not found.` });
//         }
//         const sourceDocumentText = sourceDocument.text;
//         // --- END NEW ---

//         const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
//         if (!pythonServiceUrl) {
//             console.error("[Generation Route] PYTHON_RAG_SERVICE_URL is not set.");
//             return res.status(500).json({ message: "Document generation service is not configured." });
//         }

//         const generationUrl = `${pythonServiceUrl}/generate_document`;
//         console.log(`[Generation Route] Forwarding request to Python service: ${generationUrl}`);

//         const pythonResponse = await axios.post(generationUrl, {
//             markdownContent, // This is the outline (e.g., FAQ, Key Topics)
//             docType,
//             sourceDocumentText // Pass the full text for context
//         }, { timeout: 300000 }); // Increased timeout to 5 minutes for LLM generation

//         if (pythonResponse.data && pythonResponse.data.success) {
//             const filename = pythonResponse.data.filename;
//             const downloadUrl = `${pythonServiceUrl}/download_document/${filename}`;
            
//             res.status(200).json({
//                 success: true,
//                 downloadUrl: downloadUrl,
//                 filename: filename
//             });
//         } else {
//             throw new Error(pythonResponse.data.error || "Unknown error from generation service.");
//         }
//     } catch (error) {
//         const errorMsg = error.response?.data?.error || error.message || "Failed to generate document.";
//         console.error(`[Generation Route] Error: ${errorMsg}`);
//         res.status(500).json({ message: errorMsg });
//     }
// });

// module.exports = router;










// // server/routes/generation.js
// const express = require('express');
// const axios = require('axios');
// const router = express.Router();
// const User = require('../models/User');
// const AdminDocument = require('../models/AdminDocument'); // <-- Import AdminDocument model

// // This route is protected by authMiddleware applied in server.js

// // @route   POST /api/generate/document
// // @desc    Generate a document (PPTX or DOCX) by proxying to the Python service.
// // @access  Private
// router.post('/document', async (req, res) => {
//     const { markdownContent, docType, sourceDocumentName } = req.body;
//     const userId = req.user._id;

//     if (!markdownContent || !docType || !sourceDocumentName) {
//         return res.status(400).json({ message: 'markdownContent, docType, and sourceDocumentName are required.' });
//     }

//     try {
//         let sourceDocumentText = null;

//         // --- NEW UNIFIED DOCUMENT RETRIEVAL LOGIC ---
//         // 1. First, try to find the document in the user's personal documents.
//         const user = await User.findById(userId).select('uploadedDocuments');
//         if (user) {
//             const userDocument = user.uploadedDocuments.find(doc => doc.filename === sourceDocumentName);
//             if (userDocument && userDocument.text) {
//                 sourceDocumentText = userDocument.text;
//                 console.log(`[Generation Route] Found source text in user's documents for: ${sourceDocumentName}`);
//             }
//         }

//         // 2. If not found in user's docs, try to find it in the Admin documents.
//         if (!sourceDocumentText) {
//             console.log(`[Generation Route] Not found in user docs. Checking admin 'Subjects' for: ${sourceDocumentName}`);
//             const adminDocument = await AdminDocument.findOne({ originalName: sourceDocumentName }).select('text');
//             if (adminDocument && adminDocument.text) {
//                 sourceDocumentText = adminDocument.text;
//                 console.log(`[Generation Route] Found source text in admin documents for: ${sourceDocumentName}`);
//             }
//         }
//         // --- END UNIFIED LOGIC ---
        
//         // 3. If still not found after checking both, return an error.
//         if (!sourceDocumentText) {
//             return res.status(404).json({ message: `Source document '${sourceDocumentName}' not found.` });
//         }

//         const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
//         if (!pythonServiceUrl) {
//             console.error("[Generation Route] PYTHON_RAG_SERVICE_URL is not set.");
//             return res.status(500).json({ message: "Document generation service is not configured." });
//         }

//         const generationUrl = `${pythonServiceUrl}/generate_document`;
//         console.log(`[Generation Route] Forwarding request to Python service: ${generationUrl}`);

//         const pythonResponse = await axios.post(generationUrl, {
//             markdownContent,
//             docType,
//             sourceDocumentText // Pass the full text from whichever source it was found
//         }, { timeout: 300000 });

//         if (pythonResponse.data && pythonResponse.data.success) {
//             const filename = pythonResponse.data.filename;
//             const downloadUrl = `${pythonServiceUrl}/download_document/${filename}`;
            
//             res.status(200).json({
//                 success: true,
//                 downloadUrl: downloadUrl,
//                 filename: filename
//             });
//         } else {
//             throw new Error(pythonResponse.data.error || "Unknown error from generation service.");
//         }
//     } catch (error) {
//         const errorMsg = error.response?.data?.error || error.message || "Failed to generate document.";
//         console.error(`[Generation Route] Error: ${errorMsg}`);
//         res.status(500).json({ message: errorMsg });
//     }
// });

// module.exports = router;









// server/routes/generation.js
const express = require('express');
const axios = require('axios');
const router = express.Router();
const User = require('../models/User');
const AdminDocument = require('../models/AdminDocument');

router.post('/document', async (req, res) => {
    const { markdownContent, docType, sourceDocumentName } = req.body;
    const userId = req.user._id;

    if (!markdownContent || !docType || !sourceDocumentName) {
        return res.status(400).json({ message: 'markdownContent, docType, and sourceDocumentName are required.' });
    }

    try {
        let sourceDocumentText = null;

        const user = await User.findById(userId).select('uploadedDocuments');
        if (user) {
            const userDocument = user.uploadedDocuments.find(doc => doc.filename === sourceDocumentName);
            if (userDocument && userDocument.text) {
                sourceDocumentText = userDocument.text;
            }
        }

        if (!sourceDocumentText) {
            const adminDocument = await AdminDocument.findOne({ originalName: sourceDocumentName }).select('text');
            if (adminDocument && adminDocument.text) {
                sourceDocumentText = adminDocument.text;
            }
        }
        
        if (!sourceDocumentText) {
            return res.status(404).json({ message: `Source document '${sourceDocumentName}' not found.` });
        }

        const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
        if (!pythonServiceUrl) {
            return res.status(500).json({ message: "Document generation service is not configured." });
        }

        const generationUrl = `${pythonServiceUrl}/generate_document`;
        
        // 1. Ask Python to generate the document and get the filename
        const genResponse = await axios.post(generationUrl, {
            markdownContent, docType, sourceDocumentText
        }, { timeout: 300000 });

        if (!genResponse.data || !genResponse.data.success) {
            throw new Error(genResponse.data.error || "Python service failed to generate the document.");
        }

        const filename = genResponse.data.filename;
        const downloadUrl = `${pythonServiceUrl}/download_document/${filename}`;

        // 2. Fetch the generated document from Python as a stream (blob)
        console.log(`[Generation Route] Fetching generated file from Python: ${downloadUrl}`);
        const fileResponse = await axios.get(downloadUrl, {
            responseType: 'stream'
        });

        // 3. Stream the file directly back to the client
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Type', fileResponse.headers['content-type']);
        fileResponse.data.pipe(res);

    } catch (error) {
        const errorMsg = error.response?.data?.error || error.message || "Failed to generate document.";
        console.error(`[Generation Route] Error: ${errorMsg}`);
        res.status(500).json({ message: errorMsg });
    }
});

module.exports = router;