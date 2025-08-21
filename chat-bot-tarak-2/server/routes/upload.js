// server/routes/upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { tempAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// --- Constants ---
const UPLOAD_DIR = path.join(__dirname, '..', 'assets');
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Define allowed types by mimetype and extension (lowercase)
// Mapping mimetype to subfolder name
const allowedMimeTypes = {
    // Documents -> 'docs'
    'application/pdf': 'docs',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docs', // .docx
    'application/msword': 'docs', // .doc (Might be less reliable mimetype)
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'docs', // .pptx
    'application/vnd.ms-powerpoint': 'docs', // .ppt (Might be less reliable mimetype)
    'text/plain': 'docs', // .txt
    // Code -> 'code'
    'text/x-python': 'code', // .py
    'application/javascript': 'code', // .js
    'text/javascript': 'code', // .js (alternative)
    'text/markdown': 'code', // .md
    'text/html': 'code', // .html
    'application/xml': 'code', // .xml
    'text/xml': 'code', // .xml
    'application/json': 'code', // .json
    'text/csv': 'code', // .csv
    // Images -> 'images'
    'image/jpeg': 'images',
    'image/png': 'images',
    'image/bmp': 'images',
    'image/gif': 'images',
    // Add more specific types if needed, otherwise they fall into 'others'
};
// Define allowed extensions (lowercase) - This is a secondary check
const allowedExtensions = [
    '.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt',
    '.py', '.js', '.md', '.html', '.xml', '.json', '.csv', '.log', // Added .log
    '.jpg', '.jpeg', '.png', '.bmp', '.gif'
];

// --- Multer Config ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // tempAuth middleware ensures req.user exists here
        if (!req.user || !req.user.username) {
            // This should ideally not happen if tempAuth works correctly
            console.error("Multer Destination Error: User context missing after auth middleware.");
            return cb(new Error("Authentication error: User context not found."));
        }
        const sanitizedUsername = req.user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileMimeType = file.mimetype.toLowerCase();

        // Determine subfolder based on mimetype, default to 'others'
        const fileTypeSubfolder = allowedMimeTypes[fileMimeType] || 'others';
        const destinationPath = path.join(UPLOAD_DIR, sanitizedUsername, fileTypeSubfolder);

        // Ensure the destination directory exists (use async for safety)
        fs.mkdir(destinationPath, { recursive: true }, (err) => {
             if (err) {
                 console.error(`Error creating destination path ${destinationPath}:`, err);
                 cb(err);
             } else {
                 cb(null, destinationPath);
             }
         });
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const fileExt = path.extname(file.originalname).toLowerCase();
        // Sanitize base name: remove extension, replace invalid chars, limit length
        const sanitizedBaseName = path.basename(file.originalname, fileExt)
                                      .replace(/[^a-zA-Z0-9._-]/g, '_') // Allow letters, numbers, dot, underscore, hyphen
                                      .substring(0, 100); // Limit base name length
        const uniqueFilename = `${timestamp}-${sanitizedBaseName}${fileExt}`;
        cb(null, uniqueFilename);
    }
});

const fileFilter = (req, file, cb) => {
    // tempAuth middleware should run before this, ensuring req.user exists
    if (!req.user) {
         console.warn(`Upload Rejected (File Filter): User context missing.`);
         const error = new multer.MulterError('UNAUTHENTICATED'); // Custom code?
         error.message = `User not authenticated.`;
         return cb(error, false);
    }

    const fileExt = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    const isMimeTypeKnown = !!allowedMimeTypes[mimeType];
    const isExtensionAllowed = allowedExtensions.includes(fileExt);

    // Stricter: Allow only if BOTH mimetype is known AND extension is allowed
    if (isMimeTypeKnown && isExtensionAllowed) {
        cb(null, true); // Accept file
    } else {
        console.warn(`Upload Rejected (File Filter): User='${req.user.username}', File='${file.originalname}', MIME='${mimeType}', Ext='${fileExt}'. MimeKnown=${isMimeTypeKnown}, ExtAllowed=${isExtensionAllowed}`);
        const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
        error.message = `Invalid file type or extension. Allowed extensions: ${allowedExtensions.join(', ')}`;
        cb(error, false); // Reject file
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
});
// --- End Multer Config ---


// --- Function to call Python AI Core service ---
async function triggerPythonRagProcessing(userId, filePath, documentIdentifier) { // <-- CHANGE HERE
    const pythonServiceUrl = process.env.PYTHON_AI_CORE_SERVICE_URL;

    if (!pythonServiceUrl) {
        console.error("PYTHON_AI_CORE_SERVICE_URL is not set in environment. Cannot trigger processing.");
        return { success: false, message: "AI Core service URL not configured." };
    }
    const addDocumentUrl = `${pythonServiceUrl}/add_document`;
    console.log(`Triggering Python AI Core processing for ${documentIdentifier} (User: ${userId}) at ${addDocumentUrl}`);
    try {
        const response = await axios.post(addDocumentUrl, {
            user_id: userId,
            file_path: filePath,
            document_name: documentIdentifier // <-- CHANGE HERE to document_name
        }, { timeout: 300000 }); // 5 minute timeout

        console.log(`Python AI Core service response for ${documentIdentifier}:`, response.data);
        if (response.data?.status === 'skipped') {
             console.warn(`Python AI Core service skipped processing ${documentIdentifier}: ${response.data.message}`);
             return { success: true, status: 'skipped', message: response.data.message, details: response.data };
        } else if (response.data?.status === 'added') {
             return { success: true, status: 'added', message: response.data.message, details: response.data };
        } else {
             console.warn(`Unexpected response status from Python AI Core service for ${documentIdentifier}: ${response.data?.status}`);
             return { success: false, message: `Unexpected AI Core status: ${response.data?.status}`, details: response.data };
        }

    } catch (error) {
        const errorMsg = error.response?.data?.error || error.message || "Unknown AI Core service error";
        console.error(`Error calling Python AI Core service for ${documentIdentifier}:`, errorMsg);
        return { success: false, message: `AI Core service call failed: ${errorMsg}`, details: error.response?.data };
    }
}
// --- End Function ---


// --- Modified Upload Route ---
router.post('/', tempAuth, (req, res) => {
    const uploader = upload.single('file');

    uploader(req, res, async function (err) {
        if (!req.user) {
             console.error("!!! Upload handler: req.user not found after tempAuth.");
             return res.status(401).json({ message: "Authentication error during upload." });
        }
        const userId = req.user._id.toString();
    
        if (err) {
            console.error(`!!! Error during upload middleware for user ${req.user.username}:`, err);
            if (err instanceof multer.MulterError) {
                let message = "File upload failed.";
                if (err.code === 'LIMIT_FILE_SIZE') message = `File too large. Max: ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB.`;
                else if (err.code === 'LIMIT_UNEXPECTED_FILE') message = err.message || 'Invalid file type.';
                else if (err.code === 'UNAUTHENTICATED') message = err.message || 'Authentication required.';
                return res.status(400).json({ message });
            } else {
                return res.status(500).json({ message: "Server error during upload preparation." });
            }
        }
    
        if (!req.file) {
            console.warn(`Upload request for User '${req.user.username}' completed, but req.file is missing (potentially filtered).`);
            const filterError = req.multerFilterError;
            return res.status(400).json({ message: filterError?.message || "No valid file received or file type rejected." });
        }
    
        const { path: filePath, originalname, filename: serverFilename } = req.file;
        const absoluteFilePath = path.resolve(filePath);
        const sanitizedOriginalName = originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    
        console.log(`<<< POST /api/upload successful for User '${req.user.username}'.`);
        console.log(`   Original Name (Raw from upload): '${originalname}'`);
        console.log(`   Original Name (Sanitized for use): '${sanitizedOriginalName}'`);
        console.log(`   Server Filename (Saved to disk): '${serverFilename}'`);
    
        try {
            const pythonServiceUrl = process.env.PYTHON_AI_CORE_SERVICE_URL;
            if (pythonServiceUrl) {
                const extractTopicsResponse = await axios.post(
                    `${pythonServiceUrl}/extract_topics_from_file`,
                    { file_path: absoluteFilePath }
                );
                if (extractTopicsResponse.data?.status === 'success') {
                    console.log(`Extracted topics for ${sanitizedOriginalName}:`, extractTopicsResponse.data.topics);
                } else {
                    console.warn(`Topic extraction failed for ${sanitizedOriginalName}:`, extractTopicsResponse.data);
                }
            }
        } catch (topicErr) {
            console.error(`Error extracting topics for ${sanitizedOriginalName}:`, topicErr.message || topicErr);
        }
    
        // --- Trigger Python processing asynchronously ---
        // Pass the UNIQUE SERVER FILENAME to the Python service as the identifier.     // <<< DEFINITIVE FIX: AWAIT THE RAG PROCESSING RESULT >>>
     // We now wait for the Python service to finish before responding to the client.
     try {
         // Await the result from our helper function
         const ragResult = await triggerPythonRagProcessing(userId, absoluteFilePath, serverFilename);

         // Check the result from the Python service
         if (ragResult.success) {
             // SUCCESS CASE: Python processed the file successfully.
             console.log(`RAG processing for ${serverFilename} completed with status: ${ragResult.status}`);
             return res.status(200).json({
                 message: "File uploaded and indexed successfully!",
                 filename: serverFilename,
                 originalname: sanitizedOriginalName,
                 details: ragResult.details 
             });
         } else {
             // FAILURE CASE: Python returned an error.
             console.error(`RAG processing failed for ${serverFilename}: ${ragResult.message}`);
             // Return a server error to the client, indicating the indexing failed.
             return res.status(500).json({
                 message: "File uploaded, but failed during AI processing.",
                 error: ragResult.message,
                 details: ragResult.details
             });
         }
     } catch (processingError) {
         // CATCH-ALL: For unexpected errors in the trigger function itself.
         console.error(`A critical error occurred while triggering RAG processing for ${serverFilename}:`, processingError);
         return res.status(500).json({
             message: "A critical server error occurred during file processing."
         });
     }
     // <<< END OF FIX >>>
    });
    
});

module.exports = router;