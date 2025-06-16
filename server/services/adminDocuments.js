// server/routes/adminDocuments.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Using Node.js fs for directory creation and file ops
const fsPromises = fs.promises; // For async file operations
const AdminDocument = require('../models/AdminDocument');
const { fixedAdminAuthMiddleware } = require('../middleware/fixedAdminAuthMiddleware');
const axios = require('axios'); // For calling Python RAG service

const router = express.Router();

// --- Constants for Admin Uploads ---
const ADMIN_UPLOAD_DIR_BASE = path.join(__dirname, '..', 'assets', '_admin_uploads_');
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Allowed types for admin uploads
const allowedAdminMimeTypes = {
    'application/pdf': 'docs',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docs', // docx
    'text/plain': 'docs', // txt
    'text/markdown': 'docs', // md
    // Add more as needed for admin
};
const allowedAdminExtensions = ['.pdf', '.docx', '.txt', '.md'];

// --- Multer Config for Admin Uploads ---
const adminStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const fileMimeType = file.mimetype.toLowerCase();
        const fileTypeSubfolder = allowedAdminMimeTypes[fileMimeType] || 'others'; // Default to 'others'
        const destinationPath = path.join(ADMIN_UPLOAD_DIR_BASE, fileTypeSubfolder);

        fs.mkdir(destinationPath, { recursive: true }, (err) => {
            if (err) {
                console.error(`Admin Upload Multer: Error creating destination path ${destinationPath}:`, err);
                return cb(err);
            }
            cb(null, destinationPath);
        });
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const fileExt = path.extname(file.originalname).toLowerCase();
        const sanitizedBaseName = path.basename(file.originalname, fileExt)
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .substring(0, 100); // Limit base name length
        const uniqueFilename = `${timestamp}-${sanitizedBaseName}${fileExt}`;
        cb(null, uniqueFilename);
    }
});

const adminFileFilter = (req, file, cb) => {
    const fileExt = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    const isMimeTypeAllowed = !!allowedAdminMimeTypes[mimeType];
    const isExtensionAllowed = allowedAdminExtensions.includes(fileExt);

    if (isMimeTypeAllowed && isExtensionAllowed) {
        cb(null, true);
    } else {
        console.warn(`Admin Upload Rejected (Filter): File='${file.originalname}', MIME='${mimeType}', Ext='${fileExt}'.`);
        const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE_TYPE_ADMIN');
        error.message = `Invalid file type or extension for admin upload. Allowed: ${allowedAdminExtensions.join(', ')}`;
        cb(error, false);
    }
};

const adminUpload = multer({
    storage: adminStorage,
    fileFilter: adminFileFilter,
    limits: { fileSize: MAX_FILE_SIZE }
});

// --- Helper to call Python RAG service for Admin Docs (Text Extraction Only) ---
async function triggerPythonTextExtractionForAdmin(filePath, originalName) {
    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
    if (!pythonServiceUrl) {
        console.error("ADMIN RAG: PYTHON_RAG_SERVICE_URL not set. Cannot extract text.");
        return { success: false, message: "Python service URL not configured for text extraction.", text: null };
    }
    const addDocumentUrl = `${pythonServiceUrl}/add_document`;
    console.log(`ADMIN RAG: Calling Python Service: ${addDocumentUrl} for text extraction of '${originalName}'`);

    try {
        // For admin docs, we pass a generic user_id or a specific marker.
        // The Python service might try to add to Qdrant/Neo4j with this ID.
        // If admin docs are NOT to be in the main Qdrant/Neo4j, the Python service
        // would ideally have a flag to skip DB insertions for certain user_ids/contexts.
        // For now, Node.js only cares about the returned text.
        const response = await axios.post(addDocumentUrl, {
            user_id: "fixed_admin_text_extraction_user", // A distinct ID for Python's logging/potential filtering
            file_path: filePath,
            original_name: originalName
        }, { timeout: 300000 }); // 5 min timeout

        const pythonData = response.data;
        const text = pythonData?.raw_text_for_analysis || null;

        if (text) {
            console.log(`ADMIN RAG: Text extracted successfully for '${originalName}'. Length: ${text.length}`);
            return { success: true, message: "Text extracted.", text: text };
        } else {
            console.warn(`ADMIN RAG: Python service returned no text for '${originalName}'. Status: ${pythonData?.status}, Message: ${pythonData?.message}`);
            return { success: false, message: pythonData?.message || "Python service extracted no text.", text: null };
        }
    } catch (error) {
        const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || "Unknown error calling Python RAG for text extraction.";
        console.error(`ADMIN RAG: Error calling Python service for '${originalName}': ${errorMsg}`);
        return { success: false, message: `Python RAG call failed: ${errorMsg}`, text: null };
    }
}


// --- Admin Document Routes ---

// @route   POST /api/admin/documents/upload
// @desc    Upload a document for the admin, extract text, and initiate analysis.
// @access  Admin Only (via fixedAdminAuthMiddleware)
router.post('/upload', fixedAdminAuthMiddleware, adminUpload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded or file type rejected.' });
    }

    const { filename: serverFilename, originalname: originalName, path: tempServerPath } = req.file;
    let adminDocRecord;

    try {
        // 1. Check for existing document with the same originalName
        const existingDoc = await AdminDocument.findOne({ originalName: originalName });
        if (existingDoc) {
            await fsPromises.unlink(tempServerPath).catch(e => console.error(`Admin Upload: Error deleting duplicate temp file ${tempServerPath}:`, e));
            return res.status(409).json({ message: `Document with original name '${originalName}' already exists for admin.` });
        }

        // 2. Extract text using Python RAG service
        console.log(`Admin Upload: Attempting text extraction for '${originalName}' from ${tempServerPath}`);
        const textExtractionResult = await triggerPythonTextExtractionForAdmin(tempServerPath, originalName);

        if (!textExtractionResult.success || !textExtractionResult.text || textExtractionResult.text.trim() === "") {
            await fsPromises.unlink(tempServerPath).catch(e => console.error(`Admin Upload: Error deleting temp file ${tempServerPath} after failed text extraction:`, e));
            return res.status(422).json({ // Unprocessable Entity
                message: textExtractionResult.message || "Failed to extract usable text from the document.",
                filename: serverFilename,
                originalname: originalName
            });
        }
        console.log(`Admin Upload: Text extracted for '${originalName}'. Proceeding to save and analyze.`);

        // 3. Save initial AdminDocument record
        adminDocRecord = new AdminDocument({
            filename: serverFilename,
            originalName: originalName,
            text: textExtractionResult.text,
            // serverPath and fileTypeSubfolder are not in the simplified model.
            // If we decide to keep the file, we'd need to move it from tempServerPath
            // to a final location and store that path. For now, assume tempServerPath is cleaned up.
            analysis: { faq: "", topics: "", mindmap: "" }, // Initialize analysis
            analysisUpdatedAt: null,
        });
        await adminDocRecord.save();
        console.log(`Admin Upload: Initial DB record saved for '${originalName}' (Server: ${serverFilename}).`);

        // 4. Delete the temporary file uploaded by multer as text is now in DB
        // If you decide to keep the physical file, this step would be a move operation instead.
        await fsPromises.unlink(tempServerPath).catch(e => console.error(`Admin Upload: Non-critical error deleting temp file ${tempServerPath} after DB save:`, e));


        // 5. Respond to client (202 Accepted) & Trigger Background Analysis
        res.status(202).json({
            message: `Admin document '${originalName}' uploaded. Text extracted. Analysis initiated.`,
            filename: serverFilename,
            originalname: originalName,
        });
        console.log(`Admin Upload: Sent 202 Accepted for '${originalName}'. Offloading analysis.`);

        // --- Trigger Background Analysis Worker ---
        // This requires an 'adminAnalysisWorker.js'
        const { Worker } = require('worker_threads');
        const adminAnalysisWorkerPath = path.resolve(__dirname, '..', 'workers', 'adminAnalysisWorker.js');
        
        try {
            if (fs.existsSync(adminAnalysisWorkerPath)) { // Check if worker file exists
                const worker = new Worker(adminAnalysisWorkerPath, {
                    workerData: {
                        adminDocumentId: adminDocRecord._id.toString(), // Pass ID to update the specific doc
                        originalName: originalName,
                        textForAnalysis: textExtractionResult.text
                    }
                });
                worker.on('message', (msg) => console.log(`Admin Analysis Worker [Doc: ${msg.originalName || originalName}]: ${msg.message || JSON.stringify(msg)}`));
                worker.on('error', (err) => console.error(`Admin Analysis Worker Error [Doc: ${originalName}]:`, err));
                worker.on('exit', (code) => console.log(`Admin Analysis Worker [Doc: ${originalName}] exited (code ${code}).`));
            } else {
                console.error(`Admin Upload: adminAnalysisWorker.js not found at ${adminAnalysisWorkerPath}. Analysis cannot be started.`);
                // Optionally update the AdminDocument status to 'analysis_launch_failed'
            }
        } catch (workerError) {
            console.error(`Admin Upload: Error launching Admin Analysis Worker for '${originalName}':`, workerError);
        }

    } catch (error) {
        console.error(`Admin Upload: Overall error for '${originalName || (req.file && req.file.originalname)}':`, error);
        if (tempServerPath) { // If path is known, try to clean up temp file
            await fsPromises.unlink(tempServerPath).catch(e => console.error(`Admin Upload: Error cleaning up temp file ${tempServerPath} after overall error:`, e));
        }
        if (!res.headersSent) {
            if (error.code === 11000) { // MongoDB duplicate key
                 res.status(409).json({ message: 'Document processing conflict (e.g., duplicate server filename). Please try again.' });
            } else {
                 res.status(500).json({ message: 'Server error during admin document upload processing.' });
            }
        }
    }
});

// @route   GET /api/admin/documents
// @desc    Get list of documents uploaded by the admin
// @access  Admin Only (via fixedAdminAuthMiddleware)
router.get('/', fixedAdminAuthMiddleware, async (req, res) => {
    try {
        // Fetching fields relevant for listing and identifying documents.
        // Exclude 'text' and full 'analysis' objects by default to keep payload small.
        const adminDocs = await AdminDocument.find()
            .sort({ uploadedAt: -1 })
            .select('originalName filename uploadedAt analysisUpdatedAt analysis.faq analysis.topics analysis.mindmap'); // Select specific fields

        const documentsList = adminDocs.map(doc => ({
            originalName: doc.originalName,
            serverFilename: doc.filename, // Useful if frontend needs to make further requests (e.g., delete)
            uploadedAt: doc.uploadedAt,
            analysisUpdatedAt: doc.analysisUpdatedAt,
            hasFaq: !!(doc.analysis && doc.analysis.faq && doc.analysis.faq.trim() !== ""),
            hasTopics: !!(doc.analysis && doc.analysis.topics && doc.analysis.topics.trim() !== ""),
            hasMindmap: !!(doc.analysis && doc.analysis.mindmap && doc.analysis.mindmap.trim() !== ""),
        }));

        // For frontend compatibility with existing DocumentList component,
        // it might expect an array of strings (originalName).
        // If so, change `res.json({ documents: documentsList });` to
        // `res.json({ filenames: documentsList.map(d => d.originalName) });`
        // However, sending more info like `documentsList` is generally more useful.
        res.json({ documents: documentsList });

    } catch (error) {
        console.error('Admin List Documents Error:', error);
        res.status(500).json({ message: 'Server error fetching admin documents.' });
    }
});

// @route   DELETE /api/admin/documents/:serverFilename
// @desc    Delete a document uploaded by the admin (DB record only for simplified model)
// @access  Admin Only (via fixedAdminAuthMiddleware)
router.delete('/:serverFilename', fixedAdminAuthMiddleware, async (req, res) => {
    const { serverFilename } = req.params;

    if (!serverFilename) {
        return res.status(400).json({ message: 'Server filename parameter is required for deletion.' });
    }

    try {
        const docToDelete = await AdminDocument.findOneAndDelete({ filename: serverFilename });

        if (!docToDelete) {
            return res.status(404).json({ message: `Admin document with server name '${serverFilename}' not found.` });
        }

        console.log(`Admin Delete: Document record '${docToDelete.originalName}' (Server: ${serverFilename}) deleted from MongoDB.`);
        
        // Since we are not storing serverPath in the simplified model and deleting temp files after text extraction,
        // there's no physical file to delete from 'assets/_admin_uploads_' based on DB record alone at this stage.
        // If, in the future, you decide to *keep* admin-uploaded files, you'd add file deletion logic here
        // and would need to store `serverPath` in AdminDocument model.

        // TODO (Future): If admin documents were processed by Qdrant/Neo4j,
        // trigger deletion from those services here.

        res.status(200).json({ message: `Admin document '${docToDelete.originalName}' record deleted successfully.` });

    } catch (error) {
        console.error(`Admin Delete Error for serverFilename '${serverFilename}':`, error);
        res.status(500).json({ message: 'Server error during admin document deletion.' });
    }
});


// @route   GET /api/admin/documents/:serverFilename/analysis
// @desc    Get analysis data for a specific admin document
// @access  Admin Only
router.get('/:serverFilename/analysis', fixedAdminAuthMiddleware, async (req, res) => {
    const { serverFilename } = req.params;
    if (!serverFilename) {
        return res.status(400).json({ message: 'Server filename parameter is required.' });
    }

    try {
        const adminDoc = await AdminDocument.findOne({ filename: serverFilename }).select('originalName analysis analysisUpdatedAt');
        if (!adminDoc) {
            return res.status(404).json({ message: `Admin document '${serverFilename}' not found.` });
        }
        if (!adminDoc.analysis || 
            (!adminDoc.analysis.faq && !adminDoc.analysis.topics && !adminDoc.analysis.mindmap)) {
            return res.status(200).json({ 
                originalName: adminDoc.originalName,
                message: 'Analysis has not been generated or is empty for this document.',
                analysis: { faq: "", topics: "", mindmap: "" }, // Return empty structure
                analysisUpdatedAt: adminDoc.analysisUpdatedAt
            });
        }
        res.status(200).json({
            originalName: adminDoc.originalName,
            analysis: adminDoc.analysis, // Contains faq, topics, mindmap strings
            analysisUpdatedAt: adminDoc.analysisUpdatedAt
        });
    } catch (error) {
        console.error(`Error fetching analysis for admin document '${serverFilename}':`, error);
        res.status(500).json({ message: 'Server error while retrieving admin document analysis.' });
    }
});


module.exports = router;